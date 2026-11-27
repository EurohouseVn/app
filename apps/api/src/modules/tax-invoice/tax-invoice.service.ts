import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type {
  InvoiceProviderCode,
  RecordExternalInvoiceInput,
  SalesInvoiceSource,
  SalesInvoiceStatus,
  SaveWorkshopSalesInvoiceInput,
  TaxBusinessLine,
  TaxEntityType,
  TaxPitMethod,
  UpdateWorkshopTaxProfileInput,
  WorkshopSalesInvoice,
  WorkshopSalesInvoiceSummary,
  WorkshopTaxLedger,
  WorkshopTaxProfile,
  WorkshopTaxYearRuleView,
} from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { computeInvoiceTotals, isValidTaxCode, lineAmount, validateForIssue } from './invoice-rules';
import { INVOICE_NUMBER_DIGITS, providerFor } from './invoice-provider';
import { buildYearLedger, estimateTax, vnDateKey, type LedgerInvoiceStatus } from './tax-ledger';
import { taxRuleForYear, type TaxYearRule } from './tax-rules';

export const TAX_CLOCK = Symbol('TAX_CLOCK');

const ENTITY_TYPES: TaxEntityType[] = ['HKD', 'DN'];
const BUSINESS_LINES: TaxBusinessLine[] = ['MANUFACTURING', 'CONSTRUCTION_WITH_MATERIALS', 'TRADING'];
const PIT_METHODS: TaxPitMethod[] = ['REVENUE_RATE', 'INCOME'];
const PROVIDERS: InvoiceProviderCode[] = ['NONE', 'SANDBOX', 'MISA'];
const DN_VAT_RATES = [0, 5, 8, 10];
const STATUSES: SalesInvoiceStatus[] = ['DRAFT', 'ISSUED', 'CANCELLED', 'REPLACED'];

type ProfileRow = {
  entityType: string; taxCode: string; legalName: string; legalAddress: string; locationCode: string; businessLine: string;
  vatRatePct: number | null; pitRatePct: number | null; pitMethod: string; invoiceSeries: string; provider: string;
  einvoiceRegisteredAt: Date | null; updatedAt?: Date | null;
};

const EMPTY_PROFILE: ProfileRow = {
  entityType: 'HKD', taxCode: '', legalName: '', legalAddress: '', locationCode: '', businessLine: 'MANUFACTURING',
  vatRatePct: null, pitRatePct: null, pitMethod: 'REVENUE_RATE', invoiceSeries: '', provider: 'NONE', einvoiceRegisteredAt: null, updatedAt: null,
};

const INVOICE_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
  events: { orderBy: { createdAt: 'desc' } },
  replaces: { select: { number: true } },
  replacedBy: { select: { id: true, number: true, status: true } },
  _count: { select: { lines: true } },
} as const;

/** Đầu ngày YYYY-MM-DD theo giờ Việt Nam. */
function vnStart(key: string): Date {
  return new Date(`${key}T00:00:00+07:00`);
}

/** Ngày hoá đơn lưu lúc 12:00 giờ VN để không lệch ngày khi đổi múi giờ. */
function vnNoon(key: string): Date {
  return new Date(`${key}T12:00:00+07:00`);
}

function parseDateKey(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  const key = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(Date.parse(`${key}T00:00:00Z`))) throw new BadRequestException('Ngày hoá đơn không hợp lệ.');
  return key;
}

