export type UserRole = 'ADMIN' | 'STAFF' | 'NPP' | 'DAILY' | 'FACTORY';

export type UserStatus = 'active' | 'locked';

export interface UserSummary {
  id: string;
  displayName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  points: number;
}

export interface DashboardMetric {
  label: string;
  value: string;
  trend?: string;
}

export interface DemoAdminUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  token: string;
  isCeo: boolean;
  modules: string[]; // module key được phép; CEO bỏ qua check này
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  permissions?: string[];
  rbacRoleId?: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  user: DemoAdminUser;
  message: string;
}

export interface RegisterFactoryInput {
  displayName: string;
  email: string;
  phone?: string;
  password: string;
  factoryCode: string;
}

/** Thông tin người dùng đã xác thực, trả về từ /auth/login và /auth/me. */
export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  organizationId?: string;
  organizationName?: string;
  organizationType?: OrganizationType;
  points?: number;
  isCeo: boolean;
  modules: string[];
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  permissions?: string[];
  rbacRoleId?: string;
}

export type DashboardTone = 'brandOrange' | 'success' | 'warning' | 'danger' | 'brandBlack';

export interface DashboardSummaryCard {
  title: string;
  value: string;
  description: string;
  tone: DashboardTone;
  change: string;
}

export interface DashboardActivity {
  title: string;
  description: string;
  time: string;
  tone: DashboardTone;
}

export interface DashboardModuleSummary {
  label: string;
  value: string;
  note: string;
  progress: number;
  tone: DashboardTone;
}

export interface DashboardChartPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface DashboardOrder {
  id: string;
  dealer: string;
  npp: string;
  value: string;
  status: 'Mới' | 'Tiếp nhận' | 'Hoàn tất' | 'Giao một phần' | 'Chậm xử lý';
  age: string;
  tone: DashboardTone;
}

export interface DashboardDepartmentWorkload {
  department: string;
  openTasks: number;
  sla: string;
  tone: DashboardTone;
}

export interface DashboardSystemStatus {
  service: string;
  status: 'Online' | 'Theo dõi' | 'Cần xử lý';
  note: string;
  tone: DashboardTone;
}

export interface AdminDashboardData {
  greeting: string;
  lastLoginAt: string;
  summary: DashboardSummaryCard[];
  modules: DashboardModuleSummary[];
  activities: DashboardActivity[];
  chart: DashboardChartPoint[];
  recentOrders: DashboardOrder[];
  departments: DashboardDepartmentWorkload[];
  systemStatus: DashboardSystemStatus[];
  apiStatus: 'online' | 'offline';
  quote: QuoteCalculationResult;
}

export type OrderStatus =
  | 'DRAFT'
  | 'NEW'
  | 'NPP_REVIEWING'
  | 'ADMIN_SENT_NPP'
  | 'NPP_RECEIVED'
  | 'CONFIRMED'
  | 'RESERVED'
  | 'PICKING'
  | 'SHIPPED'
  | 'PARTIALLY_SHIPPED'
  | 'DELIVERED'
  | 'RECEIVED_BY_NPP'
  | 'SENT_TO_ADMIN'
  | 'PROCESSING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE';

export type OrderSourceType = 'FACTORY' | 'DEALER' | 'NPP' | 'ADMIN' | 'ADMIN_TO_NPP';

export type OrganizationType = 'COMPANY' | 'FACTORY' | 'NPP' | 'DEALER';

export interface DemoOrderItem {
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  totalKg: number;
  totalPrice: number;
}

export interface DemoOrder {
  id: string;
  code: string;
  sourceType: OrderSourceType;
  factory: string;
  dealer: string;
  npp: string;
  customerName: string;
  deliveryAddress: string;
  status: OrderStatus;
  statusLabel: string;
  tone: DashboardTone;
  totalKg: number;
  totalAmount: number;
  age: string;
  dueNote: string;
  items: DemoOrderItem[];
  history: DashboardActivity[];
}

export interface MobileHomeData {
  userName: string;
  roleLabel: string;
  greeting: string;
  promo: string;
  metrics: DashboardMetric[];
  orders: DemoOrder[];
}

export interface GiftItem {
  id: string;
  name: string;
  points: number;
  icon: string;
  imageUrl?: string;
  stock?: number;
}

export interface LibraryItem {
  id: string;
  categoryId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  title: string;
  mediaUrl: string;
  description?: string;
}

export interface Promotion {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  gallery?: string[];
  targetAudience: 'ALL' | 'WORKER' | 'NPP_DEALER';
  active: boolean;
}

