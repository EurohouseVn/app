import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CashTransactionItem,
  CreateCashTransactionInput,
  DebtPaymentRequestItem,
  DebtItem,
  FinancialReportData,
  MonthlyPnL,
  PayDebtInput,
} from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';

const PAYMENT_REQUEST_PENDING = 'DEBT_PAYMENT_REQUEST_PENDING';
const PAYMENT_REQUEST_CONFIRMED = 'DEBT_PAYMENT_REQUEST_CONFIRMED';
const PAYMENT_REQUEST_REJECTED = 'DEBT_PAYMENT_REQUEST_REJECTED';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private toDebtItem(d: {
    id: string; type: string; direction: string; partnerName: string; amount: number;
    paidAmount: number; status: string; bankAccount: string; bankName: string; note: string;
    nppOrgId: string | null; factoryOrgId: string | null; orderId: string | null;
    factoryOrg: { name: string } | null; order: { code: string } | null;
  }): DebtItem {
    return {
      id: d.id, type: d.type as DebtItem['type'], direction: d.direction as DebtItem['direction'],
      partnerName: d.partnerName, amount: d.amount, paidAmount: d.paidAmount,
      status: d.status as DebtItem['status'], bankAccount: d.bankAccount, bankName: d.bankName, note: d.note,
      nppOrgId: d.nppOrgId ?? undefined, factoryOrgId: d.factoryOrgId ?? undefined,
      factoryOrgName: d.factoryOrg?.name, orderId: d.orderId ?? undefined, orderCode: d.order?.code,
    };
  }

  async listDebts(filter?: { direction?: string; status?: string; type?: string; nppOrgId?: string; excludeNppInternal?: boolean }): Promise<DebtItem[]> {
    const debts = await this.prisma.debt.findMany({
      where: {
        direction: filter?.direction,
        status: filter?.status,
        type: filter?.type,
        nppOrgId: filter?.nppOrgId,
        ...(filter?.excludeNppInternal ? { factoryOrgId: null } : {}),
      },
      include: { factoryOrg: true, order: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return debts.map((d) => this.toDebtItem(d));
  }

  async listUserDebts(user: JwtUser): Promise<DebtItem[]> {
    if (!user.organizationId) return [];
    const debts = await this.prisma.debt.findMany({
      where: {
        factoryOrgId: user.organizationId,
        type: 'NPP',
        status: { not: 'PAID' },
      },
      include: { factoryOrg: true, order: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return debts.map((d) => this.toDebtItem(d));
  }

  async createDebt(data: Partial<DebtItem> & { projectId?: string }): Promise<DebtItem> {
    const type = data.type ?? 'CUSTOMER';
    const direction = data.direction ?? (type === 'CUSTOMER' ? 'RECEIVABLE' : 'PAYABLE');
    const created = await this.prisma.debt.create({
      data: {
        type, direction, partnerName: data.partnerName ?? '', amount: data.amount ?? 0,
        paidAmount: data.paidAmount ?? 0, bankAccount: data.bankAccount ?? '', bankName: data.bankName ?? '',
        note: data.note ?? '', projectId: data.projectId ?? null,
      },
      include: { factoryOrg: true, order: { select: { code: true } } },
    });
    return this.toDebtItem(created);
  }

  async updateDebt(id: string, data: Partial<DebtItem>): Promise<DebtItem> {
    const allowed = ['partnerName', 'amount', 'bankAccount', 'bankName', 'note', 'direction', 'status'];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data) updateData[key] = (data as Record<string, unknown>)[key];
    }
    const updated = await this.prisma.debt.update({
      where: { id }, data: updateData,
      include: { factoryOrg: true, order: { select: { code: true } } },
    });
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

  async payNppDebt(id: string, input: PayDebtInput, nppOrgId: string, userId?: string): Promise<CashTransactionItem> {
    const debt = await this.prisma.debt.findUnique({ where: { id } });
    if (!debt || debt.nppOrgId !== nppOrgId) throw new NotFoundException('Không tìm thấy công nợ.');
    return this.payDebt(id, input, userId);
  }

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

  private toDebtPaymentRequestItem(c: {
    id: string; code: string; amount: number; method: string; note: string; category: string; createdAt: Date;
    debtId: string | null; partnerName: string;
    debt: {
      partnerName: string; factoryOrg: { name: string } | null; order: { code: string } | null;
    } | null;
  }): DebtPaymentRequestItem {
    return {
      id: c.id,
      code: c.code,
      debtId: c.debtId ?? '',
      debtPartnerName: c.debt?.partnerName ?? '',
      factoryName: c.debt?.factoryOrg?.name ?? c.debt?.partnerName ?? c.partnerName ?? '',
      orderCode: c.debt?.order?.code,
      amount: c.amount,
      method: c.method as DebtPaymentRequestItem['method'],
      note: c.note,
      status: c.category === PAYMENT_REQUEST_CONFIRMED ? 'CONFIRMED' : c.category === PAYMENT_REQUEST_REJECTED ? 'REJECTED' : 'PENDING',
      createdAt: c.createdAt.toISOString(),
    };
  }

  async createDebtPaymentRequest(id: string, input: PayDebtInput, user: JwtUser): Promise<DebtPaymentRequestItem> {
    if (!user.organizationId) throw new ForbiddenException('Tài khoản chưa gắn với cơ sở sản xuất.');
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: { factoryOrg: true, order: { select: { code: true } } },
    });
    if (!debt || debt.factoryOrgId !== user.organizationId || debt.type !== 'NPP') {
      throw new NotFoundException('Không tìm thấy công nợ.');
    }
    const remaining = debt.amount - debt.paidAmount;
    const amount = Number(input.amount);
    if (!amount || amount <= 0) throw new BadRequestException('Số tiền thanh toán không hợp lệ.');
    if (amount > remaining) throw new BadRequestException('Số tiền thanh toán lớn hơn công nợ còn lại.');

    const type = debt.direction === 'RECEIVABLE' ? 'RECEIPT' : 'PAYMENT';
    const code = await this.nextCashCode(type);
    const created = await this.prisma.cashTransaction.create({
      data: {
        code,
        type,
        amount,
        method: input.method ?? 'CASH',
        category: PAYMENT_REQUEST_PENDING,
        debtId: id,
        partnerName: debt.partnerName,
        note: input.note ?? '',
        createdById: user.sub,
      },
      include: { debt: { include: { factoryOrg: true, order: { select: { code: true } } } } },
    });
    return this.toDebtPaymentRequestItem(created);
  }

  async listNppDebtPaymentRequests(nppOrgId: string): Promise<DebtPaymentRequestItem[]> {
    const list = await this.prisma.cashTransaction.findMany({
      where: { category: PAYMENT_REQUEST_PENDING, debt: { nppOrgId } },
      include: { debt: { include: { factoryOrg: true, order: { select: { code: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((item) => this.toDebtPaymentRequestItem(item));
  }

  async confirmNppDebtPaymentRequest(id: string, nppOrgId: string, userId?: string): Promise<DebtPaymentRequestItem> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.cashTransaction.findUnique({
        where: { id },
        include: { debt: { include: { factoryOrg: true, order: { select: { code: true } } } } },
      });
      if (!request || !request.debt || request.debt.nppOrgId !== nppOrgId) throw new NotFoundException('Không tìm thấy yêu cầu thanh toán.');
      if (request.category !== PAYMENT_REQUEST_PENDING) throw new BadRequestException('Yêu cầu thanh toán đã được xử lý.');
      const remaining = request.debt.amount - request.debt.paidAmount;
      if (remaining <= 0) throw new BadRequestException('Công nợ này đã được thanh toán đủ.');
      if (request.amount > remaining) throw new BadRequestException('Số tiền yêu cầu lớn hơn công nợ còn lại.');

      const paidAmount = request.debt.paidAmount + request.amount;
      const status = paidAmount >= request.debt.amount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'OPEN';
      await tx.debt.update({ where: { id: request.debt.id }, data: { paidAmount, status } });
      return tx.cashTransaction.update({
        where: { id },
        data: {
          category: PAYMENT_REQUEST_CONFIRMED,
          note: request.note ? `${request.note}\nĐã xác nhận bởi NPP.` : 'Đã xác nhận bởi NPP.',
          createdById: userId ?? request.createdById,
        },
        include: { debt: { include: { factoryOrg: true, order: { select: { code: true } } } } },
      });
    });
    return this.toDebtPaymentRequestItem(updated);
  }

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
}