function text(value: unknown, max = 300): string {
  return String(value ?? '').trim().slice(0, max);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

@Injectable()
export class TaxInvoiceService {
  private readonly now: () => Date;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(TAX_CLOCK) now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  private organizationId(user: JwtUser): string {
    if (!user.organizationId) throw new ForbiddenException('Tài khoản chưa được gắn với cơ sở sản xuất.');
    return user.organizationId;
  }

  /** Nhà phân phối không có công trình: tiền thu là các phiếu thu gắn với công nợ của chính NPP. */
  private receiptsWhere(user: JwtUser, organizationId: string, range: { gte: Date; lt: Date }) {
    return user.role === 'NPP'
      ? { type: 'RECEIPT', transDate: range, debt: { nppOrgId: organizationId } }
      : { type: 'RECEIPT', transDate: range, project: { organizationId } };
  }

  private actor(user: JwtUser) {
    return { actorId: user.sub, actorName: user.displayName || user.email || '' };
  }

  private ruleView(rule: TaxYearRule, businessLine: string): WorkshopTaxYearRuleView {
    const line = rule.lines[businessLine as TaxBusinessLine] ?? rule.lines.MANUFACTURING;
    return { year: rule.year, exemptThreshold: rule.exemptThreshold, vatPct: line.vatPct, pitPct: line.pitPct, confirmed: rule.confirmed, source: rule.source };
  }

  /** Hồ sơ chưa lập: nhà phân phối mặc định ngành phân phối, xưởng mặc định sản xuất. */
  private emptyProfile(user: JwtUser): ProfileRow {
    return user.role === 'NPP' ? { ...EMPTY_PROFILE, businessLine: 'TRADING' } : EMPTY_PROFILE;
  }

  private async profileRow(user: JwtUser): Promise<ProfileRow> {
    const organizationId = this.organizationId(user);
    return ((await this.prisma.workshopTaxProfile.findUnique({ where: { organizationId } })) as ProfileRow | null) ?? this.emptyProfile(user);
  }

  private toProfile(row: ProfileRow): WorkshopTaxProfile {
    const year = Number(vnDateKey(this.now()).slice(0, 4));
    return {
      entityType: row.entityType as TaxEntityType,
      taxCode: row.taxCode,
      legalName: row.legalName,
      legalAddress: row.legalAddress,
      locationCode: row.locationCode,
      businessLine: row.businessLine as TaxBusinessLine,
      vatRatePct: row.vatRatePct,
      pitRatePct: row.pitRatePct,
      pitMethod: row.pitMethod as TaxPitMethod,
      invoiceSeries: row.invoiceSeries,
      provider: row.provider as InvoiceProviderCode,
      einvoiceRegisteredAt: iso(row.einvoiceRegisteredAt),
      updatedAt: iso(row.updatedAt ?? null),
      isComplete: Boolean(row.taxCode && row.legalName && row.invoiceSeries),
      defaults: this.ruleView(taxRuleForYear(year), row.businessLine),
    };
  }

  // ---- Hồ sơ thuế ----

  async profile(user: JwtUser): Promise<WorkshopTaxProfile> {
    return this.toProfile(await this.profileRow(user));
  }

  async updateProfile(user: JwtUser, body: UpdateWorkshopTaxProfileInput): Promise<WorkshopTaxProfile> {
    const organizationId = this.organizationId(user);
    const data: Record<string, unknown> = {};
    if (body.entityType !== undefined) {
      if (!ENTITY_TYPES.includes(body.entityType)) throw new BadRequestException('Loại hình phải là hộ kinh doanh hoặc doanh nghiệp.');
      data.entityType = body.entityType;
    }
    if (body.taxCode !== undefined) {
      const taxCode = text(body.taxCode, 20);
      if (taxCode && !isValidTaxCode(taxCode)) throw new BadRequestException('Mã số thuế phải có 10 hoặc 13 chữ số.');
      data.taxCode = taxCode;
    }
    if (body.legalName !== undefined) data.legalName = text(body.legalName, 200);
    if (body.legalAddress !== undefined) data.legalAddress = text(body.legalAddress, 300);
    if (body.locationCode !== undefined) data.locationCode = text(body.locationCode, 20);
    if (body.businessLine !== undefined) {
      if (!BUSINESS_LINES.includes(body.businessLine)) throw new BadRequestException('Ngành nghề không hợp lệ.');
      data.businessLine = body.businessLine;
    }
    for (const key of ['vatRatePct', 'pitRatePct'] as const) {
      if (body[key] === undefined) continue;
      if (body[key] === null) { data[key] = null; continue; }
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new BadRequestException('Tỷ lệ thuế phải từ 0 đến 100%.');
      data[key] = value;
    }
    if (body.pitMethod !== undefined) {
      if (!PIT_METHODS.includes(body.pitMethod)) throw new BadRequestException('Cách tính thuế TNCN không hợp lệ.');
      data.pitMethod = body.pitMethod;
    }
    if (body.invoiceSeries !== undefined) {
      const series = text(body.invoiceSeries, 12).toUpperCase().replace(/\s+/g, '');
      if (series && !/^[0-9A-Z]{1,12}$/.test(series)) throw new BadRequestException('Ký hiệu hoá đơn chỉ gồm chữ và số, tối đa 12 ký tự.');
      data.invoiceSeries = series;
    }
    if (body.provider !== undefined) {
      if (!PROVIDERS.includes(body.provider)) throw new BadRequestException('Nhà cung cấp hoá đơn không hợp lệ.');
      if (body.provider === 'MISA') throw new BadRequestException('Chưa nối MISA meInvoice. Khi xưởng có tài khoản API, Eurohouse sẽ bật kết nối này.');
      data.provider = body.provider;
    }
    if (body.einvoiceRegisteredAt !== undefined) {
      data.einvoiceRegisteredAt = body.einvoiceRegisteredAt ? vnNoon(parseDateKey(body.einvoiceRegisteredAt, '')) : null;
    }
    data.updatedById = user.sub;
    const { updatedAt: _ignored, ...defaults } = this.emptyProfile(user);
    const row = await this.prisma.workshopTaxProfile.upsert({
      where: { organizationId },
      create: { ...defaults, ...data, organizationId } as never,
      update: data as never,
    });
    return this.toProfile(row as ProfileRow);
  }

  // ---- Hoá đơn ----

  private toSummary(row: any): WorkshopSalesInvoiceSummary {
    const replacement = (row.replacedBy ?? []).find((r: any) => r.number) ?? null;
    return {
      id: row.id,
      status: row.status,
      source: row.source,
      provider: row.provider ?? null,
      series: row.series,
      number: row.number ?? null,
      issueDate: vnDateKey(row.issueDate),
      buyerName: row.buyerName,
      buyerTaxCode: row.buyerTaxCode,
      projectId: row.projectId ?? null,
      projectCode: row.projectCode ?? '',
      total: row.total,
      lineCount: row._count?.lines ?? row.lines?.length ?? 0,
      cancelReason: row.cancelReason ?? '',
      replacesNumber: row.replaces?.number ?? null,
      replacedByNumber: replacement?.number ?? null,
    };
  }

  private toInvoice(row: any, projectCollected: number | null = null): WorkshopSalesInvoice {
    const replacedBy = (row.replacedBy ?? [])[0] ?? null;
    return {
      ...this.toSummary(row),
      customerId: row.customerId ?? null,
      buyerAddress: row.buyerAddress,
      buyerEmail: row.buyerEmail,
      buyerPhone: row.buyerPhone,
      subtotal: row.subtotal,
      vatRatePct: row.vatRatePct,
      vatAmount: row.vatAmount,
      note: row.note,
      lookupCode: row.lookupCode ?? null,
      providerRef: row.providerRef ?? null,
      issuedAt: iso(row.issuedAt),
      cancelledAt: iso(row.cancelledAt),
      replacesId: row.replacesId ?? null,
      replacedById: replacedBy?.id ?? null,
      lines: (row.lines ?? []).map((l: any) => ({ id: l.id, name: l.name, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount })),
      events: (row.events ?? []).map((e: any) => ({ action: e.action, actorName: e.actorName, detail: e.detail, createdAt: iso(e.createdAt)! })),
      projectCollected,
    };
  }

  private async scoped(user: JwtUser, id: string) {
    const row = await this.prisma.workshopSalesInvoice.findFirst({ where: { id, organizationId: this.organizationId(user) }, include: INVOICE_INCLUDE });
    if (!row) throw new NotFoundException('Không tìm thấy hoá đơn.');
    return row as any;
  }

  private requireDraft(row: { status: string }) {
    if (row.status !== 'DRAFT') throw new BadRequestException('Chỉ sửa, xoá hoặc phát hành được hoá đơn nháp. Hoá đơn đã phát hành thì huỷ hoặc lập hoá đơn thay thế.');
  }

  private normalizeLines(lines: SaveWorkshopSalesInvoiceInput['lines']) {
    if (!Array.isArray(lines)) throw new BadRequestException('Danh sách dòng hàng không hợp lệ.');
    if (lines.length > 200) throw new BadRequestException('Hoá đơn tối đa 200 dòng.');
    return lines.map((line) => ({
      name: text(line.name, 300),
      unit: text(line.unit, 30),
      quantity: Math.round((Number(line.quantity) || 0) * 1000) / 1000,
      unitPrice: Math.round(Number(line.unitPrice) || 0),
    }));
  }

  private invoiceData(body: SaveWorkshopSalesInvoiceInput, entityType: string) {
    const lines = this.normalizeLines(body.lines ?? []);
    let vatRatePct = 0;
    if (entityType === 'DN') {
      vatRatePct = Number(body.vatRatePct ?? 0);
      if (!DN_VAT_RATES.includes(vatRatePct)) throw new BadRequestException('Thuế suất GTGT phải là 0, 5, 8 hoặc 10%.');
    }
    const totals = computeInvoiceTotals(lines, vatRatePct);
    const buyerTaxCode = text(body.buyerTaxCode, 20);
    if (buyerTaxCode && !isValidTaxCode(buyerTaxCode)) throw new BadRequestException('Mã số thuế người mua phải có 10 hoặc 13 chữ số.');
    return {
      fields: {
        buyerName: text(body.buyerName, 200),
        buyerTaxCode,
        buyerAddress: text(body.buyerAddress, 300),
        buyerEmail: text(body.buyerEmail, 200),
        buyerPhone: text(body.buyerPhone, 30),
        issueDate: vnNoon(parseDateKey(body.issueDate, vnDateKey(this.now()))),
        note: text(body.note, 500),
        vatRatePct,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
      },
      lines: lines.map((line, i) => ({ ...line, position: i, amount: totals.amounts[i] })),
    };
  }

  async invoices(user: JwtUser, query: { year?: string; status?: string; q?: string } = {}): Promise<WorkshopSalesInvoiceSummary[]> {
    const organizationId = this.organizationId(user);
    const where: Record<string, unknown> = { organizationId };
    if (query.year) {
      const year = Number(query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Năm không hợp lệ.');
      where.issueDate = { gte: vnStart(`${year}-01-01`), lt: vnStart(`${year + 1}-01-01`) };
    }
    if (query.status) {
      if (!STATUSES.includes(query.status as SalesInvoiceStatus)) throw new BadRequestException('Trạng thái không hợp lệ.');
      where.status = query.status;
    }
    const q = text(query.q, 100);
    if (q) where.OR = [{ buyerName: { contains: q, mode: 'insensitive' } }, { number: { contains: q } }, { buyerTaxCode: { contains: q } }, { projectCode: { contains: q, mode: 'insensitive' } }];
    const rows = await this.prisma.workshopSalesInvoice.findMany({
      where,
      include: { replaces: { select: { number: true } }, replacedBy: { select: { id: true, number: true, status: true } }, _count: { select: { lines: true } } },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async invoice(user: JwtUser, id: string): Promise<WorkshopSalesInvoice> {
    const row = await this.scoped(user, id);
    let collected: number | null = null;
    if (row.projectId) {
      const sum = await this.prisma.cashTransaction.aggregate({ where: { projectId: row.projectId, type: 'RECEIPT' }, _sum: { amount: true } });
      collected = sum._sum.amount ?? 0;
    }
    return this.toInvoice(row, collected);
  }

  private async createDraft(user: JwtUser, body: SaveWorkshopSalesInvoiceInput, extra: { projectId?: string | null; projectCode?: string; customerId?: string | null; replacesId?: string | null; detail: string; action?: string }) {
    const organizationId = this.organizationId(user);
    const profile = await this.profileRow(user);
    const { fields, lines } = this.invoiceData(body, profile.entityType);
    const row = await this.prisma.workshopSalesInvoice.create({
      data: {
        organizationId,
        ...fields,
        projectId: extra.projectId ?? null,
        projectCode: extra.projectCode ?? '',
        customerId: extra.customerId ?? null,
        replacesId: extra.replacesId ?? null,
        series: profile.invoiceSeries,
        status: 'DRAFT',
        source: 'PROVIDER',
        createdById: user.sub,
        lines: { create: lines },
        events: { create: { action: extra.action ?? 'CREATED', detail: extra.detail, ...this.actor(user) } },
      },
      include: INVOICE_INCLUDE,
    });
    return this.toInvoice(row);
  }

  async createInvoice(user: JwtUser, body: SaveWorkshopSalesInvoiceInput): Promise<WorkshopSalesInvoice> {
    let projectCode = '';
    const projectId = body.projectId ? String(body.projectId) : null;
    if (projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId: this.organizationId(user) } });
      if (!project) throw new NotFoundException('Không tìm thấy công trình trong xưởng này.');
      projectCode = project.code;
    }
    return this.createDraft(user, body, { projectId, projectCode, customerId: body.customerId ?? null, detail: 'Lập hoá đơn nháp' });
  }

  async createFromProject(user: JwtUser, projectId: string): Promise<WorkshopSalesInvoice> {
    const organizationId = this.organizationId(user);
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId, archivedAt: null } });
    if (!project) throw new NotFoundException('Không tìm thấy công trình trong xưởng này.');

    const customer = project.customerV2Id
      ? await this.prisma.workshopCustomer.findFirst({ where: { id: project.customerV2Id, organizationId } })
      : null;
    const quotation = project.quotationId
      ? await this.prisma.quotation.findUnique({ where: { id: project.quotationId }, include: { items: true } })
      : null;

    const lines: SaveWorkshopSalesInvoiceInput['lines'] = [];
    if (quotation?.items?.length) {
      for (const item of quotation.items) {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const label = [`${item.doorType || 'Hạng mục'}${item.system ? ` ${item.system}` : ''}`, item.name, item.widthMm && item.heightMm ? `${item.widthMm}×${item.heightMm} mm` : '']
          .filter(Boolean).join(' · ');
        lines.push({ name: label, unit: 'bộ', quantity, unitPrice: Math.round((Number(item.totalPrice) || 0) / quantity) });
      }
      const itemsTotal = lines.reduce((s, l) => s + lineAmount(l), 0);
      const rest = (Number(quotation.totalAmount) || 0) - (Number(quotation.vatAmount) || 0) - itemsTotal;
      if (rest > 0) lines.push({ name: 'Phụ kiện, nhân công, lắp đặt và chi phí khác theo báo giá', unit: 'gói', quantity: 1, unitPrice: rest });
    } else {
      const value = project.settledValue || (project.contractValue + project.extraRevenue) || project.estimatedValue;
      lines.push({ name: `Thi công, lắp đặt nhôm kính công trình ${project.name}`, unit: 'gói', quantity: 1, unitPrice: Math.max(0, value) });
    }

    return this.createDraft(user, {
      buyerName: customer?.name || project.customerName || '',
      buyerTaxCode: customer?.taxCode || '',
      buyerAddress: customer?.address || project.address || '',
      buyerEmail: customer?.email || '',
      buyerPhone: customer?.phone || project.customerPhone || '',
      lines,
    }, { projectId: project.id, projectCode: project.code, customerId: customer?.id ?? null, detail: `Lập nháp từ ${project.code}` });
  }

  /** Nhà phân phối lập nháp từ đơn hàng đã giao xưởng: dòng theo kg từng màu đã cân, chưa cân thì theo cây. */
  async createFromOrder(user: JwtUser, orderId: string): Promise<WorkshopSalesInvoice> {
    if (user.role !== 'NPP') throw new ForbiddenException('Chỉ tài khoản nhà phân phối lập hoá đơn từ đơn hàng giao xưởng.');
    const organizationId = this.organizationId(user);
    const order: any = await this.prisma.order.findFirst({ where: { id: orderId, nppOrgId: organizationId }, include: { items: true, colorWeighings: true } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng của nhà phân phối này.');

    const lines: SaveWorkshopSalesInvoiceInput['lines'] = [];
    if (order.colorWeighings?.length) {
      for (const w of order.colorWeighings) {
        lines.push({ name: `Nhôm màu ${w.colorCode} (${w.basis === 'BUNDLE' ? 'bó nguyên' : 'nhôm trần'})`, unit: 'kg', quantity: w.actualKg, unitPrice: w.unitPricePerKg });
      }
    } else {
      for (const item of order.items ?? []) {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        lines.push({
          name: [item.productName || item.productCode, item.colorCode ? `màu ${item.colorCode}` : ''].filter(Boolean).join(' · '),
          unit: item.unit || 'cây',
          quantity,
          unitPrice: item.unitPrice || Math.round((Number(item.totalPrice) || 0) / quantity),
        });
      }
    }
    const linesTotal = lines.reduce((s, l) => s + lineAmount(l), 0);
    const rest = (Number(order.totalAmount) || 0) - linesTotal;
    if (lines.length && rest !== 0) {
      lines.push(rest > 0
        ? { name: 'Phụ thu, chi phí khác theo đơn hàng', unit: 'gói', quantity: 1, unitPrice: rest }
        : { name: 'Chiết khấu theo đơn hàng', unit: 'gói', quantity: 1, unitPrice: rest });
    }
    if (!lines.length) lines.push({ name: `Hàng hoá theo đơn ${order.code}`, unit: 'gói', quantity: 1, unitPrice: Math.max(0, Number(order.totalAmount) || 0) });

    return this.createDraft(user, {
      buyerName: order.factoryName || order.customerName || '',
      buyerAddress: order.deliveryAddress || '',
      buyerPhone: order.customerPhone || '',
      lines,
    }, { projectId: null, projectCode: order.code, detail: `Lập nháp từ đơn ${order.code}` });
  }

  async updateInvoice(user: JwtUser, id: string, body: SaveWorkshopSalesInvoiceInput): Promise<WorkshopSalesInvoice> {
    const current = await this.scoped(user, id);
    this.requireDraft(current);
    const profile = await this.profileRow(user);
    const { fields, lines } = this.invoiceData(body, profile.entityType);
    const row = await this.prisma.workshopSalesInvoice.update({
      where: { id },
      data: {
        ...fields,
        series: profile.invoiceSeries || current.series,
        lines: { deleteMany: {}, create: lines },
        events: { create: { action: 'UPDATED', detail: 'Sửa hoá đơn nháp', ...this.actor(user) } },
      },
      include: INVOICE_INCLUDE,
    });
    return this.toInvoice(row);
  }

  async deleteInvoice(user: JwtUser, id: string): Promise<{ ok: true }> {
    const current = await this.scoped(user, id);
    this.requireDraft(current);
    await this.prisma.workshopSalesInvoice.delete({ where: { id } });
    return { ok: true };
  }

  private async markReplaced(tx: any, row: any, newNumber: string, user: JwtUser) {
    if (!row.replacesId) return;
    await tx.workshopSalesInvoice.update({
      where: { id: row.replacesId },
      data: { status: 'REPLACED', events: { create: { action: 'REPLACED', detail: `Bị thay thế bởi hoá đơn số ${newNumber}`, ...this.actor(user) } } },
    });
  }

  private assertReplaceable(row: any) {
    if (row.replacesId && row.replaces === null) throw new BadRequestException('Không tìm thấy hoá đơn bị thay thế.');
  }

  async issue(user: JwtUser, id: string): Promise<WorkshopSalesInvoice> {
    const organizationId = this.organizationId(user);
    const current = await this.scoped(user, id);
    this.requireDraft(current);
    this.assertReplaceable(current);
    const profile = await this.profileRow(user);
    const provider = providerFor(profile.provider as InvoiceProviderCode);
    const errors = validateForIssue({ buyerName: current.buyerName, buyerTaxCode: current.buyerTaxCode, lines: current.lines }, profile);
    if (errors.length) throw new BadRequestException(errors.join(' '));

    const series = profile.invoiceSeries;
    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await this.prisma.workshopSalesInvoice.findFirst({
        where: { organizationId, series, number: { not: null } },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const result = await provider.issue({ series, lastNumber: last?.number ?? null, sellerTaxCode: profile.taxCode, buyerName: current.buyerName, total: current.total });
      try {
        const row = await this.prisma.$transaction(async (tx: any) => {
          const updated = await tx.workshopSalesInvoice.update({
            where: { id },
            data: {
              status: 'ISSUED',
              source: 'PROVIDER' as SalesInvoiceSource,
              provider: provider.code,
              series,
              number: result.number,
              lookupCode: result.lookupCode,
              providerRef: result.providerRef,
              issuedAt: this.now(),
              events: { create: { action: 'ISSUED', detail: `Phát hành ${provider.code === 'SANDBOX' ? '(Bản thử) ' : ''}số ${result.number}, ký hiệu ${series}`, ...this.actor(user) } },
            },
            include: INVOICE_INCLUDE,
          });
          await this.markReplaced(tx, current, result.number, user);
          return updated;
        });
        return this.invoice(user, row.id);
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    throw new BadRequestException('Số hoá đơn vừa bị dùng ở thao tác khác. Thử phát hành lại.');
  }

  async recordExternal(user: JwtUser, id: string, body: RecordExternalInvoiceInput): Promise<WorkshopSalesInvoice> {
    const current = await this.scoped(user, id);
    this.requireDraft(current);
    this.assertReplaceable(current);
    const series = text(body.series, 12).toUpperCase().replace(/\s+/g, '');
    const digits = text(body.number, 20).replace(/\D/g, '');
    if (!series) throw new BadRequestException('Nhập ký hiệu hoá đơn đã xuất.');
    if (!digits) throw new BadRequestException('Nhập số hoá đơn đã xuất.');
    const number = digits.padStart(INVOICE_NUMBER_DIGITS, '0');
    if (!current.buyerName.trim()) throw new BadRequestException('Thiếu tên người mua.');
    if (!current.lines.length) throw new BadRequestException('Hoá đơn cần ít nhất một dòng hàng.');
    const issueDate = vnNoon(parseDateKey(body.issueDate, vnDateKey(current.issueDate)));
    try {
      const row = await this.prisma.$transaction(async (tx: any) => {
        const updated = await tx.workshopSalesInvoice.update({
          where: { id },
          data: {
            status: 'ISSUED',
            source: 'EXTERNAL' as SalesInvoiceSource,
            provider: null,
            series,
            number,
            issueDate,
            issuedAt: this.now(),
            events: { create: { action: 'RECORDED_EXTERNAL', detail: `Ghi số đã xuất ở hệ thống khác: ${series} · ${number}`, ...this.actor(user) } },
          },
          include: INVOICE_INCLUDE,
        });
        await this.markReplaced(tx, current, number, user);
        return updated;
      });
      return this.invoice(user, row.id);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new BadRequestException(`Số ${number} ký hiệu ${series} đã dùng cho hoá đơn khác.`);
      throw error;
    }
  }

  async cancel(user: JwtUser, id: string, reason: string): Promise<WorkshopSalesInvoice> {
    const current = await this.scoped(user, id);
    if (current.status !== 'ISSUED') throw new BadRequestException('Chỉ huỷ được hoá đơn đã phát hành.');
    const why = text(reason, 300);
    if (!why) throw new BadRequestException('Nhập lý do huỷ hoá đơn.');
    if (current.source === 'PROVIDER' && current.provider && current.providerRef) {
      await providerFor(current.provider).cancel(current.providerRef, why);
    }
    await this.prisma.workshopSalesInvoice.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: why, cancelledAt: this.now(), events: { create: { action: 'CANCELLED', detail: `Huỷ: ${why}`, ...this.actor(user) } } },
      include: INVOICE_INCLUDE,
    });
    return this.invoice(user, id);
  }

  async replace(user: JwtUser, id: string): Promise<WorkshopSalesInvoice> {
    const current = await this.scoped(user, id);
    if (current.status !== 'ISSUED') throw new BadRequestException('Chỉ lập hoá đơn thay thế cho hoá đơn đã phát hành.');
    if ((current.replacedBy ?? []).length) throw new BadRequestException('Hoá đơn này đang có hoá đơn thay thế. Mở hoá đơn đó để sửa hoặc phát hành.');
    return this.createDraft(user, {
      buyerName: current.buyerName,
      buyerTaxCode: current.buyerTaxCode,
      buyerAddress: current.buyerAddress,
      buyerEmail: current.buyerEmail,
      buyerPhone: current.buyerPhone,
      note: current.note,
      vatRatePct: current.vatRatePct,
      lines: current.lines.map((l: any) => ({ name: l.name, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice })),
    }, { projectId: current.projectId, projectCode: current.projectCode, customerId: current.customerId, replacesId: current.id, detail: `Lập nháp thay thế hoá đơn số ${current.number}`, action: 'CREATED' });
  }

  // ---- Sổ doanh thu ----

  async ledger(user: JwtUser, yearInput?: number | string): Promise<WorkshopTaxLedger> {
    const organizationId = this.organizationId(user);
    const today = this.now();
    const year = yearInput ? Number(yearInput) : Number(vnDateKey(today).slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Năm không hợp lệ.');
    const range = { gte: vnStart(`${year}-01-01`), lt: vnStart(`${year + 1}-01-01`) };
    const [profileRow, invoices, receipts, draftCount] = await Promise.all([
      this.profileRow(user),
      this.prisma.workshopSalesInvoice.findMany({ where: { organizationId, issueDate: range, status: 'ISSUED' }, select: { issueDate: true, total: true, status: true } }),
      this.prisma.cashTransaction.findMany({ where: this.receiptsWhere(user, organizationId, range), select: { transDate: true, amount: true } }),
      this.prisma.workshopSalesInvoice.count({ where: { organizationId, status: 'DRAFT' } }),
    ]);
    const rule = taxRuleForYear(year);
    const ledger = buildYearLedger({
      year,
      rule,
      today,
      invoices: invoices.map((i: any) => ({ issueDate: i.issueDate, total: i.total, status: i.status as LedgerInvoiceStatus })),
      receipts: receipts.map((r: any) => ({ transDate: r.transDate, amount: r.amount })),
      einvoiceRegisteredAt: profileRow.einvoiceRegisteredAt,
    });
    const taxInput = {
      rule,
      businessLine: profileRow.businessLine as TaxBusinessLine,
      pitMethod: profileRow.pitMethod as TaxPitMethod,
      vatPct: profileRow.vatRatePct,
      pitPct: profileRow.pitRatePct,
    };
    const projected = ledger.projectedYearRevenue;
    const profile = this.toProfile(profileRow);
    return {
      ...ledger,
      draftCount,
      tax: estimateTax({ revenue: ledger.totalInvoiced, ...taxInput }),
      projectedTax: projected !== null && projected > rule.exemptThreshold && ledger.totalInvoiced <= rule.exemptThreshold ? estimateTax({ revenue: projected, ...taxInput }) : null,
      rule: this.ruleView(rule, profileRow.businessLine),
      profile: { entityType: profile.entityType, legalName: profile.legalName, taxCode: profile.taxCode, isComplete: profile.isComplete, provider: profile.provider },
    };
  }

  // ---- Dữ liệu cho báo cáo và PDF ----

  async reportData(user: JwtUser, year: number) {
    const organizationId = this.organizationId(user);
    const range = { gte: vnStart(`${year}-01-01`), lt: vnStart(`${year + 1}-01-01`) };
    const [profileRow, organization, invoices, receipts] = await Promise.all([
      this.profileRow(user),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.workshopSalesInvoice.findMany({
        where: { organizationId, issueDate: range, status: { not: 'DRAFT' } },
        include: { lines: { orderBy: { position: 'asc' } }, replaces: { select: { number: true } } },
        orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.cashTransaction.findMany({
        where: this.receiptsWhere(user, organizationId, range),
        include: { project: { select: { code: true, name: true } } },
        orderBy: { transDate: 'asc' },
      }),
    ]);
    return { year, profile: this.toProfile(profileRow), organizationName: organization?.name ?? '', invoices: invoices as any[], receipts: receipts as any[] };
  }

  async pdfData(user: JwtUser, id: string) {
    const invoice = await this.invoice(user, id);
    const organizationId = this.organizationId(user);
    const [profileRow, organization] = await Promise.all([
      this.profileRow(user),
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);
    return { invoice, profile: this.toProfile(profileRow), organization };
  }
}
