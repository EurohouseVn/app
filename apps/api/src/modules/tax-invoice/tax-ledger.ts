// Sổ doanh thu năm và thuế tạm tính: hàm thuần, không chạm CSDL (tax-ledger.spec.ts).
import type { TaxBusinessLine, TaxPitMethod, TaxYearRule } from './tax-rules';

export type LedgerInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'REPLACED';
export type LedgerAlert = 'NONE' | 'NEAR' | 'CROSSED' | 'OVERDUE' | 'REGISTERED';

export interface LedgerInvoice {
  issueDate: Date;
  total: number;
  status: LedgerInvoiceStatus;
}

export interface LedgerReceipt {
  transDate: Date;
  amount: number;
}

export interface LedgerPeriod {
  invoiced: number;
  collected: number;
  invoiceCount: number;
  receiptCount: number;
}

export interface YearLedger {
  year: number;
  threshold: number;
  months: Array<LedgerPeriod & { month: number }>;
  quarters: Array<LedgerPeriod & { quarter: number }>;
  totalInvoiced: number;
  totalCollected: number;
  invoiceCount: number;
  receiptCount: number;
  thresholdPct: number;
  remaining: number;
  /** Quý có doanh thu luỹ kế vượt ngưỡng (1–4). */
  crossedQuarter: number | null;
  /** Ngày hoá đơn làm luỹ kế vượt ngưỡng. */
  crossedOn: string | null;
  /** Hạn đăng ký hoá đơn điện tử: 30 ngày kể từ ngày cuối quý vượt ngưỡng. */
  registrationDeadline: string | null;
  daysToDeadline: number | null;
  /** Năm đang chạy, chưa vượt: hạn đăng ký nếu vượt trong quý hiện tại. */
  registrationDeadlineIfCrossedNow: string | null;
  alert: LedgerAlert;
  annualNoticeDeadline: string;
  /** Quý của `today` khi xem năm đang chạy, ngược lại null. */
  currentQuarter: number | null;
  /** Doanh thu cả năm nếu giữ nhịp hiện tại (chỉ năm đang chạy). */
  projectedYearRevenue: number | null;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const NEAR_THRESHOLD_PCT = 80;
export const REGISTRATION_DAYS = 30;

/** YYYY-MM-DD theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè). */
export function vnDateKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function dayNumber(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
}

function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function quarterEnd(year: number, quarter: number): string {
  const lastMonth = quarter * 3;
  const lastDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  return `${year}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function emptyPeriod(): LedgerPeriod {
  return { invoiced: 0, collected: 0, invoiceCount: 0, receiptCount: 0 };
}

export function buildYearLedger(input: {
  year: number;
  rule: TaxYearRule;
  invoices: LedgerInvoice[];
  receipts: LedgerReceipt[];
  today: Date;
  einvoiceRegisteredAt?: Date | null;
}): YearLedger {
  const { year, rule } = input;
  const yearPrefix = `${year}-`;
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...emptyPeriod() }));

  const issued = input.invoices
    .filter((invoice) => invoice.status === 'ISSUED')
    .map((invoice) => ({ key: vnDateKey(invoice.issueDate), total: invoice.total }))
    .filter((invoice) => invoice.key.startsWith(yearPrefix))
    .sort((a, b) => a.key.localeCompare(b.key));

  for (const invoice of issued) {
    const m = months[Number(invoice.key.slice(5, 7)) - 1];
    m.invoiced += invoice.total;
    m.invoiceCount += 1;
  }
  for (const receipt of input.receipts) {
    const key = vnDateKey(receipt.transDate);
    if (!key.startsWith(yearPrefix)) continue;
    const m = months[Number(key.slice(5, 7)) - 1];
    m.collected += receipt.amount;
    m.receiptCount += 1;
  }

  const quarters = [1, 2, 3, 4].map((quarter) => {
    const slice = months.slice((quarter - 1) * 3, quarter * 3);
    return {
      quarter,
      invoiced: slice.reduce((s, m) => s + m.invoiced, 0),
      collected: slice.reduce((s, m) => s + m.collected, 0),
      invoiceCount: slice.reduce((s, m) => s + m.invoiceCount, 0),
      receiptCount: slice.reduce((s, m) => s + m.receiptCount, 0),
    };
  });

  const totalInvoiced = quarters.reduce((s, q) => s + q.invoiced, 0);
  const totalCollected = quarters.reduce((s, q) => s + q.collected, 0);
  const threshold = rule.exemptThreshold;

  let crossedOn: string | null = null;
  let running = 0;
  for (const invoice of issued) {
    running += invoice.total;
    if (running > threshold) { crossedOn = invoice.key; break; }
  }
  const crossedQuarter = crossedOn ? Math.ceil(Number(crossedOn.slice(5, 7)) / 3) : null;
  const registrationDeadline = crossedQuarter ? addDays(quarterEnd(year, crossedQuarter), REGISTRATION_DAYS) : null;

  const todayKey = vnDateKey(input.today);
  const isCurrentYear = todayKey.startsWith(yearPrefix);
  const currentQuarter = isCurrentYear ? Math.ceil(Number(todayKey.slice(5, 7)) / 3) : null;
  const daysToDeadline = registrationDeadline ? dayNumber(registrationDeadline) - dayNumber(todayKey) : null;
  const thresholdPct = threshold > 0 ? (totalInvoiced / threshold) * 100 : 0;

  let alert: LedgerAlert = 'NONE';
  if (input.einvoiceRegisteredAt) alert = crossedQuarter || thresholdPct >= NEAR_THRESHOLD_PCT ? 'REGISTERED' : 'NONE';
  else if (crossedQuarter) alert = daysToDeadline !== null && daysToDeadline < 0 ? 'OVERDUE' : 'CROSSED';
  else if (thresholdPct >= NEAR_THRESHOLD_PCT) alert = 'NEAR';

  let projectedYearRevenue: number | null = null;
  if (isCurrentYear) {
    const dayOfYear = dayNumber(todayKey) - dayNumber(`${year}-01-01`) + 1;
    const daysInYear = dayNumber(`${year + 1}-01-01`) - dayNumber(`${year}-01-01`);
    projectedYearRevenue = Math.round((totalInvoiced / dayOfYear) * daysInYear);
  }

  return {
    year,
    threshold,
    months,
    quarters,
    totalInvoiced,
    totalCollected,
    invoiceCount: issued.length,
    receiptCount: months.reduce((s, m) => s + m.receiptCount, 0),
    thresholdPct,
    remaining: Math.max(0, threshold - totalInvoiced),
    crossedQuarter,
    crossedOn,
    registrationDeadline,
    daysToDeadline,
    registrationDeadlineIfCrossedNow: !crossedQuarter && currentQuarter ? addDays(quarterEnd(year, currentQuarter), REGISTRATION_DAYS) : null,
    alert,
    annualNoticeDeadline: `${year + 1}-01-31`,
    currentQuarter,
    projectedYearRevenue,
  };
}

export interface TaxEstimate {
  revenue: number;
  exempt: boolean;
  vatRatePct: number;
  pitRatePct: number;
  pitMethod: TaxPitMethod;
  vat: number;
  /** null khi tính theo thu nhập mà chưa có chi phí. */
  pit: number | null;
  total: number;
  vatFormula: string;
  pitFormula: string;
}

function pctText(value: number): string {
  return `${String(value).replace('.', ',')}%`;
}

function moneyText(value: number): string {
  if (value >= 1_000_000_000 && value % 10_000_000 === 0) return `${String(value / 1_000_000_000).replace('.', ',')} tỷ`;
  return Math.round(value).toLocaleString('vi-VN');
}

export function estimateTax(input: {
  revenue: number;
  cost?: number | null;
  rule: TaxYearRule;
  businessLine: TaxBusinessLine;
  pitMethod: TaxPitMethod;
  vatPct?: number | null;
  pitPct?: number | null;
}): TaxEstimate {
  const { revenue, rule } = input;
  const line = rule.lines[input.businessLine] ?? rule.lines.MANUFACTURING;
  const vatRatePct = input.vatPct ?? line.vatPct;
  const forcedIncome = revenue > rule.incomeMethodRequiredAbove;
  const pitMethod: TaxPitMethod = forcedIncome ? 'INCOME' : input.pitMethod;
  const bracket = rule.incomeBrackets.find((b) => b.revenueUpTo === null || revenue <= b.revenueUpTo) ?? rule.incomeBrackets[rule.incomeBrackets.length - 1];
  const pitRatePct = pitMethod === 'INCOME' ? bracket.pct : input.pitPct ?? line.pitPct;

  if (revenue <= rule.exemptThreshold) {
    return {
      revenue, exempt: true, vatRatePct, pitRatePct, pitMethod, vat: 0, pit: 0, total: 0,
      vatFormula: `Không phải nộp khi doanh thu ≤ ${moneyText(rule.exemptThreshold)}`,
      pitFormula: `Không phải nộp khi doanh thu ≤ ${moneyText(rule.exemptThreshold)}`,
    };
  }

  const vat = Math.round((revenue * vatRatePct) / 100);
  let pit: number | null;
  let pitFormula: string;
  if (pitMethod === 'REVENUE_RATE') {
    pit = Math.round(((revenue - rule.exemptThreshold) * pitRatePct) / 100);
    pitFormula = `${pctText(pitRatePct)} × (${moneyText(revenue)} − ${moneyText(rule.exemptThreshold)})`;
  } else if (input.cost === undefined || input.cost === null) {
    pit = null;
    pitFormula = `${pctText(pitRatePct)} × (doanh thu − chi phí): cần nhập chi phí`;
  } else {
    pit = Math.max(0, Math.round(((revenue - input.cost) * pitRatePct) / 100));
    pitFormula = `${pctText(pitRatePct)} × (${moneyText(revenue)} − ${moneyText(input.cost)})`;
  }

  return {
    revenue, exempt: false, vatRatePct, pitRatePct, pitMethod, vat, pit,
    total: vat + (pit ?? 0),
    vatFormula: `${pctText(vatRatePct)} × ${moneyText(revenue)}`,
    pitFormula,
  };
}
