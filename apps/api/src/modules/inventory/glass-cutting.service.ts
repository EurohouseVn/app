import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateNppCutPlanInput,
  GlassCutPieceInput,
  NppCutPlanEffectLine,
  NppCutPlanEffects,
  NppCutPlanItem,
  NppCutPlanResultData,
  NppCutPlanStatus,
  NppGlassStockKind,
} from '@eurohouse/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildGlassBarcode } from './glass-barcode';
import { DEFAULT_CUT_OPTIONS, planGlassCutting, type CutOptions, type CutSource } from './glass-cutting';

type SchemeRow = { id: string; prefix: string; glassType: string; active: boolean };
type StockRow = { id: string; widthMm: number; heightMm: number; quantity: number; kind: string; location: string; barcode: string };
type PlanRow = {
  id: string; status: string; schemeId: string; orderRef: string; note: string; options: unknown; pieces: unknown; result: unknown;
  createdAt: Date; confirmedAt: Date | null;
};

function badRequest(error: unknown): never {
  if (error instanceof BadRequestException) throw error;
  throw new BadRequestException(error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.');
}

function resolveOptions(input?: CreateNppCutPlanInput['options']): Required<NonNullable<CreateNppCutPlanInput['options']>> {
  return {
    kerfMm: input?.kerfMm ?? DEFAULT_CUT_OPTIONS.kerfMm,
    trimMm: input?.trimMm ?? DEFAULT_CUT_OPTIONS.trimMm,
    minRemnantMm: input?.minRemnantMm ?? DEFAULT_CUT_OPTIONS.minRemnantMm,
    allowRotation: input?.allowRotation ?? DEFAULT_CUT_OPTIONS.allowRotation,
  };
}

function addLine(map: Map<string, NppCutPlanEffectLine>, barcode: string, widthMm: number, heightMm: number, location: string, quantity: number) {
  const key = `${barcode}|${location}`;
  const current = map.get(key);
  if (current) current.quantity += quantity;
  else map.set(key, { barcode, widthMm: Math.min(widthMm, heightMm), heightMm: Math.max(widthMm, heightMm), quantity, location });
}

/** Phương án cắt kính: tính và lưu nháp, chốt cắt (trừ kho, sinh tấm dư và tấm cắt), hủy nháp. */
@Injectable()
export class NppGlassCuttingService {
  constructor(private readonly prisma: PrismaService) {}

  private toItem(row: PlanRow, prefix: string): NppCutPlanItem {
    return {
      id: row.id,
      status: row.status as NppCutPlanStatus,
      schemeId: row.schemeId,
      schemePrefix: prefix,
      orderRef: row.orderRef,
      note: row.note,
      options: row.options as NppCutPlanItem['options'],
      pieces: row.pieces as GlassCutPieceInput[],
      result: row.result as NppCutPlanResultData,
      createdAt: row.createdAt.toISOString(),
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : undefined,
    };
  }

  private async schemePrefix(schemeId: string): Promise<string> {
    const scheme = (await this.prisma.nppBarcodeScheme.findFirst({ where: { id: schemeId } })) as SchemeRow | null;
    return scheme?.prefix ?? '';
  }

  async createPlan(nppOrgId: string, actorId: string, input: CreateNppCutPlanInput): Promise<NppCutPlanItem> {
    if (!Array.isArray(input.pieces) || input.pieces.length === 0) throw new BadRequestException('Cần ít nhất một kích thước cần cắt.');
    const scheme = (await this.prisma.nppBarcodeScheme.findFirst({ where: { id: input.schemeId, nppOrgId } })) as SchemeRow | null;
    if (!scheme) throw new NotFoundException('Không tìm thấy mã đầu.');
    if (!scheme.active) throw new BadRequestException(`Mã đầu ${scheme.prefix} đã ngừng dùng.`);

    const rows = (await this.prisma.nppGlassSheet.findMany({
      where: { nppOrgId, schemeId: scheme.id, kind: { in: ['SHEET', 'REMNANT'] }, quantity: { gt: 0 } },
      orderBy: [{ barcode: 'asc' }],
    })) as StockRow[];
    const sources: CutSource[] = rows.map((row) => ({ id: row.id, widthMm: row.widthMm, heightMm: row.heightMm, quantity: row.quantity, kind: row.kind as NppGlassStockKind }));
    const options = resolveOptions(input.options);

    let planned;
    try {
      planned = planGlassCutting(input.pieces, sources, options as CutOptions);
    } catch (error) {
      return badRequest(error);
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    const result: NppCutPlanResultData = {
      sheets: planned.sheets.map((sheet) => ({
        ...sheet,
        sourceBarcode: byId.get(sheet.sourceId)?.barcode ?? '',
        sourceLocation: byId.get(sheet.sourceId)?.location ?? '',
      })),
      unplaced: planned.unplaced,
      totals: planned.totals,
    };
    const saved = (await this.prisma.nppCutPlan.create({
      data: {
        nppOrgId,
        schemeId: scheme.id,
        orderRef: input.orderRef?.trim() ?? '',
        note: input.note?.trim() ?? '',
        options: options as unknown as Prisma.InputJsonValue,
        pieces: input.pieces as unknown as Prisma.InputJsonValue,
        result: result as unknown as Prisma.InputJsonValue,
        sheetsUsed: planned.totals.sheetsUsed,
        piecesPlaced: planned.totals.piecesPlaced,
        unplacedCount: planned.unplaced.length,
        wastePercent: planned.totals.wastePercent,
        createdById: actorId,
      },
    })) as PlanRow;
    return this.toItem(saved, scheme.prefix);
  }

  async listPlans(nppOrgId: string, status?: NppCutPlanStatus): Promise<NppCutPlanItem[]> {
    const rows = (await this.prisma.nppCutPlan.findMany({ where: { nppOrgId, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 })) as PlanRow[];
    const schemes = (await this.prisma.nppBarcodeScheme.findMany({ where: { nppOrgId } })) as SchemeRow[];
    const prefixes = new Map(schemes.map((s) => [s.id, s.prefix]));
    return rows.map((row) => this.toItem(row, prefixes.get(row.schemeId) ?? ''));
  }

  async getPlan(nppOrgId: string, id: string): Promise<NppCutPlanItem> {
    const row = (await this.prisma.nppCutPlan.findFirst({ where: { id, nppOrgId } })) as PlanRow | null;
    if (!row) throw new NotFoundException('Không tìm thấy phương án cắt.');
    return this.toItem(row, await this.schemePrefix(row.schemeId));
  }

  async cancelPlan(nppOrgId: string, id: string): Promise<NppCutPlanItem> {
    const plan = await this.getPlan(nppOrgId, id);
    if (plan.status === 'CANCELLED') return plan;
    if (plan.status === 'CONFIRMED') throw new BadRequestException('Phương án đã chốt cắt, không hủy được.');
    await this.prisma.nppCutPlan.updateMany({ where: { id, nppOrgId, status: 'DRAFT' }, data: { status: 'CANCELLED' } });
    return this.getPlan(nppOrgId, id);
  }

  /**
   * Chốt cắt trong một giao dịch: trừ tấm đã dùng (chỉ khi còn đủ), cộng tấm dư và tấm cắt, ghi sổ nhập xuất.
   * Chốt lần hai trả lại kết quả cũ. Gặp lỗi trùng khóa do yêu cầu khác chốt cùng lúc thì chạy lại giao dịch.
   */
  async confirmPlan(nppOrgId: string, actorId: string, id: string): Promise<NppCutPlanItem> {
    const plan = await this.getPlan(nppOrgId, id);
    if (plan.status === 'CONFIRMED') return plan;
    if (plan.status === 'CANCELLED') throw new BadRequestException('Phương án đã hủy, không chốt được.');
    if (plan.result.unplaced.length > 0) {
      throw new BadRequestException(`Còn ${plan.result.unplaced.length} tấm chưa xếp được. Sửa danh sách cần cắt hoặc nhập thêm kính rồi tính lại.`);
    }
    const scheme = (await this.prisma.nppBarcodeScheme.findFirst({ where: { id: plan.schemeId, nppOrgId } })) as SchemeRow | null;
    if (!scheme) throw new NotFoundException('Không tìm thấy mã đầu.');

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.confirmOnce(nppOrgId, actorId, plan, scheme);
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt >= 4) throw error;
      }
    }
  }

  private confirmOnce(nppOrgId: string, actorId: string, plan: NppCutPlanItem, scheme: SchemeRow): Promise<NppCutPlanItem> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.nppCutPlan.updateMany({ where: { id: plan.id, nppOrgId, status: 'DRAFT' }, data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: new Date() } });
      if (claimed.count === 0) {
        const current = (await tx.nppCutPlan.findFirst({ where: { id: plan.id, nppOrgId } })) as PlanRow | null;
        if (current?.status === 'CONFIRMED') return this.toItem(current, scheme.prefix);
        throw new BadRequestException('Phương án không còn ở trạng thái nháp.');
      }

      const consumed = new Map<string, NppCutPlanEffectLine>();
      const remnants = new Map<string, NppCutPlanEffectLine>();
      const pieces = new Map<string, NppCutPlanEffectLine>();
      const usedBySource = new Map<string, { count: number; barcode: string; location: string }>();

      for (const sheet of plan.result.sheets) {
        const used = usedBySource.get(sheet.sourceId);
        usedBySource.set(sheet.sourceId, { count: (used?.count ?? 0) + 1, barcode: sheet.sourceBarcode, location: sheet.sourceLocation });
        addLine(consumed, sheet.sourceBarcode, sheet.widthMm, sheet.heightMm, sheet.sourceLocation, 1);
        for (const remnant of sheet.remnants) {
          addLine(remnants, buildGlassBarcode(scheme.prefix, remnant.widthMm, remnant.heightMm), remnant.widthMm, remnant.heightMm, sheet.sourceLocation, 1);
        }
        for (const placement of sheet.placements) {
          addLine(pieces, buildGlassBarcode(scheme.prefix, placement.widthMm, placement.heightMm), placement.widthMm, placement.heightMm, sheet.sourceLocation, 1);
        }
      }

      // 1) Trừ tấm đã dùng, chỉ khi tồn còn đủ (điều kiện nằm trong câu cập nhật nên không trừ âm khi có yêu cầu khác chen vào).
      for (const [sourceId, usage] of usedBySource) {
        const updated = await tx.nppGlassSheet.updateMany({ where: { id: sourceId, nppOrgId, quantity: { gte: usage.count } }, data: { quantity: { decrement: usage.count } } });
        if (updated.count === 0) throw new ConflictException(`Tồn kính ${usage.barcode || sourceId} đã thay đổi, không còn đủ ${usage.count} tấm. Hãy tính lại phương án.`);
        await tx.nppGlassMovement.create({
          data: { nppOrgId, stockId: sourceId, type: 'CUT', quantity: usage.count, direction: 'OUT', reason: `Chốt cắt ${plan.id}`, actorId, idempotencyKey: `cut:${plan.id}:src:${sourceId}` },
        });
      }

      // 2) Cộng tấm dư và tấm cắt vào kho (cùng vị trí với tấm nguồn).
      const add = async (line: NppCutPlanEffectLine, kind: NppGlassStockKind, type: string, tag: string) => {
        const existing = (await tx.nppGlassSheet.findUnique({ where: { nppOrgId_barcode_kind_location: { nppOrgId, barcode: line.barcode, kind, location: line.location } } })) as StockRow | null;
        const stock = existing
          ? ((await tx.nppGlassSheet.update({ where: { id: existing.id }, data: { quantity: { increment: line.quantity } } })) as StockRow)
          : ((await tx.nppGlassSheet.create({
              data: {
                nppOrgId, code: line.barcode, glassType: scheme.glassType, widthMm: line.widthMm, heightMm: line.heightMm, quantity: line.quantity,
                unitCost: 0, note: `Từ phương án cắt ${plan.id}`, schemeId: scheme.id, kind, location: line.location, barcode: line.barcode,
              },
            })) as StockRow);
        await tx.nppGlassMovement.create({
          data: { nppOrgId, stockId: stock.id, type, quantity: line.quantity, direction: 'IN', reason: `Chốt cắt ${plan.id}`, actorId, idempotencyKey: `cut:${plan.id}:${tag}:${line.barcode}:${line.location}` },
        });
      };
      for (const line of remnants.values()) await add(line, 'REMNANT', 'REMNANT_IN', 'rem');
      for (const line of pieces.values()) await add(line, 'CUT_PIECE', 'CUT_IN', 'pcs');

      const effects: NppCutPlanEffects = { consumed: [...consumed.values()], remnants: [...remnants.values()], pieces: [...pieces.values()] };
      const updatedPlan = (await tx.nppCutPlan.update({ where: { id: plan.id }, data: { result: { ...plan.result, effects } as unknown as Prisma.InputJsonValue } })) as PlanRow;
      return this.toItem(updatedPlan, scheme.prefix);
    });
  }
}
