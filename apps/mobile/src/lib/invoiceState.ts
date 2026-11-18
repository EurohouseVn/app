// Logic hiển thị của màn Hoá đơn & thuế (invoiceState.test.ts). Không gọi API.

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'REPLACED';
export type InvoiceFilter = 'ALL' | 'DRAFT' | 'ISSUED' | 'CANCELLED';
export type StatusTone = 'ok' | 'test' | 'draft' | 'cancel';
export type BannerTone = 'warning' | 'error' | 'success';

export function compactMoney(value: number): string {
  const amount = Math.round(Number(value) || 0);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export function money(value: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')} đ`;
}

export function dmy(key: string): string {
  const [y, m, d] = key.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export interface LedgerBannerInput {
  alert: 'NONE' | 'NEAR' | 'CROSSED' | 'OVERDUE' | 'REGISTERED';
  threshold: number;
  remaining: number;
  currentQuarter: number | null;
  crossedOn: string | null;
  crossedQuarter: number | null;
  registrationDeadline: string | null;
  registrationDeadlineIfCrossedNow: string | null;
  daysToDeadline: number | null;
}

export function ledgerBanner(l: LedgerBannerInput): { tone: BannerTone; title: string; text: string } | null {
  const limit = compactMoney(l.threshold);
  switch (l.alert) {
    case 'NEAR': {
      const when = l.currentQuarter && l.registrationDeadlineIfCrossedNow
        ? ` Nếu vượt trong quý ${l.currentQuarter}, phải đăng ký hoá đơn điện tử trước ${dmy(l.registrationDeadlineIfCrossedNow)} và khai thuế theo quý.`
        : '';
      return { tone: 'warning', title: `Sắp vượt ngưỡng ${limit}`, text: `Còn ${compactMoney(l.remaining)}.${when}` };
    }
    case 'CROSSED': {
      const left = l.daysToDeadline === 0 ? 'hôm nay là hạn cuối' : `còn ${l.daysToDeadline} ngày`;
      return {
        tone: 'error',
        title: `Đã vượt ngưỡng ${limit} từ ${l.crossedOn ? dmy(l.crossedOn) : ''}`.trim(),
        text: `Đăng ký hoá đơn điện tử trước ${l.registrationDeadline ? dmy(l.registrationDeadline) : ''} (${left}) và khai thuế theo quý. Đăng ký xong thì ghi ngày vào hồ sơ thuế.`,
      };
    }
    case 'OVERDUE':
      return {
        tone: 'error',
        title: 'Quá hạn đăng ký hoá đơn điện tử',
        text: `Hạn là ${l.registrationDeadline ? dmy(l.registrationDeadline) : ''}, đã quá ${Math.abs(l.daysToDeadline ?? 0)} ngày. Đăng ký ngay và hỏi kế toán về khai bổ sung.`,
      };
    case 'REGISTERED':
      return {
        tone: 'success',
        title: 'Đã đăng ký hoá đơn điện tử',
        text: l.crossedQuarter ? `Doanh thu đã vượt ${limit}: khai thuế GTGT, TNCN theo quý.` : `Khi doanh thu vượt ${limit}, khai thuế GTGT, TNCN theo quý.`,
      };
    default:
      return null;
  }
}

export function statusMeta(inv: { status: InvoiceStatus; provider: string | null; number: string | null }): { label: string; tone: StatusTone } {
  if (inv.status === 'DRAFT') return { label: 'Nháp', tone: 'draft' };
  if (inv.status === 'CANCELLED') return { label: 'Đã huỷ', tone: 'cancel' };
  if (inv.status === 'REPLACED') return { label: 'Đã bị thay thế', tone: 'cancel' };
  if (inv.provider === 'SANDBOX') return { label: 'Bản thử', tone: 'test' };
  return { label: 'Đã phát hành', tone: 'ok' };
}

export function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

type Listable = { status: InvoiceStatus; issueDate: string; total: number; number: string | null; buyerName: string; buyerTaxCode: string; projectCode: string };

export function filterInvoices<T extends Listable>(list: T[], filter: InvoiceFilter, query: string): T[] {
  const needle = fold(query.trim());
  return list.filter((inv) => {
    if (filter === 'CANCELLED' ? !(inv.status === 'CANCELLED' || inv.status === 'REPLACED') : filter !== 'ALL' && inv.status !== filter) return false;
    if (!needle) return true;
    return fold(`${inv.number ?? ''} ${inv.buyerName} ${inv.buyerTaxCode} ${inv.projectCode}`).includes(needle);
  });
}

export function statusCounts(list: Array<{ status: InvoiceStatus }>): Record<InvoiceFilter, number> {
  return {
    ALL: list.length,
    DRAFT: list.filter((i) => i.status === 'DRAFT').length,
    ISSUED: list.filter((i) => i.status === 'ISSUED').length,
    CANCELLED: list.filter((i) => i.status === 'CANCELLED' || i.status === 'REPLACED').length,
  };
}

export function groupInvoicesByMonth<T extends Listable>(list: T[]): Array<{ key: string; label: string; total: number; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const inv of list) {
    const key = inv.issueDate.slice(0, 7);
    map.set(key, [...(map.get(key) ?? []), inv]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      label: `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}`,
      total: items.filter((i) => i.status === 'ISSUED').reduce((s, i) => s + i.total, 0),
      items,
    }));
}

export function draftTotal(lines: Array<{ quantity: number; unitPrice: number }>): number {
  return lines.reduce((s, l) => s + (Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)) || 0), 0);
}

/** "18/11/2026" → "2026-11-18"; sai ngày thì null. */
export function parseDmy(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const key = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) return null;
  return key;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
