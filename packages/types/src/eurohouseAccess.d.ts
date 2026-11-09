export const EUROHOUSE_FEATURE_KEYS: readonly ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'];
export type EurohouseFeatureKey = (typeof EUROHOUSE_FEATURE_KEYS)[number];

export const EUROHOUSE_ACCESS_STATUSES: readonly ['LOCKED', 'ACTIVE', 'REVOKED'];
export type EurohouseAccessStatus = (typeof EUROHOUSE_ACCESS_STATUSES)[number];
export type AccessTier = 'GUEST' | 'REGISTERED' | 'EUROHOUSE_LINKED';

export const PUBLIC_GUEST_FEATURE_KEYS: readonly [
  'weather',
  'attendance:basic',
  'quotation:manual',
  'eurohouse:catalog',
  'eurohouse:library',
  'eurohouse:knowledge',
  'eurohouse:promotions',
];

export const REGISTERED_FREE_MODULE_KEYS: readonly [
  'factory:quotations',
  'factory:projects',
  'factory:debts',
  'factory:workforce',
  'factory:payroll',
  'factory:cashflow',
];

export const EUROHOUSE_FEATURE_COPY: Record<
  EurohouseFeatureKey,
  Record<EurohouseAccessStatus, string>
>;

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
): EurohouseFeatureCapability;
export function accessTierFor(
  user: { id: string } | null | undefined,
  access: EurohouseAccessView | null | undefined,
): AccessTier;
