import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateNppFactoryInput,
  CreateAdminToNppShipmentInput,
  CreateOrderInput,
  NppDashboardData,
  NppFactoryItem,
  NppFactoryReconciliation,
  NppFinancialReportData,
  NppMonthlyReport,
  UpdateOrderInput,
} from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';

const STD_BAR_M = 6;

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
const ORDER_KG_PER_BLOCK = 100;
const ORDER_POINTS_PER_KG_BLOCK = 10;

function normalizeCodePart(value: string): string {
  const noMarks = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/g, 'd')
    .replace(/Ä/g, 'D');
  return noMarks.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 18) || 'CSSX';
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly createOrderRequests = new Map<string, { expiresAt: number; promise: Promise<any> }>();
  private nppColorSchemaReady = false;

  private async ensureNppColorSchema() {
    if (this.nppColorSchemaReady) return;
    await this.prisma.$executeRawUnsafe('ALTER TABLE "NppProfileStock" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
    await this.prisma.$executeRawUnsafe('ALTER TABLE "NppStockMovement" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
    await this.prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "NppProfileStock_nppOrgId_profileId_key"');
    await this.prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_profileId_colorCode_key" ON "NppProfileStock"("nppOrgId", "profileId", "colorCode")');
    await this.prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppProfileStock_colorCode_idx" ON "NppProfileStock"("colorCode")');
    await this.prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppStockMovement_colorCode_idx" ON "NppStockMovement"("colorCode")');
    this.nppColorSchemaReady = true;
  }

  private theoreticalKg(profile: any, quantity: number, inputKgPerMeter = 0) {
    const kgPerMeter = profile?.kgPerMeter ?? inputKgPerMeter ?? 0;
    const barLengthM = (profile?.barLengthMm ?? STD_BAR_M * 1000) / 1000;
    return Number((kgPerMeter * barLengthM * quantity).toFixed(2));
  }

  private resolveActualTotalKg(inputActualTotalKg: unknown, theoreticalTotalKg: number) {
    const value = Number(inputActualTotalKg);
    if (Number.isFinite(value) && value > 0) return Number(value.toFixed(2));
    return Number(theoreticalTotalKg.toFixed(2));
  }

  private amountForActualWeight(actualTotalKg: number, theoreticalTotalKg: number, theoreticalAmount: number) {
    if (theoreticalTotalKg <= 0 || theoreticalAmount <= 0) return 0;
    const avgPricePerKg = theoreticalAmount / theoreticalTotalKg;
    return Math.round(actualTotalKg * avgPricePerKg);
  }

  private hasGlobalOrderAccess(user?: JwtUser): boolean {
    return !user || user.isCeo === true || user.role === 'ADMIN' || user.role === 'STAFF';
  }

  private assertCanAccessOrder(order: { createdById: string | null; nppOrgId: string | null }, user?: JwtUser) {
    if (this.hasGlobalOrderAccess(user)) return;
    if (user?.role === 'NPP' && user.organizationId && order.nppOrgId === user.organizationId) return;
    if ((user?.role === 'FACTORY' || user?.role === 'DAILY') && order.createdById === user.sub) return;
    throw new ForbiddenException('KhÃ´ng cÃ³ quyá»n truy cáº­p Ä‘Æ¡n hÃ ng nÃ y.');
  }

  private maskNppStockForWorker(order: any, user?: JwtUser) {
    if (user?.role !== 'FACTORY' && user?.role !== 'DAILY') return order;
    if (!Array.isArray(order?.items)) return order;
    return {
      ...order,
      items: order.items.map((item: any) => {
        if (!item?.profile) return item;
        const { stockBars: _stockBars, lowStockAlert: _lowStockAlert, ...profile } = item.profile;
        return { ...item, profile };
      }),
    };
  }

  private async actorNameForUser(user?: JwtUser, fallback = 'He thong') {
    if (!user) return fallback;
    if (user.organizationName) return user.organizationName;
    if (user.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { productionName: true, name: true },
      });
      if (organization?.productionName || organization?.name) return organization.productionName || organization.name;
    }
    return user.displayName || fallback;
  }

  private async nextOrderCode(organization?: { id: string; code: string; shortLabel: string | null } | null): Promise<string> {
    const now = new Date();
    const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = organization?.shortLabel || organization?.code || 'EH';

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const count = organization
      ? await this.prisma.order.count({
          where: { createdBy: { organizationId: organization.id }, createdAt: { gte: startOfDay, lt: endOfDay } },
        })
      : await this.prisma.order.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } });

    return `${prefix}-${ymd}-${String(count + 1).padStart(2, '0')}`;
  }

  async createOrder(input: CreateOrderInput, userId?: string) {
    const requestId = input.clientRequestId?.trim();
    const requestKey = userId && requestId ? `${userId}:${requestId}` : '';
    const now = Date.now();
    if (requestKey) {
      const current = this.createOrderRequests.get(requestKey);
      if (current && current.expiresAt > now) return current.promise;
      if (current) this.createOrderRequests.delete(requestKey);
    }

    const promise = this.createOrderInternal(input, userId);
    if (!requestKey) return promise;

    this.createOrderRequests.set(requestKey, { expiresAt: now + 10 * 60 * 1000, promise });
    try {
      return await promise;
    } catch (error) {
      this.createOrderRequests.delete(requestKey);
      throw error;
    }
  }

  private async createOrderInternal(input: CreateOrderInput, userId?: string) {
    const profileIds = input.items.map((i) => i.profileId).filter(Boolean);
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: profileIds } } });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    let totalKg = 0;
    let totalAmount = 0;
    const itemsData = input.items.map((item) => {
      const profile = profileById.get(item.profileId);
      const pricePerKg = profile?.pricePerKg ?? 0;
      const itemKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const theoreticalTotalKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const itemPrice = Math.round(itemKg * pricePerKg);
      totalKg += itemKg;
      totalAmount += itemPrice;
      return {
        profileId: profile?.id ?? null, productCode: item.productCode, productName: item.productName,
        colorCode: item.colorCode ?? '', quantity: item.quantity, unit: 'cÃ¢y', totalKg: itemKg,
        theoreticalTotalKg,
        unitPrice: pricePerKg, totalPrice: itemPrice,
      };
    });

    const actualTotalKg = this.resolveActualTotalKg(input.actualTotalKg, totalKg);
    const actualTotalAmount = this.amountForActualWeight(actualTotalKg, totalKg, totalAmount);
    const creator = userId ? await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true } }) : null;
    const canSeeNppStockWarnings = creator?.role === 'NPP';
    const factoryOrg = creator?.organization?.type === 'FACTORY' ? creator.organization : null;
    const code = await this.nextOrderCode(factoryOrg);

    let nppOrgId: string | null = null;
    let nppName = '';
    let nppWarning: string | undefined;
    if (creator?.organization?.type === 'FACTORY') {
      const managedByNppId = creator.organization.managedByNppId;
      if (managedByNppId) {
        const npp = await this.prisma.organization.findUnique({ where: { id: managedByNppId } });
        if (npp) { nppOrgId = npp.id; nppName = npp.name; }
      } else {
        nppWarning = 'XÆ°á»Ÿng chÆ°a Ä‘Æ°á»£c gÃ¡n NPP quáº£n lÃ½ â€” Ä‘Æ¡n chÆ°a thá»ƒ chuyá»ƒn tá»›i NPP nÃ o.';
      }
    } else if (creator?.organization?.type === 'NPP') {
      nppOrgId = creator.organization.id;
      nppName = creator.organization.name;
    }

    const order = await this.prisma.order.create({
      data: {
        code, sourceType: input.sourceType, createdById: creator?.id ?? null,
        factoryName: creator?.organization?.type === 'FACTORY' ? creator.organization.name : '',
        nppOrgId, nppName,
        customerName: input.customerName ?? factoryOrg?.productionName ?? factoryOrg?.name ?? creator?.displayName ?? '',
        customerPhone: input.customerPhone ?? factoryOrg?.phone ?? creator?.phone ?? '',
        deliveryAddress: input.deliveryAddress ?? factoryOrg?.address ?? '',
        colorCode: input.colorCode ?? '', note: input.note ?? '',
        accessoriesNote: input.accessoriesNote ?? '', status: 'NEW', totalKg: actualTotalKg,
        totalAmount: actualTotalAmount, dueNote: 'Chờ NPP tiếp nhận', items: { create: itemsData },
        histories: { create: [{ status: 'NEW', title: 'Gửi NPP', actor: factoryOrg?.productionName || factoryOrg?.name || creator?.displayName || 'Người dùng', note: 'Đơn đã được gửi tới NPP.' }] },
      },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });

    return { ...order, stockWarnings: canSeeNppStockWarnings ? [] : [], nppWarning };
  }

  listOrders(filter: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string; page: number; pageSize?: number; }, user?: JwtUser): Promise<{ items: any[]; total: number; page: number; pageSize: number }>;
  listOrders(filter?: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string; page?: undefined; pageSize?: number; }, user?: JwtUser): Promise<any[]>;
  async listOrders(filter?: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string; page?: number; pageSize?: number; }, user?: JwtUser) {
    const where = {
      sourceType: filter?.sourceType, status: filter?.status, createdById: filter?.createdById, nppOrgId: filter?.nppOrgId,
    };
    if (filter?.page !== undefined) {
      const pageSize = filter.pageSize ?? 5;
      const page = filter.page;
      const [items, total] = await Promise.all([
        this.prisma.order.findMany({
          where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
          include: { items: { include: { profile: true } }, histories: { orderBy: { createdAt: 'desc' } } },
        }),
        this.prisma.order.count({ where }),
      ]);
      return { items: items.map((item) => this.maskNppStockForWorker(item, user)), total, page, pageSize };
    }
    const items = await this.prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            displayName: true,
            phone: true,
            email: true,
            organization: {
              select: { name: true, address: true, phone: true, email: true, productionName: true, mainCategories: true },
            },
          },
        },
        nppOrg: {
          select: { name: true, address: true, phone: true, email: true, productionName: true, mainCategories: true },
        },
        items: { include: { profile: true } },
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
    return items.map((item) => this.maskNppStockForWorker(item, user));
  }

  async getOrder(id: string, user?: JwtUser) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        createdBy: {
          select: {
            displayName: true,
            phone: true,
            email: true,
            organization: {
              select: { name: true, address: true, phone: true, email: true, productionName: true, mainCategories: true },
            },
          },
        },
        items: { include: { profile: true } },
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng.');
    this.assertCanAccessOrder(order, user);
    return this.maskNppStockForWorker(order, user);
  }

  async deleteOrder(id: string, user?: JwtUser) {
    const existing = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });
    if (!existing) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng.');

    this.assertCanAccessOrder(existing, user);

    await this.prisma.orderItem.deleteMany({ where: { orderId: existing.id } });
    await this.prisma.orderStatusHistory.deleteMany({ where: { orderId: existing.id } });
    await this.prisma.profileStockMovement.deleteMany({ where: { orderId: existing.id } });
    await this.prisma.debt.deleteMany({ where: { orderId: existing.id } });
    await this.prisma.workOrder.deleteMany({ where: { orderId: existing.id } });

    await this.prisma.order.delete({ where: { id: existing.id } });
    return true;
  }

  async updateExportFields(id: string, input: { customerCode?: string; invoiceNo?: string; poNo?: string }, user?: JwtUser) {
    const order = await this.getOrder(id, user);
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        ...(input.customerCode !== undefined ? { customerCode: input.customerCode } : {}),
        ...(input.invoiceNo !== undefined ? { invoiceNo: input.invoiceNo } : {}),
        ...(input.poNo !== undefined ? { poNo: input.poNo } : {}),
      },
    });
    return this.getOrder(id, user);
  }

  async updateOrderStatus(id: string, status: string, actor: string, title: string, note = '', user?: JwtUser) {
    const order = await this.getOrder(id, user);

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['NEW', 'CANCELLED'],
      NEW: ['NPP_REVIEWING', 'CONFIRMED', 'CANCELLED'],
      NPP_REVIEWING: ['CONFIRMED', 'CANCELLED'],
      ADMIN_SENT_NPP: ['NPP_RECEIVED', 'CANCELLED'],
      NPP_RECEIVED: [],
      CONFIRMED: ['RESERVED', 'PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED', 'CANCELLED'],
      RESERVED: ['PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED', 'CANCELLED'],
      PICKING: ['SHIPPED', 'PARTIALLY_SHIPPED', 'CANCELLED'],
      PARTIALLY_SHIPPED: ['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'COMPLETED', 'CANCELLED'],
      DELIVERED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[order.status];
    if (allowed && !allowed.includes(status) && order.status !== status) {
      throw new BadRequestException(`KhÃ´ng thá»ƒ chuyá»ƒn Ä‘Æ¡n hÃ ng tá»« tráº¡ng thÃ¡i ${order.status} sang ${status}.`);
    }

    await this.prisma.orderStatusHistory.create({
      data: { orderId: order.id, status, title, actor, note },
    });
    const updated = await this.prisma.order.update({
      where: { id: order.id }, data: { status },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });

    if (order.createdById) {
      const statusTextMap: Record<string, string> = {
        CONFIRMED: 'NPP Ä‘Ã£ xÃ¡c nháº­n Ä‘Æ¡n hÃ ng',
        SHIPPED: 'ÄÆ¡n hÃ ng Ä‘ang Ä‘Æ°á»£c váº­n chuyá»ƒn',
        PARTIALLY_SHIPPED: 'ÄÆ¡n hÃ ng Ä‘Ã£ Ä‘Æ°á»£c giao má»™t pháº§n',
        DELIVERED: 'ÄÆ¡n hÃ ng Ä‘Ã£ giao tá»›i xÆ°á»Ÿng',
        COMPLETED: 'ÄÆ¡n hÃ ng Ä‘Ã£ hoÃ n thÃ nh',
        CANCELLED: 'ÄÆ¡n hÃ ng Ä‘Ã£ bá»‹ há»§y'
      };
      const textMsg = statusTextMap[status] || `ÄÆ¡n hÃ ng chuyá»ƒn sang ${status}`;
      await this.prisma.notification.create({
        data: {
          userId: order.createdById,
          title: `ÄÆ¡n hÃ ng ${order.code}`,
          body: textMsg,
          type: 'ORDER_STATUS',
          refId: order.id,
        }
      }).catch(() => undefined);
    }

    if (status === 'COMPLETED') {
      await this.createNppDebtForOrder(updated.id);
      await this.awardOrderPoints(updated.id);
    }
    return this.maskNppStockForWorker(updated, user);
  }

  private async awardOrderPoints(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }, select: { id: true, code: true, totalKg: true, nppOrgId: true, createdById: true },
    });
    if (!order || !order.nppOrgId || !order.createdById) return;

    const points = Math.floor(order.totalKg / ORDER_KG_PER_BLOCK) * ORDER_POINTS_PER_KG_BLOCK;
    if (points <= 0) return;

    const existing = await this.prisma.pointLedger.findFirst({ where: { reason: 'ORDER_COMPLETED', refId: order.id } });
    if (existing) return;

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: order.createdById! }, select: { points: true } });
      if (!user) return;
      const balanceAfter = user.points + points;
      await tx.user.update({ where: { id: order.createdById! }, data: { points: balanceAfter } });
      await tx.pointLedger.create({
        data: {
          userId: order.createdById!, delta: points, balanceAfter, reason: 'ORDER_COMPLETED',
          refType: 'ORDER', refId: order.id, note: `ÄÆ¡n hoÃ n táº¥t ${order.code} Â· ${order.totalKg.toFixed(0)}kg`,
        },
      });
    });
  }

  private async createNppDebtForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }, include: { createdBy: { include: { organization: true } } },
    });
    if (!order || !order.nppOrgId) return;

    const existing = await this.prisma.debt.findFirst({ where: { orderId: order.id } });
    if (existing) return;

    const factoryOrg = order.createdBy?.organization?.type === 'FACTORY' ? order.createdBy.organization : null;
    if (!factoryOrg) return;

    await this.prisma.debt.create({
      data: {
        type: 'NPP', direction: 'RECEIVABLE', partnerName: factoryOrg.name, amount: order.totalAmount,
        note: `CÃ´ng ná»£ Ä‘Æ¡n ${order.code}`, nppOrgId: order.nppOrgId, factoryOrgId: factoryOrg.id, orderId: order.id,
      },
    });
  }

  async updateOrder(id: string, input: UpdateOrderInput, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng.');
    if (!['DRAFT', 'NEW'].includes(order.status)) throw new BadRequestException('Chá»‰ cÃ³ thá»ƒ sá»­a Ä‘Æ¡n khi tráº¡ng thÃ¡i lÃ  Má»›i (NEW).');
    if (order.createdById !== userId) throw new BadRequestException('KhÃ´ng cÃ³ quyá»n sá»­a Ä‘Æ¡n nÃ y.');

    const profileIds = (input.items ?? []).map((i) => i.profileId).filter(Boolean);
    const profiles = profileIds.length ? await this.prisma.profile.findMany({ where: { id: { in: profileIds } } }) : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    let totalKg = 0;
    let totalAmount = 0;
    const newItemsData = (input.items ?? order.items.map((i) => ({
      profileId: i.profileId ?? '', productCode: i.productCode, productName: i.productName,
      colorCode: i.colorCode, quantity: i.quantity,
    }))).map((item) => {
      const profile = profileById.get(item.profileId);
      const pricePerKg = profile?.pricePerKg ?? 0;
      const itemKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const theoreticalTotalKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const itemPrice = Math.round(itemKg * pricePerKg);
      totalKg += itemKg;
      totalAmount += itemPrice;
      return {
        profileId: profile?.id ?? null, productCode: item.productCode, productName: item.productName,
        colorCode: item.colorCode ?? '', quantity: item.quantity, unit: 'cÃ¢y', totalKg: itemKg,
        theoreticalTotalKg,
        unitPrice: pricePerKg, totalPrice: itemPrice,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({ data: newItemsData.map((d) => ({ ...d, orderId: id })) });
      }

      const updateData: Record<string, unknown> = {};
      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
      if (input.deliveryAddress !== undefined) updateData.deliveryAddress = input.deliveryAddress;
      if (input.colorCode !== undefined) updateData.colorCode = input.colorCode;
      if (input.note !== undefined) updateData.note = input.note;
      if (input.accessoriesNote !== undefined) updateData.accessoriesNote = input.accessoriesNote;
      if (input.items) {
        const actualTotalKg = this.resolveActualTotalKg(input.actualTotalKg, totalKg);
        updateData.totalKg = actualTotalKg;
        updateData.totalAmount = this.amountForActualWeight(actualTotalKg, totalKg, totalAmount);
      }

      await tx.order.update({ where: { id }, data: updateData });
    });

    return this.getOrder(id);
  }

  async submitOrderToNpp(id: string, user: JwtUser) {
    const order = await this.getOrder(id, user);
    if (order.createdById !== user.sub) throw new ForbiddenException('Không có quyền gửi đơn này.');
    if (!['DRAFT', 'NEW'].includes(order.status)) throw new BadRequestException('Chỉ gửi NPP khi đơn còn ở trạng thái mới.');

    const actor = await this.actorNameForUser(user, 'CSSX');
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'NEW',
        title: 'Gửi NPP',
        actor,
        note: order.nppName ? `Đơn đã được gửi tới ${order.nppName}.` : 'Đơn đã được gửi tới luồng NPP.',
      },
    });
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'NEW', dueNote: 'Chờ NPP tiếp nhận' },
      include: { items: { include: { profile: true } }, histories: { orderBy: { createdAt: 'desc' } } },
    });
    return this.maskNppStockForWorker(updated, user);
  }

  async nppDashboard(nppOrgId: string): Promise<NppDashboardData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [statusGroups, managedFactoryCount, openDebts, monthOrders] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { nppOrgId }, _count: { _all: true } }),
      this.prisma.organization.count({ where: { managedByNppId: nppOrgId } }),
      this.prisma.debt.aggregate({
        where: { nppOrgId, status: { not: 'PAID' } }, _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.order.findMany({
        where: { nppOrgId, createdAt: { gte: startOfMonth } }, select: { totalAmount: true },
      }),
    ]);

    const ordersByStatus: Record<string, number> = {};
    for (const g of statusGroups) ordersByStatus[g.status] = g._count._all;

    return {
      ordersByStatus, managedFactoryCount,
      openDebtTotal: openDebts._sum.amount ?? 0, openDebtPaid: openDebts._sum.paidAmount ?? 0,
      monthRevenue: monthOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    };
  }

  private toNppFactoryItem(factory: {
    id: string; code: string; name: string; phone: string | null; address: string | null;
    province: string | null; email: string | null; shortLabel: string | null; createdAt: Date;
    _count: { users: number };
  }): NppFactoryItem {
    return {
      id: factory.id,
      code: factory.code,
      name: factory.name,
      phone: factory.phone ?? undefined,
      address: factory.address ?? undefined,
      province: factory.province ?? undefined,
      email: factory.email ?? undefined,
      shortLabel: factory.shortLabel ?? undefined,
      userCount: factory._count.users,
      createdAt: factory.createdAt.toISOString(),
    };
  }

  async listNppFactories(nppOrgId: string): Promise<NppFactoryItem[]> {
    const factories = await this.prisma.organization.findMany({
      where: { type: 'FACTORY', managedByNppId: nppOrgId },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return factories.map((factory) => this.toNppFactoryItem(factory));
  }

  private async nextNppFactoryCode(nppOrgId: string, factoryName: string): Promise<string> {
    const npp = await this.prisma.organization.findUnique({ where: { id: nppOrgId }, select: { code: true, shortLabel: true } });
    if (!npp) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y NPP.');

    const prefix = normalizeCodePart(npp.shortLabel || npp.code || 'NPP');
    const namePart = normalizeCodePart(factoryName);
    for (let i = 0; i < 12; i += 1) {
      const random = Math.random().toString(36).slice(2, 7).toUpperCase();
      const code = `${prefix}_${namePart}_${random}`;
      const existing = await this.prisma.organization.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('KhÃ´ng sinh Ä‘Æ°á»£c mÃ£ CSSX, vui lÃ²ng thá»­ láº¡i.');
  }

  async createNppFactory(nppOrgId: string, input: CreateNppFactoryInput): Promise<NppFactoryItem> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('TÃªn cÆ¡ sá»Ÿ sáº£n xuáº¥t khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.');

    const code = await this.nextNppFactoryCode(nppOrgId, name);
    const created = await this.prisma.organization.create({
      data: {
        code,
        name,
        type: 'FACTORY',
        shortLabel: input.shortLabel?.trim() || normalizeCodePart(name).slice(0, 10),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        province: input.province?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        managedByNppId: nppOrgId,
      },
      include: { _count: { select: { users: true } } },
    });
    return this.toNppFactoryItem(created);
  }

  private async nextAdminShipmentCode(): Promise<string> {
    const now = new Date();
    const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const count = await this.prisma.order.count({
      where: { sourceType: 'ADMIN_TO_NPP', createdAt: { gte: startOfDay, lt: endOfDay } },
    });
    return `GIAO-NPP-${ymd}-${String(count + 1).padStart(2, '0')}`;
  }

  async createAdminToNppShipment(input: CreateAdminToNppShipmentInput, userId: string) {
    if (!input.nppOrgId) throw new BadRequestException('Chọn NPP nhận hàng.');
    if (!input.items?.length) throw new BadRequestException('Phiếu giao cần ít nhất một dòng hàng.');

    const npp = await this.prisma.organization.findFirst({ where: { id: input.nppOrgId, type: 'NPP' } });
    if (!npp) throw new NotFoundException('Không tìm thấy NPP.');

    const profileIds = input.items.map((item) => item.profileId).filter(Boolean);
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: profileIds } } });
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    let totalKg = 0;
    let totalAmount = 0;
    const itemsData = input.items.map((item) => {
      const profile = profileById.get(item.profileId);
      if (!profile) throw new BadRequestException(`Không tìm thấy mã thanh ${item.productCode || item.profileId}.`);
      const itemKg = this.theoreticalKg(profile, item.quantity, item.kgPerMeter);
      const theoreticalTotalKg = this.theoreticalKg(profile, item.quantity, item.kgPerMeter);
      const itemPrice = Math.round(itemKg * profile.pricePerKg);
      totalKg += itemKg;
      totalAmount += itemPrice;
      return {
        profileId: profile.id,
        productCode: item.productCode || profile.code,
        productName: item.productName || profile.name,
        colorCode: item.colorCode ?? '',
        quantity: item.quantity,
        unit: 'cây',
        totalKg: itemKg,
        theoreticalTotalKg,
        unitPrice: profile.pricePerKg,
        totalPrice: itemPrice,
      };
    });

    const actualTotalKg = this.resolveActualTotalKg(input.actualTotalKg, totalKg);
    const actualTotalAmount = this.amountForActualWeight(actualTotalKg, totalKg, totalAmount);

    for (const item of itemsData) {
      const profile = profileById.get(item.profileId);
      if (profile && profile.stockBars < item.quantity) throw new BadRequestException(`Tồn công ty của ${profile.code} không đủ để giao NPP.`);
    }

    const code = await this.nextAdminShipmentCode();
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          code,
          sourceType: 'ADMIN_TO_NPP',
          createdById: userId,
          nppOrgId: npp.id,
          nppName: npp.name,
          customerName: npp.name,
          customerPhone: npp.phone ?? '',
          deliveryAddress: npp.address ?? '',
          note: input.note ?? '',
          invoiceNo: input.invoiceNo ?? '',
          poNo: input.poNo ?? '',
          status: 'ADMIN_SENT_NPP',
          dueNote: 'Chờ NPP xác nhận nhận đủ hàng',
          totalKg: actualTotalKg,
          totalAmount: actualTotalAmount,
          items: { create: itemsData },
          histories: { create: [{ status: 'ADMIN_SENT_NPP', title: 'Công ty giao NPP', actor: 'WebAdmin', note: 'Phiếu giao hàng về NPP được tạo.' }] },
        },
        include: { items: { include: { profile: true } }, histories: { orderBy: { createdAt: 'desc' } } },
      });

      for (const item of itemsData) {
        await tx.profile.update({ where: { id: item.profileId }, data: { stockBars: { decrement: item.quantity } } });
        await tx.profileStockMovement.create({
          data: {
            profileId: item.profileId,
            direction: 'OUT',
            quantity: item.quantity,
            reason: 'Xuất giao NPP',
            orderId: created.id,
            createdById: userId,
            note: created.code,
          },
        });
      }

      return created;
    });
  }

  async createNppDelivery(id: string, user: JwtUser, input: { actualTotalKg?: number } = {}) {
    await this.ensureNppColorSchema();
    const order = await this.getOrder(id, user);
    if (!order.nppOrgId || !user.organizationId || order.nppOrgId !== user.organizationId) throw new ForbiddenException('Không có quyền tạo đơn giao.');
    if (!['NPP_REVIEWING', 'CONFIRMED', 'RESERVED'].includes(order.status)) throw new BadRequestException('Chỉ tạo đơn giao khi NPP đã tiếp nhận hoặc xác nhận đơn.');

    const existingMovement = await this.prisma.nppStockMovement.findFirst({
      where: { nppOrgId: user.organizationId, orderId: order.id, direction: 'OUT', reason: 'Xuất giao CSSX' },
    });
    if (existingMovement) return this.getOrder(id, user);

    for (const item of order.items) {
      if (!item.profileId) continue;
      const colorCode = normalizeColorCode(item.colorCode);
      const stock = await this.prisma.nppProfileStock.findUnique({
        where: { nppOrgId_profileId_colorCode: { nppOrgId: user.organizationId, profileId: item.profileId, colorCode } },
      });
      if (!stock || stock.stockBars < item.quantity) throw new BadRequestException(`Kho NPP không đủ ${item.productCode}.`);
    }

    const theoreticalTotalKg = order.items.reduce((sum: number, item: any) => sum + (item.totalKg || 0), 0) || order.totalKg;
    const theoreticalAmount = order.items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || order.totalAmount;
    const actualTotalKg = this.resolveActualTotalKg(input.actualTotalKg, theoreticalTotalKg);
    const actualTotalAmount = this.amountForActualWeight(actualTotalKg, theoreticalTotalKg, theoreticalAmount);

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.profileId) continue;
        const colorCode = normalizeColorCode(item.colorCode);
        await tx.nppProfileStock.update({
          where: { nppOrgId_profileId_colorCode: { nppOrgId: user.organizationId!, profileId: item.profileId, colorCode } },
          data: { stockBars: { decrement: item.quantity } },
        });
        await tx.nppStockMovement.create({
          data: {
            nppOrgId: user.organizationId!,
            profileId: item.profileId,
            colorCode,
            direction: 'OUT',
            quantity: item.quantity,
            reason: 'Xuất giao CSSX',
            orderId: order.id,
            createdById: user.sub,
            note: order.code,
          },
        });
      }
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: 'SHIPPED', title: 'Tạo đơn giao', actor: await this.actorNameForUser(user, 'NPP'), note: 'NPP tạo đơn giao và trừ kho NPP.' },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'SHIPPED', dueNote: 'Đã tạo đơn giao từ NPP', totalKg: actualTotalKg, totalAmount: actualTotalAmount },
      });
    });

    return this.getOrder(id, user);
  }

  async completeNppDelivery(id: string, user: JwtUser) {
    const order = await this.getOrder(id, user);
    if (!order.nppOrgId || !user.organizationId || order.nppOrgId !== user.organizationId) throw new ForbiddenException('Không có quyền hoàn thành đơn giao.');
    if (!['SHIPPED', 'DELIVERED'].includes(order.status)) throw new BadRequestException('Chỉ hoàn thành đơn sau khi đã tạo đơn giao.');

    await this.prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'COMPLETED',
          title: 'Hoàn thành đơn',
          actor: await this.actorNameForUser(user, 'NPP'),
          note: 'NPP xác nhận đơn giao đã hoàn tất.',
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', dueNote: 'NPP đã hoàn thành đơn giao' },
      });
    });

    return this.getOrder(id, user);
  }

  async nppOrderReconciliation(nppOrgId: string, filter?: { month?: string }): Promise<NppFactoryReconciliation[]> {
    let dateRange: { gte: Date; lt: Date } | undefined;
    if (filter?.month) {
      const [y, m] = filter.month.split('-').map(Number);
      dateRange = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const orders = await this.prisma.order.findMany({
      where: { nppOrgId, createdAt: dateRange }, include: { createdBy: { include: { organization: true } } },
    });

    const groups = new Map<string, NppFactoryReconciliation>();
    for (const order of orders) {
      const factoryOrg = order.createdBy?.organization?.type === 'FACTORY' ? order.createdBy.organization : null;
      const key = factoryOrg?.id ?? '__unknown__';
      let group = groups.get(key);
      if (!group) {
        group = { factoryOrgId: factoryOrg?.id, factoryName: factoryOrg?.name ?? order.factoryName ?? 'KhÃ´ng xÃ¡c Ä‘á»‹nh', counts: {}, totalAmount: 0, totalKg: 0 };
        groups.set(key, group);
      }
      group.counts[order.status] = (group.counts[order.status] ?? 0) + 1;
      group.totalAmount += order.totalAmount;
      group.totalKg += order.totalKg;
    }

    return Array.from(groups.values());
  }

  async nppFinancialReport(nppOrgId: string, months = 6): Promise<NppFinancialReportData> {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [orders, debts] = await Promise.all([
      this.prisma.order.findMany({
        where: { nppOrgId, createdAt: { gte: rangeStart }, status: { not: 'CANCELLED' } }, select: { totalAmount: true, createdAt: true },
      }),
      this.prisma.debt.findMany({
        where: { nppOrgId, createdAt: { gte: rangeStart } }, select: { amount: true, paidAmount: true, status: true, createdAt: true },
      }),
    ]);

    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const buckets = new Map<string, NppMonthlyReport>();
    for (let i = 0; i < months; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = monthKey(d);
      buckets.set(key, { month: key, revenue: 0, debtCreated: 0, debtPaid: 0 });
    }

    let totalRevenue = 0;
    let totalDebtOpen = 0;
    for (const order of orders) {
      const bucket = buckets.get(monthKey(order.createdAt));
      if (bucket) {
        bucket.revenue += order.totalAmount;
        totalRevenue += order.totalAmount;
      }
    }
    for (const debt of debts) {
      const bucket = buckets.get(monthKey(debt.createdAt));
      if (bucket) {
        bucket.debtCreated += debt.amount;
        bucket.debtPaid += debt.paidAmount;
      }
      if (debt.status !== 'PAID') {
        totalDebtOpen += (debt.amount - debt.paidAmount);
      }
    }

    return {
      months: Array.from(buckets.values()),
      totalRevenue,
      totalDebtOpen,
    };
  }
}

