import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdjustProfileStockInput,
  AdminUserItem,
  CashTransactionItem,
  CatalogSystem,
  ColorCode,
  CreateCashTransactionInput,
  CreateMaterialInput,
  CreateOrderInput,
  CreateStockMovementInput,
  DebtItem,
  FinancialReportData,
  GiftItem,
  LibraryItem,
  MaterialItem,
  MonthlyPnL,
  OrgItem,
  PayDebtInput,
  ProfileStockMovementItem,
  ProjectDetail,
  ProjectSummary,
  Promotion,
  QuotationInput,
  QuotationResult,
  StockMovementItem,
  UpdateMaterialInput,
} from '@eurohouse/types';
import { PrismaService } from '../prisma/prisma.service';

const STD_BAR_M = 6; // chiều dài cây tiêu chuẩn (m)

function projectTotalCost(p: {
  costAluminum: number; costAccessory: number; costLockHinge: number; costGasket: number;
  costSilicone: number; costScrew: number; costGlass: number; costLabor: number;
  costOther: number; costPartnerPct: number; contractValue: number; extraRevenue: number;
}): number {
  const base = p.costAluminum + p.costAccessory + p.costLockHinge + p.costGasket +
    p.costSilicone + p.costScrew + p.costGlass + p.costLabor + p.costOther;
  const partner = Math.round(((p.contractValue + p.extraRevenue) * p.costPartnerPct) / 100);
  return base + partner;
}

