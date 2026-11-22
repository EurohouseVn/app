export {
  ACCESS_SCOPE_META,
  SCOPED_MODULES,
  allowedModuleKeysForRole,
  modulesAfterRoleChange,
  scopeForRole,
  type AccessScope,
} from '@eurohouse/types';

export const ACCESS_SCOPE_ORDER = ['INTERNAL', 'NPP', 'FACTORY'] as const;
