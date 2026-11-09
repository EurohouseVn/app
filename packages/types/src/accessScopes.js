export const ACCESS_SCOPE_META = {
    INTERNAL: {
        label: 'Nội bộ Eurohouse',
        description: 'Chỉ dành cho quản trị viên và cán bộ nhân viên Eurohouse.',
    },
    NPP: {
        label: 'Nhà phân phối',
        description: 'Chỉ dành cho tài khoản vận hành Cổng NPP.',
    },
    FACTORY: {
        label: 'Cơ sở sản xuất',
        description: 'Chỉ dành cho tài khoản cơ sở sản xuất và đại lý.',
    },
};
export const INTERNAL_MODULES = [
    { key: 'dashboard', label: 'Tổng quan', href: '/', scope: 'INTERNAL', group: 'Hệ thống' },
    { key: 'users', label: 'Người dùng', href: '/users', scope: 'INTERNAL', group: 'Hệ thống' },
    { key: 'users', label: 'Quyền Eurohouse', href: '/eurohouse-access', scope: 'INTERNAL', group: 'Hệ thống' },
    { key: 'roles', label: 'Chức danh', href: '/roles', scope: 'INTERNAL', group: 'Hệ thống' },
    { key: 'orders', label: 'Đơn hàng', href: '/orders', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'sales-projects', label: 'Mảng dự án', href: '/sales/projects', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'sales-npp', label: 'Nhà phân phối', href: '/sales/distributors', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'sales-factories', label: 'Xưởng sản xuất', href: '/sales/factories', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'sales-leads', label: 'Xưởng tiềm năng', href: '/sales/leads', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'sales-reports', label: 'Báo cáo sale', href: '/sales/reports', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'sales-targets', label: 'Theo dõi doanh số', href: '/sales/targets', scope: 'INTERNAL', group: 'Kinh doanh & CRM' },
    { key: 'inventory', label: 'Kho NVL', href: '/inventory', scope: 'INTERNAL', group: 'Kế toán & Kho' },
    { key: 'debts', label: 'Công nợ', href: '/debts', scope: 'INTERNAL', group: 'Kế toán & Kho' },
    { key: 'cashflow', label: 'Thu chi', href: '/cashflow', scope: 'INTERNAL', group: 'Kế toán & Kho' },
    { key: 'reports', label: 'Báo cáo tài chính', href: '/reports', scope: 'INTERNAL', group: 'Kế toán & Kho' },
    { key: 'accounting-pricing', label: 'Bảng giá & Báo giá', href: '/accounting/pricing', scope: 'INTERNAL', group: 'Kế toán & Kho' },
    { key: 'payroll', label: 'Bảng lương', href: '/payroll', scope: 'INTERNAL', group: 'Kế toán & Kho' },
    { key: 'catalog', label: 'Hệ nhôm', href: '/catalog', scope: 'INTERNAL', group: 'Danh mục' },
    { key: 'formulas', label: 'Mẫu Cửa', href: '/formulas', scope: 'INTERNAL', group: 'Danh mục' },
    { key: 'warranties', label: 'Bảo hành', href: '/warranties', scope: 'INTERNAL', group: 'Marketing & CSKH' },
    { key: 'promotions', label: 'Khuyến mãi', href: '/promotions', scope: 'INTERNAL', group: 'Marketing & CSKH' },
    { key: 'loyalty', label: 'Loyalty', href: '/loyalty', scope: 'INTERNAL', group: 'Marketing & CSKH' },
    { key: 'library', label: 'Thư viện', href: '/library', scope: 'INTERNAL', group: 'Marketing & CSKH' },
    { key: 'website', label: 'Quản trị Website', href: '/website', scope: 'INTERNAL', group: 'Marketing & CSKH' },
    { key: 'prod-dashboard', label: 'Dashboard Sản Xuất', href: '/production/dashboard', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'prod-work-orders', label: 'Lệnh Sản Xuất', href: '/production/work-orders', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'prod-shop-floor', label: 'Xưởng (Kiosk)', href: '/production/shop-floor', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'workshop-operations', label: 'Điều hành xưởng', href: '/workshop/operations', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'prod-dies', label: 'Khuôn Đùn', href: '/production/dies', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'manufacturing-datasets', label: 'Dataset kỹ thuật', href: '/manufacturing/datasets', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'manufacturing-verification', label: 'Xác minh sản xuất', href: '/manufacturing/verification', scope: 'INTERNAL', group: 'Sản xuất' },
    { key: 'manufacturing-traces', label: 'Trace tính toán', href: '/manufacturing/traces', scope: 'INTERNAL', group: 'Sản xuất' },
];
export const NPP_MODULES = [
    { key: 'npp:dashboard', label: 'Tổng quan', href: '/', scope: 'NPP', group: 'Vận hành' },
    { key: 'npp:orders', label: 'Đơn hàng', href: '/orders', scope: 'NPP', group: 'Vận hành' },
    { key: 'npp:factories', label: 'Cơ sở sản xuất', href: '/factories', scope: 'NPP', group: 'Vận hành' },
    { key: 'npp:inventory', label: 'Kho hàng', href: '/inventory', scope: 'NPP', group: 'Kho & hàng hóa' },
    { key: 'npp:accessories', label: 'Phụ kiện', href: '/accessories', scope: 'NPP', group: 'Kho & hàng hóa' },
    { key: 'npp:glass', label: 'Kính', href: '/glass', scope: 'NPP', group: 'Kho & hàng hóa' },
    { key: 'npp:quotations', label: 'Báo giá', href: '/quotations', scope: 'NPP', group: 'Kinh doanh' },
    { key: 'npp:projects', label: 'Công trình', href: '/projects', scope: 'NPP', group: 'Kinh doanh' },
    { key: 'npp:reconciliation', label: 'Đối chiếu', href: '/reconciliation', scope: 'NPP', group: 'Tài chính' },
    { key: 'npp:debts', label: 'Công nợ', href: '/debts', scope: 'NPP', group: 'Tài chính' },
    { key: 'npp:reports', label: 'Báo cáo', href: '/reports', scope: 'NPP', group: 'Tài chính' },
    { key: 'npp:profile', label: 'Tài khoản', href: '/profile', scope: 'NPP', group: 'Tài khoản' },
];
export const FACTORY_MODULES = [
    { key: 'factory:dashboard', label: 'Tổng quan', href: '/', scope: 'FACTORY', group: 'Vận hành' },
    { key: 'factory:orders', label: 'Đặt nhôm & đơn hàng', href: '/orders', scope: 'FACTORY', group: 'Kinh doanh' },
    { key: 'factory:quotations', label: 'Báo giá', href: '/quote', scope: 'FACTORY', group: 'Kinh doanh' },
    { key: 'factory:formulas', label: 'Công thức', href: '/formulas', scope: 'FACTORY', group: 'Kỹ thuật' },
    { key: 'factory:projects', label: 'Công trình', href: '/projects', scope: 'FACTORY', group: 'Kinh doanh' },
    { key: 'factory:shop-floor', label: 'Việc xưởng', href: '/shop-floor', scope: 'FACTORY', group: 'Sản xuất' },
    { key: 'factory:qc', label: 'Kiểm tra QC', href: '/qc', scope: 'FACTORY', group: 'Sản xuất' },
    { key: 'factory:installations', label: 'Lắp đặt', href: '/installations', scope: 'FACTORY', group: 'Sản xuất' },
    { key: 'factory:workforce', label: 'Chấm công', href: '/workforce', scope: 'FACTORY', group: 'Nhân sự' },
    { key: 'factory:inventory', label: 'Kho xưởng', href: '/inventory', scope: 'FACTORY', group: 'Kho & vật tư' },
    { key: 'factory:debts', label: 'Công nợ', href: '/debts', scope: 'FACTORY', group: 'Tài chính' },
    { key: 'factory:warranty', label: 'Bảo hành', href: '/service-warranty', scope: 'FACTORY', group: 'CSKH' },
    { key: 'factory:library', label: 'Thư viện', href: '/library', scope: 'FACTORY', group: 'Tài nguyên' },
    { key: 'factory:reminders', label: 'Nhắc việc', href: '/reminders', scope: 'FACTORY', group: 'Vận hành' },
    { key: 'factory:profile', label: 'Tài khoản', href: '/profile', scope: 'FACTORY', group: 'Tài khoản' },
];
export const SCOPED_MODULES = [...INTERNAL_MODULES, ...NPP_MODULES, ...FACTORY_MODULES];
export function scopeForRole(role) {
    if (role === 'NPP')
        return 'NPP';
    if (role === 'FACTORY' || role === 'DAILY')
        return 'FACTORY';
    return 'INTERNAL';
}
export function allowedModuleKeysForRole(role) {
    const scope = scopeForRole(role);
    return SCOPED_MODULES.filter((module) => module.scope === scope).map((module) => module.key);
}
export function sanitizeModulesForRole(role, modules) {
    const allowed = new Set(allowedModuleKeysForRole(role));
    return Array.from(new Set(modules.filter((key) => allowed.has(key))));
}
export function invalidModulesForRole(role, modules) {
    const allowed = new Set(allowedModuleKeysForRole(role));
    return Array.from(new Set(modules.filter((key) => !allowed.has(key))));
}
export function modulesAfterRoleChange(currentModules, nextRole) {
    return sanitizeModulesForRole(nextRole, currentModules);
}
