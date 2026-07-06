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
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  user: DemoAdminUser;
  message: string;
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
  | 'NEW'
  | 'RECEIVED_BY_NPP'
  | 'SENT_TO_ADMIN'
  | 'PROCESSING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE';

export type OrderSourceType = 'FACTORY' | 'DEALER' | 'NPP' | 'ADMIN';

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
  type: 'IMAGE' | 'KNOWLEDGE' | 'PRODUCT' | 'VIDEO';
  title: string;
  imageUrl?: string;
  videoUrl?: string;
  tag?: string;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  bannerUrl: string;
  gallery: string[];
  content: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
}

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
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  colorCode?: string;
  note?: string;
  accessoriesNote?: string;
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
}

export interface QuotationInput {
  customerName?: string;
  doorType?: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  pricePerM2: number;
  aluPricePerKg: number;
  glassPerM2: number;
  accessoryCost: number;
  laborCost: number;
  installCost: number;
  profitPct: number;
  depreciation: number;
}

export interface QuotationResult {
  areaM2: number;
  baseAmount: number;
  accessoryCost: number;
  laborCost: number;
  installCost: number;
  depreciation: number;
  profitAmount: number;
  totalAmount: number;
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
  createdAt: string;
}

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

export interface CreateUserInput {
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  organizationId?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  phone?: string;
  role?: UserRole;
  organizationId?: string;
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
