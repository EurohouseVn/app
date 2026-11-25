import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApplyStocktakeInput,
  CreateStocktakeInput,
  NppGlassStockKind,
  NppStocktakeItem,
  NppStocktakeStatus,
  NppStocktakeSummary,
  StocktakeLine,
  StocktakeScanInput,
  StocktakeScanResult,
} from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';
import { parseGlassBarcode } from './glass-barcode';

const KINDS: NppGlassStockKind[] = ['SHEET', 'REMNANT', 'CUT_PIECE'];

type StocktakeRow = { id: string; nppOrgId: string; name: string; location: string; status: string; createdAt: Date; appliedAt: Date | null };
type ScanRow = { barcode: string; kind: string; location: string; quantity: number; deviceSessionId: string | null };
type StockRow = { id: string; barcode: string; kind: string; location: string; quantity: number };

const keyOf = (barcode: string, kind: string, location: string) => `${barcode}|${kind}|${location}`;

/** Lý do ghi vào sổ: tên đợt, thêm tiền tố "Kiểm kê" khi tên chưa có để người đọc sổ biết đây là điều chỉnh do kiểm kê. */
function ledgerReason(stocktake: { id: string; name: string }): string {
  const name = stocktake.name.trim();
  if (!name) return `Kiểm kê ${stocktake.id}`;
  return /^kiểm kê/i.test(name) ? name : `Kiểm kê · ${name}`;
}

function toItem(row: StocktakeRow): NppStocktakeItem {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    status: row.status as NppStocktakeStatus,
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : undefined,
  };
}

/**
 * Kiểm kê kính bằng điện thoại: nhiều máy cùng quét vào một đợt, số đếm cộng dồn theo (mã, loại hàng, vị trí),
 * máy tính xem đối chiếu với kho rồi bấm Áp dụng thì kho mới đổi (docs/design/NPP_GLASS_BARCODE_STOCK_DESIGN.md mục 6).
 */
@Injectable()
export class NppStocktakeService {
  constructor(private readonly prisma: PrismaService) {}

  async createStocktake(nppOrgId: string, actorId: string, input: CreateStocktakeInput): Promise<NppStocktakeItem> {
    const row = (await this.prisma.nppStocktake.create({
      data: { nppOrgId, name: input.name?.trim().slice(0, 120) ?? '', location: input.location?.trim() ?? '', createdById: actorId },
    })) as StocktakeRow;
    return toItem(row);
  }

  async listStocktakes(nppOrgId: string): Promise<NppStocktakeItem[]> {
    const rows = (await this.prisma.nppStocktake.findMany({ where: { nppOrgId }, orderBy: { createdAt: 'desc' }, take: 30 })) as StocktakeRow[];
    return rows.map(toItem);
  }

  private async load(nppOrgId: string, id: string): Promise<StocktakeRow> {
    const row = (await this.prisma.nppStocktake.findFirst({ where: { id, nppOrgId } })) as StocktakeRow | null;
    if (!row) throw new NotFoundException('Không tìm thấy đợt kiểm kê.');
    return row;
  }

  async addScan(nppOrgId: string, actorId: string, deviceSessionId: string | undefined, stocktakeId: string, input: StocktakeScanInput): Promise<StocktakeScanResult> {
    const key = input.idempotencyKey?.trim();
    if (!key) throw new BadRequestException('Thiếu mã chống ghi trùng (idempotencyKey).');
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity === 0) throw new BadRequestException('Số lượng phải là số nguyên khác 0.');
    const parsed = parseGlassBarcode(input.barcode);
    if (!parsed) throw new BadRequestException('Mã vạch không đúng dạng MÃĐẦU-RỘNG-CAO.');
    if (input.kind !== undefined && !KINDS.includes(input.kind)) throw new BadRequestException('Loại hàng kính không hợp lệ.');
    const barcode = `${parsed.prefix}-${String(parsed.shortMm).padStart(4, '0')}-${String(parsed.longMm).padStart(4, '0')}`;

    const stocktake = await this.load(nppOrgId, stocktakeId);
    if (stocktake.status !== 'OPEN') throw new BadRequestException('Đợt kiểm kê đã kết thúc, không quét thêm được.');
    const location = input.location !== undefined ? input.location.trim() : stocktake.location;

