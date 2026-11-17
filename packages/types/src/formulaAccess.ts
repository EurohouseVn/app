import {
  EUROHOUSE_ACCESS_STATUSES,
  EUROHOUSE_FEATURE_COPY,
  REGISTERED_FREE_MODULE_KEYS,
  featureCapability,
  type EurohouseAccessStatus,
  type EurohouseFeatureCapability,
} from './eurohouseAccess.js';

export const FORMULA_ACCESS_STATUSES = EUROHOUSE_ACCESS_STATUSES;
export type FormulaAccessStatus = EurohouseAccessStatus;

export const FORMULA_ACCESS_COPY = EUROHOUSE_FEATURE_COPY.FORMULA_CUTTING;

export const PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS = REGISTERED_FREE_MODULE_KEYS;

export type FormulaCapability = Omit<EurohouseFeatureCapability, 'featureKey'>;

export function formulaCapabilityFromStatus(status: FormulaAccessStatus): FormulaCapability {
  const { featureKey: _featureKey, ...capability } = featureCapability(status, 'FORMULA_CUTTING');
  return capability;
}

export interface RegisterWorkshopInput {
  displayName: string;
  organizationName: string;
  password: string;
  email: string;
  phone?: string;
  province?: string;
}

export interface VerificationConfirmInput {
  pendingVerificationId: string;
  code: string;
}

export interface WorkshopRegistrationResponse {
  pendingVerificationId: string;
  maskedTarget: string;
}

export interface FormulaInviteView {
  id: string;
  codePrefix: string;
  codeLast4: string;
  status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  targetOrganizationId: string;
  targetOrganizationName?: string;
}

export interface FormulaAccessView {
  organizationId: string;
  status: FormulaAccessStatus;
  capability: FormulaCapability;
  nppOrganizationId?: string;
  nppOrganizationName?: string;
  source?: 'NPP_INVITE' | 'NPP_DIRECT' | 'ADMIN_DIRECT' | 'MIGRATED';
  activatedAt?: string;
  activatedByName?: string;
  revokedAt?: string;
  revokeReason?: string;
}
