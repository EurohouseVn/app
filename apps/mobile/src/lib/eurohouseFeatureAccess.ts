import type {
  AccessTier,
  EurohouseAccessView,
  EurohouseFeatureCapability,
  EurohouseFeatureKey,
} from '@eurohouse/types';

export type FeatureUiState = {
  active: boolean;
  statusLabel: 'Chưa kích hoạt' | 'Đã kích hoạt' | 'Đã thu hồi';
  message: string;
};

export type OrderingScreenPolicy = {
  canLoadCatalog: boolean;
  canMutate: boolean;
  canReadHistory: true;
};

const LOCKED_ORDERING: EurohouseFeatureCapability = {
  featureKey: 'EUROHOUSE_ORDERING',
  status: 'LOCKED',
  enabled: false,
  message: 'Tính năng này chỉ áp dụng cho CSSX đang sản xuất Nhôm Eurohouse.',
};

export function canUseEurohouseFeature(
  access: EurohouseAccessView | null | undefined,
  featureKey: EurohouseFeatureKey,
): boolean {
  const capability = access?.features?.[featureKey];
  return capability?.status === 'ACTIVE' && capability.enabled === true;
}

export function featureUiState(capability?: EurohouseFeatureCapability): FeatureUiState {
  const current = capability ?? LOCKED_ORDERING;
  return {
    active: current.status === 'ACTIVE' && current.enabled === true,
    statusLabel: current.status === 'ACTIVE' ? 'Đã kích hoạt' : current.status === 'REVOKED' ? 'Đã thu hồi' : 'Chưa kích hoạt',
    message: current.message,
  };
}

export function orderingScreenPolicy(capability?: EurohouseFeatureCapability): OrderingScreenPolicy {
  const active = featureUiState(capability).active;
  return {
    canLoadCatalog: active,
    canMutate: active,
    canReadHistory: true,
  };
}

export function orderingCta(tier: AccessTier, access?: EurohouseAccessView | null): { label: string; href: '/auth' | '/profile' } {
  if (tier === 'GUEST') return { label: 'Đăng nhập / Đăng ký', href: '/auth' };
  if (!access?.nppOrganizationId) return { label: 'Nhập mã mời NPP', href: '/profile' };
  return { label: `Liên hệ ${access.nppOrganizationName || 'NPP phụ trách'}`, href: '/profile' };
}

export async function guardEurohouseMutation<T>(
  capability: EurohouseFeatureCapability | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!orderingScreenPolicy(capability).canMutate) throw new Error('EUROHOUSE_ORDERING_ACCESS_REQUIRED');
  return operation();
}
