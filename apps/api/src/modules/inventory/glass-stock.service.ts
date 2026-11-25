import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  NppBarcodeSchemeItem,
  NppGlassSheetItem,
  NppGlassStockKind,
  ReceiveNppGlassStockInput,
  ScanGlassStockInput,
  UpsertNppBarcodeSchemeInput,
} from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';
import { buildGlassBarcode, normalizeBarcodePrefix, parseGlassBarcode } from './glass-barcode';

const KINDS: NppGlassStockKind[] = ['SHEET', 'REMNANT', 'CUT_PIECE'];

type SchemeRow = { id: string; prefix: string; label: string; glassType: string; thicknessMm: number | null; active: boolean };
type StockRow = {
  id: string; code: string; glassType: string; widthMm: number; heightMm: number; quantity: number; unitCost: number;
  note: string; createdAt: Date; barcode: string; kind: string; location: string; schemeId: string | null;
};

function toSchemeItem(row: SchemeRow): NppBarcodeSchemeItem {
  return { id: row.id, prefix: row.prefix, label: row.label, glassType: row.glassType, thicknessMm: row.thicknessMm, active: row.active };
}

function toStockItem(row: StockRow): NppGlassSheetItem {
  return {
    id: row.id,
    code: row.code,
    glassType: row.glassType,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    quantity: row.quantity,
    unitCost: row.unitCost,
    note: row.note || undefined,
    createdAt: row.createdAt.toISOString(),
    barcode: row.barcode,
    kind: row.kind as NppGlassStockKind,
    location: row.location,
    schemeId: row.schemeId,
  };
}

