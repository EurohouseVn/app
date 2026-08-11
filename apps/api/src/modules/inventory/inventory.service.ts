import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  NppGlassSheetItem,
  UpsertNppAccessoryInput,
  UpsertNppGlassSheetInput,
} from '@eurohouse/types';

const EUROHOUSE_SYSTEM_NAMES: Record<string, string> = {
  'EU-55': 'Hệ 55 Euroqueen',
  'EU-TRUOT': 'Hệ trượt Châu Âu',
};

function displaySystemName(code?: string, fallback?: string) {
  if (!code) return fallback || 'Khác';
  return EUROHOUSE_SYSTEM_NAMES[code.toUpperCase()] ?? fallback ?? code;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toNppAccessory(item: {
    id: string; name: string; brand: string; category: string; unit: string; quantity: number; unitCost: number; note: string; createdAt: Date;
  }): NppAccessoryItem {
    return {
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: item.unitCost,
      note: item.note || undefined,
      createdAt: item.createdAt.toISOString(),
    };
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
    const created = await this.prisma.nppAccessory.create({
      data: {
        nppOrgId,
        name: input.name.trim(),
        brand: input.brand?.trim() ?? '',
        category: input.category?.trim() ?? '',
        unit: input.unit?.trim() || 'cai',
        quantity: input.quantity ?? 0,
        unitCost: input.unitCost ?? 0,
        note: input.note?.trim() ?? '',
      },
    });
    return this.toNppAccessory(created);
  }

  async updateNppAccessory(nppOrgId: string, id: string, input: Partial<UpsertNppAccessoryInput>): Promise<NppAccessoryItem> {
    const existing = await this.prisma.nppAccessory.findFirst({ where: { id, nppOrgId } });
    if (!existing) throw new NotFoundException('Khong tim thay phu kien.');
    const updated = await this.prisma.nppAccessory.update({
      where: { id },
      data: {
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
        errors.push(`Tam ${index + 1} khong vua kho kinh lon.`);
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

    return {
      items,
      scrapKg: user?.scrapKg || 0,
    };
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

  async createStockMovement(input: CreateStockMovementInput, userId?: string): Promise<StockMovementItem> {
    const material = await this.prisma.material.findUnique({ where: { id: input.materialId } });
    if (!material) throw new NotFoundException('Không tìm thấy vật tư.');
    const unitPrice = input.unitPrice ?? material.unitPrice;
    const totalAmount = Math.round(unitPrice * input.quantity);
    const delta = input.direction === 'IN' ? input.quantity : -input.quantity;

    const created = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          materialId: input.materialId, direction: input.direction, quantity: input.quantity,
          unitPrice, totalAmount, reason: input.reason ?? '', note: input.note ?? '', createdById: userId ?? null,
        },
        include: { material: true, createdBy: true },
      });
      await tx.material.update({ where: { id: input.materialId }, data: { stockQty: { increment: delta } } });
      return movement;
    });
    return this.toStockMovementItem(created);
  }

  async listProfileMovements(profileId: string): Promise<ProfileStockMovementItem[]> {
    const list = await this.prisma.profileStockMovement.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((m) => ({
      id: m.id, profileId: m.profileId, direction: m.direction as ProfileStockMovementItem['direction'],
      quantity: m.quantity, reason: m.reason, orderId: m.orderId ?? undefined, note: m.note,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async listNppProfiles(nppOrgId: string) {
    const [systems, profiles, stocks] = await Promise.all([
      this.prisma.aluSystem.findMany({ where: { code: { startsWith: 'EU-' } }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.profile.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.nppProfileStock.findMany({ where: { nppOrgId } }),
    ]);
    const systemById = new Map(systems.map((system) => [system.id, system]));
    const stockByProfileId = new Map(stocks.map((stock) => [stock.profileId, stock]));

    return profiles.filter((profile) => systemById.has(profile.aluSystemId)).map((profile) => {
      const system = systemById.get(profile.aluSystemId);
      const stock = stockByProfileId.get(profile.id);
      return ({
      id: profile.id,
      code: profile.code,
      name: profile.name,
      systemCode: system?.code ?? 'KHAC',
      systemName: displaySystemName(system?.code, system?.name),
      stockBars: stock?.stockBars ?? 0,
      lowStockAlert: stock?.lowStockAlert ?? profile.lowStockAlert,
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
      id: m.id, profileId: m.profileId, direction: m.direction as ProfileStockMovementItem['direction'],
      quantity: m.quantity, reason: m.reason, orderId: m.orderId ?? undefined, note: m.note,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async adjustNppProfileStock(nppOrgId: string, profileId: string, input: AdjustProfileStockInput, userId?: string): Promise<ProfileStockMovementItem> {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Không tìm thấy thanh nhôm.');
    const delta = input.direction === 'IN' ? input.quantity : -input.quantity;

    const created = await this.prisma.$transaction(async (tx) => {
      if (input.direction === 'OUT') {
        const stock = await tx.nppProfileStock.findUnique({ where: { nppOrgId_profileId: { nppOrgId, profileId } } });
        if (!stock || stock.stockBars < input.quantity) {
          throw new BadRequestException('Ton kho NPP khong du de xuat.');
        }
      }
      await tx.nppProfileStock.upsert({
        where: { nppOrgId_profileId: { nppOrgId, profileId } },
        update: { stockBars: { increment: delta } },
        create: { nppOrgId, profileId, stockBars: Math.max(0, delta), lowStockAlert: profile.lowStockAlert },
      });
      return tx.nppStockMovement.create({
        data: {
          nppOrgId,
          profileId,
          direction: input.direction,
          quantity: input.quantity,
          reason: input.reason ?? 'Điều chỉnh kiểm kê',
          note: input.note ?? '',
          createdById: userId ?? null,
        },
      });
    });
    return {
      id: created.id, profileId: created.profileId, direction: created.direction as ProfileStockMovementItem['direction'],
      quantity: created.quantity, reason: created.reason, orderId: created.orderId ?? undefined, note: created.note,
      createdAt: created.createdAt.toISOString(),
    };
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

  async receiveNppInboundShipment(orderId: string, nppOrgId: string, userId: string): Promise<NppInboundShipment> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sourceType: 'ADMIN_TO_NPP', nppOrgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy phiếu giao về NPP.');
    if (order.status === 'NPP_RECEIVED') return this.toNppInboundShipment(order);
    if (order.status !== 'ADMIN_SENT_NPP') throw new BadRequestException('Phiếu giao không ở trạng thái chờ nhận.');

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.profileId) continue;
        await tx.nppProfileStock.upsert({
          where: { nppOrgId_profileId: { nppOrgId, profileId: item.profileId } },
          update: { stockBars: { increment: item.quantity } },
          create: { nppOrgId, profileId: item.profileId, stockBars: item.quantity },
        });
        await tx.nppStockMovement.create({
          data: {
            nppOrgId,
            profileId: item.profileId,
            direction: 'IN',
            quantity: item.quantity,
            reason: 'Nhập từ phiếu công ty giao',
            orderId: order.id,
            createdById: userId,
            note: order.code,
          },
        });
      }
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: 'NPP_RECEIVED', title: 'NPP xác nhận nhận đủ hàng', actor: 'NPP', note: 'Kho NPP đã được cập nhật.' },
      });
      return tx.order.update({
        where: { id: order.id },
        data: { status: 'NPP_RECEIVED', dueNote: 'NPP đã nhận đủ hàng' },
        include: { items: true },
      });
    });

    return this.toNppInboundShipment(updated);
  }

  async adjustProfileStock(profileId: string, input: AdjustProfileStockInput, userId?: string): Promise<ProfileStockMovementItem> {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Không tìm thấy thanh nhôm.');
    const delta = input.direction === 'IN' ? input.quantity : -input.quantity;

    const created = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.profileStockMovement.create({
        data: {
          profileId, direction: input.direction, quantity: input.quantity,
          reason: input.reason ?? 'Điều chỉnh kiểm kê', note: input.note ?? '', createdById: userId ?? null,
        },
      });
      await tx.profile.update({ where: { id: profileId }, data: { stockBars: { increment: delta } } });
      return movement;
    });
    return {
      id: created.id, profileId: created.profileId, direction: created.direction as ProfileStockMovementItem['direction'],
      quantity: created.quantity, reason: created.reason, orderId: created.orderId ?? undefined, note: created.note,
      createdAt: created.createdAt.toISOString(),
    };
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

  async syncOrderStock(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.profileId) continue;
        await tx.profileStockMovement.create({
          data: {
            profileId: item.profileId, direction: 'IN', quantity: item.quantity,
            reason: 'Nhập kho từ đơn hàng ' + order.code, orderId, createdById: userId,
          },
        });
        await tx.profile.update({
          where: { id: item.profileId },
          data: { stockBars: { increment: item.quantity } },
        });
      }
    });
    return { success: true };
  }

  async cutProfile(profileId: string, cutLengths: number[], projectId: string | undefined, userId: string) {
    // 1 bar = 6000mm. 
    // This function assumes one bar is cut. If multiple bars are cut, they should be called per bar or handle total quantity.
    // Assuming cutLengths are the final usable lengths needed. 
    // The sum of cutLengths + leftover must be <= 6000.
    const totalCut = cutLengths.reduce((a, b) => a + b, 0);
    if (totalCut > 6000) throw new Error('Tổng chiều dài cắt vượt quá 6000mm của 1 cây nhôm.');

    const leftover = 6000 - totalCut;

    await this.prisma.$transaction(async (tx) => {
      // Trừ 1 cây nguyên
      await tx.profile.update({
        where: { id: profileId },
        data: { stockBars: { decrement: 1 } },
      });
      await tx.profileStockMovement.create({
        data: {
          profileId, direction: 'OUT', quantity: 1,
          reason: 'Xuất cắt cho công trình', createdById: userId,
        },
      });

      // Xử lý Đề xê hoặc Phế liệu
      if (leftover >= 1000) {
        // Lưu vào ProfileCutoff (Đề xê)
        await tx.profileCutoff.create({
          data: {
            profileId, lengthMm: leftover, quantity: 1, projectId, createdById: userId,
          },
        });
      } else if (leftover > 0) {
        // Cộng vào phế liệu dự kiến (Quy đổi ra kg). 
        // 1 cây 6m có cân nặng là profile.kgPerMeter * 6. (or if not available, approximate)
        const profile = await tx.profile.findUnique({ where: { id: profileId } });
        const kgPerMeter = profile?.kgPerMeter ?? 1; // Default 1kg/m if unknown
        const scrapWeight = (leftover / 1000) * kgPerMeter;
        
        await tx.user.update({
          where: { id: userId },
          data: { scrapKg: { increment: scrapWeight } },
        });
      }
    });

    return { success: true, leftover, isScrap: leftover < 1000 };
  }
}
