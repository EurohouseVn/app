export type UserRole = 'ADMIN' | 'STAFF' | 'NPP' | 'DAILY' | 'FACTORY';

export * from './formulaSystemVisibility.js';
export * from './accessScopes.js';
export * from './eurohouseAccess.js';
export * from './formulaAccess.js';
import { INTERNAL_MODULES } from './accessScopes.js';
import type { FormulaCapability } from './formulaAccess.js';
import type { EurohouseAccessView } from './eurohouseAccess.js';

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
  email?: string;
  phone: string;
  role: UserRole;
  organizationId?: string;
  organizationName?: string;
  organizationType?: OrganizationType;
  organizationProvince?: string;
  points?: number;
  isCeo: boolean;
  modules: string[];
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  permissions?: string[];
  rbacRoleId?: string;
  capabilities: {
    formulas: FormulaCapability;
    eurohouse: EurohouseAccessView;
  };
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

export type OrderSourceType = 'FACTORY' | 'DEALER' | 'NPP' | 'ADMIN' | 'ADMIN_TO_NPP' | 'NPP_TO_ADMIN';

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
  factoryOrgId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  colorCode?: string;
  note?: string;
  accessoriesNote?: string;
  items: CreateOrderItemInput[];
}

export interface CreateAdminToNppShipmentInput {
  sourceOrderId: string;
  note?: string;
  actualTotalKg?: number;
}

export type OrderPricingStatus = 'PENDING_NPP' | 'FINALIZED' | 'ESTIMATED_COMPANY';

export interface CreateNppDeliveryInput {
  actualTotalKg: number;
  finalUnitPricePerKg: number;
  discountAmount?: number;
  surchargeAmount?: number;
  pricingNote?: string;
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
  theoreticalTotalKg: number;
  actualTotalKg?: number;
  totalAmount: number;
  pricingStatus: OrderPricingStatus;
  finalUnitPricePerKg?: number;
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
  ...INTERNAL_MODULES.map(({ key, label, href }) => ({ key, label, href })),
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
  password?: string; // bắt buộc khi tạo tài khoản nhân sự; NPP có thể được sinh tự động
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
  colorCode?: string;
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
  colorCode?: string;
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

export type NppGlassStockKind = 'SHEET' | 'REMNANT' | 'CUT_PIECE';

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
  /** Mã vạch dạng MÃĐẦU-CẠNHNGẮN-CẠNHDÀI; dòng cũ nhập tay có dạng LEGACY-<id>. */
  barcode?: string;
  kind?: NppGlassStockKind;
  location?: string;
  schemeId?: string | null;
}

export interface NppBarcodeSchemeItem {
  id: string;
  prefix: string;
  label: string;
  glassType: string;
  thicknessMm?: number | null;
  active: boolean;
}

export interface UpsertNppBarcodeSchemeInput {
  prefix?: string;
  label?: string;
  glassType?: string;
  thicknessMm?: number | null;
  active?: boolean;
}