// ---------- Quản trị nội dung (Web Admin CRUD) ----------

export interface CreatePromotionInput {
  title: string;
  description?: string;
  imageUrl?: string;
  targetAudience?: 'ALL' | 'WORKER' | 'NPP_DEALER';
  active?: boolean;
}

export type UpdatePromotionInput = Partial<CreatePromotionInput>;

export interface CreateLibraryItemInput {
  categoryId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  title: string;
  mediaUrl: string;
  description?: string;
}

export type UpdateLibraryItemInput = Partial<CreateLibraryItemInput>;

export interface CreateGiftInput {
  name: string;
  points: number;
  icon?: string;
  imageUrl?: string;
  stock?: number;
}

export type UpdateGiftInput = Partial<CreateGiftInput>;

// ---------- Danh mục hệ nhôm (đặt hàng dạng cây) ----------

export interface CatalogProfile {
  id: string;
  code: string;
  name: string;
  thicknessMm?: string;
  kgPerMeter: number;
  barLengthMm: number;
  barsPerBundle: number;
  pricePerKg: number;
  imageUrl?: string;
}

export interface CatalogSystem {
  id: string;
  code: string;
  name: string;
  description?: string;
  profiles: CatalogProfile[];
}

export interface DoorModel {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  description: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ColorCode {
  id: string;
  code: string;
  name: string;
  hex?: string;
}

export interface CreateOrderItemInput {
  profileId: string;
  productCode: string;
  productName: string;
  colorCode: string;
  quantity: number;
  kgPerMeter?: number;
}

export interface CreateOrderInput {
  sourceType: OrderSourceType;
  clientRequestId?: string;
  submitToNpp?: boolean;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  colorCode?: string;
  note?: string;
  accessoriesNote?: string;
  items: CreateOrderItemInput[];
}

export interface CreateAdminToNppShipmentInput {
  nppOrgId: string;
  invoiceNo?: string;
  poNo?: string;
  note?: string;
  items: CreateOrderItemInput[];
}

export interface OrderStockWarning {
  profileId: string;
  code: string;
  name: string;
  shortBy: number;
}

export interface CreateOrderResult {
  id: string;
  code: string;
  status: OrderStatus;
  nppOrgId?: string;
  nppName: string;
  totalKg: number;
  totalAmount: number;
  stockWarnings: OrderStockWarning[];
  nppWarning?: string;
}

export interface UpdateOrderInput {
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  colorCode?: string;
  note?: string;
  accessoriesNote?: string;
  items?: CreateOrderItemInput[];
}

export interface UpdateOrderExportFieldsInput {
  customerCode?: string;
  invoiceNo?: string;
  poNo?: string;
}

export interface PaginatedOrders<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Công trình & lợi nhuận ----------

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  customerName: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  contractValue: number;
  totalCost: number;
  profit: number;
  profitPct: number;
}

export interface ProjectDetail extends ProjectSummary {
  customerPhone: string;
  address: string;
  costAluminum: number;
  costAccessory: number;
  costLockHinge: number;
  costGasket: number;
  costSilicone: number;
  costScrew: number;
  costGlass: number;
  costLabor: number;
  costPartnerPct: number;
  costOther: number;
  extraRevenue: number;
  note: string;
  estimatedValue: number;
  incurredValue: number;
  incurredType: string;
  settledValue: number;
  quotationId?: string;
  images: string[];
}

export type DebtDirection = 'PAYABLE' | 'RECEIVABLE';

export interface DebtItem {
  id: string;
  type: 'NPP' | 'ACCESSORY' | 'CUSTOMER';
  direction?: DebtDirection;
  partnerName: string;
  amount: number;
  paidAmount: number;
  status: 'OPEN' | 'PARTIAL' | 'PAID';
  bankAccount: string;
  bankName: string;
  note: string;
  nppOrgId?: string;
  factoryOrgId?: string;
  factoryOrgName?: string;
  orderId?: string;
  orderCode?: string;
}

export interface QuotationItemInput {
  name: string;
  system?: string;
  doorType: string;
  templateId?: string;
  widthMm: number;
  heightMm: number;
  wallHugging?: string;
  quantity: number;
  pricePerM2: number;
  includesAccessories?: boolean;
  accessoriesPrice?: number;
  color?: string;
  glassType?: string;
  glassColor?: string;
  requiredInputs?: string[];
  dynamicInputs?: Record<string, string>;
}