@Injectable()
export class EurohouseService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Danh mục đặt hàng ----------

  async catalog(): Promise<CatalogSystem[]> {
    const systems = await this.prisma.aluSystem.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { profiles: { orderBy: { code: 'asc' } } },
    });
    return systems.map((s) => ({
      id: s.id, code: s.code, name: s.name, description: s.description ?? undefined,
      profiles: s.profiles.map((p) => ({
        id: p.id, code: p.code, name: p.name, thicknessMm: p.thicknessMm ?? undefined,
        kgPerMeter: p.kgPerMeter, barLengthMm: p.barLengthMm, barsPerBundle: p.barsPerBundle,
        pricePerKg: p.pricePerKg, imageUrl: p.imageUrl ?? undefined,
      })),
    }));
  }

  async colors(): Promise<ColorCode[]> {
    const list = await this.prisma.colorCode.findMany({ orderBy: { name: 'asc' } });
    return list.map((c) => ({ id: c.id, code: c.code, name: c.name, hex: c.hex ?? undefined }));
  }

  // ---------- Kho NVL & chi phí sản xuất chung ----------

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

  // ---------- Tồn kho thanh nhôm (Profile) ----------

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

  // ---------- Đơn hàng ----------

  private async nextOrderCode(): Promise<string> {
    const count = await this.prisma.order.count();
    const now = new Date();
    const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `EH-${ym}-${String(count + 1).padStart(3, '0')}`;
  }

  async createOrder(input: CreateOrderInput, userId?: string) {
    const profileIds = input.items.map((i) => i.profileId).filter(Boolean);
    const profiles = await this.prisma.profile.findMany({ where: { id: { in: profileIds } } });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    let totalKg = 0;
    let totalAmount = 0;
    const itemsData = input.items.map((item) => {
      const profile = profileById.get(item.profileId);
      const kgPerMeter = profile?.kgPerMeter ?? item.kgPerMeter ?? 0;
      const pricePerKg = profile?.pricePerKg ?? 0;
      const itemKg = Number((kgPerMeter * STD_BAR_M * item.quantity).toFixed(2));
      const itemPrice = Math.round(itemKg * pricePerKg);
      totalKg += itemKg;
      totalAmount += itemPrice;
      return {
        profileId: profile?.id ?? null,
        productCode: item.productCode,
        productName: item.productName,
        colorCode: item.colorCode ?? '',
        quantity: item.quantity,
        unit: 'cây',
        totalKg: itemKg,
        unitPrice: pricePerKg,
        totalPrice: itemPrice,
      };
    });

    const creator = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true } })
      : null;
    const code = await this.nextOrderCode();

    // Xưởng đặt hàng → tự động chuyển đơn về NPP quản lý xưởng đó (cấu hình sẵn ở Web Admin).
    let nppOrgId: string | null = null;
    let nppName = '';
    let nppWarning: string | undefined;
    if (creator?.organization?.type === 'FACTORY') {
      const managedByNppId = creator.organization.managedByNppId;
      if (managedByNppId) {
        const npp = await this.prisma.organization.findUnique({ where: { id: managedByNppId } });
        if (npp) {
          nppOrgId = npp.id;
          nppName = npp.name;
        }
      } else {
        nppWarning = 'Xưởng chưa được gán NPP quản lý — đơn chưa thể chuyển tới NPP nào.';
      }
    } else if (creator?.organization?.type === 'NPP') {
      nppName = creator.organization.name;
    }

    const { order, stockWarnings } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          code,
          sourceType: input.sourceType,
          createdById: creator?.id ?? null,
          factoryName: creator?.organization?.type === 'FACTORY' ? creator.organization.name : '',
          nppOrgId,
          nppName,
          customerName: input.customerName ?? '',
          customerPhone: input.customerPhone ?? '',
          deliveryAddress: input.deliveryAddress ?? '',
          colorCode: input.colorCode ?? '',
          note: input.note ?? '',
          status: 'NEW',
          totalKg: Number(totalKg.toFixed(2)),
          totalAmount,
          dueNote: 'Chờ NPP tiếp nhận',
          items: { create: itemsData },
          histories: { create: [{ status: 'NEW', title: 'Tạo đơn', actor: creator?.displayName ?? 'Người dùng', note: 'Đơn được tạo' }] },
        },
        include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
      });

      // Tự động trừ kho thanh nhôm theo đơn hàng — chỉ cảnh báo khi tồn không đủ, không chặn tạo đơn (B2B nội bộ).
      const warnings: { profileId: string; code: string; name: string; shortBy: number }[] = [];
      for (const item of itemsData) {
        if (!item.profileId) continue;
        const profile = profileById.get(item.profileId);
        if (!profile) continue;
        if (profile.stockBars < item.quantity) {
          warnings.push({ profileId: profile.id, code: profile.code, name: profile.name, shortBy: item.quantity - profile.stockBars });
        }
        await tx.profile.update({ where: { id: profile.id }, data: { stockBars: { decrement: item.quantity } } });
        await tx.profileStockMovement.create({
          data: {
            profileId: profile.id,
            direction: 'OUT',
            quantity: item.quantity,
            reason: 'Trừ theo đơn hàng',
            orderId: created.id,
            createdById: userId ?? null,
            note: created.code,
          },
        });
      }

      return { order: created, stockWarnings: warnings };
    });

    return { ...order, stockWarnings, nppWarning };
  }

  async listOrders(filter?: { sourceType?: string; status?: string; createdById?: string; nppOrgId?: string }) {
    return this.prisma.order.findMany({
      where: {
        sourceType: filter?.sourceType,
        status: filter?.status,
        createdById: filter?.createdById,
        nppOrgId: filter?.nppOrgId,
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return order;
  }

  async updateOrderStatus(id: string, status: string, actor: string, title: string, note = '') {
    const order = await this.getOrder(id);
    await this.prisma.orderStatusHistory.create({
      data: { orderId: order.id, status, title, actor, note },
    });
    return this.prisma.order.update({
      where: { id: order.id },
      data: { status },
      include: { items: true, histories: { orderBy: { createdAt: 'desc' } } },
    });
  }

  // ---------- Công trình ----------

  async listProjects(ownerId?: string): Promise<ProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      where: ownerId ? { ownerId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.toProjectSummary(p));
  }

  private toProjectSummary(p: import('@prisma/client').Project): ProjectSummary {
    const totalCost = projectTotalCost(p);
    const revenue = p.contractValue + p.extraRevenue;
    const profit = revenue - totalCost;
    return {
      id: p.id, code: p.code, name: p.name, customerName: p.customerName, status: p.status as ProjectSummary['status'],
      contractValue: p.contractValue, totalCost, profit,
      profitPct: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
    };
  }

  async getProject(id: string): Promise<ProjectDetail> {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy công trình.');
    const summary = this.toProjectSummary(p);
    return {
      ...summary,
      customerPhone: p.customerPhone, address: p.address,
      costAluminum: p.costAluminum, costAccessory: p.costAccessory, costLockHinge: p.costLockHinge,
      costGasket: p.costGasket, costSilicone: p.costSilicone, costScrew: p.costScrew,
      costGlass: p.costGlass, costLabor: p.costLabor, costPartnerPct: p.costPartnerPct,
      costOther: p.costOther, extraRevenue: p.extraRevenue, note: p.note,
    };
  }

  async createProject(data: Partial<ProjectDetail>, ownerId?: string): Promise<ProjectDetail> {
    const count = await this.prisma.project.count();
    const created = await this.prisma.project.create({
      data: {
        code: `CT-${String(count + 1).padStart(4, '0')}`,
        name: data.name ?? 'Công trình mới',
        ownerId: ownerId ?? null,
        customerName: data.customerName ?? '',
        customerPhone: data.customerPhone ?? '',
        address: data.address ?? '',
        contractValue: data.contractValue ?? 0,
      },
    });
    return this.getProject(created.id);
  }

  async updateProject(id: string, data: Partial<ProjectDetail>): Promise<ProjectDetail> {
    const allowed = [
      'name', 'customerName', 'customerPhone', 'address', 'status', 'contractValue',
      'costAluminum', 'costAccessory', 'costLockHinge', 'costGasket', 'costSilicone',
      'costScrew', 'costGlass', 'costLabor', 'costPartnerPct', 'costOther', 'extraRevenue', 'note',
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) updateData[key] = (data as Record<string, unknown>)[key];
    }
    await this.prisma.project.update({ where: { id }, data: updateData });
    return this.getProject(id);
  }

  // ---------- Công nợ ----------

  private toDebtItem(d: {
    id: string; type: string; direction: string; partnerName: string; amount: number;
    paidAmount: number; status: string; bankAccount: string; bankName: string; note: string;
  }): DebtItem {
    return {
      id: d.id, type: d.type as DebtItem['type'], direction: d.direction as DebtItem['direction'],
      partnerName: d.partnerName, amount: d.amount, paidAmount: d.paidAmount,
      status: d.status as DebtItem['status'], bankAccount: d.bankAccount, bankName: d.bankName, note: d.note,
    };
  }

  async listDebts(filter?: { direction?: string; status?: string; type?: string }): Promise<DebtItem[]> {
    const debts = await this.prisma.debt.findMany({
      where: { direction: filter?.direction, status: filter?.status, type: filter?.type },
      orderBy: { createdAt: 'desc' },
    });
    return debts.map((d) => this.toDebtItem(d));
  }

  async createDebt(data: Partial<DebtItem> & { projectId?: string }): Promise<DebtItem> {
    const type = data.type ?? 'CUSTOMER';
    const direction = data.direction ?? (type === 'CUSTOMER' ? 'RECEIVABLE' : 'PAYABLE');
    const created = await this.prisma.debt.create({
      data: {
        type,
        direction,
        partnerName: data.partnerName ?? '',
        amount: data.amount ?? 0,
        paidAmount: data.paidAmount ?? 0,
        bankAccount: data.bankAccount ?? '',
        bankName: data.bankName ?? '',
        note: data.note ?? '',
        projectId: data.projectId ?? null,
      },
    });
    return this.toDebtItem(created);
  }

  async updateDebt(id: string, data: Partial<DebtItem>): Promise<DebtItem> {
    const allowed = ['partnerName', 'amount', 'bankAccount', 'bankName', 'note', 'direction', 'status'];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) updateData[key] = (data as Record<string, unknown>)[key];
    }
    const updated = await this.prisma.debt.update({ where: { id }, data: updateData });
    return this.toDebtItem(updated);
  }

  async payDebt(id: string, input: PayDebtInput, userId?: string): Promise<CashTransactionItem> {
    const debt = await this.prisma.debt.findUnique({ where: { id } });
    if (!debt) throw new NotFoundException('Không tìm thấy công nợ.');
    const type: CashTransactionItem['type'] = debt.direction === 'RECEIVABLE' ? 'RECEIPT' : 'PAYMENT';
    return this.createCashTransaction(
      { type, amount: input.amount, method: input.method, debtId: id, partnerName: debt.partnerName, note: input.note },
      userId,
    );
  }

  // ---------- Thu chi ----------

  private async nextCashCode(type: string): Promise<string> {
    const prefix = type === 'RECEIPT' ? 'PT' : 'PC';
    const count = await this.prisma.cashTransaction.count({ where: { type } });
    const now = new Date();
    const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `${prefix}-${ym}-${String(count + 1).padStart(3, '0')}`;
  }

  private toCashTransactionItem(c: {
    id: string; code: string; type: string; amount: number; method: string; category: string;
    debtId: string | null; projectId: string | null; partnerName: string; note: string;
    transDate: Date; createdAt: Date;
  }): CashTransactionItem {
    return {
      id: c.id, code: c.code, type: c.type as CashTransactionItem['type'], amount: c.amount,
      method: c.method as CashTransactionItem['method'], category: c.category,
      debtId: c.debtId ?? undefined, projectId: c.projectId ?? undefined,
      partnerName: c.partnerName, note: c.note, transDate: c.transDate.toISOString(), createdAt: c.createdAt.toISOString(),
    };
  }

  async listCashTransactions(filter?: { type?: string; debtId?: string; from?: string; to?: string }): Promise<CashTransactionItem[]> {
    const list = await this.prisma.cashTransaction.findMany({
      where: {
        type: filter?.type,
        debtId: filter?.debtId,
        transDate: filter?.from || filter?.to ? { gte: filter?.from ? new Date(filter.from) : undefined, lte: filter?.to ? new Date(filter.to) : undefined } : undefined,
      },
      orderBy: { transDate: 'desc' },
    });
    return list.map((c) => this.toCashTransactionItem(c));
  }

  async createCashTransaction(input: CreateCashTransactionInput, userId?: string): Promise<CashTransactionItem> {
    const code = await this.nextCashCode(input.type);
    const created = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.cashTransaction.create({
        data: {
          code, type: input.type, amount: input.amount, method: input.method ?? 'CASH',
          category: input.category ?? '', debtId: input.debtId ?? null, projectId: input.projectId ?? null,
          partnerName: input.partnerName ?? '', note: input.note ?? '',
          transDate: input.transDate ? new Date(input.transDate) : undefined,
          createdById: userId ?? null,
        },
      });

      if (input.debtId) {
        const debt = await tx.debt.findUnique({ where: { id: input.debtId } });
        if (debt) {
          const paidAmount = debt.paidAmount + input.amount;
          const status = paidAmount >= debt.amount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'OPEN';
          await tx.debt.update({ where: { id: input.debtId }, data: { paidAmount, status } });
        }
      }

      return transaction;
    });
    return this.toCashTransactionItem(created);
  }

  // ---------- Báo cáo tài chính ----------

  async monthlyPnL(months = 6): Promise<FinancialReportData> {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [orders, payments, materials] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: rangeStart }, status: { not: 'CANCELLED' } },
        select: { totalAmount: true, createdAt: true },
      }),
      this.prisma.cashTransaction.findMany({
        where: { type: 'PAYMENT', transDate: { gte: rangeStart } },
        select: { amount: true, category: true, transDate: true },
      }),
      this.prisma.material.findMany({ select: { group: true, category: true } }),
    ]);

    const overheadGroups = new Set(materials.filter((m) => m.category === 'OVERHEAD').map((m) => m.group));

    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const buckets = new Map<string, MonthlyPnL>();
    for (let i = 0; i < months; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = monthKey(d);
      buckets.set(key, { month: key, revenue: 0, directMaterialCost: 0, overheadCost: 0, profit: 0, profitPct: 0 });
    }

    for (const order of orders) {
      const bucket = buckets.get(monthKey(order.createdAt));
      if (bucket) bucket.revenue += order.totalAmount;
    }
    for (const payment of payments) {
      const bucket = buckets.get(monthKey(payment.transDate));
      if (!bucket) continue;
      if (overheadGroups.has(payment.category)) bucket.overheadCost += payment.amount;
      else bucket.directMaterialCost += payment.amount;
    }

    let totalRevenue = 0;
    let totalCost = 0;
    for (const bucket of buckets.values()) {
      bucket.profit = bucket.revenue - bucket.directMaterialCost - bucket.overheadCost;
      bucket.profitPct = bucket.revenue > 0 ? Number(((bucket.profit / bucket.revenue) * 100).toFixed(1)) : 0;
      totalRevenue += bucket.revenue;
      totalCost += bucket.directMaterialCost + bucket.overheadCost;
    }

    return {
      months: Array.from(buckets.values()),
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
    };
  }

  // ---------- Người dùng & tổ chức (Web Admin) ----------

  async adminUsers(): Promise<AdminUserItem[]> {
    const users = await this.prisma.user.findMany({
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      phone: u.phone ?? '',
      role: u.role as AdminUserItem['role'],
      organizationId: u.organizationId ?? undefined,
      organizationName: u.organization?.name,
      organizationType: u.organization?.type as AdminUserItem['organizationType'],
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async adminOrgs(): Promise<OrgItem[]> {
    const orgs = await this.prisma.organization.findMany({
      include: { _count: { select: { users: true } }, managedByNpp: true },
      orderBy: { createdAt: 'asc' },
    });
    return orgs.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      type: o.type as OrgItem['type'],
      phone: o.phone ?? undefined,
      address: o.address ?? undefined,
      userCount: o._count.users,
      managedByNppId: o.managedByNppId ?? undefined,
      managedByNppName: o.managedByNpp?.name,
    }));
  }

  async updateOrgManagedNpp(orgId: string, managedByNppId: string | null): Promise<OrgItem> {
    await this.prisma.organization.update({ where: { id: orgId }, data: { managedByNppId } });
    const orgs = await this.adminOrgs();
    const updated = orgs.find((o) => o.id === orgId);
    if (!updated) throw new NotFoundException('Không tìm thấy tổ chức.');
    return updated;
  }

  // ---------- Báo giá tự động ----------

  calcQuotation(input: QuotationInput): QuotationResult {
    const areaM2 = Number(((input.widthMm / 1000) * (input.heightMm / 1000) * input.quantity).toFixed(2));
    const baseAmount = Math.round(areaM2 * (input.pricePerM2 || 0));
    const subtotal = baseAmount + input.accessoryCost + input.laborCost + input.installCost + input.depreciation;
    const profitAmount = Math.round((subtotal * (input.profitPct || 0)) / 100);
    return {
      areaM2,
      baseAmount,
      accessoryCost: input.accessoryCost,
      laborCost: input.laborCost,
      installCost: input.installCost,
      depreciation: input.depreciation,
      profitAmount,
      totalAmount: subtotal + profitAmount,
    };
  }

  // ---------- Nội dung từ Web Admin ----------

  async promotions(): Promise<Promotion[]> {
    const list = await this.prisma.promotion.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return list.map((p) => ({
      id: p.id, title: p.title, subtitle: p.subtitle, imageUrl: p.imageUrl, bannerUrl: p.bannerUrl,
      gallery: this.parseGallery(p.gallery), content: p.content, active: p.active,
      startDate: p.startDate?.toISOString(), endDate: p.endDate?.toISOString(),
    }));
  }

  private parseGallery(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async gifts(): Promise<GiftItem[]> {
    const list = await this.prisma.gift.findMany({ orderBy: { points: 'asc' } });
    return list.map((g) => ({ id: g.id, name: g.name, points: g.points, icon: g.icon, imageUrl: g.imageUrl, stock: g.stock }));
  }

  async library(): Promise<LibraryItem[]> {
    const list = await this.prisma.libraryItem.findMany({ orderBy: { createdAt: 'desc' } });
    return list.map((l) => ({
      id: l.id, type: l.type as LibraryItem['type'], title: l.title,
      imageUrl: l.imageUrl, videoUrl: l.videoUrl, tag: l.tag,
    }));
  }
}
