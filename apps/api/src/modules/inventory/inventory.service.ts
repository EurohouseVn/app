import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateMaterialInput,
  CreateStockMovementInput,
  MaterialItem,
  StockMovementItem,
  ProfileStockMovementItem,
  AdjustProfileStockInput,
  UpdateMaterialInput,
  NppInboundShipment,
  GlassCutPlanResult,
  GlassCutPieceInput,
  NppAccessoryItem,
  NppAccessorySettings,
  AccessoryPhotoLine,
  ReadAccessoryPhotoInput,
  ReadAccessoryPhotoResult,
  AccessoryPriceMode,
  NppGlassSheetItem,
  UpsertNppAccessoryInput,
  UpsertNppGlassSheetInput,
} from '@eurohouse/types';
import { InventoryCommandService, type InventoryCommandContext } from './inventory-command.service';
import { OCR_PROVIDER, type OcrProviderPort } from './ocr-provider';
import { computeAccessorySalePrice, normalizeMarkupPercent } from './npp-accessory-pricing';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Vát Cạnh',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

const ALUMINUM_COLORS = [
  { code: 'CAFE_METALIC', name: 'Màu Café Metalic' },
  { code: 'CAFE_THUONG', name: 'Màu Café thường' },
  { code: 'XAM_NGOC_TRAI', name: 'Màu Xám Ngọc Trai' },
  { code: 'VAN_GO_CAM_LAI', name: 'Màu Vân gỗ Cẩm Lai' },
  { code: 'VAN_GO_OLAK', name: 'Màu vân gỗ Olak' },
  { code: 'XAM_RITA', name: 'Màu Xám Rita (dự án)' },
] as const;

function normalizeColorCode(colorCode?: string) {
  const value = (colorCode || '').trim();
  if (!value) return ALUMINUM_COLORS[0].code;
  const found = ALUMINUM_COLORS.find((color) => color.code === value || color.name === value);
  return found?.code ?? value;
}

