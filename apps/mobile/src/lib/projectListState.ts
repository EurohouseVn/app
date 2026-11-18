// Pure list logic for the Công trình screen (no React Native imports, unit-tested).

export type ProjectStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  customerName: string;
  address?: string;
  status: ProjectStatus;
  estimatedAmount: number;
  finalAmount: number;
  /** Sum of receipts (phiếu thu) reported by the server; undefined = not known yet. */
  receivedAmount?: number;
  createdAt: number;
  updatedAt: number;
};

export type ProjectFilter = 'ALL' | 'ATTENTION' | 'IN_PROGRESS' | 'DEBT' | 'OPEN' | 'DONE' | 'CANCELLED';

export const STALE_AFTER_DAYS = 14;
const DAY_MS = 86_400_000;

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function contractValue(project: ProjectListItem): number {
  return project.finalAmount || project.estimatedAmount || 0;
}

/** Còn phải thu. Báo giá chưa chốt và công trình huỷ không phát sinh công nợ. */
export function amountDue(project: ProjectListItem): number | undefined {
  if (project.status === 'CANCELLED' || project.status === 'OPEN') return 0;
  if (project.receivedAmount === undefined) return undefined;
  return Math.max(0, contractValue(project) - project.receivedAmount);
}

export function isStale(project: ProjectListItem, now: number): boolean {
  if (project.status !== 'OPEN' && project.status !== 'IN_PROGRESS') return false;
  return now - project.updatedAt > STALE_AFTER_DAYS * DAY_MS;
}

/** Còn nợ khi đang thi công hoặc đã hoàn tất mà chưa thu đủ. */
export function hasDebt(project: ProjectListItem): boolean {
  return (project.status === 'IN_PROGRESS' || project.status === 'DONE') && (amountDue(project) ?? 0) > 0;
}

export function needsAttention(project: ProjectListItem, now: number): boolean {
  return hasDebt(project) || isStale(project, now);
}

export function daysSinceUpdate(project: ProjectListItem, now: number): number {
  return Math.max(0, Math.floor((now - project.updatedAt) / DAY_MS));
}

export function filterProjects<T extends ProjectListItem>(list: T[], options: { query: string; filter: ProjectFilter }, now: number): T[] {
  const query = fold(options.query.trim());
  return list.filter((project) => {
    if (query && !fold(`${project.name} ${project.customerName} ${project.code}`).includes(query)) return false;
    switch (options.filter) {
      case 'ALL': return true;
      case 'ATTENTION': return needsAttention(project, now);
      case 'DEBT': return hasDebt(project);
      default: return project.status === options.filter;
    }
  });
}

export function projectSummary(list: ProjectListItem[], now: number) {
  const year = new Date(now).getFullYear();
  let running = 0;
  let totalDue = 0;
  let dueKnown = false;
  let revenueThisYear = 0;
  let attention = 0;
  for (const project of list) {
    if (project.status === 'IN_PROGRESS') running += 1;
    if ((project.status === 'IN_PROGRESS' || project.status === 'DONE') && project.receivedAmount !== undefined) {
      dueKnown = true;
      totalDue += amountDue(project) ?? 0;
    }
    if (project.status === 'DONE' && new Date(project.updatedAt).getFullYear() === year) revenueThisYear += contractValue(project);
    if (needsAttention(project, now)) attention += 1;
  }
  return { running, totalDue, dueKnown, revenueThisYear, attention };
}

export function countByFilter(list: ProjectListItem[], now: number): Record<ProjectFilter, number> {
  const filters: ProjectFilter[] = ['ALL', 'ATTENTION', 'IN_PROGRESS', 'DEBT', 'OPEN', 'DONE', 'CANCELLED'];
  return Object.fromEntries(filters.map((filter) => [filter, filterProjects(list, { query: '', filter }, now).length])) as Record<ProjectFilter, number>;
}

/** "232,8 tr", "1,25 tỷ", "950.000 đ" — số tiền gọn cho danh sách. */
export function compactVnd(value: number): string {
  const amount = Math.round(Number(value) || 0);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return `${amount.toLocaleString('vi-VN')} đ`;
}

const STATUS_ORDER: Record<ProjectStatus, number> = { OPEN: 0, IN_PROGRESS: 0, DONE: 1, CANCELLED: 2 };

/** Đang làm (báo giá, thi công) lên trước, rồi hoàn tất, cuối cùng đã huỷ; trong nhóm mới cập nhật lên trước. */
export function sortForList<T extends ProjectListItem>(list: T[]): T[] {
  return [...list].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.updatedAt - a.updatedAt);
}

/**
 * Trang chủ: tối đa 3 công trình cần chú ý. Còn nợ (nhiều trước), rồi lâu chưa cập nhật;
 * không có gì cần chú ý thì lấy công trình đang thi công mới cập nhật nhất.
 */
export function homeProjects<T extends ProjectListItem>(list: T[], now: number, limit = 3) {
  const live = list.filter((p) => p.status !== 'CANCELLED');
  const debts = live.filter(hasDebt).sort((a, b) => (amountDue(b) ?? 0) - (amountDue(a) ?? 0));
  const stale = live.filter((p) => !hasDebt(p) && isStale(p, now)).sort((a, b) => a.updatedAt - b.updatedAt);
  const items: Array<{ project: T; reason: string; tone: 'danger' | 'warning' | 'muted' }> = [
    ...debts.map((project) => ({ project, reason: `Còn phải thu ${compactVnd(amountDue(project) ?? 0)}`, tone: 'danger' as const })),
    ...stale.map((project) => ({ project, reason: `${daysSinceUpdate(project, now)} ngày chưa cập nhật`, tone: 'warning' as const })),
  ];
  if (!items.length) {
    const running = live.filter((p) => p.status === 'IN_PROGRESS').sort((a, b) => b.updatedAt - a.updatedAt);
    items.push(...running.map((project) => ({ project, reason: 'Đang thi công', tone: 'muted' as const })));
  }
  const summary = projectSummary(live, now);
  return { items: items.slice(0, limit), totalDue: summary.totalDue, running: summary.running };
}
