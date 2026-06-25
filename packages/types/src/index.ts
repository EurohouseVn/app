export type UserRole = 'ADMIN' | 'STAFF' | 'NPP' | 'DAILY';

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
