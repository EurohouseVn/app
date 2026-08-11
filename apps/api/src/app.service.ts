import { Injectable } from '@nestjs/common';
import type {
  AdminDashboardData,
  QuoteCalculationResult,
} from '@eurohouse/types';
import { PrismaService } from './prisma/prisma.service';

type OrderRow = { code: string; nppName: string; dealerName: string; totalAmount: number; status: string; createdAt?: Date | string };

const statusLabel: Record<string, { label: string; tone: AdminDashboardData['recentOrders'][number]['tone'] }> = {
  NEW: { label: 'Mới', tone: 'brandOrange' },
  RECEIVED_BY_NPP: { label: 'NPP tiếp nhận', tone: 'success' },
  SENT_TO_ADMIN: { label: 'Gửi công ty', tone: 'brandBlack' },
  PROCESSING: { label: 'Đang xử lý', tone: 'warning' },
  PARTIAL: { label: 'Giao một phần', tone: 'warning' },
  COMPLETED: { label: 'Hoàn tất', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  OVERDUE: { label: 'Chậm xử lý', tone: 'danger' },
};

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { name: 'Eurohouse API', status: 'ok', build: 'npp-color-schema-guard-v2', timestamp: new Date().toISOString() };
  }

  sampleQuote(): QuoteCalculationResult {
    return {
      items: [
        { profileCode: 'PR-DD55', profileName: 'Khung bao cửa đi 55', lengthMm: 1950, quantity: 2, cutAngle: '45°' },
        { profileCode: 'PR5542', profileName: 'Cánh cửa đi 55', lengthMm: 2150, quantity: 4, cutAngle: '45°' },
        { profileCode: 'PR55N', profileName: 'Nẹp kính 55', lengthMm: 980, quantity: 1, cutAngle: '90°' },
      ],
      totalKg: 42.6,
      aluminumCost: 2982000,
      accessoryCost: 1450000,
      totalCost: 4432000,
    };
  }

  async adminDashboard(orders: OrderRow[]): Promise<AdminDashboardData> {
    const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const newCount = orders.filter((o) => o.status === 'NEW').length;
    const [warrantyCount, projectCount] = await Promise.all([
      this.prisma.warranty.count(),
      this.prisma.project.count(),
    ]);
    return {
      greeting: 'Tổng quan vận hành Eurohouse',
      lastLoginAt: 'Hôm nay',
      summary: [
        { title: 'Doanh số đơn hàng', value: `${(totalAmount / 1000000).toFixed(1)} tr`, description: 'Tổng giá trị đơn trong hệ thống', tone: 'brandOrange', change: `${orders.length} đơn` },
        { title: 'Đơn mới', value: String(newCount), description: 'Đơn chờ NPP tiếp nhận', tone: 'warning', change: `${newCount} chờ` },
        { title: 'Tổng đơn', value: String(orders.length), description: 'Toàn bộ đơn đã tạo', tone: 'success', change: '' },
        { title: 'Bảo hành QR', value: String(warrantyCount), description: 'Mã đã kích hoạt', tone: 'brandBlack', change: '' },
        { title: 'Công trình', value: String(projectCount), description: 'Đang theo dõi', tone: 'brandOrange', change: '' },
        { title: 'Ticket CSKH', value: '0', description: 'Đang mở', tone: 'danger', change: '' },
      ],
      modules: [
        { label: 'Đơn hàng', value: String(orders.length), note: 'Luồng xưởng → NPP → công ty', progress: Math.min(100, orders.length * 10), tone: 'brandOrange' },
        { label: 'Danh mục hệ nhôm', value: '4', note: 'Catalog R17', progress: 80, tone: 'success' },
        { label: 'Khuyến mãi', value: '1', note: 'Chương trình Hè 2026', progress: 100, tone: 'warning' },
        { label: 'Thư viện', value: '4', note: 'Ảnh/kiến thức/video', progress: 60, tone: 'brandBlack' },
      ],
      activities: orders.slice(0, 5).map((o) => ({
        title: `Đơn ${o.code}`,
        description: `${o.dealerName || o.nppName || 'Khách'} · ${(o.totalAmount / 1000000).toFixed(1)} triệu`,
        time: '',
        tone: statusLabel[o.status]?.tone ?? 'brandOrange',
      })),
      chart: this.buildMonthlyChart(orders),
      recentOrders: orders.slice(0, 8).map((o) => ({
        id: o.code,
        dealer: o.dealerName || '—',
        npp: o.nppName || '—',
        value: `${(o.totalAmount / 1000000).toFixed(1)} triệu`,
        status: statusLabel[o.status]?.label ?? o.status,
        age: '',
        tone: statusLabel[o.status]?.tone ?? 'brandOrange',
      })) as AdminDashboardData['recentOrders'],
      departments: [
        { department: 'Kinh doanh', openTasks: 0, sla: '—', tone: 'success' },
        { department: 'Kỹ thuật', openTasks: 0, sla: '—', tone: 'brandOrange' },
        { department: 'CSKH', openTasks: 0, sla: '—', tone: 'warning' },
        { department: 'Kho', openTasks: 0, sla: '—', tone: 'danger' },
      ],
      systemStatus: [
        { service: 'API', status: 'Online', note: 'NestJS + Prisma', tone: 'success' },
        { service: 'Database', status: 'Online', note: 'SQLite (dev) / Postgres (prod)', tone: 'success' },
        { service: 'Mobile Expo', status: 'Theo dõi', note: 'Chạy local qua Expo', tone: 'brandOrange' },
      ],
      apiStatus: 'online',
      quote: this.sampleQuote(),
    };
  }

  // Doanh thu 6 tháng gần nhất, gộp theo tháng từ ngày tạo đơn thật.
  private buildMonthlyChart(orders: OrderRow[]): AdminDashboardData['chart'] {
    const now = new Date();
    const buckets: { label: string; year: number; month: number; revenue: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: `T${d.getMonth() + 1}`, year: d.getFullYear(), month: d.getMonth(), revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      if (!o.createdAt) continue;
      const d = new Date(o.createdAt);
      const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
      if (bucket) {
        bucket.revenue += o.totalAmount;
        bucket.orders += 1;
      }
    }
    return buckets.map((b) => ({ label: b.label, revenue: Math.round(b.revenue / 1000000), orders: b.orders }));
  }
}
