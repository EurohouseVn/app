import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { QuotationInput, QuotationResult, QuotationRecord } from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { QuotationBomService } from './quotation-bom.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';

@Injectable()
export class QuotationsService {

  async getNppProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true } });
    if (!user) return null;
    if (user.organization) {
      return {
        name: user.organization.name || user.displayName,
        address: user.organization.address || '',
        phone: user.organization.phone || user.phone || '',
        productionName: user.organization.productionName || user.organization.name || user.displayName,
        logoUrl: user.organization.logoUrl || '',
        mainCategories: user.organization.mainCategories || '',
        email: user.organization.email || user.email || '',
        fanpage: user.organization.fanpage || ''
      };
    }
    return {
      name: user.displayName,
      address: '',
      phone: user.phone || '',
      productionName: user.displayName,
      logoUrl: '',
      mainCategories: '',
      email: user.email || '',
      fanpage: ''
    };
  }

  async updateNppProfile(userId: string, data: any) {
    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy User');
    
    if (!user.organizationId) {
      const org = await this.prisma.organization.create({
        data: {
          code: `ORG-${Date.now().toString(36).toUpperCase()}`,
          name: data.productionName || user.displayName || 'Xưởng Thợ',
          type: user.role === 'NPP' ? 'NPP' : 'FACTORY',
          productionName: data.productionName,
          logoUrl: data.logoUrl,
          mainCategories: data.mainCategories,
          email: data.email,
          fanpage: data.fanpage,
          address: data.address,
          phone: data.phone,
        }
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { organizationId: org.id }
      });
      return org;
    }

    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        productionName: data.productionName,
        logoUrl: data.logoUrl,
        mainCategories: data.mainCategories,
        email: data.email,
        fanpage: data.fanpage,
        address: data.address,
        phone: data.phone,
        name: data.productionName || data.name
      }
    });
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationBom: QuotationBomService,
    private readonly formulaService: FormulaEvaluatorService,
  ) {}

  private async captureFormulaSnapshots(items: QuotationInput['items']) {
    const templateIds = Array.from(new Set(items.map((item) => item.templateId).filter((id): id is string => Boolean(id))));
    const templates = templateIds.length
      ? await this.prisma.formulaTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, templateId: true, updatedAt: true } })
      : [];
    const templateById = new Map(templates.flatMap((template) => [
      [template.id, template],
      [template.templateId, template],
    ]));

    return Promise.all(items.map(async (item) => {
      if (!item.templateId) return null;
      const dynamicInputs = item.dynamicInputs && typeof item.dynamicInputs === 'object'
        ? item.dynamicInputs as Record<string, unknown>
        : {};
      const result = await this.formulaService.evaluateTemplate(item.templateId, {
        ...dynamicInputs,
        width: item.widthMm,
        height: item.heightMm,
        quantity: item.quantity,
      });
      const template = templateById.get(item.templateId);
      return {
        templateId: item.templateId,
        templateUpdatedAt: template?.updatedAt.toISOString() || null,
        capturedAt: new Date().toISOString(),
        result,
      };
    }));
  }

  private hasGlobalQuotationAccess(user?: JwtUser): boolean {
    return !user || user.isCeo === true || user.role === 'ADMIN' || user.role === 'STAFF';
  }

  private assertCanAccessQuotation(quotation: { createdById: string | null }, user?: JwtUser) {
    if (this.hasGlobalQuotationAccess(user)) return;
    if (quotation.createdById === user?.sub) return;
    throw new ForbiddenException('Khong co quyen truy cap bao gia nay.');
  }

  private scopedQuotationCreator(createdById: string | undefined, user?: JwtUser) {
    if (this.hasGlobalQuotationAccess(user)) return createdById;
    if (user?.role === 'NPP' || user?.role === 'FACTORY' || user?.role === 'DAILY') return user.sub;
    throw new ForbiddenException('Khong co quyen truy cap danh sach bao gia.');
  }

  private assertCanAccessProject(project: { ownerId: string | null }, user?: JwtUser) {
    if (this.hasGlobalQuotationAccess(user)) return;
    if (project.ownerId === user?.sub) return;
    throw new ForbiddenException('Khong co quyen truy cap cong trinh nay.');
  }

  calcQuotation(input: QuotationInput): QuotationResult {
    let areaM2 = 0;
    let doorBaseAmount = 0;
    const itemsResult = input.items.map(item => {
      const itemArea = Number(((item.widthMm / 1000) * (item.heightMm / 1000) * item.quantity).toFixed(2));
      const itemTotal = Math.round(itemArea * (item.pricePerM2 || 0)) + (!item.includesAccessories ? (item.accessoriesPrice || 0) * item.quantity : 0);
      
      const dyn = item.dynamicInputs as any || {};
      areaM2 += itemArea;
      doorBaseAmount += itemTotal;
      return { ...item, areaM2: itemArea, totalPrice: itemTotal, dynamicInputs: dyn };
    });

    const extraProducts: any[] = [];
    let extraProductsAmount = 0;

    // Process explicit extraProducts
    if (input.extraProducts && Array.isArray(input.extraProducts)) {
      input.extraProducts.forEach(ep => {
        if (!ep.name || ep.name.trim() === '') return;
        const qty = Number(ep.quantity) || 0;
        const price = Number(ep.unitPrice) || 0;
        const total = Math.round(qty * price);
        extraProductsAmount += total;
        extraProducts.push({
          name: ep.name.trim(),
          description: ep.description ? ep.description.trim() : '',
          unit: ep.unit || 'md',
          quantity: qty,
          unitPrice: price,
          totalPrice: total,
        });
      });
    }

    // Process legacy phaoDinh from items for backwards compatibility
    input.items.forEach(item => {
      const dyn = item.dynamicInputs as any || {};
      const phaoDinhName = dyn.phaoDinhName || '';
      if (phaoDinhName && phaoDinhName !== 'Không') {
        const phaoDinhLength = Number(dyn.phaoDinhLength) || 0;
        const phaoDinhPrice = Number(dyn.phaoDinhPrice) || 0;
        const phaoDinhAmount = Math.round(phaoDinhLength * phaoDinhPrice);
        // Only add if not already in extraProducts
        if (!extraProducts.some(e => e.name === phaoDinhName)) {
          extraProductsAmount += phaoDinhAmount;
          extraProducts.push({
            name: phaoDinhName,
            unit: 'md',
            quantity: phaoDinhLength,
            unitPrice: phaoDinhPrice,
            totalPrice: phaoDinhAmount,
          });
        }
      }
    });

    areaM2 = Number(areaM2.toFixed(2));
    const baseAmount = doorBaseAmount + extraProductsAmount;
    const subtotal = baseAmount + input.accessoryCost + input.laborCost + input.installCost + input.depreciation;
    const profitAmount = Math.round((subtotal * (input.profitPct || 0)) / 100);
    const amountBeforeVat = subtotal + profitAmount;
    const vatPct = Number(input.vatPct) || 0;
    const vatAmount = Math.round((amountBeforeVat * vatPct) / 100);
    const totalAmount = amountBeforeVat + vatAmount;

    const depositAmount = Math.max(0, input.depositAmount || 0);
    const remainingAmount = Math.max(0, totalAmount - depositAmount);

    return {
      items: itemsResult,
      extraProducts,
      extraProductsAmount,
      areaM2,
      baseAmount,
      accessoryCost: input.accessoryCost,
      laborCost: input.laborCost,
      installCost: input.installCost,
      depreciation: input.depreciation,
      profitPct: input.profitPct || 0,
      profitAmount,
      vatPct,
      vatAmount,
      totalAmount,
      depositAmount,
      remainingAmount,
    };
  }

  private async nextQuotationCode(): Promise<string> {
    const now = new Date();
    const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const count = await this.prisma.quotation.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } });
    return `BG-${ymd}-${String(count + 1).padStart(2, '0')}`;
  }

  async createQuotation(input: QuotationInput, userId?: string): Promise<QuotationRecord> {
    const result = this.calcQuotation(input);
    const formulaSnapshots = await this.captureFormulaSnapshots(input.items);
    const code = await this.nextQuotationCode();
    const created = await this.prisma.quotation.create({
      data: {
        code, createdById: userId ?? null, 
        customerName: input.customerName ?? '', customerPhone: input.customerPhone ?? '', customerAddress: input.customerAddress ?? '',
        notes: input.notes ?? '',
        isFinalSettlement: input.isFinalSettlement ?? false,
        depositAmount: input.depositAmount ?? 0,
        accessoryCost: input.accessoryCost, laborCost: input.laborCost, installCost: input.installCost, 
        profitPct: input.profitPct, depreciation: input.depreciation, areaM2: result.areaM2, 
        baseAmount: result.baseAmount, profitAmount: result.profitAmount, 
        vatPct: result.vatPct, vatAmount: result.vatAmount, totalAmount: result.totalAmount,
        extraProducts: result.extraProducts && result.extraProducts.length > 0 ? JSON.stringify(result.extraProducts) : null,
        items: {
          create: result.items.map((i, index) => ({
            name: i.name, system: i.system || '', doorType: i.doorType, templateId: i.templateId, widthMm: i.widthMm, heightMm: i.heightMm,
            wallHugging: i.wallHugging || 'Non', quantity: i.quantity, includesAccessories: i.includesAccessories ?? true, accessoriesPrice: i.accessoriesPrice || 0,
            areaM2: i.areaM2, pricePerM2: i.pricePerM2, totalPrice: i.totalPrice,
            color: i.color, glassType: i.glassType, glassColor: i.glassColor, dynamicInputs: i.dynamicInputs as any,
            formulaSnapshot: formulaSnapshots[index] as any,
          }))
        }
      },
      include: { items: true },
    });
    return this.toQuotationRecord(created);
  }

  async updateQuotation(id: string, input: QuotationInput, userId?: string, user?: JwtUser): Promise<QuotationRecord> {
    const existing = await this.prisma.quotation.findFirst({ where: { OR: [{ id }, { code: id }] } });
    if (!existing) throw new NotFoundException('Không tìm thấy báo giá.');

    this.assertCanAccessQuotation(existing, user);

    const result = this.calcQuotation(input);
    const formulaSnapshots = await this.captureFormulaSnapshots(input.items);
    
    // Xoá hết items cũ
    await this.prisma.quotationItem.deleteMany({ where: { quotationId: existing.id } });

    const updated = await this.prisma.quotation.update({
      where: { id: existing.id },
      data: {
        customerName: input.customerName ?? '', customerPhone: input.customerPhone ?? '', customerAddress: input.customerAddress ?? '',
        notes: input.notes ?? '',
        isFinalSettlement: input.isFinalSettlement ?? false,
        depositAmount: input.depositAmount ?? 0,
        accessoryCost: input.accessoryCost, laborCost: input.laborCost, installCost: input.installCost, 
        profitPct: input.profitPct, depreciation: input.depreciation, areaM2: result.areaM2, 
        baseAmount: result.baseAmount, profitAmount: result.profitAmount, 
        vatPct: result.vatPct, vatAmount: result.vatAmount, totalAmount: result.totalAmount,
        extraProducts: result.extraProducts && result.extraProducts.length > 0 ? JSON.stringify(result.extraProducts) : null,
        items: {
          create: result.items.map((i, index) => ({
            name: i.name, system: i.system || '', doorType: i.doorType, templateId: i.templateId, widthMm: i.widthMm, heightMm: i.heightMm,
            wallHugging: i.wallHugging || 'Non', quantity: i.quantity, includesAccessories: i.includesAccessories ?? true, accessoriesPrice: i.accessoriesPrice || 0,
            areaM2: i.areaM2, pricePerM2: i.pricePerM2, totalPrice: i.totalPrice,
            color: i.color, glassType: i.glassType, glassColor: i.glassColor, dynamicInputs: i.dynamicInputs as any,
            formulaSnapshot: formulaSnapshots[index] as any,
          }))
        }
      },
      include: { items: true },
    });
    return this.toQuotationRecord(updated);
  }

  async deleteQuotation(id: string, userId?: string, user?: JwtUser) {
    const q = await this.prisma.quotation.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });
    if (!q) throw new NotFoundException('Không tìm thấy báo giá.');

    this.assertCanAccessQuotation(q, user);

    // Delete quotation items first
    await this.prisma.quotationItem.deleteMany({
      where: { quotationId: q.id },
    });

    return this.prisma.quotation.delete({ where: { id: q.id } });
  }

  private toQuotationRecord(q: any): QuotationRecord {
    let extraProducts: any[] = [];
    if (q.extraProducts) {
      try {
        extraProducts = typeof q.extraProducts === 'string' ? JSON.parse(q.extraProducts) : q.extraProducts;
      } catch (e) {}
    }
    const depositAmount = q.depositAmount || 0;
    const remainingAmount = Math.max(0, (q.totalAmount || 0) - depositAmount);
    return {
      id: q.id, code: q.code, createdById: q.createdById, createdAt: q.createdAt.toISOString(), customerName: q.customerName,
      customerPhone: q.customerPhone, customerAddress: q.customerAddress, notes: q.notes,
      isFinalSettlement: q.isFinalSettlement ?? false,
      depositAmount,
      remainingAmount,
      items: (q.items || []).map((i: any) => ({
        id: i.id, name: i.name, system: i.system, doorType: i.doorType, widthMm: i.widthMm, heightMm: i.heightMm, wallHugging: i.wallHugging,
        quantity: i.quantity, pricePerM2: i.pricePerM2, includesAccessories: i.includesAccessories, accessoriesPrice: i.accessoriesPrice,
        areaM2: i.areaM2, totalPrice: i.totalPrice, color: i.color, glassType: i.glassType, glassColor: i.glassColor, dynamicInputs: i.dynamicInputs
      })),
      extraProducts,
      accessoryCost: q.accessoryCost, laborCost: q.laborCost, installCost: q.installCost,
      profitPct: q.profitPct, depreciation: q.depreciation, areaM2: q.areaM2,
      baseAmount: q.baseAmount, profitAmount: q.profitAmount,
      vatPct: q.vatPct || 0, vatAmount: q.vatAmount || 0, totalAmount: q.totalAmount,
    };
  }

  async getQuotation(id: string, user?: JwtUser): Promise<QuotationRecord> {
    const quotation = await this.prisma.quotation.findFirst({ 
      where: { OR: [{ id }, { code: id }] },
      include: { items: true },
    });
    if (!quotation) throw new NotFoundException('Không tìm thấy báo giá.');
    this.assertCanAccessQuotation(quotation, user);
    return this.toQuotationRecord(quotation);
  }

  listQuotations(filter: { createdById?: string; page: number; pageSize?: number; }, user?: JwtUser): Promise<{ items: QuotationRecord[]; total: number; page: number; pageSize: number }>;
  listQuotations(filter?: { createdById?: string; page?: undefined; pageSize?: number; }, user?: JwtUser): Promise<QuotationRecord[]>;
  async listQuotations(filter?: { createdById?: string; page?: number; pageSize?: number }, user?: JwtUser) {
    const where = { createdById: this.scopedQuotationCreator(filter?.createdById, user) };
    if (filter?.page !== undefined) {
      const pageSize = filter.pageSize ?? 10;
      const page = filter.page;
      const [items, total] = await Promise.all([
        this.prisma.quotation.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { items: true } }),
        this.prisma.quotation.count({ where }),
      ]);
      return { items: items.map((q) => this.toQuotationRecord(q)), total, page, pageSize };
    }
    const items = await this.prisma.quotation.findMany({ where, orderBy: { createdAt: 'desc' }, include: { items: true } });
    return items.map((q) => this.toQuotationRecord(q));
  }

  async convertToProject(quotationId: string, user: JwtUser) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { OR: [{ id: quotationId }, { code: quotationId }] },
      include: { items: true }
    });
    if (!quotation) throw new NotFoundException('Không tìm thấy báo giá.');

    this.assertCanAccessQuotation(quotation, user);

    const now = new Date();
    const code = `CT-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    const project = await this.prisma.project.create({
      data: {
        code,
        name: quotation.customerName ? `Công trình ${quotation.customerName}` : `Công trình ${quotation.code}`,
        ownerId: user.sub,
        customerName: quotation.customerName || '',
        customerPhone: quotation.customerPhone || '',
        address: quotation.customerAddress || '',
        quotationId: quotation.id,
        estimatedValue: quotation.totalAmount,
        contractValue: quotation.totalAmount,
        status: 'OPEN',
        note: `Tự động chuyển từ Báo giá ${quotation.code}`
      }
    });

    return project;
  }

  async createOrderDraftFromProject(projectId: string, user: JwtUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) throw new NotFoundException('Không tìm thấy công trình.');

    this.assertCanAccessProject(project, user);

    let quotationItems: any[] = [];
    let colorCode = '';
    if (project.quotationId) {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: project.quotationId },
        include: { items: true }
      });
      if (quotation) {
        quotationItems = quotation.items;
        if (quotationItems.length > 0 && quotationItems[0].color) {
          colorCode = quotationItems[0].color;
        }
      }
    }

    if (quotationItems.length === 0) throw new BadRequestException('Công trình chưa có báo giá với bộ cửa để bóc tách.');
    const orderItems = await this.quotationBom.buildOrderItems(quotationItems, {
      defaultColor: colorCode || 'CAFE_METALIC',
    });

    return {
      sourceType: 'FACTORY',
      customerName: project.customerName || '',
      customerPhone: project.customerPhone || '',
      deliveryAddress: project.address || '',
      colorCode,
      note: `Đơn từ công trình ${project.name} (${project.code})`,
      items: orderItems,
    };
  }
}
