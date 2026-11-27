import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InventoryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  NppColorPriceItem, UpsertNppColorPricesInput,
  ConvertQuoteToOrderInput,
  CreateNppFactoryInput,
  CreateAdminToNppShipmentInput,
  CreateNppDeliveryInput,
  CreateOrderInput,
  NppDashboardData,
  NppFactoryItem,
  NppFactoryReconciliation,
  NppFinancialReportData,
  NppMonthlyReport,
  UpdateOrderInput,
} from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { QuotationBomService } from '../quotations/quotation-bom.service';
import { InventoryCommandService, type InventoryCommandContext } from '../inventory/inventory-command.service';
import { businessDateUtcRange, formatNppInvoiceNumber, formatNppPoNumber } from './order-identifiers';
import { calculateNppColorPricing } from './npp-color-pricing';
import { EurohouseAccessService } from '../eurohouse-access/eurohouse-access.service';

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
function requireSingleColorCode(colorCode?: string) {
  const value = (colorCode || '').trim();
  if (value.includes(',')) {
    throw new BadRequestException('Dòng hàng có nhiều màu ghép chung. Vui lòng tách riêng số cây cho từng màu trước khi tạo đơn giao.');
  }
  return normalizeColorCode(value);
}
const ORDER_KG_PER_BLOCK = 100;
const ORDER_POINTS_PER_KG_BLOCK = 10;

export function calculateNppDeliveryPricing(input: Pick<CreateNppDeliveryInput, 'actualTotalKg' | 'finalUnitPricePerKg' | 'discountAmount' | 'surchargeAmount'>) {
  const actualTotalKg = Number(input.actualTotalKg);
  const finalUnitPricePerKg = Number(input.finalUnitPricePerKg);
  const discountAmount = Number(input.discountAmount ?? 0);
  const surchargeAmount = Number(input.surchargeAmount ?? 0);

  if (!Number.isFinite(actualTotalKg) || actualTotalKg <= 0) {
    throw new BadRequestException('Nhập tổng kg thực tế cân của toàn đơn giao.');
  }
  if (!Number.isFinite(finalUnitPricePerKg) || finalUnitPricePerKg <= 0) {
    throw new BadRequestException('Nhập đơn giá NPP áp dụng cho đơn giao.');
  }
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    throw new BadRequestException('Giảm giá không hợp lệ.');
  }
  if (!Number.isFinite(surchargeAmount) || surchargeAmount < 0) {
    throw new BadRequestException('Phụ phí không hợp lệ.');
  }

  const normalizedKg = Number(actualTotalKg.toFixed(2));
  const normalizedUnitPrice = Math.round(finalUnitPricePerKg);
  const normalizedDiscount = Math.round(discountAmount);
  const normalizedSurcharge = Math.round(surchargeAmount);
  const subtotalAmount = Math.round(normalizedKg * normalizedUnitPrice);
  const finalTotalAmount = subtotalAmount - normalizedDiscount + normalizedSurcharge;
  if (finalTotalAmount <= 0) {
    throw new BadRequestException('Thành tiền sau giảm giá và phụ phí phải lớn hơn 0.');
  }

  return {
    actualTotalKg: normalizedKg,
    finalUnitPricePerKg: normalizedUnitPrice,
    discountAmount: normalizedDiscount,
    surchargeAmount: normalizedSurcharge,
    subtotalAmount,
    finalTotalAmount,
  };
}