export interface QuotationExtraProduct {
  id?: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface QuotationInput {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  isFinalSettlement?: boolean;
  depositAmount?: number;
  items: QuotationItemInput[];
  extraProducts?: QuotationExtraProduct[];
  accessoryCost: number;
  laborCost: number;
  installCost: number;
  depreciation: number;
  profitPct: number;
  vatPct?: number;
}

export interface QuotationItemResult extends QuotationItemInput {
  areaM2: number;
  totalPrice: number;
}

export interface QuotationResult {
  items: QuotationItemResult[];
  extraProducts?: QuotationExtraProduct[];
  extraProductsAmount?: number;
  areaM2: number;
  baseAmount: number;
  accessoryCost: number;
  laborCost: number;
  installCost: number;
  depreciation: number;
  profitPct: number;
  profitAmount: number;
  vatPct?: number;
  vatAmount?: number;
  totalAmount: number;
  isFinalSettlement?: boolean;
  depositAmount?: number;
  remainingAmount?: number;
}

export interface QuotationItemRecord extends QuotationItemResult {
  id: string;
}

export interface QuotationRecord extends Omit<QuotationResult, 'items'> {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
  createdById?: string;
  isFinalSettlement?: boolean;
  depositAmount?: number;
  items: QuotationItemRecord[];
  extraProducts?: QuotationExtraProduct[];
  createdAt: string;
}

// ---------- Bảo hành ----------

export interface ActivateWarrantyInput {
  serialCode: string;
  productName?: string;
  systemCode?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  projectName?: string;
  warrantyMonths?: number;
}

export interface WarrantyRecord {
  id: string;
  code: string;
  serialCode: string;
  productName: string;
  systemCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  projectName: string;
  warrantyMonths: number;
  activatedByName: string;
  pointsAwarded: number;
  status: 'ACTIVE' | 'EXPIRED' | 'VOID';
  activatedAt: string;
  expiresAt?: string;
}

export interface ActivateWarrantyResult {
  warranty: WarrantyRecord;
  pointsAwarded: number;
  pointsBalance: number;
}

// ---------- Tích điểm & đổi quà ----------

export type PointReason = 'WARRANTY' | 'ORDER_COMPLETED' | 'ADMIN_ADJUST' | 'REDEEM';

export interface PointLedgerItem {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: PointReason;
  note: string;
  createdAt: string;
}

export interface UserPoints {
  points: number;
  ledger: PointLedgerItem[];
}

export interface RedeemGiftInput {
  giftId: string;
}

export interface RedeemGiftResult {
  giftName: string;
  pointsCost: number;
  pointsBalance: number;
}

export interface AdjustPointsInput {
  delta: number;
  note?: string;
}

export interface QuoteWizardInput {
  aluSystemId: string;
  doorTypeId: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
}

export interface CuttingListItem {
  profileCode: string;
  profileName: string;
  lengthMm: number;
  quantity: number;
  cutAngle?: string;
}

export interface QuoteCalculationResult {
  items: CuttingListItem[];
  totalKg: number;
  aluminumCost: number;
  accessoryCost: number;
  totalCost: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

// ---------- Quản lý người dùng & tổ chức (Web Admin) ----------

export interface AdminUserItem {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  organizationId?: string;
  organizationName?: string;
  organizationType?: OrganizationType;
  departmentId?: string;
  departmentName?: string;
  jobTitle: string;
  isCeo: boolean;
  modules: string[];
  points: number;
  createdAt: string;
}

// ---------- Phòng ban & phân quyền module (RBAC nội bộ Web Admin) ----------

export interface Department {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  userCount: number;
}

/** Một module chức năng trong Web Admin — nguồn chân lý cho cả menu lẫn guard API. */
export interface AdminModule {
  key: string;
  label: string;
  href: string;
}

/** Danh mục module khớp với navItems của AdminShell. */
export const ADMIN_MODULES: AdminModule[] = [
  { key: 'dashboard', label: 'Tổng quan', href: '/' },
  { key: 'orders', label: 'Đơn hàng', href: '/orders' },
  { key: 'inventory', label: 'Kho NVL', href: '/inventory' },
  { key: 'debts', label: 'Công nợ', href: '/debts' },
  { key: 'cashflow', label: 'Thu chi', href: '/cashflow' },
  { key: 'reports', label: 'Báo cáo tài chính', href: '/reports' },
  { key: 'users', label: 'Người dùng', href: '/users' },
  { key: 'catalog', label: 'Hệ nhôm', href: '/catalog' },
  { key: 'accounting-pricing', label: 'Bảng giá & Báo giá', href: '/accounting/pricing' },
  { key: 'sales-projects', label: 'Mảng dự án', href: '/sales/projects' },
  { key: 'sales-npp', label: 'Nhà phân phối', href: '/sales/distributors' },
  { key: 'sales-factories', label: 'Xưởng sản xuất', href: '/sales/factories' },
  { key: 'warranties', label: 'Bảo hành', href: '/warranties' },
  { key: 'promotions', label: 'Khuyến mãi', href: '/promotions' },
  { key: 'loyalty', label: 'Loyalty', href: '/loyalty' },
  { key: 'library', label: 'Thư viện', href: '/library' },
  { key: 'roles', label: 'Chức danh', href: '/roles' },
  { key: 'sales-leads', label: 'Xưởng tiềm năng', href: '/sales/leads' },
  { key: 'sales-reports', label: 'Báo cáo sale', href: '/sales/reports' },
  { key: 'sales-targets', label: 'Theo dõi doanh số', href: '/sales/targets' },
  { key: 'payroll', label: 'Bảng lương', href: '/payroll' },
  { key: 'prod-dashboard', label: 'Dashboard Sản Xuất', href: '/production/dashboard' },
  { key: 'prod-work-orders', label: 'Lệnh Sản Xuất', href: '/production/work-orders' },
  { key: 'prod-shop-floor', label: 'Xưởng (Kiosk)', href: '/production/shop-floor' },
  { key: 'prod-dies', label: 'Khuôn Đùn', href: '/production/dies' },
  { key: 'formulas', label: 'Mẫu Cửa', href: '/formulas' },
];

export const ADMIN_MODULE_KEYS: string[] = ADMIN_MODULES.map((m) => m.key);

export interface OrgItem {
  id: string;
  code: string;
  name: string;
  type: OrganizationType;
  phone?: string;
  address?: string;
  shortLabel?: string;
  userCount: number;
  managedByNppId?: string;
  managedByNppName?: string;
}

export interface UpdateOrgInput {
  managedByNppId?: string | null;
  shortLabel?: string | null;
}

export interface CreateNppInput {
  name: string;
  code?: string;
  shortLabel?: string;
  province?: string;
  phone?: string;
  address?: string;
  email: string;
  displayName?: string;
  password?: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  organizationId?: string;
  departmentId?: string;
  jobTitle?: string;
  isCeo?: boolean;
  modules?: string[];
  password?: string; // để trống → dùng mật khẩu mặc định
}

export interface UpdateUserInput {
  displayName?: string;
  phone?: string;
  role?: UserRole;
  organizationId?: string;
  departmentId?: string | null;
  jobTitle?: string;
  isCeo?: boolean;
  modules?: string[];
  password?: string; // đặt lại mật khẩu
}

// ---------- Kho NVL & chi phí sản xuất chung ----------

export type MaterialCategory = 'DIRECT_MATERIAL' | 'OVERHEAD';

export type MaterialGroup =
  | 'BILLET'
  | 'PAINT'
  | 'LABEL'
  | 'NYLON'
  | 'PACKAGING'
  | 'ACCESSORY_HW'
  | 'ELECTRICITY'
  | 'GAS'
  | 'WATER'
  | 'FUEL'
  | 'MAINTENANCE';

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  group: MaterialGroup;
  unit: string;
  unitPrice: number;
  stockQty: number;
  lowStockAlert: number;
  note: string;
  active: boolean;
}

export interface CreateMaterialInput {
  code: string;
  name: string;
  category: MaterialCategory;
  group: MaterialGroup;
  unit?: string;
  unitPrice?: number;
  lowStockAlert?: number;
  note?: string;
}

export interface UpdateMaterialInput {
  name?: string;
  unitPrice?: number;
  lowStockAlert?: number;
  note?: string;
  active?: boolean;
}

export type StockDirection = 'IN' | 'OUT';

export interface StockMovementItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  direction: StockDirection;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  reason: string;
  note: string;
  createdByName?: string;
  createdAt: string;
}

