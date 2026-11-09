export const EUROHOUSE_FEATURE_KEYS = ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const;
export type EurohouseFeatureKey = (typeof EUROHOUSE_FEATURE_KEYS)[number];

export const EUROHOUSE_ACCESS_STATUSES = ['LOCKED', 'ACTIVE', 'REVOKED'] as const;
export type EurohouseAccessStatus = (typeof EUROHOUSE_ACCESS_STATUSES)[number];

export type AccessTier = 'GUEST' | 'REGISTERED' | 'EUROHOUSE_LINKED';

export const PUBLIC_GUEST_FEATURE_KEYS = [
  'weather',
  'attendance:basic',
  'quotation:manual',
  'eurohouse:catalog',
  'eurohouse:library',
  'eurohouse:knowledge',
  'eurohouse:promotions',
] as const;

export const REGISTERED_FREE_MODULE_KEYS = [
  'factory:quotations',
  'factory:projects',
  'factory:debts',
  'factory:workforce',
  'factory:payroll',
  'factory:cashflow',
] as const;

export const EUROHOUSE_FEATURE_COPY: Record<
  EurohouseFeatureKey,
  Record<EurohouseAccessStatus, string>
> = {
  FORMULA_CUTTING: {
    LOCKED: 'Module đang xây dựng',
    ACTIVE: 'Công thức Eurohouse đã được kích hoạt',
    REVOKED: 'Quyền sử dụng Công thức Eurohouse đã được thu hồi',
  },
  EUROHOUSE_ORDERING: {
    LOCKED: 'Tính năng này chỉ áp dụng cho CSSX đang sản xuất Nhôm Eurohouse.',
    ACTIVE: 'Đặt hàng Nhôm Eurohouse đã được kích hoạt',
    REVOKED: 'Quyền Đặt hàng Nhôm Eurohouse đã được thu hồi',
  },
};

export interface EurohouseFeatureCapability {
  featureKey: EurohouseFeatureKey;
  status: EurohouseAccessStatus;
  enabled: boolean;
  message: string;
}

export interface EurohouseAccessView {
  organizationId: string;
  nppOrganizationId?: string;
  nppOrganizationName?: string;
  features: Record<EurohouseFeatureKey, EurohouseFeatureCapability>;
}

export interface EurohouseInviteView {
  id: string;
  codePrefix: string;
  codeLast4: string;
  status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';
  featureKeys: EurohouseFeatureKey[];
  expiresAt: string;
  createdAt: string;
  targetOrganizationId: string;
  targetOrganizationName?: string;
}

export function featureCapability(
  status: EurohouseAccessStatus,
  featureKey: EurohouseFeatureKey,
): EurohouseFeatureCapability {
  return {
    featureKey,
    status,
    enabled: status === 'ACTIVE',
    message: EUROHOUSE_FEATURE_COPY[featureKey][status],
  };
}

export function accessTierFor(
  user: { id: string } | null | undefined,
  access: EurohouseAccessView | null | undefined,
): AccessTier {
  if (!user) return 'GUEST';
  return access?.nppOrganizationId ? 'EUROHOUSE_LINKED' : 'REGISTERED';
}