    // Loại hàng: người dùng chọn thì dùng; không thì suy ra từ kho và các lần đã quét; nhiều loại thì hỏi lại.
    let kind = input.kind;
    if (!kind) {
      const rows = (await this.prisma.nppGlassSheet.findMany({ where: { nppOrgId, barcode, location } })) as StockRow[];
      const scanned = (await this.prisma.nppStocktakeScan.findMany({ where: { stocktakeId, barcode, location } })) as ScanRow[];
      const kinds = [...new Set([...rows.map((r) => r.kind), ...scanned.map((s) => s.kind)])] as NppGlassStockKind[];
      if (kinds.length > 1) {
        throw new ConflictException({ statusCode: 409, code: 'AMBIGUOUS_KIND', message: `Mã ${barcode} có nhiều loại hàng ở ${location || 'kho'}. Hãy chọn loại.`, kinds });
      }
      kind = kinds[0] ?? 'SHEET';
    }

    const existing = (await this.prisma.nppStocktakeScan.findMany({ where: { stocktakeId, barcode, kind, location } })) as ScanRow[];
    const before = existing.reduce((sum, s) => sum + s.quantity, 0);
    if (before + quantity < 0) throw new BadRequestException(`Chưa quét đủ để hoàn tác: ${barcode} mới đếm được ${before}.`);
    let counted = before + quantity;
    try {
      await this.prisma.nppStocktakeScan.create({
        data: { stocktakeId, nppOrgId, barcode, kind, location, quantity, deviceSessionId: deviceSessionId ?? null, actorId, idempotencyKey: key },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      counted = before; // lần quét này đã được ghi từ trước (gửi lại): không cộng thêm
    }
    return { barcode, kind, location, counted };
  }

  private async computeLines(db: PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0], stocktake: StocktakeRow): Promise<{ lines: StocktakeLine[]; scans: ScanRow[] }> {
    const scans = (await db.nppStocktakeScan.findMany({ where: { stocktakeId: stocktake.id } })) as ScanRow[];
    const stockRows = ((await db.nppGlassSheet.findMany({ where: { nppOrgId: stocktake.nppOrgId, ...(stocktake.location ? { location: stocktake.location } : {}) } })) as StockRow[])
      .filter((row) => !row.barcode.startsWith('LEGACY-'));

    const counted = new Map<string, { barcode: string; kind: string; location: string; total: number }>();
    for (const scan of scans) {
      const key = keyOf(scan.barcode, scan.kind, scan.location);
      const entry = counted.get(key) ?? { barcode: scan.barcode, kind: scan.kind, location: scan.location, total: 0 };
      entry.total += scan.quantity;
      counted.set(key, entry);
    }
    const system = new Map(stockRows.map((row) => [keyOf(row.barcode, row.kind, row.location), row]));
    const keys = new Set([...counted.keys(), ...system.keys()]);
    const lines: StocktakeLine[] = [];
    for (const key of keys) {
      const c = counted.get(key);
      const s = system.get(key);
      const barcode = c?.barcode ?? s!.barcode;
      const parsed = parseGlassBarcode(barcode);
      const total = c?.total ?? 0;
      lines.push({
        barcode,
        kind: (c?.kind ?? s!.kind) as NppGlassStockKind,
        location: c?.location ?? s!.location,
        widthMm: parsed?.shortMm ?? 0,
        heightMm: parsed?.longMm ?? 0,
        system: s?.quantity ?? 0,
        counted: total,
        delta: total - (s?.quantity ?? 0),
        scanned: !!c,
      });
    }
    lines.sort((a, b) => a.barcode.localeCompare(b.barcode) || a.kind.localeCompare(b.kind) || a.location.localeCompare(b.location));
    return { lines, scans };
  }

  async getSummary(nppOrgId: string, id: string): Promise<NppStocktakeSummary> {
    const stocktake = await this.load(nppOrgId, id);
    const { lines, scans } = await this.computeLines(this.prisma, stocktake);
    return {
      ...toItem(stocktake),
      lines,
      scanCount: scans.length,
      deviceCount: new Set(scans.map((s) => s.deviceSessionId).filter((v): v is string => !!v)).size,
      differenceCount: lines.filter((l) => l.scanned && l.delta !== 0).length,
    };
  }