export interface CreateStockMovementInput {
  materialId: string;
  direction: StockDirection;
  quantity: number;
  unitPrice?: number;
  reason?: string;
  note?: string;
}

export interface ProfileStockMovementItem {
  id: string;
  profileId: string;
  direction: StockDirection;
  quantity: number;
  reason: string;
  orderId?: string;
  note: string;
  createdAt: string;
}

export interface AdjustProfileStockInput {
  direction: StockDirection;
  quantity: number;
  reason?: string;
  note?: string;
}

// ---------- Thu chi & công nợ ----------

export type CashTransactionType = 'RECEIPT' | 'PAYMENT';
export type CashMethod = 'CASH' | 'BANK_TRANSFER';

export interface CashTransactionItem {
  id: string;
  code: string;
  type: CashTransactionType;
  amount: number;
  method: CashMethod;
  category: string;
  debtId?: string;
  projectId?: string;
  partnerName: string;
  note: string;
  transDate: string;
  createdAt: string;
}

export interface CreateCashTransactionInput {
  type: CashTransactionType;
  amount: number;
  method?: CashMethod;
  category?: string;
  debtId?: string;
  projectId?: string;
  partnerName?: string;
  note?: string;
  transDate?: string;
}

export interface PayDebtInput {
  amount: number;
  method?: CashMethod;
  note?: string;
}

