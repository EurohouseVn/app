export const EUROHOUSE_FEATURE_KEYS = ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'];

export const EUROHOUSE_ACCESS_STATUSES = ['LOCKED', 'ACTIVE', 'REVOKED'];

export const PUBLIC_GUEST_FEATURE_KEYS = [
  'weather',
  'attendance:basic',
  'quotation:manual',
  'eurohouse:catalog',
  'eurohouse:library',
  'eurohouse:knowledge',
  'eurohouse:promotions',
];

export const REGISTERED_FREE_MODULE_KEYS = [
  'factory:quotations',
  'factory:projects',
  'factory:debts',
  'factory:workforce',
  'factory:payroll',
  'factory:cashflow',
];

export const EUROHOUSE_FEATURE_COPY = {
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

export function featureCapability(status, featureKey) {
  return {
    featureKey,
    status,
    enabled: status === 'ACTIVE',
    message: EUROHOUSE_FEATURE_COPY[featureKey][status],
  };
}

export function accessTierFor(user, access) {
  if (!user) return 'GUEST';
  return access?.nppOrganizationId ? 'EUROHOUSE_LINKED' : 'REGISTERED';
}
