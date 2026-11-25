import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EnqueuePrintJobInput, NppPrintJobItem, NppPrintJobStatus, NppPrintJobWithLabels, PrintLabelData } from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';
import { parseGlassBarcode } from './glass-barcode';

/** Trạm in được coi là trực tuyến nếu đã hỏi lệnh in trong 15 giây qua (trang Trạm in hỏi mỗi 3 giây). */
export const STATION_ONLINE_MS = 15_000;
/** Lệnh đã giao cho một trạm nhưng 2 phút chưa báo xong (máy tắt giữa chừng) sẽ được giao lại. */
export const STALE_CLAIM_MS = 120_000;
export const MAX_LABELS_PER_JOB = 500;

type JobRow = {
  id: string; status: string; labels: unknown; labelCount: number; error: string; createdAt: Date; printedAt: Date | null;
};

function toItem(row: JobRow, stationOnline?: boolean): NppPrintJobItem {
  return {
    id: row.id,
    status: row.status as NppPrintJobStatus,
    labelCount: row.labelCount,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    printedAt: row.printedAt ? row.printedAt.toISOString() : undefined,
    ...(stationOnline === undefined ? {} : { stationOnline }),
  };
}

function cleanLabels(input: PrintLabelData[]): PrintLabelData[] {
  if (!Array.isArray(input) || input.length === 0) throw new BadRequestException('Cần ít nhất một nhãn để in.');
  if (input.length > MAX_LABELS_PER_JOB) throw new BadRequestException(`Mỗi lệnh in tối đa ${MAX_LABELS_PER_JOB} nhãn.`);
  return input.map((label) => {
    const parsed = parseGlassBarcode(label.barcode);
    if (!parsed) throw new BadRequestException(`Mã vạch không đúng dạng MÃĐẦU-RỘNG-CAO: ${String(label.barcode).slice(0, 30)}`);
    const sides = [label.widthMm, label.heightMm];
    if (!sides.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 99999)) throw new BadRequestException('Kích thước trên nhãn không hợp lệ.');
    const text = (value?: string) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 60) : undefined);
    return {
      barcode: `${parsed.prefix}-${String(parsed.shortMm).padStart(4, '0')}-${String(parsed.longMm).padStart(4, '0')}`,
      widthMm: label.widthMm,
      heightMm: label.heightMm,
      glassType: text(label.glassType),
      location: text(label.location),
      kindLabel: text(label.kindLabel),
    };
  });
}

/** Hàng đợi in nhãn giữa điện thoại và "trạm in" (máy tính nối máy in tem). */
@Injectable()
export class NppPrintService {
  constructor(private readonly prisma: PrismaService) {}

  async stationOnline(nppOrgId: string): Promise<boolean> {
    const station = await this.prisma.nppPrintStation.findFirst({ where: { nppOrgId, lastSeenAt: { gt: new Date(Date.now() - STATION_ONLINE_MS) } } });
    return !!station;
  }

  async enqueue(nppOrgId: string, actorId: string, sessionId: string | undefined, input: EnqueuePrintJobInput): Promise<NppPrintJobItem> {
    const labels = cleanLabels(input.labels);
    const row = (await this.prisma.nppPrintJob.create({
      data: { nppOrgId, createdById: actorId, sourceSessionId: sessionId ?? null, labels: labels as unknown as Prisma.InputJsonValue, labelCount: labels.length },
    })) as JobRow;
    return toItem(row, await this.stationOnline(nppOrgId));
  }

  /** Trạm in hỏi lệnh mới: ghi nhận trạm còn sống, nhả lại các lệnh bị bỏ dở, rồi giao lệnh cũ nhất (mỗi lệnh chỉ cho một trạm). */
  async poll(nppOrgId: string, sessionId: string | undefined): Promise<{ job: NppPrintJobWithLabels | null }> {
    await this.prisma.nppPrintStation.upsert({
      where: { nppOrgId_deviceSessionId: { nppOrgId, deviceSessionId: sessionId ?? 'unknown' } },
      create: { nppOrgId, deviceSessionId: sessionId ?? 'unknown', lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    await this.prisma.nppPrintJob.updateMany({
      where: { nppOrgId, status: 'CLAIMED', claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
      data: { status: 'QUEUED', claimedBySessionId: null, claimedAt: null },
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      const next = (await this.prisma.nppPrintJob.findFirst({ where: { nppOrgId, status: 'QUEUED' }, orderBy: { createdAt: 'asc' } })) as JobRow | null;
      if (!next) return { job: null };
      const claimed = await this.prisma.nppPrintJob.updateMany({
        where: { id: next.id, nppOrgId, status: 'QUEUED' },
        data: { status: 'CLAIMED', claimedBySessionId: sessionId ?? 'unknown', claimedAt: new Date() },
      });
      if (claimed.count === 1) return { job: { ...toItem({ ...next, status: 'CLAIMED' }), labels: next.labels as PrintLabelData[] } };
    }
    return { job: null };
  }

  async getJob(nppOrgId: string, id: string): Promise<NppPrintJobItem> {
    const row = (await this.prisma.nppPrintJob.findFirst({ where: { id, nppOrgId } })) as JobRow | null;
    if (!row) throw new NotFoundException('Không tìm thấy lệnh in.');
    return toItem(row);
  }

  async complete(nppOrgId: string, id: string, result: { ok: boolean; error?: string }): Promise<NppPrintJobItem> {
    const row = (await this.prisma.nppPrintJob.findFirst({ where: { id, nppOrgId } })) as JobRow | null;
    if (!row) throw new NotFoundException('Không tìm thấy lệnh in.');
    if (row.status === 'PRINTED' || row.status === 'FAILED') return toItem(row);
    if (row.status === 'QUEUED') throw new BadRequestException('Lệnh in chưa được trạm in nhận.');
    await this.prisma.nppPrintJob.updateMany({
      where: { id, nppOrgId, status: 'CLAIMED' },
      data: { status: result.ok ? 'PRINTED' : 'FAILED', printedAt: result.ok ? new Date() : null, error: result.ok ? '' : (result.error ?? 'Lỗi in').slice(0, 200) },
    });
    return this.getJob(nppOrgId, id);
  }

  async listJobs(nppOrgId: string): Promise<NppPrintJobItem[]> {
    const rows = (await this.prisma.nppPrintJob.findMany({ where: { nppOrgId }, orderBy: { createdAt: 'desc' }, take: 20 })) as JobRow[];
    return rows.map((row) => toItem(row));
  }
}
