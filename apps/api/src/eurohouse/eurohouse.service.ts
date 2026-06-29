import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminUserItem,
  CatalogSystem,
  ColorCode,
  CreateOrderInput,
  DebtItem,
  GiftItem,
  LibraryItem,
  OrgItem,
  ProjectDetail,
  ProjectSummary,
  Promotion,
  QuotationInput,
  QuotationResult,
} from '@eurohouse/types';
import { PrismaService } from '../prisma/prisma.service';

const STD_BAR_M = 5.8; // chiều dài cây tiêu chuẩn (m)

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

  // ---------- Đơn hàng ----------

  private async nextOrderCode(): Promise<string> {
    const count = await this.prisma.order.count();
    const now = new Date();
    const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `EH-${ym}-${String(count + 1).padStart(3, '0')}`;
  }

  async createOrder(input: CreateOrderInput) {
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

    const creator = input.createdByEmail
      ? await this.prisma.user.findUnique({ where: { email: input.createdByEmail }, include: { organization: true } })
      : null;

    const order = await this.prisma.order.create({
      data: {
        code: await this.nextOrderCode(),
        sourceType: input.sourceType,
        createdById: creator?.id ?? null,
        factoryName: creator?.organization?.type === 'FACTORY' ? creator.organization.name : '',
        nppName: creator?.organization?.type === 'NPP' ? creator.organization.name : '',
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
    return order;
  }

  async listOrders(filter?: { sourceType?: string; status?: string }) {
    return this.prisma.order.findMany({
      where: { sourceType: filter?.sourceType, status: filter?.status },
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

  async listProjects(ownerEmail?: string): Promise<ProjectSummary[]> {
    const owner = ownerEmail ? await this.prisma.user.findUnique({ where: { email: ownerEmail } }) : null;
    const projects = await this.prisma.project.findMany({
      where: owner ? { ownerId: owner.id } : undefined,
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

  async createProject(data: Partial<ProjectDetail> & { ownerEmail?: string }): Promise<ProjectDetail> {
    const owner = data.ownerEmail ? await this.prisma.user.findUnique({ where: { email: data.ownerEmail } }) : null;
    const count = await this.prisma.project.count();
    const created = await this.prisma.project.create({
      data: {
        code: `CT-${String(count + 1).padStart(4, '0')}`,
        name: data.name ?? 'Công trình mới',
        ownerId: owner?.id ?? null,
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

  async listDebts(): Promise<DebtItem[]> {
    const debts = await this.prisma.debt.findMany({ orderBy: { createdAt: 'desc' } });
    return debts.map((d) => ({
      id: d.id, type: d.type as DebtItem['type'], partnerName: d.partnerName, amount: d.amount,
      paidAmount: d.paidAmount, status: d.status as DebtItem['status'],
      bankAccount: d.bankAccount, bankName: d.bankName, note: d.note,
    }));
  }

  async createDebt(data: Partial<DebtItem> & { projectId?: string }): Promise<DebtItem> {
    const created = await this.prisma.debt.create({
      data: {
        type: data.type ?? 'CUSTOMER',
        partnerName: data.partnerName ?? '',
        amount: data.amount ?? 0,
        paidAmount: data.paidAmount ?? 0,
        bankAccount: data.bankAccount ?? '',
        bankName: data.bankName ?? '',
        note: data.note ?? '',
        projectId: data.projectId ?? null,
      },
    });
    return (await this.listDebts()).find((d) => d.id === created.id)!;
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
      include: { _count: { select: { users: true } } },
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
    }));
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
