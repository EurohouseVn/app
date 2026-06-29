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
  createdByEmail?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  colorCode?: string;
  note?: string;
  items: CreateOrderItemInput[];
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

export interface DebtItem {
  id: string;
  type: 'NPP' | 'ACCESSORY' | 'CUSTOMER';
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
  userCount: number;
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
