import type { EurohouseAccessStatus, EurohouseFeatureCapability } from './eurohouseAccess.js';
export const FORMULA_ACCESS_STATUSES: readonly ['LOCKED', 'ACTIVE', 'REVOKED'];
export type FormulaAccessStatus = EurohouseAccessStatus;
export const FORMULA_ACCESS_COPY: Record<FormulaAccessStatus, string>;
export const PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS: readonly [
  'factory:quotations',
  'factory:projects',
  'factory:debts',
  'factory:workforce',
  'factory:payroll',
  'factory:cashflow',
];
export type FormulaCapability = Omit<EurohouseFeatureCapability, 'featureKey'>;
export function formulaCapabilityFromStatus(status: FormulaAccessStatus): FormulaCapability;
export interface RegisterWorkshopInput {
  displayName: string;
  organizationName: string;
  password: string;
  email?: string;
  phone?: string;
  province?: string;
  verificationChannel?: 'EMAIL' | 'PHONE';
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