export interface DebtPaymentRequestItem {
  id: string;
  code: string;
  debtId: string;
  debtPartnerName: string;
  factoryName: string;
  orderCode?: string;
  amount: number;
  method: CashMethod;
  note: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  createdAt: string;
}

// ---------- Báo cáo tài chính ----------

export interface MonthlyPnL {
  month: string; // "2026-07"
  revenue: number;
  directMaterialCost: number;
  overheadCost: number;
  profit: number;
  profitPct: number;
}

export interface FinancialReportData {
  months: MonthlyPnL[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

// ---------- NPP Web Manager ----------

export interface NppDashboardData {
  ordersByStatus: Record<string, number>;
  managedFactoryCount: number;
  openDebtTotal: number;
  openDebtPaid: number;
  monthRevenue: number;
}

export interface NppFactoryReconciliation {
  factoryOrgId?: string;
  factoryName: string;
  counts: Record<string, number>;
  totalAmount: number;
  totalKg: number;
}

export interface NppFactoryItem {
  id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  province?: string;
  email?: string;
  shortLabel?: string;
  userCount: number;
  createdAt: string;
}

export interface NppInboundShipment {
  id: string;
  code: string;
  status: string;
  nppName: string;
  invoiceNo?: string;
  poNo?: string;
  note?: string;
  totalKg: number;
  totalAmount: number;
  createdAt: string;
  items: {
    productCode: string;
    productName: string;
    colorCode: string;
    quantity: number;
    totalKg: number;
    totalPrice: number;
  }[];
}

export interface NppAccessoryItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  note?: string;
  createdAt: string;
}

export interface UpsertNppAccessoryInput {
  name: string;
  brand?: string;
  category?: string;
  unit?: string;
  quantity?: number;
  unitCost?: number;
  note?: string;
}

export interface NppGlassSheetItem {
  id: string;
  code: string;
  glassType: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  unitCost: number;
  note?: string;
  createdAt: string;
}

export interface UpsertNppGlassSheetInput {
  code: string;
  glassType?: string;
  widthMm: number;
  heightMm: number;
  quantity?: number;
  unitCost?: number;
  note?: string;
}

export interface GlassCutPieceInput {
  widthMm: number;
  heightMm: number;
  quantity: number;
}

export interface GlassCutPlacement {
  pieceNo: number;
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
}

export interface GlassCutPlanResult {
  sheetId: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  placements: GlassCutPlacement[];
  errors: string[];
  usedAreaMm2: number;
  wasteAreaMm2: number;
  wastePercent: number;
}

export interface CreateNppFactoryInput {
  name: string;
  phone?: string;
  address?: string;
  province?: string;
  email?: string;
  shortLabel?: string;
}

export interface NppMonthlyReport {
  month: string;
  revenue: number;
  debtCreated: number;
  debtPaid: number;
}

export interface NppFinancialReportData {
  months: NppMonthlyReport[];
  totalRevenue: number;
  totalDebtOpen: number;
}

export interface InventoryProfile {
  id: string;
  code: string;
  name: string;
  systemCode?: string;
  systemName?: string;
  stockBars: number;
  lowStockAlert?: number;
  pricePerKg?: number;
}

export interface NppInventorySystemGroup {
  systemCode: string;
  systemName: string;
  stockBars: number;
  lowStockCount: number;
  profiles: InventoryProfile[];
}

export interface InventoryCutoff {
  id: string;
  profileId: string;
  profileCode: string;
  profileName: string;
  lengthMm: number;
  quantity: number;
}

export interface InventoryData {
  profiles: InventoryProfile[];
  cutoffs: InventoryCutoff[];
  scrapKg: number;
}