function normalizeCodePart(value: string): string {
  const noMarks = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  return noMarks.toUpperCase().replace(/[^A-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'CSSX';
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationBom: QuotationBomService,
    private readonly inventoryCommands: InventoryCommandService,
    @Optional() private readonly eurohouseAccess?: EurohouseAccessService,
  ) {}

  private async assertOrderingMutationAllowed(user?: JwtUser) {
    if (!user || (user.role !== 'FACTORY' && user.role !== 'DAILY') || !this.eurohouseAccess) return;
    const capability = await this.eurohouseAccess.getCapability(user.organizationId, 'EUROHOUSE_ORDERING');
    if (capability.status !== 'ACTIVE') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EUROHOUSE_ORDERING_REQUIRED',
        message: 'Tính năng đặt hàng chỉ áp dụng cho cơ sở đang sản xuất Nhôm Eurohouse.',
      });
    }
  }

  private readonly createOrderRequests = new Map<string, { expiresAt: number; promise: Promise<any> }>();
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
    throw new ForbiddenException('Không có quyền truy cập đơn hàng này.');
  }

  private scopedOrderWhere(
    filter: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string } | undefined,
    user?: JwtUser,
  ) {
    const where: Record<string, unknown> = {
      sourceType: filter?.sourceType,
      status: filter?.status,
      createdById: filter?.createdById,
      nppOrgId: filter?.nppOrgId,
    };

    if (this.hasGlobalOrderAccess(user)) return where;
    if (user?.role === 'NPP') {
      if (!user.organizationId) throw new ForbiddenException('Tài khoản NPP chưa được gán tổ chức.');
      where.nppOrgId = user.organizationId;
      where.createdById = undefined;
      where.status = filter?.status === 'DRAFT'
        ? '__DRAFT_IS_NOT_VISIBLE_TO_NPP__'
        : (filter?.status || { not: 'DRAFT' });
      return where;
    }
    if (user?.role === 'FACTORY' || user?.role === 'DAILY') {
      where.createdById = user.sub;
      where.nppOrgId = undefined;
      return where;
    }
    throw new ForbiddenException('Không có quyền truy cập danh sách đơn hàng.');
  }

  private maskNppStockForWorker(order: any, user?: JwtUser) {
    if (user?.role !== 'FACTORY' && user?.role !== 'DAILY') return order;
    if (!Array.isArray(order?.items)) return order;
    return {
      ...order,
      items: order.items.map((item: any) => {
        if (!item?.profile) return item;
        const profile = { ...item.profile };
        delete profile.stockBars;
        delete profile.lowStockAlert;
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

  private async nextOrderCode(organization?: { id: string; code: string; shortLabel: string | null; name?: string | null } | null): Promise<string> {
    const now = new Date();
    const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = normalizeCodePart(organization?.code || organization?.shortLabel || organization?.name || 'CSSX');

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const count = organization
      ? await this.prisma.order.count({
          where: { createdBy: { organizationId: organization.id }, createdAt: { gte: startOfDay, lt: endOfDay } },
        })
      : await this.prisma.order.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } });

    return `${prefix}-${ymd}-${String(count + 1).padStart(2, '0')}`;
  }

  private async nextNppPurchaseCode(organization: { id: string; code: string }, now = new Date()): Promise<string> {
    const { start, end } = businessDateUtcRange(now);
    const count = await this.prisma.order.count({
      where: {
        sourceType: 'NPP_TO_ADMIN',
        nppOrgId: organization.id,
        createdAt: { gte: start, lt: end },
      },
    });
    return formatNppPoNumber(organization.code, now, count + 1);
  }

  async createOrder(input: CreateOrderInput, userId?: string, user?: JwtUser) {
    await this.assertOrderingMutationAllowed(user);
    const requestId = input.clientRequestId?.trim();
    const requestKey = userId && requestId ? `${userId}:${requestId}` : '';
    const now = Date.now();
    if (requestKey) {
      const persisted = await this.prisma.order.findFirst({
        where: { createdById: userId, clientRequestId: requestId },
        include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
      });
      if (persisted) return persisted;
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
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Đơn hàng cần ít nhất một dòng sản phẩm.');
    }
    for (const item of input.items) {
      if (typeof item?.profileId !== 'string' || !item.profileId.trim()) {
        throw new BadRequestException('Mỗi dòng hàng phải liên kết với một mã thanh trong catalog.');
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(`Số cây của ${item.productCode || 'dòng hàng'} phải là số nguyên dương.`);
      }
      requireSingleColorCode(item.colorCode);
    }

    const profileIds = Array.from(new Set(input.items.map((item) => item.profileId.trim())));
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: profileIds } } });
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const missingProfileId = profileIds.find((profileId) => !profileById.has(profileId));
    if (missingProfileId) throw new BadRequestException('Có mã thanh không còn tồn tại trong catalog. Vui lòng tải lại danh mục.');

    const creator = userId ? await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true } }) : null;
    const canSeeNppStockWarnings = creator?.role === 'NPP';
    const nppOrganization = creator?.organization?.type === 'NPP' ? creator.organization : null;
    const createdByNpp = Boolean(nppOrganization);
    const nppPurchase = createdByNpp && input.sourceType === 'NPP_TO_ADMIN';
    if (input.sourceType === 'NPP_TO_ADMIN' && !nppOrganization) {
      throw new BadRequestException('Chỉ tài khoản thuộc NPP mới được tạo đơn đặt hàng công ty.');
    }
    const useCompanyCatalogPricing = nppPurchase;

    let totalKg = 0;
    let totalAmount = 0;
    const itemsData = input.items.map((item) => {
      const profile = profileById.get(item.profileId);
      const pricePerKg = useCompanyCatalogPricing ? profile?.pricePerKg ?? 0 : 0;
      const itemKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const theoreticalTotalKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const itemPrice = Math.round(itemKg * pricePerKg);
      totalKg += itemKg;
      totalAmount += itemPrice;
      return {
        profileId: profile!.id, productCode: profile!.code, productName: profile!.name,
        colorCode: requireSingleColorCode(item.colorCode), quantity: item.quantity, unit: 'cây', totalKg: itemKg,
        theoreticalTotalKg,
        unitPrice: pricePerKg, totalPrice: itemPrice,
      };
    });

    let factoryOrg = creator?.organization?.type === 'FACTORY' ? creator.organization : null;
    if (createdByNpp && !nppPurchase) {
      if (!input.factoryOrgId) throw new BadRequestException('Chọn cơ sở sản xuất nhận đơn hàng.');
      factoryOrg = await this.prisma.organization.findFirst({
        where: { id: input.factoryOrgId, type: 'FACTORY', managedByNppId: nppOrganization!.id },
      });
      if (!factoryOrg) throw new BadRequestException('Cơ sở sản xuất không thuộc phạm vi quản lý của NPP.');
    }
    const code = nppPurchase
      ? await this.nextNppPurchaseCode({ id: nppOrganization!.id, code: nppOrganization!.code })
      : await this.nextOrderCode(factoryOrg);

    let nppOrgId: string | null = null;
    let nppName = '';
    let nppWarning: string | undefined;
    if (creator?.organization?.type === 'FACTORY') {
      const managedByNppId = creator.organization.managedByNppId;
      if (managedByNppId) {
        const npp = await this.prisma.organization.findUnique({ where: { id: managedByNppId } });
        if (npp) { nppOrgId = npp.id; nppName = npp.name; }
      } else {
        nppWarning = 'Xưởng chưa được gán NPP quản lý - đơn chưa thể chuyển tới NPP nào.';
      }
    } else if (creator?.organization?.type === 'NPP') {
      nppOrgId = creator.organization.id;
      nppName = creator.organization.name;
    }

    const fallbackSourceType = input.sourceType || (creator?.organization?.type === 'NPP' ? 'NPP' : 'FACTORY');
    const shouldSubmit = nppPurchase || createdByNpp || (input.submitToNpp === true && Boolean(nppOrgId));
    const initialStatus = nppPurchase ? 'NEW' : (createdByNpp ? 'NPP_REVIEWING' : (shouldSubmit ? 'NEW' : 'DRAFT'));
    const initialTitle = nppPurchase ? 'NPP đặt hàng công ty' : (createdByNpp ? 'NPP tạo đơn' : (shouldSubmit ? 'Gửi NPP' : 'Lưu nháp'));
    const initialNote = nppPurchase
      ? `${nppOrganization?.name || 'NPP'} gửi yêu cầu đặt hàng tới công ty.`
      : createdByNpp
      ? `NPP tạo đơn trực tiếp cho ${factoryOrg?.productionName || factoryOrg?.name || 'CSSX'}.`
      : shouldSubmit
      ? `Đơn đã được gửi tới ${nppName || 'NPP'}.`
      : 'Đơn được lưu nháp và chưa chuyển tới NPP.';
    const initialActor = createdByNpp
      ? (creator?.organization?.productionName || creator?.organization?.name || creator?.displayName || 'NPP')
      : (factoryOrg?.productionName || factoryOrg?.name || creator?.displayName || 'Người dùng');
    const order = await this.prisma.order.create({
      data: {
        code, clientRequestId: input.clientRequestId?.trim() || null,
        sourceType: fallbackSourceType, createdById: creator?.id ?? null,
        factoryName: factoryOrg?.productionName || factoryOrg?.name || '',
        factoryOrgId: factoryOrg?.id ?? null,
        nppOrgId, nppName,
        customerName: input.customerName ?? (nppPurchase ? nppOrganization?.name : undefined) ?? factoryOrg?.productionName ?? factoryOrg?.name ?? creator?.displayName ?? '',
        customerPhone: input.customerPhone ?? (nppPurchase ? nppOrganization?.phone : undefined) ?? factoryOrg?.phone ?? creator?.phone ?? '',
        deliveryAddress: input.deliveryAddress ?? (nppPurchase ? nppOrganization?.address : undefined) ?? factoryOrg?.address ?? '',
        colorCode: input.colorCode ?? '', note: input.note ?? '',
        poNo: nppPurchase ? code : '',
        accessoriesNote: input.accessoriesNote ?? '', status: initialStatus, totalKg,
        theoreticalTotalKg: totalKg,
        actualTotalKg: null,
        totalAmount,
        pricingStatus: nppPurchase ? 'ESTIMATED_COMPANY' : 'PENDING_NPP',
        dueNote: nppPurchase ? 'Chờ công ty tiếp nhận' : (createdByNpp ? 'Chờ NPP cân và xác nhận giá' : (shouldSubmit ? 'Chờ NPP tiếp nhận' : 'Bản nháp')),
        items: { create: itemsData },
        histories: { create: [{ status: initialStatus, title: initialTitle, actor: initialActor, note: initialNote }] },
      },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });

    return { ...order, stockWarnings: canSeeNppStockWarnings ? [] : [], nppWarning };
  }

  listOrders(filter: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string; page: number; pageSize?: number; }, user?: JwtUser): Promise<{ items: any[]; total: number; page: number; pageSize: number }>;
  listOrders(filter?: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string; page?: undefined; pageSize?: number; }, user?: JwtUser): Promise<any[]>;
  async listOrders(filter?: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string; page?: number; pageSize?: number; }, user?: JwtUser) {
    const where = this.scopedOrderWhere(filter, user);
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
        factoryOrg: {
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
        factoryOrg: {
          select: { name: true, address: true, phone: true, email: true, productionName: true, mainCategories: true },
        },
        nppOrg: {
          select: { name: true, address: true, phone: true, email: true, productionName: true, mainCategories: true },
        },
        items: { include: { profile: true } },
        histories: { orderBy: { createdAt: 'desc' } },
        colorWeighings: { orderBy: [{ colorCode: 'asc' }, { basis: 'asc' }] },
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    this.assertCanAccessOrder(order, user);
    return this.maskNppStockForWorker(order, user);
  }

  async deleteOrder(id: string, user?: JwtUser) {
    await this.assertOrderingMutationAllowed(user);
    const existing = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy đơn hàng.');

    this.assertCanAccessOrder(existing, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ được xóa đơn nháp. Đơn đã gửi phải được hủy để giữ lịch sử xử lý.');
    }
    if (existing.createdById !== user?.sub && !this.hasGlobalOrderAccess(user)) {
      throw new ForbiddenException('Chỉ người tạo mới được xóa đơn nháp này.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      await tx.orderStatusHistory.deleteMany({ where: { orderId: existing.id } });
      await tx.profileStockMovement.deleteMany({ where: { orderId: existing.id } });
      await tx.debt.deleteMany({ where: { orderId: existing.id } });
      await tx.workOrder.deleteMany({ where: { orderId: existing.id } });
      await tx.order.delete({ where: { id: existing.id } });
    });
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
    if (order.status === status) return order;

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
      throw new BadRequestException(`Không thể chuyển đơn hàng từ trạng thái ${order.status} sang ${status}.`);
    }

    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status },
      });
      if (result.count === 0) return false;
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status, title, actor, note },
      });
      return true;
    });
    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });
    if (!changed) {
      if (updated.status === status) return this.maskNppStockForWorker(updated, user);
      throw new BadRequestException('Trạng thái đơn đã thay đổi. Vui lòng tải lại dữ liệu.');
    }

    if (order.createdById) {
      const statusTextMap: Record<string, string> = {
        CONFIRMED: 'NPP đã xác nhận đơn hàng',
        SHIPPED: 'Đơn hàng đang được vận chuyển',
        PARTIALLY_SHIPPED: 'Đơn hàng đã được giao một phần',
        DELIVERED: 'Đơn hàng đã giao tới xưởng',
        COMPLETED: 'Đơn hàng đã hoàn thành',
        CANCELLED: 'Đơn hàng đã bị hủy'
      };
      const textMsg = statusTextMap[status] || `Đơn hàng chuyển sang ${status}`;
      await this.prisma.notification.create({
        data: {
          userId: order.createdById,
          title: `Đơn hàng ${order.code}`,
          body: textMsg,
          type: 'ORDER_STATUS',
          refId: order.id,
        }
      }).catch(() => undefined);
    }

    if (status === 'COMPLETED') {
      await this.createNppDebtForOrder(updated.id);
      await this.awardOrderPoints(updated.id);
      await this.recordFactoryFullBarInventory(updated.id);
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

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `order-points:${order.id}`);
      const existing = await tx.pointLedger.findFirst({ where: { reason: 'ORDER_COMPLETED', refId: order.id } });
      if (existing) return;
      const updatedUser = await tx.user.update({
        where: { id: order.createdById! },
        data: { points: { increment: points } },
        select: { points: true },
      }).catch(() => null);
      if (!updatedUser) return;
      await tx.pointLedger.create({
        data: {
          userId: order.createdById!, delta: points, balanceAfter: updatedUser.points, reason: 'ORDER_COMPLETED',
          refType: 'ORDER', refId: order.id, note: `Đơn hoàn tất ${order.code} - ${order.totalKg.toFixed(0)}kg`,
        },
      });
    });
  }

  private async createNppDebtForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }, include: { factoryOrg: true, createdBy: { include: { organization: true } } },
    });
    if (!order || !order.nppOrgId) return;

    const factoryOrg = order.factoryOrg || (order.createdBy?.organization?.type === 'FACTORY' ? order.createdBy.organization : null);
    if (!factoryOrg) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `order-debt:${order.id}`);
      const existing = await tx.debt.findFirst({ where: { orderId: order.id } });
      if (existing) return;
      await tx.debt.create({
        data: {
          type: 'NPP', direction: 'RECEIVABLE', partnerName: factoryOrg.name, amount: order.totalAmount,
          note: `Công nợ đơn ${order.code}`, nppOrgId: order.nppOrgId, factoryOrgId: factoryOrg.id, orderId: order.id,
        },
      });
    });
  }

  private async recordFactoryFullBarInventory(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { profile: { select: { barLengthMm: true } } } },
        createdBy: { include: { organization: true } },
      },
    });
    if (!order) return;
    const factoryOrgId = order.factoryOrgId
      ?? (order.createdBy?.organization?.type === 'FACTORY' ? order.createdBy.organization.id : null);
    if (!factoryOrgId) return;
    const inventoryUserId = order.createdById && order.createdBy?.organizationId === factoryOrgId
      ? order.createdById
      : (await this.prisma.user.findFirst({
          where: { organizationId: factoryOrgId, role: { in: ['FACTORY', 'DAILY'] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        }))?.id;
    if (!inventoryUserId) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `factory-inventory:${order.id}`);
      const recorded = await tx.orderStatusHistory.findFirst({
        where: { orderId: order.id, title: 'Kho xưởng nhận cây nguyên' },
        select: { id: true },
      });
      if (recorded) return;

      const grouped = new Map<string, { materialCode: string; lengthMm: number; quantity: number }>();
      for (const item of order.items) {
        if (item.quantity <= 0) continue;
        const materialCode = item.productCode.trim().toUpperCase();
        if (!materialCode) continue;
        const lengthMm = item.profile?.barLengthMm || STD_BAR_M * 1000;
        const key = `${materialCode}:${lengthMm}`;
        const current = grouped.get(key);
        if (current) current.quantity += item.quantity;
        else grouped.set(key, { materialCode, lengthMm, quantity: item.quantity });
      }

      for (const item of grouped.values()) {
        const existing = await tx.inventoryItem.findFirst({
          where: { userId: inventoryUserId, materialCode: item.materialCode, lengthMm: item.lengthMm, type: InventoryType.FULL_BAR },
          select: { id: true },
        });
        if (existing) {
          await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantity: { increment: item.quantity } } });
        } else {
          await tx.inventoryItem.create({ data: { userId: inventoryUserId, materialCode: item.materialCode, lengthMm: item.lengthMm, quantity: item.quantity, type: InventoryType.FULL_BAR } });
        }
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'COMPLETED',
          title: 'Kho xưởng nhận cây nguyên',
          actor: 'Hệ thống',
          note: `Đã ghi nhận ${Array.from(grouped.values()).reduce((sum, item) => sum + item.quantity, 0)} cây nguyên vào kho xưởng.`,
        },
      });
    });
  }

  async updateOrder(id: string, input: UpdateOrderInput, userId: string, user?: JwtUser) {
    await this.assertOrderingMutationAllowed(user);
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (order.status !== 'DRAFT') throw new BadRequestException('Chỉ có thể sửa đơn khi còn ở trạng thái nháp.');
    if (order.createdById !== userId) throw new BadRequestException('Không có quyền sửa đơn này.');

    const profileIds = (input.items ?? []).map((i) => i.profileId).filter(Boolean);
    const profiles = profileIds.length ? await this.prisma.profile.findMany({ where: { id: { in: profileIds } } }) : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const useCompanyCatalogPricing = order.sourceType === 'NPP_TO_ADMIN';

    let totalKg = 0;
    let totalAmount = 0;
    const newItemsData = (input.items ?? order.items.map((i) => ({
      profileId: i.profileId ?? '', productCode: i.productCode, productName: i.productName,
      colorCode: i.colorCode, quantity: i.quantity,
    }))).map((item) => {
      const profile = profileById.get(item.profileId);
      const pricePerKg = useCompanyCatalogPricing ? profile?.pricePerKg ?? 0 : 0;
      const itemKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const theoreticalTotalKg = this.theoreticalKg(profile, item.quantity, (item as any).kgPerMeter);
      const itemPrice = Math.round(itemKg * pricePerKg);
      totalKg += itemKg;
      totalAmount += itemPrice;
      return {
        profileId: profile?.id ?? null, productCode: item.productCode, productName: item.productName,
        colorCode: item.colorCode ?? '', quantity: item.quantity, unit: 'cây', totalKg: itemKg,
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
        updateData.totalKg = totalKg;
        updateData.theoreticalTotalKg = totalKg;
        updateData.actualTotalKg = null;
        updateData.totalAmount = totalAmount;
        updateData.pricingStatus = useCompanyCatalogPricing ? 'ESTIMATED_COMPANY' : 'PENDING_NPP';
        updateData.finalUnitPricePerKg = null;
        updateData.pricingDiscountAmount = 0;
        updateData.pricingSurchargeAmount = 0;
        updateData.pricingNote = '';
        updateData.priceConfirmedAt = null;
        updateData.priceConfirmedById = null;
      }

      await tx.order.update({ where: { id }, data: updateData });
    });

    return this.getOrder(id);
  }

  async submitOrderToNpp(id: string, user: JwtUser) {
    await this.assertOrderingMutationAllowed(user);
    const order = await this.getOrder(id, user);
    if (order.createdById !== user.sub) throw new ForbiddenException('Không có quyền gửi đơn này.');
    if (order.status === 'NEW') return order;
    if (order.status !== 'DRAFT') throw new BadRequestException('Chỉ gửi NPP khi đơn còn ở trạng thái nháp.');
    if (!order.nppOrgId) throw new BadRequestException('Cơ sở sản xuất chưa được gán NPP quản lý. Vui lòng liên hệ NPP trước khi gửi đơn.');

    const actor = await this.actorNameForUser(user, 'CSSX');
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: 'DRAFT' },
        data: { status: 'NEW', dueNote: 'Chờ NPP tiếp nhận' },
      });
      if (result.count === 0) return false;
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'NEW',
          title: 'Gửi NPP',
          actor,
          note: `Đơn đã được gửi tới ${order.nppName || 'NPP'}.`,
        },
      });
      return true;
    });
    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: { include: { profile: true } }, histories: { orderBy: { createdAt: 'desc' } } },
    });
    if (!changed && updated.status !== 'NEW') {
      throw new BadRequestException('Trạng thái đơn đã thay đổi. Vui lòng tải lại trước khi gửi.');
    }
    return this.maskNppStockForWorker(updated, user);
  }

  async nppDashboard(nppOrgId: string): Promise<NppDashboardData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [statusGroups, managedFactoryCount, openDebts, monthOrders] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { nppOrgId, status: { not: 'DRAFT' } }, _count: { _all: true } }),
      this.prisma.organization.count({ where: { managedByNppId: nppOrgId } }),
      this.prisma.debt.aggregate({
        where: { nppOrgId, status: { not: 'PAID' } }, _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.order.findMany({
        where: { nppOrgId, status: { not: 'DRAFT' }, createdAt: { gte: startOfMonth } }, select: { totalAmount: true },
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
    if (!npp) throw new NotFoundException('Không tìm thấy NPP.');

    const prefix = normalizeCodePart(npp.shortLabel || npp.code || 'NPP');
    const namePart = normalizeCodePart(factoryName);
    for (let i = 0; i < 12; i += 1) {
      const random = Math.random().toString(36).slice(2, 7).toUpperCase();
      const code = `${prefix}_${namePart}_${random}`;
      const existing = await this.prisma.organization.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Không sinh được mã CSSX, vui lòng thử lại.');
  }

  async createNppFactory(nppOrgId: string, input: CreateNppFactoryInput): Promise<NppFactoryItem> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Tên cơ sở sản xuất không được để trống.');

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

  async createAdminToNppShipment(input: CreateAdminToNppShipmentInput, userId: string, command: InventoryCommandContext) {
    return this.inventoryCommands.execute(command, input, async (tx) => {
      if (!input.sourceOrderId?.trim()) throw new BadRequestException('Chọn đơn đặt hàng của NPP cần giao.');
      const sourceOrder = await tx.order.findUnique({
        where: { id: input.sourceOrderId },
        include: { nppOrg: true, items: { include: { profile: true } } },
      });
      if (!sourceOrder) throw new NotFoundException('Không tìm thấy đơn đặt hàng NPP.');
      if (sourceOrder.sourceType !== 'NPP_TO_ADMIN') throw new BadRequestException('Chỉ có thể tạo phiếu giao từ đơn NPP đặt công ty.');
      if (!sourceOrder.nppOrg || sourceOrder.nppOrg.type !== 'NPP') throw new BadRequestException('Đơn đặt hàng chưa liên kết với NPP hợp lệ.');
      if (!['NEW', 'CONFIRMED', 'PROCESSING'].includes(sourceOrder.status)) {
        throw new BadRequestException('Đơn đặt hàng này không còn ở trạng thái có thể tạo phiếu giao.');
      }
      const poNo = sourceOrder.poNo || sourceOrder.code;
      const existingShipment = await tx.order.findFirst({ where: { sourceType: 'ADMIN_TO_NPP', poNo } });
      if (existingShipment) throw new BadRequestException(`Đơn ${poNo} đã có phiếu giao.`);

      let totalKg = 0;
      let totalAmount = 0;
      const itemsData = sourceOrder.items.map((item) => {
        const profile = item.profile;
        if (!profile) throw new BadRequestException(`Mã thanh ${item.productCode} không còn trong catalog.`);
        if (profile.stockBars < item.quantity) throw new BadRequestException(`Tồn công ty của ${profile.code} không đủ để giao NPP.`);
        const itemKg = this.theoreticalKg(profile, item.quantity);
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
          theoreticalTotalKg: itemKg,
          unitPrice: profile.pricePerKg,
          totalPrice: itemPrice,
        };
      });
      if (!itemsData.length) throw new BadRequestException('Đơn NPP không có dòng hàng để giao.');
      const actualTotalKg = this.resolveActualTotalKg(input.actualTotalKg, totalKg);
      const actualTotalAmount = this.amountForActualWeight(actualTotalKg, totalKg, totalAmount);
      const now = new Date();
      const { start, end } = businessDateUtcRange(now);
      const existingToday = await tx.order.count({
        where: { sourceType: 'ADMIN_TO_NPP', nppOrgId: sourceOrder.nppOrg.id, createdAt: { gte: start, lt: end } },
      });
      const invoiceNo = formatNppInvoiceNumber(sourceOrder.nppOrg.code, now, existingToday + 1);
      const created = await tx.order.create({
        data: {
          code: invoiceNo,
          sourceType: 'ADMIN_TO_NPP',
          createdById: userId,
          nppOrgId: sourceOrder.nppOrg.id,
          nppName: sourceOrder.nppOrg.name,
          customerName: sourceOrder.nppOrg.name,
          customerPhone: sourceOrder.nppOrg.phone ?? '',
          deliveryAddress: sourceOrder.nppOrg.address ?? '',
          note: input.note ?? '',
          invoiceNo,
          poNo,
          status: 'ADMIN_SENT_NPP',
          dueNote: 'Chờ NPP xác nhận nhận đủ hàng',
          totalKg: actualTotalKg,
          theoreticalTotalKg: totalKg,
          actualTotalKg,
          totalAmount: actualTotalAmount,
          pricingStatus: 'FINALIZED',
          finalUnitPricePerKg: actualTotalKg > 0 ? Math.round(actualTotalAmount / actualTotalKg) : null,
          priceConfirmedAt: new Date(),
          priceConfirmedById: userId,
          items: { create: itemsData },
          histories: { create: [{ status: 'ADMIN_SENT_NPP', title: 'Công ty giao NPP', actor: 'WebAdmin', note: `Tạo từ PO ${poNo}.` }] },
        },
        include: { items: { include: { profile: true } }, histories: { orderBy: { createdAt: 'desc' } } },
      });

      for (const item of itemsData) {
        const decremented = await tx.profile.updateMany({ where: { id: item.profileId, stockBars: { gte: item.quantity } }, data: { stockBars: { decrement: item.quantity } } });
        if (decremented.count !== 1) throw new BadRequestException(`Tồn công ty của ${item.productCode} không đủ để giao NPP.`);
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

      await tx.order.update({
        where: { id: sourceOrder.id },
        data: {
          status: 'SHIPPED',
          dueNote: `Đã tạo phiếu giao ${invoiceNo}`,
          histories: { create: { status: 'SHIPPED', title: 'Đã tạo phiếu giao', actor: 'WebAdmin', note: `Số hóa đơn ${invoiceNo}.` } },
        },
      });

      return created;
    });
  }

  async createNppDelivery(id: string, user: JwtUser, input: CreateNppDeliveryInput, command: InventoryCommandContext) {
    const order = await this.getOrder(id, user);
    if (!order.nppOrgId || !user.organizationId || order.nppOrgId !== user.organizationId) throw new ForbiddenException('Không có quyền tạo đơn giao.');
    if (order.status === 'SHIPPED') return order;
    if (!['NPP_REVIEWING', 'CONFIRMED', 'RESERVED'].includes(order.status)) throw new BadRequestException('Chỉ tạo đơn giao khi NPP đã tiếp nhận hoặc xác nhận đơn.');
    if (!order.items.length) throw new BadRequestException('Đơn hàng chưa có dòng sản phẩm, không thể tạo đơn giao.');

    const existingMovement = await this.prisma.nppStockMovement.findFirst({
      where: { nppOrgId: user.organizationId, orderId: order.id, direction: 'OUT', reason: 'Xuất giao CSSX' },
    });
    if (existingMovement) return this.getOrder(id, user);

    const requiredStocks = new Map<string, { profileId: string; colorCode: string; productCode: string; quantity: number }>();
    for (const item of order.items) {
      if (!item.profileId) throw new BadRequestException(`Mã hàng ${item.productCode} chưa liên kết với danh mục kho NPP.`);
      const colorCode = requireSingleColorCode(item.colorCode);
      const key = `${item.profileId}:${colorCode}`;
      const current = requiredStocks.get(key);
      if (current) current.quantity += item.quantity;
      else requiredStocks.set(key, { profileId: item.profileId, colorCode, productCode: item.productCode, quantity: item.quantity });
    }

    const stocksByKey = new Map<string, { id: string; stockBars: number }>();
    for (const [key, required] of requiredStocks) {
      const stock = await this.prisma.nppProfileStock.findFirst({
        where: { nppOrgId: user.organizationId, profileId: required.profileId, colorCode: required.colorCode },
      });
      if (!stock || stock.stockBars < required.quantity) {
        throw new BadRequestException(`Kho NPP không đủ ${required.productCode} màu ${required.colorCode}.`);
      }
      stocksByKey.set(key, { id: stock.id, stockBars: stock.stockBars });
    }

    const theoreticalTotalKg = order.theoreticalTotalKg
      || order.items.reduce((sum: number, item: { theoreticalTotalKg: number; totalKg: number }) => sum + (item.theoreticalTotalKg || item.totalKg || 0), 0)
      || order.totalKg;
    const theoreticalKgByColor: Record<string, number> = {};
    for (const item of order.items) {
      const color = requireSingleColorCode(item.colorCode);
      theoreticalKgByColor[color] = (theoreticalKgByColor[color] ?? 0) + (item.theoreticalTotalKg || item.totalKg || 0);
    }
    const colorPricing = input.colorLines?.length
      ? calculateNppColorPricing({ theoreticalKgByColor, lines: input.colorLines, discountAmount: input.discountAmount, surchargeAmount: input.surchargeAmount })
      : null;
    const pricing = colorPricing ?? calculateNppDeliveryPricing(input);
    const colorNote = colorPricing
      ? colorPricing.lines.map((l) => `${l.colorCode} ${l.basis === 'BUNDLE' ? 'bó nguyên' : 'nhôm trần'} ${l.actualKg} kg × ${l.unitPricePerKg.toLocaleString('vi-VN')}`).join('; ')
      : '';
    if (pricing.actualTotalKg + 0.01 < theoreticalTotalKg) {
      throw new BadRequestException(`Kg thực tế không được thấp hơn kg theo tỷ trọng (${theoreticalTotalKg.toFixed(2)} kg).`);
    }
    const actor = await this.actorNameForUser(user, 'NPP');

    await this.inventoryCommands.execute(command, { orderId: id, ...input }, async (tx) => {
      for (const required of requiredStocks.values()) {
        const key = `${required.profileId}:${required.colorCode}`;
        const stock = stocksByKey.get(key);
        if (!stock) throw new BadRequestException(`Kho NPP không đủ ${required.productCode} màu ${required.colorCode}.`);
        const decremented = await tx.nppProfileStock.updateMany({
          where: { id: stock.id, nppOrgId: user.organizationId!, stockBars: { gte: required.quantity } },
          data: { stockBars: { decrement: required.quantity } },
        });
        if (decremented.count === 0) {
          throw new BadRequestException(`Kho NPP không đủ ${required.productCode} màu ${required.colorCode}.`);
        }
        await tx.nppStockMovement.create({
          data: {
            nppOrgId: user.organizationId!,
            profileId: required.profileId,
            colorCode: required.colorCode,
            direction: 'OUT',
            quantity: required.quantity,
            reason: 'Xuất giao CSSX',
            orderId: order.id,
            createdById: user.sub,
            note: order.code,
          },
        });
      }
      const transitioned = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: 'SHIPPED',
          dueNote: 'NPP đã cân hàng và chốt giá trị giao',
          totalKg: pricing.actualTotalKg,
          theoreticalTotalKg,
          actualTotalKg: pricing.actualTotalKg,
          totalAmount: pricing.finalTotalAmount,
          pricingStatus: 'FINALIZED',
          finalUnitPricePerKg: pricing.finalUnitPricePerKg,
          pricingDiscountAmount: pricing.discountAmount,
          pricingSurchargeAmount: pricing.surchargeAmount,
          pricingNote: [input.pricingNote?.trim(), colorNote ? `Cân theo màu: ${colorNote}` : ''].filter(Boolean).join(' | '),
          priceConfirmedAt: new Date(),
          priceConfirmedById: user.sub,
        },
      });
      if (transitioned.count === 0) throw new BadRequestException('Trạng thái đơn đã thay đổi. Vui lòng tải lại trước khi tạo đơn giao.');
      if (colorPricing) {
        await tx.orderColorWeighing.deleteMany({ where: { orderId: order.id } });
        await tx.orderColorWeighing.createMany({
          data: colorPricing.lines.map((l) => ({ orderId: order.id, colorCode: l.colorCode, basis: l.basis, actualKg: l.actualKg, unitPricePerKg: l.unitPricePerKg, amount: l.amount })),
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'SHIPPED',
          title: 'Cân hàng và chốt giá',
          actor,
          note: `NPP xác nhận ${pricing.actualTotalKg.toFixed(2)} kg thực tế, đơn giá ${pricing.finalUnitPricePerKg.toLocaleString('vi-VN')} đ/kg, thành tiền ${pricing.finalTotalAmount.toLocaleString('vi-VN')} đ.`,
        },
      });
      return { success: true, orderId: order.id, ...pricing };
    });

    return this.getOrder(id, user);
  }

  /** Bảng giá niêm yết theo màu của NPP: mỗi màu hai giá, bó nguyên và nhôm trần (đ/kg). Màu chưa thiết lập trả 0. */
  async listNppColorPrices(nppOrgId: string, colors: Array<{ code: string; name: string }>): Promise<NppColorPriceItem[]> {
    const rows = await this.prisma.nppColorPrice.findMany({ where: { nppOrgId } });
    return colors.map((c) => {
      const row = rows.find((r) => r.colorCode === c.code);
      return { colorCode: c.code, colorName: c.name, bundlePricePerKg: row?.bundlePricePerKg ?? 0, barePricePerKg: row?.barePricePerKg ?? 0 };
    });
  }

  async saveNppColorPrices(nppOrgId: string, input: UpsertNppColorPricesInput, validCodes: string[]): Promise<void> {
    for (const p of input.prices ?? []) {
      if (!validCodes.includes(p.colorCode)) throw new BadRequestException(`Màu ${p.colorCode} không có trong danh mục.`);
      const bundle = Math.round(Number(p.bundlePricePerKg)); const bare = Math.round(Number(p.barePricePerKg));
      if (!Number.isFinite(bundle) || bundle < 0 || !Number.isFinite(bare) || bare < 0) throw new BadRequestException(`Giá của màu ${p.colorCode} không hợp lệ.`);
      await this.prisma.nppColorPrice.upsert({
        where: { nppOrgId_colorCode: { nppOrgId, colorCode: p.colorCode } },
        update: { bundlePricePerKg: bundle, barePricePerKg: bare },
        create: { nppOrgId, colorCode: p.colorCode, bundlePricePerKg: bundle, barePricePerKg: bare },
      });
    }
  }

  async completeNppDelivery(id: string, user: JwtUser) {
    const order = await this.getOrder(id, user);
    if (!order.nppOrgId || !user.organizationId || order.nppOrgId !== user.organizationId) throw new ForbiddenException('Không có quyền hoàn thành đơn giao.');
    if (order.status === 'COMPLETED') {
      await this.createNppDebtForOrder(order.id);
      await this.awardOrderPoints(order.id);
      await this.recordFactoryFullBarInventory(order.id);
      return order;
    }
    if (!['SHIPPED', 'DELIVERED'].includes(order.status)) throw new BadRequestException('Chỉ hoàn thành đơn sau khi đã tạo đơn giao.');

    const actor = await this.actorNameForUser(user, 'NPP');
    await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: 'COMPLETED', dueNote: 'NPP đã hoàn thành đơn giao' },
      });
      if (transitioned.count === 0) throw new BadRequestException('Trạng thái đơn đã thay đổi. Vui lòng tải lại trước khi hoàn thành.');
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'COMPLETED',
          title: 'Hoàn thành đơn',
          actor,
          note: 'NPP xác nhận đơn giao đã hoàn tất.',
        },
      });
    });

    await this.createNppDebtForOrder(order.id);
    await this.awardOrderPoints(order.id);
    await this.recordFactoryFullBarInventory(order.id);

    return this.getOrder(id, user);
  }

  async nppOrderReconciliation(nppOrgId: string, filter?: { month?: string }): Promise<NppFactoryReconciliation[]> {
    let dateRange: { gte: Date; lt: Date } | undefined;
    if (filter?.month) {
      const [y, m] = filter.month.split('-').map(Number);
      dateRange = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const orders = await this.prisma.order.findMany({
      where: { nppOrgId, status: { not: 'DRAFT' }, createdAt: dateRange }, include: { createdBy: { include: { organization: true } } },
    });

    const groups = new Map<string, NppFactoryReconciliation>();
    for (const order of orders) {
      const factoryOrg = order.createdBy?.organization?.type === 'FACTORY' ? order.createdBy.organization : null;
      const key = factoryOrg?.id ?? '__unknown__';
      let group = groups.get(key);
      if (!group) {
        group = { factoryOrgId: factoryOrg?.id, factoryName: factoryOrg?.name ?? order.factoryName ?? 'Không xác định', counts: {}, totalAmount: 0, totalKg: 0 };
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

  async convertQuotationToOrder(input: ConvertQuoteToOrderInput, user: JwtUser) {
    await this.assertOrderingMutationAllowed(user);
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: input.quotationId },
      include: { items: true },
    });
    if (!quotation) throw new NotFoundException('Không tìm thấy Báo giá.');
    if (!this.hasGlobalOrderAccess(user) && quotation.createdById !== user.sub) {
      throw new ForbiddenException('Không có quyền chuyển báo giá này thành đơn hàng.');
    }

    const defaultColor = normalizeColorCode(input.colorCode || quotation.items[0]?.color || 'CAFE_METALIC');
    const orderItemsInput = await this.quotationBom.buildOrderItems(quotation.items, {
      defaultColor,
      customItemQuantities: input.customItemQuantities,
    });

    const orderInput: CreateOrderInput = {
      sourceType: 'FACTORY',
      customerName: quotation.customerName || '',
      customerPhone: quotation.customerPhone || '',
      deliveryAddress: quotation.customerAddress || '',
      colorCode: defaultColor,
      note: input.note ? `${input.note} (Từ Báo giá ${quotation.code})` : `Tạo từ Báo giá ${quotation.code}`,
      accessoriesNote: quotation.extraProducts || '',
      submitToNpp: input.submitToNpp,
      items: orderItemsInput,
    };

    return this.createOrder(orderInput, user.sub, user);
  }
}
