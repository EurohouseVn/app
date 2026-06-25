import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  AdminDashboardData,
  DemoAdminUser,
  LoginResponse,
  QuoteCalculationResult,
} from '@eurohouse/types';

@Injectable()
export class AppService {
  health() {
    return {
      name: 'Eurohouse API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  sampleQuote(): QuoteCalculationResult {
    return {
      items: [
        { profileCode: 'XF55-K', profileName: 'Khung bao Xingfa 55', lengthMm: 1950, quantity: 2, cutAngle: '45°' },
        { profileCode: 'XF55-C', profileName: 'Cánh mở quay', lengthMm: 2150, quantity: 4, cutAngle: '45°' },
        { profileCode: 'XF55-D', profileName: 'Đố giữa tăng cứng', lengthMm: 980, quantity: 1, cutAngle: '90°' },
      ],
      totalKg: 42.6,
      aluminumCost: 2982000,
      accessoryCost: 1450000,
      totalCost: 4432000,
    };
  }

  demoLogin(identifier: string, password: string): LoginResponse {
    const demoEmail = process.env.DEMO_ADMIN_EMAIL ?? 'board@eurohouse.vn';
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'Eurohouse@2026';

    if (identifier !== demoEmail || password !== demoPassword) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu demo.');
    }

    const user: DemoAdminUser = {
      id: 'demo-admin-001',
      displayName: 'Ban lãnh đạo Demo',
      email: demoEmail,
      role: 'ADMIN',
      token: 'demo-token-eurohouse-admin',
    };

    return {
      user,
      message: 'Đăng nhập demo thành công. Đây là tài khoản thử nghiệm cho lãnh đạo.',
    };
  }

  adminDashboard(): AdminDashboardData {
    return {
      greeting: 'Chào mừng Ban lãnh đạo Eurohouse',
      lastLoginAt: 'Hôm nay lúc 08:30',
      summary: [
        { title: 'Doanh số tháng', value: '1.24 tỷ', description: 'Tổng doanh số ghi nhận trong tháng', tone: 'brandOrange', change: '+18.4%' },
        { title: 'Đơn đang xử lý', value: '42', description: '8 đơn cần ưu tiên trong 24h', tone: 'warning', change: '+6 đơn' },
        { title: 'Bảo hành QR', value: '318', description: 'Mã đã kích hoạt trong 30 ngày', tone: 'success', change: '+23.7%' },
        { title: 'Điểm loyalty', value: '84.500', description: 'Tổng điểm đang lưu hành', tone: 'brandBlack', change: '+9.200' },
        { title: 'Công trình mở', value: '27', description: 'Đang báo giá hoặc thi công', tone: 'brandOrange', change: '+4' },
        { title: 'Ticket CSKH', value: '13', description: '3 ticket gần SLA', tone: 'danger', change: '-5 so với tuần trước' },
      ],
      modules: [
        { label: 'Báo giá & cắt nhôm', value: '86', note: '17 báo giá chờ duyệt kỹ thuật', progress: 72, tone: 'brandOrange' },
        { label: 'Đơn hàng NPP', value: '42', note: '8 đơn đang ở trạng thái mới', progress: 58, tone: 'warning' },
        { label: 'Bảo hành QR', value: '318', note: '99.2% kích hoạt thành công', progress: 91, tone: 'success' },
        { label: 'Loyalty & quà', value: '31', note: 'Yêu cầu đổi quà chờ duyệt', progress: 64, tone: 'brandBlack' },
        { label: 'Thư viện nội dung', value: '156', note: 'Ảnh/kiến thức/sản phẩm đang xuất bản', progress: 82, tone: 'success' },
        { label: 'Phòng ban', value: '4', note: 'Kinh doanh, Kỹ thuật, CSKH, Kho', progress: 76, tone: 'brandOrange' },
      ],
      activities: [
        { title: 'Đơn hàng mới', description: 'Đại lý Minh Phát tạo đơn Xingfa 55 trị giá 86.5 triệu', time: '5 phút trước', tone: 'brandOrange' },
        { title: 'Bảo hành QR', description: 'Kích hoạt 12 mã QR cho công trình Quận 7', time: '1 giờ trước', tone: 'success' },
        { title: 'Báo giá', description: 'Đã xuất 4 báo giá PDF gửi khách hàng', time: 'Hôm qua', tone: 'brandBlack' },
        { title: 'Ticket CSKH', description: 'Ticket #CS-1029 sắp đến hạn SLA 2 giờ', time: 'Hôm nay', tone: 'danger' },
        { title: 'Đổi quà loyalty', description: 'NPP Việt Anh gửi yêu cầu đổi máy khoan pin', time: '2 ngày trước', tone: 'warning' },
      ],
      chart: [
        { label: 'T1', revenue: 820, orders: 28 },
        { label: 'T2', revenue: 910, orders: 31 },
        { label: 'T3', revenue: 1040, orders: 39 },
        { label: 'T4', revenue: 980, orders: 36 },
        { label: 'T5', revenue: 1160, orders: 44 },
        { label: 'T6', revenue: 1240, orders: 42 },
      ],
      recentOrders: [
        { id: 'EH-2406-001', dealer: 'Đại lý Minh Phát', npp: 'NPP Việt Anh', value: '86.5 triệu', status: 'Mới', age: '2 giờ', tone: 'brandOrange' },
        { id: 'EH-2406-002', dealer: 'Cửa Nhôm An Khang', npp: 'NPP Hà Nội', value: '142 triệu', status: 'Tiếp nhận', age: '1 ngày', tone: 'success' },
        { id: 'EH-2406-003', dealer: 'Đại lý Tân Thành', npp: 'NPP Miền Trung', value: '64 triệu', status: 'Chậm xử lý', age: '8 ngày', tone: 'danger' },
        { id: 'EH-2406-004', dealer: 'Nhôm Kính Phúc Long', npp: 'NPP Việt Anh', value: '38 triệu', status: 'Giao một phần', age: '4 ngày', tone: 'warning' },
      ],
      departments: [
        { department: 'Kinh doanh', openTasks: 18, sla: '92% đúng hạn', tone: 'success' },
        { department: 'Kỹ thuật', openTasks: 11, sla: '84% đúng hạn', tone: 'brandOrange' },
        { department: 'CSKH', openTasks: 13, sla: '3 ticket gần hạn', tone: 'warning' },
        { department: 'Kho', openTasks: 7, sla: '1 đơn chậm', tone: 'danger' },
      ],
      systemStatus: [
        { service: 'API Render', status: 'Online', note: 'Health check OK', tone: 'success' },
        { service: 'Admin Vercel', status: 'Online', note: 'Đang phục vụ dashboard', tone: 'success' },
        { service: 'Database', status: 'Theo dõi', note: 'Mock mode, chưa dùng DB thật', tone: 'warning' },
        { service: 'Mobile Expo', status: 'Theo dõi', note: 'Chạy local qua Expo', tone: 'brandOrange' },
      ],
      apiStatus: 'online',
      quote: this.sampleQuote(),
    };
  }
}
