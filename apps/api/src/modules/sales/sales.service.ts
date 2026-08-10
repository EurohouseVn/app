import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUser } from '../../auth/current-user.decorator';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper: lấy thông tin User bao gồm mảng vùng quản lý
  private async getManagedProvinces(userId: string): Promise<string[]> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { managedProvinces: true } });
    if (!u) return [];
    try {
      return JSON.parse(u.managedProvinces);
    } catch {
      return [];
    }
  }

  // 1. Quản lý NPP/Xưởng thợ
  async getManagedOrgs(user: JwtUser, type?: string) {
    // Nếu là CEO thì thấy hết, nếu không thì lấy theo vùng quản lý (managedProvinces)
    const provinces = await this.getManagedProvinces(user.sub);
    const whereClause: any = {};
    if (!user.isCeo) {
      if (provinces.length === 0) return []; // Không quản lý vùng nào
      whereClause.province = { in: provinces };
    }
    if (type) {
      whereClause.type = type;
    }

    return this.prisma.organization.findMany({
      where: whereClause,
      include: {
        _count: { select: { managedFactories: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 2. Leads (Cơ sở tiềm năng)
  async getLeads(user: JwtUser) {
    const provinces = await this.getManagedProvinces(user.sub);
    const whereClause: any = {};
    if (!user.isCeo) {
      // Sale chỉ thấy lead của mình hoặc lead trong vùng mình quản lý
      whereClause.OR = [
        { managedById: user.sub },
        { province: { in: provinces } }
      ];
    }
    return this.prisma.lead.findMany({
      where: whereClause,
      include: { managedBy: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createLead(user: JwtUser, data: any) {
    return this.prisma.lead.create({
      data: {
        name: data.name,
        address: data.address || '',
        province: data.province || '',
        phone: data.phone || '',
        imageUrl: data.imageUrl || '',
        currentBrand: data.currentBrand || '',
        scale: data.scale || '',
        potentialRating: data.potentialRating || 0,
        managedById: user.sub,
        status: 'NEW',
      }
    });
  }

  async updateLead(id: string, data: any, user: JwtUser) {
    return this.prisma.lead.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        province: data.province,
        phone: data.phone,
        imageUrl: data.imageUrl,
        currentBrand: data.currentBrand,
        scale: data.scale,
        potentialRating: data.potentialRating,
        status: data.status,
      }
    });
  }

  // 3. Báo cáo công việc (SaleReport)
  async getReports(user: JwtUser) {
    // Nếu là CEO thì thấy hết, nếu là Sale thì chỉ thấy của mình
    if (user.isCeo) {
      return this.prisma.saleReport.findMany({
        include: { createdBy: { select: { displayName: true } } },
        orderBy: { date: 'desc' }
      });
    } else {
      return this.prisma.saleReport.findMany({
        where: { createdById: user.sub },
        orderBy: { date: 'desc' }
      });
    }
  }

  async createReport(user: JwtUser, data: any) {
    return this.prisma.saleReport.create({
      data: {
        type: data.type || 'DAILY',
        date: new Date(data.date),
        content: data.content,
        createdById: user.sub
      }
    });
  }

  // 4. Bảng theo dõi doanh số NPP
  async getTargets(user: JwtUser, year: number, month: number) {
    const provinces = await this.getManagedProvinces(user.sub);
    const orgWhere: any = { type: 'NPP' };
    if (!user.isCeo) {
      if (provinces.length === 0) return [];
      orgWhere.province = { in: provinces };
    }

    const npps = await this.prisma.organization.findMany({
      where: orgWhere,
      include: {
        salesTargets: {
          where: { year, month }
        }
      }
    });

    // Tính toán doanh số thực tế (Kg) từ bảng Order
    // Đơn hàng COMPLETED trong tháng đó, thuộc NPP
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const actuals = await this.prisma.order.groupBy({
      by: ['nppOrgId'],
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: startDate, lte: endDate },
        nppOrgId: { in: npps.map(n => n.id) }
      },
      _sum: { totalKg: true }
    });

    return npps.map(npp => {
      const target = npp.salesTargets[0]?.targetKg || 0;
      const actualObj = actuals.find(a => a.nppOrgId === npp.id);
      const actual = actualObj?._sum.totalKg || 0;
      return {
        nppId: npp.id,
        nppName: npp.name,
        province: npp.province,
        targetKg: target,
        actualKg: actual,
        percent: target > 0 ? (actual / target) * 100 : 0
      };
    });
  }

  // 5. Phiếu lương (Payroll)
  async getMyPayroll(user: JwtUser) {
    return this.prisma.payroll.findMany({
      where: { userId: user.sub, status: { in: ['PUBLISHED', 'PAID'] } },
      orderBy: { month: 'desc' }
    });
  }
}
