import type { EurohouseAccessStatus, EurohouseFeatureCapability, EurohouseFeatureKey } from '@eurohouse/types';

export type AdminEurohouseAccessRow = {
  organizationId: string;
  organizationName: string;
  province?: string;
  nppOrganizationId?: string;
  nppOrganizationName?: string;
  features: Record<EurohouseFeatureKey, EurohouseFeatureCapability>;
  updatedAt: string;
};

export type EurohouseAccessFilters = {
  featureKey: '' | EurohouseFeatureKey;
  status: '' | EurohouseAccessStatus;
  nppOrganizationId: string;
  province: string;
  page: number;
  pageSize: number;
};

export function buildEurohouseAccessQuery(filters: EurohouseAccessFilters): Record<string, string> {
  return Object.fromEntries(Object.entries({
    featureKey: filters.featureKey,
    status: filters.status,
    nppOrganizationId: filters.nppOrganizationId,
    province: filters.province.trim(),
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  }).filter(([, value]) => Boolean(value)));
}

export function rowPresentation(row: AdminEurohouseAccessRow) {
  return {
    id: row.organizationId,
    title: row.organizationName,
    province: row.province || 'Chưa cập nhật khu vực',
    npp: row.nppOrganizationName || 'Chưa liên kết NPP',
    updatedAt: new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(row.updatedAt)),
    features: row.features,
  };
}

export function buildActivationPayload(organizationId: string, featureKey: EurohouseFeatureKey, nppOrganizationId: string) {
  if (!organizationId.trim()) throw new Error('CSSX_REQUIRED');
  if (!nppOrganizationId.trim()) throw new Error('NPP_REQUIRED');
  return { organizationId: organizationId.trim(), featureKey, nppOrganizationId: nppOrganizationId.trim() };
}

export function buildFeatureRevokePayload(featureKey: EurohouseFeatureKey, reason: string) {
  if (reason.trim().length < 3) throw new Error('REVOKE_REASON_REQUIRED');
  return { featureKey, reason: reason.trim() };
}

export function buildTransferPayload(nextNppOrganizationId: string, reason: string) {
  if (!nextNppOrganizationId.trim()) throw new Error('NPP_REQUIRED');
  if (reason.trim().length < 3) throw new Error('TRANSFER_REASON_REQUIRED');
  return { nextNppOrganizationId: nextNppOrganizationId.trim(), reason: reason.trim() };
}

export function workspaceMode(width: number): 'CARDS' | 'TABLE' {
  return width <= 800 ? 'CARDS' : 'TABLE';
}