export interface ReceiveNppGlassStockInput {
  schemeId: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  unitCost?: number;
  location?: string;
  kind?: NppGlassStockKind;
  note?: string;
  /** Chống ghi trùng khi gửi lại; sinh ở máy khách cho mỗi thao tác. */
  idempotencyKey: string;
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

export interface GlassCutOptionsInput {
  /** Lề cắt (hao mạch) giữa hai tấm kề nhau, mm. */
  kerfMm?: number;
  /** Mép bỏ mỗi cạnh tấm lớn, mm. */
  trimMm?: number;
  /** Cạnh ngắn nhất để một mảnh thừa được giữ lại làm tấm dư, mm. */
  minRemnantMm?: number;
  allowRotation?: boolean;
}

export interface CreateNppCutPlanInput {
  schemeId: string;
  pieces: GlassCutPieceInput[];
  options?: GlassCutOptionsInput;
  orderRef?: string;
  note?: string;
}

export interface NppCutPlanPlacement {
  pieceNo: number;
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
}

export interface NppCutPlanRemnant {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
}

export interface NppCutPlanSheet {
  sheetNo: number;
  sourceId: string;
  sourceKind: NppGlassStockKind;
  sourceBarcode: string;
  sourceLocation: string;
  widthMm: number;
  heightMm: number;
  placements: NppCutPlanPlacement[];
  remnants: NppCutPlanRemnant[];
  usedAreaMm2: number;
  wasteAreaMm2: number;
  wastePercent: number;
}

export interface NppCutPlanEffectLine {
  barcode: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  location: string;
}

export interface NppCutPlanEffects {
  consumed: NppCutPlanEffectLine[];
  remnants: NppCutPlanEffectLine[];
  pieces: NppCutPlanEffectLine[];
}

export interface NppCutPlanResultData {
  sheets: NppCutPlanSheet[];
  unplaced: Array<{ pieceNo: number; widthMm: number; heightMm: number }>;
  totals: { sheetsUsed: number; piecesPlaced: number; usedAreaMm2: number; wasteAreaMm2: number; wastePercent: number };
  /** Có sau khi chốt cắt: những gì đã trừ khỏi kho và đã cộng vào kho. */
  effects?: NppCutPlanEffects;
}

export type NppCutPlanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface NppCutPlanItem {
  id: string;
  status: NppCutPlanStatus;
  schemeId: string;
  schemePrefix: string;
  orderRef: string;
  note: string;
  options: Required<GlassCutOptionsInput>;
  pieces: GlassCutPieceInput[];
  result: NppCutPlanResultData;
  createdAt: string;
  confirmedAt?: string;
}

export interface ScanGlassStockInput {
  mode: 'RECEIVE' | 'ISSUE';
  /** Mã quét được, dạng MÃĐẦU-CẠNHNGẮN-CẠNHDÀI. */
  barcode: string;
  /** Mặc định 1 cho mỗi lần quét. */
  quantity?: number;
  location?: string;
  kind?: NppGlassStockKind;
  note?: string;
  reason?: string;
  /** Mỗi lần quét một khóa riêng: quét lặp hoặc gửi lại khi mất mạng không bị cộng/trừ hai lần. */
  idempotencyKey: string;
}

export type NppStocktakeStatus = 'OPEN' | 'APPLIED' | 'CANCELLED';

export interface NppStocktakeItem {
  id: string;
  name: string;
  /** Rỗng nghĩa là kiểm cả kho. */
  location: string;
  status: NppStocktakeStatus;
  createdAt: string;
  appliedAt?: string;
}

export interface CreateStocktakeInput {
  name?: string;
  location?: string;
}

export interface StocktakeScanInput {
  barcode: string;
  /** Mặc định 1; số âm để hoàn tác lần quét trước. */
  quantity?: number;
  kind?: NppGlassStockKind;
  location?: string;
  idempotencyKey: string;
}

export interface StocktakeScanResult {
  barcode: string;
  kind: NppGlassStockKind;
  location: string;
  counted: number;
}

export interface StocktakeLine {
  barcode: string;
  kind: NppGlassStockKind;
  location: string;
  widthMm: number;
  heightMm: number;
  system: number;
  counted: number;
  delta: number;
  scanned: boolean;
}

export interface NppStocktakeSummary extends NppStocktakeItem {
  lines: StocktakeLine[];
  scanCount: number;
  deviceCount: number;
  /** Số dòng đã quét mà số đếm khác số trong hệ thống. */
  differenceCount: number;
}

export interface ApplyStocktakeInput {
  /** Dòng nào trong phạm vi mà không ai quét thì coi như 0. Mặc định false. */
  zeroUnscanned?: boolean;
}

export interface PrintLabelData {
  barcode: string;
  widthMm: number;
  heightMm: number;
  glassType?: string;
  location?: string;
  kindLabel?: string;
}

export type NppPrintJobStatus = 'QUEUED' | 'CLAIMED' | 'PRINTED' | 'FAILED';

export interface EnqueuePrintJobInput {
  labels: PrintLabelData[];
}

export interface NppPrintJobItem {
  id: string;
  status: NppPrintJobStatus;
  labelCount: number;
  error: string;
  createdAt: string;
  printedAt?: string;
  /** Chỉ có ngay sau khi gửi lệnh: có trạm in nào đang trực tuyến không. */
  stationOnline?: boolean;
}

export interface NppPrintJobWithLabels extends NppPrintJobItem {
  labels: PrintLabelData[];
}

export type DocumentDraftKind = 'ORDER' | 'RECEIPT';
export type DocumentDraftStatus = 'DRAFT' | 'CONFIRMED' | 'REJECTED';
export type DocumentUnit = 'BUNDLE' | 'BAR' | 'SET' | null;
export type DocumentConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/** Kết quả của bước đọc chữ: các nhóm theo tiêu đề (màu nhôm, hệ nhôm...) và các dòng chữ + số lượng trong từng nhóm. */
export interface ExtractedGroup {
  heading: string;
  lines: Array<{ text: string; quantity?: number | null; unit?: string | null }>;
}

export interface DocumentCandidate {
  profileId: string;
  code: string;
  name: string;
  systemCode: string;
  score: number;
  reason: 'CODE' | 'GLOSSARY' | 'NAME';
}

export interface DocumentDraftLine {
  id: string;
  group: string;
  text: string;
  quantity: number | null;
  unit: DocumentUnit;
  /** Số cây sau khi đổi từ bó; null nếu chưa tính được. */
  bars: number | null;
  colorCode: string | null;
  profileId: string | null;
  profileCode?: string;
  profileName?: string;
  confidence: DocumentConfidence;
  candidates: DocumentCandidate[];
  warnings: string[];
  /** Người dùng đã tự chọn thanh cho dòng này. */
  userChosen: boolean;
  removed: boolean;
}

export interface DocumentDraftItem {
  id: string;
  kind: DocumentDraftKind;
  status: DocumentDraftStatus;
  engine: string;
  note: string;
  factoryOrgId: string | null;
  resultRef: string;
  hasImage: boolean;
  lines: DocumentDraftLine[];
  createdAt: string;
  confirmedAt?: string;
}

export interface CreateDocumentDraftInput {
  kind: DocumentDraftKind;
  /** Ảnh phiếu dạng base64 (không có tiền tố data:). */
  imageBase64?: string;
  mime?: string;
  /** Có sẵn kết quả đọc chữ (nhập tay hoặc đọc ở nơi khác) thì không cần ảnh. */
  groups?: ExtractedGroup[];
  note?: string;
  factoryOrgId?: string;
}

export interface DocumentDraftLineInput {
  id?: string;
  group?: string;
  text: string;
  quantity: number | null;
  unit: string | null;
  /** undefined: tự ghép; null: bỏ chọn; có giá trị: người dùng chọn thanh này. */
  profileId?: string | null;
  colorCode?: string | null;
  removed?: boolean;
}

export interface UpdateDocumentDraftInput {
  lines: DocumentDraftLineInput[];
  factoryOrgId?: string | null;
  note?: string;
  /** Mặc định true: lưu lựa chọn của người dùng vào từ điển viết tắt của NPP. */
  learn?: boolean;
}

export interface DocumentServiceStatus {
  ocrConfigured: boolean;
  engine: string;
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
  kgPerMeter?: number;
  stockByColor?: { colorCode: string; colorName: string; stockBars: number; tons: number }[];
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

// ---------- Tối ưu cắt & Sơ đồ cắt trực quan (Visual Cutting Blueprint) ----------

export interface VisualCutSegment {
  lengthMm: number;
  doorName?: string;
  profileName?: string;
  cutAngle?: string;
}

export interface BarCuttingLayout {
  barIndex: number;
  barLengthMm: number;
  materialCode: string;
  materialName?: string;
  isDeXe: boolean;
  deXeId?: string;
  cuts: VisualCutSegment[];
  usedLengthMm: number;
  remainingLengthMm: number;
  isNewDeXe: boolean; // remaining >= 1000mm
  scrapMm: number;
}

export interface CutPieceRequest {
  lengthMm: number;
  doorName?: string;
  profileName?: string;
  cutAngle?: string;
}

export interface CutRequest {
  materialCode: string;
  systemCode?: string;
  lengths: number[];
  pieces?: CutPieceRequest[];
}

export type WorkshopPayType = 'DAILY' | 'HOURLY' | 'MONTHLY';
/** PRESENT đủ công · HALF nửa công · LEAVE nghỉ phép có lương · UNPAID_LEAVE nghỉ không lương · ABSENT vắng không báo */
export type WorkshopAttendanceStatus = 'PRESENT' | 'HALF' | 'LEAVE' | 'UNPAID_LEAVE' | 'ABSENT';
export type WorkshopPayAdjustmentKind = 'ADVANCE' | 'BONUS' | 'PENALTY';
export type WorkshopReminderPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface WorkshopWorker {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  roleName: string;
  payType: WorkshopPayType;
  baseRate: number;
  overtimeRate: number;
  standardMonthlyDays: number;
  sundayPayEnabled: boolean;
  sundayPayPercent: number;
  holidayPayEnabled: boolean;
  holidayPayPercent: number;
  insuranceEnabled: boolean;
  insuranceSalary: number;
  paidLeaveDaysPerMonth: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopAttendance {
  id: string;
  organizationId: string;
  workerId: string;
  worker: WorkshopWorker;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  regularHours: number;
  overtimeHours: number;
  status: WorkshopAttendanceStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopReminder {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  dueAt: string;
  priority: WorkshopReminderPriority;
  note: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopPayslipLine {
  label: string;
  projectName?: string;
  note?: string;
  date?: string;
  amount: number;
}

export interface WorkshopPayslip {
  fullDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  workUnits: number;
  regularHours: number;
  overtimeHours: number;
  overtimeHourlyRate: number;
  basePay: number;
  overtimePay: number;
  sundayDays: number;
  sundayPay: number;
  holidayDays: number;
  holidayPay: number;
  pieces: WorkshopPayslipLine[];
  pieceTotal: number;
  bonuses: WorkshopPayslipLine[];
  bonusTotal: number;
  gross: number;
  insuranceSalary: number;
  insuranceEmployee: number;
  insuranceEmployer: number;
  advances: WorkshopPayslipLine[];
  advanceTotal: number;
  penalties: WorkshopPayslipLine[];
  penaltyTotal: number;
  deductions: number;
  net: number;
}

export interface WorkshopPayrollRow {
  worker: WorkshopWorker;
  payslip: WorkshopPayslip;
  /** Kept for older clients: ngày công tính lương */
  daysWorked: number;
  /** Kept for older clients: tổng thu nhập trước khấu trừ */
  estimatedPay: number;
}

export interface WorkshopPayrollMonth {
  month: string;
  closed: boolean;
  closedAt?: string | null;
  rows: WorkshopPayrollRow[];
  totals: { gross: number; net: number; advances: number; insuranceEmployer: number; workers: number };
}

export interface WorkshopPayslipView {
  month: string;
  closed: boolean;
  organizationName: string;
  worker: WorkshopWorker;
  payslip: WorkshopPayslip;
  /** Cách tính lương theo công, ví dụ "9.000.000 ÷ 26 × 24" */
  basePayFormula: string;
}

export interface WorkshopPieceJobShare {
  workerId: string;
  workerName: string;
  amount: number;
}

export interface WorkshopPieceJob {
  id: string;
  title: string;
  projectId?: string | null;
  projectName: string;
  workDate: string;
  totalAmount: number;
  note: string;
  shares: WorkshopPieceJobShare[];
  createdAt: string;
}

export interface CreateWorkshopPieceJobInput {
  title: string;
  projectId?: string;
  workDate: string;
  totalAmount: number;
  note?: string;
  /** Chia đều cho các thợ này, hoặc dùng `shares` để tự nhập phần từng người */
  workerIds?: string[];
  shares?: Array<{ workerId: string; amount: number }>;
}

export interface WorkshopPayAdjustment {
  id: string;
  workerId: string;
  workerName: string;
  kind: WorkshopPayAdjustmentKind;
  amount: number;
  note: string;
  workDate: string;
  createdAt: string;
}

export interface CreateWorkshopPayAdjustmentInput {
  workerId: string;
  kind: WorkshopPayAdjustmentKind;
  amount: number;
  note?: string;
  workDate: string;
}

export interface SetWorkshopDayStatusInput {
  workerId: string;
  date: string;
  status: WorkshopAttendanceStatus;
  note?: string;
}

export interface WorkshopWorkdaySetting {
  date: string;
  isHoliday: boolean;
  label: string;
}

export interface WorkforceDashboard {
  date: string;
  month: string;
  workerCount: number;
  presentCount: number;
  checkedInCount: number;
  overtimeHours: number;
  estimatedPayroll: number;
  monthClosed: boolean;
  reminders: WorkshopReminder[];
  attendance: WorkshopAttendance[];
}

export interface CreateWorkshopWorkerInput {
  name: string;
  phone?: string;
  roleName?: string;
  payType: WorkshopPayType;
  baseRate: number;
  overtimeRate?: number;
  standardMonthlyDays?: number;
  sundayPayEnabled?: boolean;
  sundayPayPercent?: number;
  holidayPayEnabled?: boolean;
  holidayPayPercent?: number;
  insuranceEnabled?: boolean;
  insuranceSalary?: number;
  paidLeaveDaysPerMonth?: number;
}

export interface CreateWorkshopReminderInput {
  title: string;
  dueAt: string;
  priority?: WorkshopReminderPriority;
  note?: string;
}

export interface CutResult {
  materialCode: string;
  materialName?: string;
  pieces: number[];
  usedDeXeIds: string[];
  usedDeXe: Array<{ id: string; quantity: number }>;
  newBarsNeeded: number;
  newDeXeGenerated: number[];
  kgPerMeter: number;
  barLengthMm: number;
  inputKg: number;
  newStockKg: number;
  usedDeXeKg: number;
  finishedKg: number;
  reusableRemnantKg: number;
  scrapGeneratedKg: number;
  barLayouts?: BarCuttingLayout[];
}

// ---------- Chuyển đổi Báo giá sang Đơn hàng ----------

export interface ConvertQuoteToOrderInput {
  quotationId: string;
  projectId?: string;
  colorCode?: string;
  note?: string;
  submitToNpp?: boolean;
  customItemQuantities?: Record<string, number>; // profileId -> quantity (ghi nhận override nếu có)
}

// ---------- Thợ Pro & Gamification ----------

export type WorkerTier = 'SILVER' | 'GOLD' | 'DIAMOND' | 'MASTER';

export interface WorkerProCardData {
  tier: WorkerTier;
  tierName: string;
  currentPoints: number;
  proScore: number;
  nextTierPoints: number;
  monthlyMissionsCompleted: number;
  monthlyMissionsTotal: number;
  rankInProvince: number;
}

const WINDOWS_1252_BYTE_BY_CODE_POINT: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const LEGACY_UTF8_MARKERS = /(?:Ã|Ä|áº|á»|Â|Æ)/;

export function fixLegacyUtf8Mojibake(value: string): string {
  if (!LEGACY_UTF8_MARKERS.test(value)) return value;

  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const mapped = WINDOWS_1252_BYTE_BY_CODE_POINT[codePoint];
    if (mapped !== undefined) {
      bytes.push(mapped);
    } else if (codePoint <= 0xff) {
      bytes.push(codePoint);
    } else {
      return value;
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

export { mediaRetryDelayMs, recoverInterruptedMediaUploads } from './mediaQueuePolicy.js';
export type { RecoverableMediaUpload } from './mediaQueuePolicy.js';

// ---------- Website công khai, quản trị nội dung và kênh phân phối ----------

export const WEBSITE_PRODUCT_FAMILIES = ['RESIDENTIAL', 'INDUSTRIAL'] as const;
export type WebsiteProductFamily = (typeof WEBSITE_PRODUCT_FAMILIES)[number];

export const WEBSITE_CHANNELS = ['PUBLIC', 'NPP', 'ADMIN_ONLY'] as const;
export type WebsiteChannel = (typeof WEBSITE_CHANNELS)[number];

export const WEBSITE_CONTENT_KINDS = [
  'PRODUCT',
  'INDUSTRIAL_SERVICE',
  'SOLUTION',
  'CASE_STUDY',
  'PAGE',
  'ARTICLE',
  'FAQ',
  'VIDEO',
] as const;
export type WebsiteContentKind = (typeof WEBSITE_CONTENT_KINDS)[number];

export const WEBSITE_PUBLICATION_STATUSES = [
  'DRAFT',
  'TECHNICAL_REVIEW',
  'MARKETING_REVIEW',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type WebsitePublicationStatus = (typeof WEBSITE_PUBLICATION_STATUSES)[number];

export const WEBSITE_REVIEW_STAGES = ['TECHNICAL', 'MARKETING'] as const;
export type WebsiteReviewStage = (typeof WEBSITE_REVIEW_STAGES)[number];

export const WEBSITE_REVIEW_DECISIONS = ['APPROVED', 'CHANGES_REQUESTED'] as const;
export type WebsiteReviewDecision = (typeof WEBSITE_REVIEW_DECISIONS)[number];

export const WEBSITE_MEDIA_INTAKE_STATUSES = [
  'DISCOVERED',
  'REVIEWED',
  'APPROVED',
  'OPTIMIZED',
  'PUBLISHED',
  'REJECTED',
] as const;
export type WebsiteMediaIntakeStatus = (typeof WEBSITE_MEDIA_INTAKE_STATUSES)[number];

export interface PublicSeoProjection {
  title: string;
  description: string;
  canonicalPath: string;
  schemaType: string;
  reviewDate?: string;
  reviewer?: string;
}

export interface PublicMediaProjection {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
  altText: string;
  caption?: string;
  posterUrl?: string;
  transcript?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface PublicDocumentProjection {
  id: string;
  title: string;
  documentType: string;
  revisionLabel: string;
  effectiveDate: string;
  downloadUrl: string;
}

export interface PublicWebsiteContentSummary {
  id: string;
  slug: string;
  locale: string;
  kind: WebsiteContentKind;
  family?: WebsiteProductFamily;
  title: string;
  eyebrow?: string;
  summary: string;
  updatedAt: string;
  linkedSystem?: { id: string; code: string; name: string };
}

export interface PublicWebsiteContentDetail extends PublicWebsiteContentSummary {
  body: unknown;
  specifications?: unknown;
  seo: PublicSeoProjection;
  media: PublicMediaProjection[];
  documents: PublicDocumentProjection[];
}

export interface AdminWebsiteReview {
  id: string;
  stage: WebsiteReviewStage;
  decision: WebsiteReviewDecision;
  note?: string;
  reviewerId: string;
  reviewerName?: string;
  createdAt: string;
}

export interface AdminWebsiteRevision {
  id: string;
  websiteContentId: string;
  revision: number;
  status: WebsitePublicationStatus;
  title: string;
  eyebrow?: string;
  summary: string;
  body: unknown;
  specifications?: unknown;
  sourceRefs?: unknown;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  reviews: AdminWebsiteReview[];
}

export * from './website-homepage.js';

// ---------------------------------------------------------------------------
// Hoá đơn & thuế của CSSX (GĐ1: sổ doanh thu, hoá đơn bán ra, khung nhà cung cấp)
// ---------------------------------------------------------------------------

export type TaxEntityType = 'HKD' | 'DN';
export type TaxBusinessLine = 'MANUFACTURING' | 'CONSTRUCTION_WITH_MATERIALS';
export type TaxPitMethod = 'REVENUE_RATE' | 'INCOME';
export type InvoiceProviderCode = 'NONE' | 'SANDBOX' | 'MISA';
export type SalesInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'REPLACED';
export type SalesInvoiceSource = 'PROVIDER' | 'EXTERNAL';
export type TaxLedgerAlert = 'NONE' | 'NEAR' | 'CROSSED' | 'OVERDUE' | 'REGISTERED';

export interface WorkshopTaxYearRuleView {
  year: number;
  exemptThreshold: number;
  vatPct: number;
  pitPct: number;
  confirmed: boolean;
  source: string;
}

export interface WorkshopTaxProfile {
  entityType: TaxEntityType;
  taxCode: string;
  legalName: string;
  legalAddress: string;
  locationCode: string;
  businessLine: TaxBusinessLine;
  vatRatePct: number | null;
  pitRatePct: number | null;
  pitMethod: TaxPitMethod;
  invoiceSeries: string;
  provider: InvoiceProviderCode;
  einvoiceRegisteredAt: string | null;
  updatedAt: string | null;
  /** Đủ mã số thuế, tên và ký hiệu để phát hành. */
  isComplete: boolean;
  /** Tỷ lệ mặc định theo bảng năm hiện tại cho ngành đã chọn. */
  defaults: WorkshopTaxYearRuleView;
}

export type UpdateWorkshopTaxProfileInput = Partial<Omit<WorkshopTaxProfile, 'updatedAt' | 'isComplete' | 'defaults'>>;

export interface WorkshopSalesInvoiceLine {
  id?: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface WorkshopSalesInvoiceSummary {
  id: string;
  status: SalesInvoiceStatus;
  source: SalesInvoiceSource;
  provider: InvoiceProviderCode | null;
  series: string;
  number: string | null;
  issueDate: string;
  buyerName: string;
  buyerTaxCode: string;
  projectId: string | null;
  projectCode: string;
  total: number;
  lineCount: number;
  cancelReason: string;
  replacesNumber: string | null;
  replacedByNumber: string | null;
}

export interface WorkshopSalesInvoiceEvent {
  action: string;
  actorName: string;
  detail: string;
  createdAt: string;
}

export interface WorkshopSalesInvoice extends WorkshopSalesInvoiceSummary {
  customerId: string | null;
  buyerAddress: string;
  buyerEmail: string;
  buyerPhone: string;
  subtotal: number;
  vatRatePct: number;
  vatAmount: number;
  note: string;
  lookupCode: string | null;
  providerRef: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  replacesId: string | null;
  replacedById: string | null;
  lines: WorkshopSalesInvoiceLine[];
  events: WorkshopSalesInvoiceEvent[];
  /** Tiền đã thu của công trình gắn với hoá đơn (để đối chiếu). */
  projectCollected: number | null;
}

export interface SaveWorkshopSalesInvoiceInput {
  projectId?: string | null;
  customerId?: string | null;
  buyerName: string;
  buyerTaxCode?: string;
  buyerAddress?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  /** YYYY-MM-DD */
  issueDate?: string;
  note?: string;
  vatRatePct?: number;
  lines: Array<{ name: string; unit?: string; quantity: number; unitPrice: number }>;
}

export interface RecordExternalInvoiceInput {
  series: string;
  number: string;
  /** YYYY-MM-DD */
  issueDate?: string;
}

export interface WorkshopTaxPeriod {
  invoiced: number;
  collected: number;
  invoiceCount: number;
  receiptCount: number;
}

export interface WorkshopTaxEstimate {
  revenue: number;
  exempt: boolean;
  vatRatePct: number;
  pitRatePct: number;
  pitMethod: TaxPitMethod;
  vat: number;
  pit: number | null;
  total: number;
  vatFormula: string;
  pitFormula: string;
}

export interface WorkshopTaxLedger {
  year: number;
  threshold: number;
  months: Array<WorkshopTaxPeriod & { month: number }>;
  quarters: Array<WorkshopTaxPeriod & { quarter: number }>;
  totalInvoiced: number;
  totalCollected: number;
  invoiceCount: number;
  receiptCount: number;
  thresholdPct: number;
  remaining: number;
  crossedQuarter: number | null;
  crossedOn: string | null;
  registrationDeadline: string | null;
  daysToDeadline: number | null;
  registrationDeadlineIfCrossedNow: string | null;
  alert: TaxLedgerAlert;
  annualNoticeDeadline: string;
  currentQuarter: number | null;
  projectedYearRevenue: number | null;
  draftCount: number;
  tax: WorkshopTaxEstimate;
  /** Thuế nếu cả năm giữ nhịp hiện tại và vượt ngưỡng; null nếu không vượt. */
  projectedTax: WorkshopTaxEstimate | null;
  rule: WorkshopTaxYearRuleView;
  profile: { entityType: TaxEntityType; legalName: string; taxCode: string; isComplete: boolean; provider: InvoiceProviderCode };
}
