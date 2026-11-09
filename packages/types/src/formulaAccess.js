import {
  EUROHOUSE_ACCESS_STATUSES,
  EUROHOUSE_FEATURE_COPY,
  REGISTERED_FREE_MODULE_KEYS,
  featureCapability,
} from './eurohouseAccess.js';

export const FORMULA_ACCESS_STATUSES = EUROHOUSE_ACCESS_STATUSES;

export const FORMULA_ACCESS_COPY = EUROHOUSE_FEATURE_COPY.FORMULA_CUTTING;

export const PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS = REGISTERED_FREE_MODULE_KEYS;

export function formulaCapabilityFromStatus(status) {
  const { featureKey: _featureKey, ...capability } = featureCapability(status, 'FORMULA_CUTTING');
  return capability;
}