  /**
   * Áp dụng kết quả: kho được đưa về số đã đếm, mỗi chênh lệch là một dòng ADJUST trong sổ. Áp dụng lần hai trả lại kết quả cũ.
   * Dòng nào trong phạm vi mà không ai quét chỉ bị đưa về 0 khi chọn zeroUnscanned.
   */
  async applyStocktake(nppOrgId: string, actorId: string, id: string, input: ApplyStocktakeInput): Promise<NppStocktakeSummary> {
    const stocktake = await this.load(nppOrgId, id);
    if (stocktake.status === 'APPLIED') return this.getSummary(nppOrgId, id);
    if (stocktake.status === 'CANCELLED') throw new BadRequestException('Đợt kiểm kê đã hủy, không áp dụng được.');
    for (let attempt = 1; ; attempt++) {
      try {
        await this.applyOnce(nppOrgId, actorId, stocktake, input.zeroUnscanned === true);
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt >= 4) throw error;
      }
    }
    return this.getSummary(nppOrgId, id);
  }

  private applyOnce(nppOrgId: string, actorId: string, stocktake: StocktakeRow, zeroUnscanned: boolean): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.nppStocktake.updateMany({ where: { id: stocktake.id, nppOrgId, status: 'OPEN' }, data: { status: 'APPLIED', appliedById: actorId, appliedAt: new Date() } });
      if (claimed.count === 0) {
        const current = (await tx.nppStocktake.findFirst({ where: { id: stocktake.id, nppOrgId } })) as StocktakeRow | null;
        if (current?.status === 'APPLIED') return;
        throw new BadRequestException('Đợt kiểm kê không còn ở trạng thái mở.');
      }
      const { lines } = await this.computeLines(tx, stocktake);
      for (const line of lines) {
        if (!line.scanned && !zeroUnscanned) continue;
        const row = (await tx.nppGlassSheet.findUnique({ where: { nppOrgId_barcode_kind_location: { nppOrgId, barcode: line.barcode, kind: line.kind, location: line.location } } })) as StockRow | null;
        const current = row?.quantity ?? 0;
        const delta = line.counted - current;
        if (delta === 0) continue;
        let stockId: string;
        if (row) {
          const updated = delta > 0
            ? await tx.nppGlassSheet.updateMany({ where: { id: row.id, nppOrgId }, data: { quantity: { increment: delta } } })
            : await tx.nppGlassSheet.updateMany({ where: { id: row.id, nppOrgId, quantity: { gte: -delta } }, data: { quantity: { decrement: -delta } } });
          if (updated.count === 0) throw new ConflictException(`Tồn kho ${line.barcode} vừa thay đổi trong lúc áp dụng, hãy áp dụng lại.`);
          stockId = row.id;
        } else {
          const prefix = line.barcode.split('-')[0];
          const scheme = (await tx.nppBarcodeScheme.findFirst({ where: { nppOrgId, prefix } })) as { id: string; glassType: string } | null;
          const created = (await tx.nppGlassSheet.create({
            data: {
              nppOrgId, code: line.barcode, glassType: scheme?.glassType ?? '', widthMm: line.widthMm, heightMm: line.heightMm, quantity: line.counted,
              unitCost: 0, note: `Từ kiểm kê ${stocktake.id}`, schemeId: scheme?.id ?? null, kind: line.kind, location: line.location, barcode: line.barcode,
            },
          })) as StockRow;
          stockId = created.id;
        }
        await tx.nppGlassMovement.create({
          data: {
            nppOrgId, stockId, type: 'ADJUST', quantity: Math.abs(delta), direction: delta > 0 ? 'IN' : 'OUT', reason: ledgerReason(stocktake), actorId,
            idempotencyKey: `stocktake:${stocktake.id}:${line.barcode}:${line.kind}:${line.location}`,
          },
        });
      }
    });
  }

  async cancelStocktake(nppOrgId: string, id: string): Promise<NppStocktakeItem> {
    const stocktake = await this.load(nppOrgId, id);
    if (stocktake.status === 'APPLIED') throw new BadRequestException('Đợt kiểm kê đã áp dụng, không hủy được.');
    if (stocktake.status === 'CANCELLED') return toItem(stocktake);
    await this.prisma.nppStocktake.updateMany({ where: { id, nppOrgId, status: 'OPEN' }, data: { status: 'CANCELLED' } });
    return toItem(await this.load(nppOrgId, id));
  }
}