function displaySystemName(code?: string, fallback?: string) {
  if (!code) return fallback || 'Khác';
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback ?? code;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly commands: InventoryCommandService, @Optional() @Inject(OCR_PROVIDER) private readonly ocr?: OcrProviderPort) {}

  private toNppAccessory(item: {
    id: string; name: string; brand: string; category: string; unit: string; quantity: number; unitCost: number; salePrice: number; priceMode: string; note: string; createdAt: Date;
  }): NppAccessoryItem {
    return {
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: item.unitCost,
      salePrice: item.salePrice,
      priceMode: item.priceMode === 'MANUAL' ? 'MANUAL' : 'AUTO',
      note: item.note || undefined,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async getAccessorySettings(nppOrgId: string): Promise<NppAccessorySettings> {
    const row = await this.prisma.nppAccessorySetting.findUnique({ where: { nppOrgId } });
    return { markupPercent: row?.markupPercent ?? 20 };
  }

  /** Đổi % lãi: giá bán của mọi phụ kiện đang để tự động được tính lại, giá nhập tay giữ nguyên. */
  async updateAccessorySettings(nppOrgId: string, input: Partial<NppAccessorySettings>): Promise<NppAccessorySettings> {
    const markupPercent = normalizeMarkupPercent(input.markupPercent);
    await this.prisma.nppAccessorySetting.upsert({ where: { nppOrgId }, update: { markupPercent }, create: { nppOrgId, markupPercent } });
    const autos = await this.prisma.nppAccessory.findMany({ where: { nppOrgId, priceMode: 'AUTO' } });
    for (const item of autos) {
      const salePrice = computeAccessorySalePrice({ unitCost: item.unitCost, markupPercent, mode: 'AUTO', manualPrice: 0 });
      if (salePrice !== item.salePrice) await this.prisma.nppAccessory.update({ where: { id: item.id }, data: { salePrice } });
    }
    return { markupPercent };
  }

  /** Đọc ảnh chụp phiếu nhập phụ kiện bằng dịch vụ đọc ảnh; chưa cài dịch vụ thì trả bảng trống để nhập tay. */
  async readAccessoryPhoto(input: ReadAccessoryPhotoInput): Promise<ReadAccessoryPhotoResult> {
    if (!input.imageBase64 || !input.mime || !['image/jpeg', 'image/png', 'image/webp'].includes(input.mime)) throw new BadRequestException('Ảnh phải là JPEG, PNG hoặc WebP.');
    if ((input.imageBase64.length * 3) / 4 > 10 * 1024 * 1024) throw new BadRequestException('Ảnh quá lớn (tối đa 10 MB). Hãy chụp lại hoặc thu nhỏ ảnh.');
    if (!this.ocr?.configured) return { engine: 'none', configured: false, note: 'Chưa cài dịch vụ đọc ảnh tự động. Hãy nhập các dòng bằng tay.', lines: [] };
    try {
      const result = await this.ocr.extract({ imageBase64: input.imageBase64, mime: input.mime, kind: 'ACCESSORY' });
      const lines: AccessoryPhotoLine[] = [];
      for (const group of result.groups) {
        for (const line of group.lines) {
          lines.push({
            name: line.text.trim(), brand: (line.brand ?? '').trim(), category: (line.category ?? group.heading ?? '').trim(),
            unit: (line.unit ?? '').trim() || 'cái', quantity: Math.max(0, Math.round(line.quantity ?? 1)), unitCost: Math.max(0, Math.round(line.unitCost ?? 0)),
          });
        }
      }
      return { engine: result.engine, configured: true, note: lines.length ? '' : 'Không thấy dòng phụ kiện nào trong ảnh.', lines };
    } catch (error) {
      return { engine: this.ocr.engine, configured: true, note: `Không đọc được ảnh tự động: ${(error as Error).message} Hãy nhập các dòng bằng tay.`, lines: [] };
    }
  }

  /** Nhập kho phụ kiện theo các dòng đã duyệt: trùng tên và hãng thì cộng số lượng, cập nhật giá nhập, tính lại giá bán nếu để tự động. */
  async receiveAccessories(nppOrgId: string, lines: AccessoryPhotoLine[]): Promise<NppAccessoryItem[]> {
    const clean = (lines ?? []).filter((l) => l?.name?.trim() && Number(l.quantity) > 0);
    if (!clean.length) throw new BadRequestException('Không có dòng phụ kiện hợp lệ để nhập kho.');
    const { markupPercent } = await this.getAccessorySettings(nppOrgId);
    const out: NppAccessoryItem[] = [];
    for (const line of clean) {
      const name = line.name.trim();
      const brand = (line.brand ?? '').trim();
      const quantity = Math.round(Number(line.quantity));
      const unitCost = Math.max(0, Math.round(Number(line.unitCost) || 0));
      const existing = await this.prisma.nppAccessory.findFirst({ where: { nppOrgId, name: { equals: name, mode: 'insensitive' }, brand: { equals: brand, mode: 'insensitive' } } });
      if (existing) {
        const cost = unitCost > 0 ? unitCost : existing.unitCost;
        const mode: AccessoryPriceMode = existing.priceMode === 'MANUAL' ? 'MANUAL' : 'AUTO';
        const saved = await this.prisma.nppAccessory.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity }, unitCost: cost, salePrice: computeAccessorySalePrice({ unitCost: cost, markupPercent, mode, manualPrice: existing.salePrice }) },
        });
        out.push(this.toNppAccessory(saved));
      } else {
        const saved = await this.prisma.nppAccessory.create({
          data: { nppOrgId, name, brand, category: (line.category ?? '').trim(), unit: (line.unit ?? '').trim() || 'cái', quantity, unitCost, priceMode: 'AUTO', salePrice: computeAccessorySalePrice({ unitCost, markupPercent, mode: 'AUTO', manualPrice: 0 }) },
        });
        out.push(this.toNppAccessory(saved));
      }
    }
    return out;
  }

  async listNppAccessories(nppOrgId: string, query?: string): Promise<NppAccessoryItem[]> {
    const where = query ? {
      nppOrgId,
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { brand: { contains: query, mode: 'insensitive' as const } },
        { category: { contains: query, mode: 'insensitive' as const } },
      ],
    } : { nppOrgId };
    const list = await this.prisma.nppAccessory.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return list.map((item) => this.toNppAccessory(item));
  }

  async createNppAccessory(nppOrgId: string, input: UpsertNppAccessoryInput): Promise<NppAccessoryItem> {
    if (!input.name?.trim()) throw new BadRequestException('Ten phu kien la bat buoc.');
    const { markupPercent } = await this.getAccessorySettings(nppOrgId);
    const priceMode: AccessoryPriceMode = input.priceMode === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const created = await this.prisma.nppAccessory.create({
      data: {
        nppOrgId,
        name: input.name.trim(),
        brand: input.brand?.trim() ?? '',
        category: input.category?.trim() ?? '',
        unit: input.unit?.trim() || 'cai',
        quantity: input.quantity ?? 0,
        unitCost: input.unitCost ?? 0,
        priceMode,
        salePrice: computeAccessorySalePrice({ unitCost: input.unitCost ?? 0, markupPercent, mode: priceMode, manualPrice: input.salePrice ?? 0 }),
        note: input.note?.trim() ?? '',
      },
    });
    return this.toNppAccessory(created);
  }

  async updateNppAccessory(nppOrgId: string, id: string, input: Partial<UpsertNppAccessoryInput>): Promise<NppAccessoryItem> {
    const existing = await this.prisma.nppAccessory.findFirst({ where: { id, nppOrgId } });
    if (!existing) throw new NotFoundException('Khong tim thay phu kien.');
    const { markupPercent } = await this.getAccessorySettings(nppOrgId);
    const mode: AccessoryPriceMode = (input.priceMode ?? existing.priceMode) === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const salePrice = computeAccessorySalePrice({ unitCost: input.unitCost ?? existing.unitCost, markupPercent, mode, manualPrice: input.salePrice ?? existing.salePrice });
    const updated = await this.prisma.nppAccessory.update({
      where: { id },
      data: {
        priceMode: mode,
        salePrice,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.brand !== undefined ? { brand: input.brand.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() } : {}),
        ...(input.unit !== undefined ? { unit: input.unit.trim() || 'cai' } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}),
        ...(input.note !== undefined ? { note: input.note.trim() } : {}),
      },
    });
    return this.toNppAccessory(updated);
  }

  private toNppGlassSheet(item: {
    id: string; code: string; glassType: string; widthMm: number; heightMm: number; quantity: number; unitCost: number; note: string; createdAt: Date;
  }): NppGlassSheetItem {
    return {
      id: item.id,
      code: item.code,
      glassType: item.glassType,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      quantity: item.quantity,
      unitCost: item.unitCost,
      note: item.note || undefined,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async listNppGlassSheets(nppOrgId: string): Promise<NppGlassSheetItem[]> {
    const list = await this.prisma.nppGlassSheet.findMany({ where: { nppOrgId }, orderBy: [{ glassType: 'asc' }, { code: 'asc' }] });
    return list.map((item) => this.toNppGlassSheet(item));
  }

  async createNppGlassSheet(nppOrgId: string, input: UpsertNppGlassSheetInput): Promise<NppGlassSheetItem> {
    if (!input.code?.trim()) throw new BadRequestException('Ma tam kinh la bat buoc.');
    if (!input.widthMm || !input.heightMm) throw new BadRequestException('Nhap dung kich thuoc tam kinh.');
    const created = await this.prisma.nppGlassSheet.create({
      data: {
        nppOrgId,
        code: input.code.trim(),
        glassType: input.glassType?.trim() ?? '',
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        quantity: input.quantity ?? 0,
        unitCost: input.unitCost ?? 0,
        note: input.note?.trim() ?? '',
        // Đường nhập tay cũ không có mã đầu: cấp mã LEGACY duy nhất để không vướng khóa (nppOrgId, barcode, kind, location).
        barcode: `LEGACY-${randomUUID()}`,
      },
    });
    return this.toNppGlassSheet(created);
  }

  async planNppGlassCut(nppOrgId: string, sheetId: string, pieces: GlassCutPieceInput[]): Promise<GlassCutPlanResult> {
    const sheet = await this.prisma.nppGlassSheet.findFirst({ where: { id: sheetId, nppOrgId } });
    if (!sheet) throw new NotFoundException('Khong tim thay tam kinh.');
    const expanded = pieces.flatMap((piece) => Array.from({ length: Math.max(0, piece.quantity || 0) }, () => ({ widthMm: piece.widthMm, heightMm: piece.heightMm })))
      .sort((a, b) => (b.heightMm * b.widthMm) - (a.heightMm * a.widthMm));
    const placements: GlassCutPlanResult['placements'] = [];
    const errors: string[] = [];
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;

    expanded.forEach((piece, index) => {
      const normalFits = piece.widthMm <= sheet.widthMm && piece.heightMm <= sheet.heightMm;
      const rotatedFits = piece.heightMm <= sheet.widthMm && piece.widthMm <= sheet.heightMm;
      if (!normalFits && !rotatedFits) {
        errors.push(`Tấm ${index + 1} không vừa khổ kính lớn.`);
        return;
      }
      const rotated = !normalFits || (rotatedFits && piece.heightMm < piece.widthMm && piece.heightMm <= sheet.widthMm);
      const width = rotated ? piece.heightMm : piece.widthMm;
      const height = rotated ? piece.widthMm : piece.heightMm;
      if (cursorX + width > sheet.widthMm) {
        cursorX = 0;
        cursorY += rowHeight;
        rowHeight = 0;
      }
      if (cursorY + height > sheet.heightMm) {
        errors.push(`Tam ${index + 1} vuot qua dien tich tam kinh hien tai.`);
        return;
      }
      placements.push({ pieceNo: index + 1, x: cursorX, y: cursorY, widthMm: width, heightMm: height, rotated });
      cursorX += width;
      rowHeight = Math.max(rowHeight, height);
    });

    const sheetArea = sheet.widthMm * sheet.heightMm;
    const usedAreaMm2 = placements.reduce((sum, item) => sum + item.widthMm * item.heightMm, 0);
    const wasteAreaMm2 = Math.max(0, sheetArea - usedAreaMm2);
    return {
      sheetId: sheet.id,
      sheetWidthMm: sheet.widthMm,
      sheetHeightMm: sheet.heightMm,
      placements,
      errors,
      usedAreaMm2,
      wasteAreaMm2,
      wastePercent: sheetArea ? Number(((wasteAreaMm2 / sheetArea) * 100).toFixed(2)) : 0,
    };
  }

  async getUserInventory(userId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      orderBy: { lengthMm: 'desc' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { scrapKg: true },
    });
    const materialCodes = Array.from(new Set(items.map((item) => item.materialCode.toUpperCase())));
    const profiles = materialCodes.length ? await this.prisma.profile.findMany({
      where: { code: { in: materialCodes, mode: 'insensitive' } },
      include: { aluSystem: { select: { code: true, name: true } } },
    }) : [];
    const profileByCode = new Map(profiles.map((profile) => [profile.code.toUpperCase(), profile]));

    return {
      items: items.map((item) => {
        const profile = profileByCode.get(item.materialCode.toUpperCase());
        return {
          ...item,
          profileName: profile?.name || item.materialCode,
          systemCode: profile?.aluSystem.code || 'KHAC',
          systemName: displaySystemName(profile?.aluSystem.code, profile?.aluSystem.name),
          kgPerMeter: profile?.kgPerMeter || 0,
        };
      }),
      scrapKg: user?.scrapKg || 0,
    };
  }

  async adjustUserInventory(userId: string, input: { materialCode?: string; lengthMm?: number; quantity?: number; type?: 'FULL_BAR' | 'DE_XE' }) {
    const materialCode = String(input.materialCode || '').trim().toUpperCase();
    const lengthMm = Math.round(Number(input.lengthMm));
    const quantity = Math.round(Number(input.quantity));
    const type = input.type === 'DE_XE' ? 'DE_XE' : 'FULL_BAR';
    if (!materialCode) throw new BadRequestException('Vui lòng nhập mã thanh nhôm.');
    if (!Number.isFinite(lengthMm) || lengthMm <= 0) throw new BadRequestException('Chiều dài thanh phải lớn hơn 0 mm.');
    if (!Number.isFinite(quantity) || quantity === 0) throw new BadRequestException('Số lượng điều chỉnh phải khác 0.');
    const existing = await this.prisma.inventoryItem.findFirst({ where: { userId, materialCode, lengthMm, type } });
    if (!existing) {
      if (quantity < 0) throw new BadRequestException('Kho không đủ số lượng để xuất.');
      return this.prisma.inventoryItem.create({ data: { userId, materialCode, lengthMm, quantity, type } });
    }
    const nextQuantity = existing.quantity + quantity;
    if (nextQuantity < 0) throw new BadRequestException('Kho không đủ số lượng để xuất.');
    if (nextQuantity === 0) {
      await this.prisma.inventoryItem.delete({ where: { id: existing.id } });
      return { ...existing, quantity: 0, deleted: true };
    }
    return this.prisma.inventoryItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
  }

  async listMaterials(filter?: { category?: string; group?: string }): Promise<MaterialItem[]> {
    const list = await this.prisma.material.findMany({
      where: { category: filter?.category, group: filter?.group },
      orderBy: [{ category: 'asc' }, { group: 'asc' }],
    });
    return list.map((m) => ({
      id: m.id, code: m.code, name: m.name, category: m.category as MaterialItem['category'],
      group: m.group as MaterialItem['group'], unit: m.unit, unitPrice: m.unitPrice,
      stockQty: m.stockQty, lowStockAlert: m.lowStockAlert, note: m.note, active: m.active,
    }));
  }

  async createMaterial(data: CreateMaterialInput): Promise<MaterialItem> {
    const created = await this.prisma.material.create({
      data: {
        code: data.code, name: data.name, category: data.category, group: data.group,
        unit: data.unit ?? 'kg', unitPrice: data.unitPrice ?? 0,
        lowStockAlert: data.lowStockAlert ?? 0, note: data.note ?? '',
      },
    });
    return (await this.listMaterials()).find((m) => m.id === created.id)!;
  }

  async updateMaterial(id: string, data: UpdateMaterialInput): Promise<MaterialItem> {
    await this.prisma.material.update({ where: { id }, data });
    return (await this.listMaterials()).find((m) => m.id === id)!;
  }

  private toStockMovementItem(m: {
    id: string; materialId: string; direction: string; quantity: number; unitPrice: number;
    totalAmount: number; reason: string; note: string; createdAt: Date;
    material: { code: string; name: string }; createdBy: { displayName: string } | null;
  }): StockMovementItem {
    return {
      id: m.id, materialId: m.materialId, materialCode: m.material.code, materialName: m.material.name,
      direction: m.direction as StockMovementItem['direction'], quantity: m.quantity, unitPrice: m.unitPrice,
      totalAmount: m.totalAmount, reason: m.reason, note: m.note,
      createdByName: m.createdBy?.displayName, createdAt: m.createdAt.toISOString(),
    };
  }

  async listStockMovements(filter?: { direction?: string; materialId?: string; from?: string; to?: string }): Promise<StockMovementItem[]> {
    const list = await this.prisma.stockMovement.findMany({
      where: {
        direction: filter?.direction,
        materialId: filter?.materialId,
        createdAt: filter?.from || filter?.to ? { gte: filter?.from ? new Date(filter.from) : undefined, lte: filter?.to ? new Date(filter.to) : undefined } : undefined,
      },
      include: { material: true, createdBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((m) => this.toStockMovementItem(m));
  }

  async listMaterialMovements(materialId: string): Promise<StockMovementItem[]> {
    return this.listStockMovements({ materialId });
  }

  async createStockMovement(input: CreateStockMovementInput, command: InventoryCommandContext): Promise<StockMovementItem> {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new BadRequestException('Số lượng phải lớn hơn 0.');
    return this.commands.execute(command, input, async (tx) => {
      const material = await tx.material.findUnique({ where: { id: input.materialId } });
      if (!material) throw new NotFoundException('Không tìm thấy vật tư.');
      const unitPrice = input.unitPrice ?? material.unitPrice;
      const totalAmount = Math.round(unitPrice * input.quantity);
      if (input.direction === 'OUT') {
        const updated = await tx.material.updateMany({ where: { id: input.materialId, stockQty: { gte: input.quantity } }, data: { stockQty: { decrement: input.quantity } } });
        if (updated.count !== 1) throw new BadRequestException('Tồn vật tư công ty không đủ để xuất.');
      } else {
        await tx.material.update({ where: { id: input.materialId }, data: { stockQty: { increment: input.quantity } } });
      }
      const movement = await tx.stockMovement.create({
        data: {
          materialId: input.materialId, direction: input.direction, quantity: input.quantity,
          unitPrice, totalAmount, reason: input.reason ?? '', note: input.note ?? '', createdById: command.actorId,
        },
        include: { material: true, createdBy: true },
      });
      return this.toStockMovementItem(movement);
    });
  }

  async listProfileMovements(profileId: string): Promise<ProfileStockMovementItem[]> {
    const list = await this.prisma.profileStockMovement.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((m) => ({
      id: m.id, profileId: m.profileId, colorCode: (m as any).colorCode || undefined, direction: m.direction as ProfileStockMovementItem['direction'],
      quantity: m.quantity, reason: m.reason, orderId: m.orderId ?? undefined, note: m.note,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async listNppProfiles(nppOrgId: string) {
    const [systems, profiles] = await Promise.all([
      this.prisma.aluSystem.findMany({ where: { code: { startsWith: 'EU-' } }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.profile.findMany({ orderBy: { code: 'asc' } }),
    ]);
    const stocks: { profileId: string; colorCode?: string | null; stockBars: number; lowStockAlert: number }[] =
      await this.prisma.nppProfileStock.findMany({ where: { nppOrgId } });
    const systemById = new Map(systems.map((system) => [system.id, system]));
    const stocksByProfileId = new Map<string, typeof stocks>();
    for (const stock of stocks) {
      const list = stocksByProfileId.get(stock.profileId) ?? [];
      list.push(stock);
      stocksByProfileId.set(stock.profileId, list);
    }

    return profiles.filter((profile) => systemById.has(profile.aluSystemId)).map((profile) => {
      const system = systemById.get(profile.aluSystemId);
      const profileStocks = stocksByProfileId.get(profile.id) ?? [];
      const stockByColor = ALUMINUM_COLORS.map((color) => {
        const bars = profileStocks
          .filter((stock) => normalizeColorCode((stock as any).colorCode) === color.code)
          .reduce((sum, stock) => sum + stock.stockBars, 0);
        return {
          colorCode: color.code,
          colorName: color.name,
          stockBars: bars,
          tons: Number(((bars * (profile.kgPerMeter ?? 0) * 6) / 1000).toFixed(3)),
        };
      });
      const stockBars = stockByColor.reduce((sum, item) => sum + item.stockBars, 0);
      return ({
      id: profile.id,
      code: profile.code,
      name: profile.name,
      systemCode: system?.code ?? 'KHAC',
      systemName: displaySystemName(system?.code, system?.name),
      stockBars,
      kgPerMeter: profile.kgPerMeter,
      stockByColor,
      lowStockAlert: profileStocks[0]?.lowStockAlert ?? profile.lowStockAlert,
      pricePerKg: profile.pricePerKg,
      });
    }).sort((a, b) => a.systemCode.localeCompare(b.systemCode) || a.code.localeCompare(b.code));
  }

  async listNppProfileMovements(nppOrgId: string, profileId?: string): Promise<ProfileStockMovementItem[]> {
    const list = await this.prisma.nppStockMovement.findMany({
      where: { nppOrgId, profileId },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    return list.map((m) => ({
      id: m.id, profileId: m.profileId, colorCode: (m as any).colorCode || undefined, direction: m.direction as ProfileStockMovementItem['direction'],
      quantity: m.quantity, reason: m.reason, orderId: m.orderId ?? undefined, note: m.note,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async adjustNppProfileStock(nppOrgId: string, profileId: string, input: AdjustProfileStockInput, command: InventoryCommandContext): Promise<ProfileStockMovementItem> {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new BadRequestException('Số lượng phải lớn hơn 0.');
    return this.commands.execute(command, { profileId, ...input }, async (tx) => {
      const profile = await tx.profile.findUnique({ where: { id: profileId } });
      if (!profile) throw new NotFoundException('Không tìm thấy thanh nhôm.');
      const delta = input.direction === 'IN' ? input.quantity : -input.quantity;
      const colorCode = normalizeColorCode(input.colorCode);
      if (input.direction === 'OUT') {
        const stock = await tx.nppProfileStock.findUnique({ where: { nppOrgId_profileId_colorCode: { nppOrgId, profileId, colorCode } } });
        if (!stock || stock.stockBars < input.quantity) {
          throw new BadRequestException('Tồn kho NPP không đủ để xuất.');
        }
      }
      await tx.nppProfileStock.upsert({
        where: { nppOrgId_profileId_colorCode: { nppOrgId, profileId, colorCode } },
        update: { stockBars: { increment: delta } },
        create: { nppOrgId, profileId, colorCode, stockBars: Math.max(0, delta), lowStockAlert: profile.lowStockAlert },
      });
      const created = await tx.nppStockMovement.create({
        data: {
          nppOrgId,
          profileId,
          colorCode,
          direction: input.direction,
          quantity: input.quantity,
          reason: input.reason ?? 'Điều chỉnh kiểm kê',
          note: input.note ?? '',
          createdById: command.actorId,
        },
      });
      return {
        id: created.id, profileId: created.profileId, colorCode: (created as any).colorCode || undefined, direction: created.direction as ProfileStockMovementItem['direction'],
        quantity: created.quantity, reason: created.reason, orderId: created.orderId ?? undefined, note: created.note,
        createdAt: created.createdAt.toISOString(),
      };
    });
  }

  private toNppInboundShipment(order: {
    id: string; code: string; status: string; nppName: string; invoiceNo: string; poNo: string; note: string;
    totalKg: number; totalAmount: number; createdAt: Date;
    items: { productCode: string; productName: string; colorCode: string; quantity: number; totalKg: number; totalPrice: number }[];
  }): NppInboundShipment {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      nppName: order.nppName,
      invoiceNo: order.invoiceNo || undefined,
      poNo: order.poNo || undefined,
      note: order.note || undefined,
      totalKg: order.totalKg,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        productCode: item.productCode,
        productName: item.productName,
        colorCode: item.colorCode,
        quantity: item.quantity,
        totalKg: item.totalKg,
        totalPrice: item.totalPrice,
      })),
    };
  }

  async listNppInboundShipments(nppOrgId: string): Promise<NppInboundShipment[]> {
    const orders = await this.prisma.order.findMany({
      where: { sourceType: 'ADMIN_TO_NPP', nppOrgId, status: { in: ['ADMIN_SENT_NPP', 'NPP_RECEIVED'] } },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return orders.map((order) => this.toNppInboundShipment(order));
  }

  async receiveNppInboundShipment(orderId: string, nppOrgId: string, command: InventoryCommandContext): Promise<NppInboundShipment> {
    return this.commands.execute(command, { orderId }, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, sourceType: 'ADMIN_TO_NPP', nppOrgId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy phiếu giao về NPP.');
      if (order.status === 'NPP_RECEIVED') return this.toNppInboundShipment(order);
      if (order.status !== 'ADMIN_SENT_NPP') throw new BadRequestException('Phiếu giao không ở trạng thái chờ nhận.');
      for (const item of order.items) {
        if (!item.profileId) continue;
        const colorCode = normalizeColorCode(item.colorCode);
        await tx.nppProfileStock.upsert({
          where: { nppOrgId_profileId_colorCode: { nppOrgId, profileId: item.profileId, colorCode } },
          update: { stockBars: { increment: item.quantity } },
          create: { nppOrgId, profileId: item.profileId, colorCode, stockBars: item.quantity },
        });
        await tx.nppStockMovement.create({
          data: {
            nppOrgId,
            profileId: item.profileId,
            colorCode,
            direction: 'IN',
            quantity: item.quantity,
            reason: 'Nhập từ phiếu công ty giao',
            orderId: order.id,
            createdById: command.actorId,
            note: order.code,
          },
        });
      }
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: 'NPP_RECEIVED', title: 'NPP xác nhận nhận đủ hàng', actor: 'NPP', note: 'Kho NPP đã được cập nhật.' },
      });
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: 'NPP_RECEIVED', dueNote: 'NPP đã nhận đủ hàng' },
        include: { items: true },
      });
      return this.toNppInboundShipment(updated);
    });
  }

  async adjustProfileStock(profileId: string, input: AdjustProfileStockInput, command: InventoryCommandContext): Promise<ProfileStockMovementItem> {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new BadRequestException('Số lượng phải lớn hơn 0.');
    return this.commands.execute(command, { profileId, ...input }, async (tx) => {
      const profile = await tx.profile.findUnique({ where: { id: profileId } });
      if (!profile) throw new NotFoundException('Không tìm thấy thanh nhôm.');
      if (input.direction === 'OUT') {
        const updated = await tx.profile.updateMany({ where: { id: profileId, stockBars: { gte: input.quantity } }, data: { stockBars: { decrement: input.quantity } } });
        if (updated.count !== 1) throw new BadRequestException('Tồn thanh nhôm công ty không đủ để xuất.');
      } else {
        await tx.profile.update({ where: { id: profileId }, data: { stockBars: { increment: input.quantity } } });
      }
      const movement = await tx.profileStockMovement.create({
        data: {
          profileId, direction: input.direction, quantity: input.quantity,
          reason: input.reason ?? 'Điều chỉnh kiểm kê', note: input.note ?? '', createdById: command.actorId,
        },
      });
      return {
        id: movement.id, profileId: movement.profileId, direction: movement.direction as ProfileStockMovementItem['direction'],
        quantity: movement.quantity, reason: movement.reason, orderId: movement.orderId ?? undefined, note: movement.note,
        createdAt: movement.createdAt.toISOString(),
      };
    });
  }

  async getInventorySummary(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const scrapKg = user?.scrapKg ?? 0;

    const profiles = await this.prisma.profile.findMany({
      where: { stockBars: { gt: 0 } },
    });

    const cutoffsList = await this.prisma.profileCutoff.findMany({
      where: { createdById: userId },
      include: { profile: true },
    });

    return {
      profiles: profiles.map(p => ({ id: p.id, code: p.code, name: p.name, stockBars: p.stockBars })),
      cutoffs: cutoffsList.map(c => ({
        id: c.id, profileId: c.profileId, profileCode: c.profile.code, profileName: c.profile.name,
        lengthMm: c.lengthMm, quantity: c.quantity,
      })),
      scrapKg,
    };
  }

  async syncOrderStock(orderId: string, command: InventoryCommandContext) {
    return this.commands.execute(command, { orderId }, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      for (const item of order.items) {
        if (!item.profileId) continue;
        await tx.profileStockMovement.create({
          data: {
            profileId: item.profileId, direction: 'IN', quantity: item.quantity,
            reason: 'Nhập kho từ đơn hàng ' + order.code, orderId, createdById: command.actorId,
          },
        });
        await tx.profile.update({
          where: { id: item.profileId },
          data: { stockBars: { increment: item.quantity } },
        });
      }
      return { success: true };
    });
  }

  async cutProfile(profileId: string, cutLengths: number[], projectId: string | undefined, command: InventoryCommandContext) {
    // 1 bar = 6000mm. 
    // This function assumes one bar is cut. If multiple bars are cut, they should be called per bar or handle total quantity.
    // Assuming cutLengths are the final usable lengths needed. 
    // The sum of cutLengths + leftover must be <= 6000.
    const totalCut = cutLengths.reduce((a, b) => a + b, 0);
    if (!cutLengths.length || cutLengths.some((length) => !Number.isFinite(length) || length <= 0)) throw new BadRequestException('Danh sách cắt không hợp lệ.');
    if (totalCut > 6000) throw new BadRequestException('Tổng chiều dài cắt vượt quá 6000mm của 1 cây nhôm.');

    const leftover = 6000 - totalCut;

    return this.commands.execute(command, { profileId, cutLengths, projectId }, async (tx) => {
      // Trừ 1 cây nguyên
      const updated = await tx.profile.updateMany({ where: { id: profileId, stockBars: { gte: 1 } }, data: { stockBars: { decrement: 1 } } });
      if (updated.count !== 1) throw new BadRequestException('Tồn thanh nhôm công ty không đủ để cắt.');
      await tx.profileStockMovement.create({
        data: {
          profileId, direction: 'OUT', quantity: 1,
          reason: 'Xuất cắt cho công trình', createdById: command.actorId,
        },
      });

      // Xử lý Đề xê hoặc Phế liệu
      if (leftover >= 1000) {
        // Lưu vào ProfileCutoff (Đề xê)
        await tx.profileCutoff.create({
          data: {
            profileId, lengthMm: leftover, quantity: 1, projectId, createdById: command.actorId,
          },
        });
      } else if (leftover > 0) {
        // Cộng vào phế liệu dự kiến (Quy đổi ra kg). 
        // 1 cây 6m có cân nặng là profile.kgPerMeter * 6. (or if not available, approximate)
        const profile = await tx.profile.findUnique({ where: { id: profileId } });
        const kgPerMeter = profile?.kgPerMeter ?? 1; // Default 1kg/m if unknown
        const scrapWeight = (leftover / 1000) * kgPerMeter;
        
        await tx.user.update({
          where: { id: command.actorId },
          data: { scrapKg: { increment: scrapWeight } },
        });
      }
      return { success: true, leftover, isScrap: leftover < 1000 };
    });
  }
}
