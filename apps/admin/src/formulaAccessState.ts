import type { FormulaAccessStatus } from '@eurohouse/types';

export type AdminFormulaAccessRow = {
  organizationId: string;
  organizationName: string;
  province?: string;
  status: FormulaAccessStatus;
  nppOrganizationId?: string;
  nppOrganizationName?: string;
  source?: string;
  updatedAt: string;
  activatedAt?: string;
  revokedAt?: string;
  revokeReason?: string;
};

export type FormulaAccessFilters = {
  status: '' | FormulaAccessStatus;
  nppOrganizationId: string;
  query: string;
};

const statusCopy: Record<FormulaAccessStatus, string> = {
  LOCKED: 'Chưa kích hoạt',
  ACTIVE: 'Đã kích hoạt',
  REVOKED: 'Đã thu hồi',
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN');
}

export function formulaAccessStatusLabel(status: FormulaAccessStatus) {
  return statusCopy[status];
}

export function filterFormulaAccessRows(rows: readonly AdminFormulaAccessRow[], filters: FormulaAccessFilters) {
  const query = normalize(filters.query);
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (filters.nppOrganizationId && row.nppOrganizationId !== filters.nppOrganizationId) return false;
    if (!query) return true;
    return normalize([row.organizationName, row.province, row.nppOrganizationName].filter(Boolean).join(' ')).includes(query);
  });
}

function viDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export function toFormulaAccessCards(rows: readonly AdminFormulaAccessRow[]) {
  return rows.map((row) => ({
    id: row.organizationId,
    title: row.organizationName,
    location: row.province || 'Chưa cập nhật khu vực',
    status: formulaAccessStatusLabel(row.status),
    npp: row.nppOrganizationName || 'Chưa liên kết NPP',
    updatedAt: viDate(row.updatedAt),
  }));
}

export function buildTransferPayload(nextNppOrganizationId: string, reason: string) {
  if (!nextNppOrganizationId.trim()) throw new Error('NPP_REQUIRED');
  if (reason.trim().length < 3) throw new Error('TRANSFER_REASON_REQUIRED');
  return { nextNppOrganizationId: nextNppOrganizationId.trim(), reason: reason.trim() };
}

export function buildRevokePayload(reason: string) {
  if (reason.trim().length < 3) throw new Error('REVOKE_REASON_REQUIRED');
  return { reason: reason.trim() };
}