function asBadRequest(error: unknown): never {
  if (error instanceof BadRequestException) throw error;
  throw new BadRequestException(error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.');
}

/** Mã đầu mã vạch, kho kính theo mã vạch và sổ nhập xuất kính của NPP (giai đoạn 1 của NPP_GLASS_BARCODE_STOCK_DESIGN.md). */
@Injectable()
export class NppGlassStockService {
  constructor(private readonly prisma: PrismaService) {}

  async listSchemes(nppOrgId: string): Promise<NppBarcodeSchemeItem[]> {
    const rows = (await this.prisma.nppBarcodeScheme.findMany({ where: { nppOrgId }, orderBy: { prefix: 'asc' } })) as SchemeRow[];
    return rows.map(toSchemeItem);
  }

  async createScheme(nppOrgId: string, input: UpsertNppBarcodeSchemeInput): Promise<NppBarcodeSchemeItem> {
    let prefix: string;
    try {
      prefix = normalizeBarcodePrefix(input.prefix ?? '');
    } catch (error) {
      return asBadRequest(error);
    }
    try {
      const row = (await this.prisma.nppBarcodeScheme.create({
        data: {
          nppOrgId,
          prefix,
          label: input.label?.trim() ?? '',
          glassType: input.glassType?.trim() ?? '',
          thicknessMm: input.thicknessMm ?? null,
        },
      })) as SchemeRow;
      return toSchemeItem(row);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new BadRequestException(`Mã đầu ${prefix} đã tồn tại.`);
      throw error;
    }
  }

  /** Không cho đổi mã đầu: mã vạch đã in ra phải còn đọc được. */
  async updateScheme(nppOrgId: string, id: string, input: UpsertNppBarcodeSchemeInput): Promise<NppBarcodeSchemeItem> {
    const existing = await this.prisma.nppBarcodeScheme.findFirst({ where: { id, nppOrgId } });
    if (!existing) throw new NotFoundException('Không tìm thấy mã đầu.');
    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data.label = input.label.trim();
    if (input.glassType !== undefined) data.glassType = input.glassType.trim();
    if (input.thicknessMm !== undefined) data.thicknessMm = input.thicknessMm;
    if (input.active !== undefined) data.active = input.active;
    const row = (await this.prisma.nppBarcodeScheme.update({ where: { id }, data })) as SchemeRow;
    return toSchemeItem(row);
  }

  async listStock(nppOrgId: string): Promise<NppGlassSheetItem[]> {
    const rows = (await this.prisma.nppGlassSheet.findMany({
      where: { nppOrgId },
      orderBy: [{ glassType: 'asc' }, { barcode: 'asc' }],
    })) as StockRow[];
    return rows.map(toStockItem);
  }

  async receiveStock(nppOrgId: string, actorId: string, input: ReceiveNppGlassStockInput): Promise<NppGlassSheetItem> {
    const key = input.idempotencyKey?.trim();
    if (!key) throw new BadRequestException('Thiếu mã chống ghi trùng (idempotencyKey).');
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new BadRequestException('Số lượng phải là số nguyên lớn hơn 0.');
    const kind: NppGlassStockKind = input.kind ?? 'SHEET';
    if (!KINDS.includes(kind)) throw new BadRequestException('Loại hàng kính không hợp lệ.');

    const scheme = (await this.prisma.nppBarcodeScheme.findFirst({ where: { id: input.schemeId, nppOrgId } })) as SchemeRow | null;
    if (!scheme) throw new NotFoundException('Không tìm thấy mã đầu.');
    if (!scheme.active) throw new BadRequestException(`Mã đầu ${scheme.prefix} đã ngừng dùng.`);

    let barcode: string;
    try {
      barcode = buildGlassBarcode(scheme.prefix, input.widthMm, input.heightMm);
    } catch (error) {
      return asBadRequest(error);
    }
    const parsed = parseGlassBarcode(barcode)!;
    const location = input.location?.trim() ?? '';

    // Hai yêu cầu đồng thời có thể cùng tạo một dòng tồn hoặc cùng khóa chống trùng; Postgres chặn bằng ràng buộc duy nhất
    // và hủy giao dịch thua. Chạy lại giao dịch: lần sau sẽ thấy dòng hoặc bút toán của bên thắng nên cộng dồn hoặc trả lại kết quả cũ.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.receiveOnce(nppOrgId, actorId, input, key, kind, scheme, barcode, parsed.shortMm, parsed.longMm, location);
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt >= 4) throw error;
      }
    }
  }

  private receiveOnce(
    nppOrgId: string, actorId: string, input: ReceiveNppGlassStockInput, key: string, kind: NppGlassStockKind,
    scheme: SchemeRow, barcode: string, shortMm: number, longMm: number, location: string,
  ): Promise<NppGlassSheetItem> {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.nppGlassMovement.findUnique({ where: { nppOrgId_idempotencyKey: { nppOrgId, idempotencyKey: key } } });
      if (replay) {
        const current = (await tx.nppGlassSheet.findUnique({ where: { id: replay.stockId } })) as StockRow | null;
        if (current) return toStockItem(current);
      }
      const existing = (await tx.nppGlassSheet.findUnique({
        where: { nppOrgId_barcode_kind_location: { nppOrgId, barcode, kind, location } },
      })) as StockRow | null;
      const stock = existing
        ? ((await tx.nppGlassSheet.update({
            where: { id: existing.id },
            data: { quantity: { increment: input.quantity }, ...(input.unitCost && input.unitCost > 0 ? { unitCost: input.unitCost } : {}) },
          })) as StockRow)
        : ((await tx.nppGlassSheet.create({
            data: {
              nppOrgId,
              code: barcode,
              glassType: scheme.glassType,
              widthMm: shortMm,
              heightMm: longMm,
              quantity: input.quantity,
              unitCost: input.unitCost && input.unitCost > 0 ? input.unitCost : 0,
              note: input.note?.trim() ?? '',
              schemeId: scheme.id,
              kind,
              location,
              barcode,
            },
          })) as StockRow);
      await tx.nppGlassMovement.create({
        data: { nppOrgId, stockId: stock.id, type: 'RECEIVE', quantity: input.quantity, direction: 'IN', reason: input.note?.trim() ?? '', actorId, idempotencyKey: key },
      });
      return toStockItem(stock);
    });
  }

  /** Quét mã để nhập kho: lấy mã đầu và kích thước từ chính mã vạch, mỗi lần quét cộng thêm số lượng (mặc định 1). */
  async scanReceive(nppOrgId: string, actorId: string, input: Omit<ScanGlassStockInput, 'mode'>): Promise<NppGlassSheetItem> {
    const parsed = parseGlassBarcode(input.barcode);
    if (!parsed) throw new BadRequestException('Mã vạch không đúng dạng MÃĐẦU-RỘNG-CAO.');
    const scheme = (await this.prisma.nppBarcodeScheme.findFirst({ where: { nppOrgId, prefix: parsed.prefix } })) as SchemeRow | null;
    if (!scheme) throw new NotFoundException(`Mã đầu ${parsed.prefix} chưa được thiết lập.`);
    return this.receiveStock(nppOrgId, actorId, {
      schemeId: scheme.id,
      widthMm: parsed.shortMm,
      heightMm: parsed.longMm,
      quantity: input.quantity ?? 1,
      location: input.location,
      kind: input.kind,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /**
   * Quét mã để xuất kho. Cùng một mã có thể nằm ở nhiều vị trí hoặc nhiều loại hàng (tấm nguyên, tấm dư, tấm cắt):
   * nếu chưa chỉ rõ thì trả AMBIGUOUS_STOCK kèm danh sách để người dùng chọn. Chỉ trừ khi còn đủ tồn.
   */
  async scanIssue(nppOrgId: string, actorId: string, input: Omit<ScanGlassStockInput, 'mode'>): Promise<NppGlassSheetItem> {
    const key = input.idempotencyKey?.trim();
    if (!key) throw new BadRequestException('Thiếu mã chống ghi trùng (idempotencyKey).');
    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) throw new BadRequestException('Số lượng phải là số nguyên lớn hơn 0.');
    const parsed = parseGlassBarcode(input.barcode);
    if (!parsed) throw new BadRequestException('Mã vạch không đúng dạng MÃĐẦU-RỘNG-CAO.');
    if (input.kind !== undefined && !KINDS.includes(input.kind)) throw new BadRequestException('Loại hàng kính không hợp lệ.');
    const barcode = `${parsed.prefix}-${String(parsed.shortMm).padStart(4, '0')}-${String(parsed.longMm).padStart(4, '0')}`;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.issueOnce(nppOrgId, actorId, barcode, quantity, key, input);
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt >= 4) throw error;
      }
    }
  }

  private issueOnce(
    nppOrgId: string, actorId: string, barcode: string, quantity: number, key: string, input: Omit<ScanGlassStockInput, 'mode'>,
  ): Promise<NppGlassSheetItem> {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.nppGlassMovement.findUnique({ where: { nppOrgId_idempotencyKey: { nppOrgId, idempotencyKey: key } } });
      if (replay) {
        const current = (await tx.nppGlassSheet.findUnique({ where: { id: replay.stockId } })) as StockRow | null;
        if (current) return toStockItem(current);
      }
      const rows = (await tx.nppGlassSheet.findMany({
        where: { nppOrgId, barcode, quantity: { gt: 0 }, ...(input.kind ? { kind: input.kind } : {}), ...(input.location !== undefined ? { location: input.location.trim() } : {}) },
      })) as StockRow[];
      if (rows.length === 0) throw new NotFoundException(`Không có tồn kho cho mã ${barcode}.`);
      if (rows.length > 1) {
        throw new ConflictException({
          statusCode: 409,
          code: 'AMBIGUOUS_STOCK',
          message: `Mã ${barcode} có ở nhiều vị trí hoặc loại hàng. Hãy chọn một dòng để xuất.`,
          options: rows.map((row) => ({ kind: row.kind, location: row.location, quantity: row.quantity })),
        });
      }
      const row = rows[0];
      const updated = await tx.nppGlassSheet.updateMany({ where: { id: row.id, nppOrgId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
      if (updated.count === 0) throw new ConflictException(`Tồn kho không đủ: còn ${row.quantity} tấm ${barcode}, cần xuất ${quantity}.`);
      await tx.nppGlassMovement.create({
        data: { nppOrgId, stockId: row.id, type: 'ISSUE', quantity, direction: 'OUT', reason: input.reason?.trim() ?? input.note?.trim() ?? '', actorId, idempotencyKey: key },
      });
      const after = (await tx.nppGlassSheet.findUnique({ where: { id: row.id } })) as StockRow;
      return toStockItem(after);
    });
  }

  /** Tra tồn theo mã quét được (điện thoại hoặc máy quét). */
  async lookupByBarcode(nppOrgId: string, scanned: string): Promise<NppGlassSheetItem[]> {
    const parsed = parseGlassBarcode(scanned);
    if (!parsed) throw new BadRequestException('Mã vạch không đúng dạng MÃĐẦU-RỘNG-CAO.');
    const barcode = `${parsed.prefix}-${String(parsed.shortMm).padStart(4, '0')}-${String(parsed.longMm).padStart(4, '0')}`;
    const rows = (await this.prisma.nppGlassSheet.findMany({ where: { nppOrgId, barcode } })) as StockRow[];
    return rows.map(toStockItem);
  }
}
