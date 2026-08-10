import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../auth/current-user.decorator';

@Controller('admin/sales')
@UseGuards(JwtAuthGuard) // Chỉ những người có module sales hoặc có quyền mới được, nhưng tạm thời dùng jwt auth, chi tiết check ở service
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ---------- Quản lý Xưởng/NPP (theo vùng) ----------
  @Get('managed-orgs')
  getManagedOrgs(@CurrentUser() user: JwtUser, @Query('type') type?: string) {
    return this.salesService.getManagedOrgs(user, type);
  }

  // ---------- Quản lý Khách Hàng Tiềm Năng (Leads) ----------
  @Get('leads')
  getLeads(@CurrentUser() user: JwtUser) {
    return this.salesService.getLeads(user);
  }

  @Post('leads')
  createLead(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.salesService.createLead(user, body);
  }

  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtUser) {
    return this.salesService.updateLead(id, body, user);
  }

  // ---------- Báo cáo công việc ----------
  @Get('reports')
  getReports(@CurrentUser() user: JwtUser) {
    return this.salesService.getReports(user);
  }

  @Post('reports')
  createReport(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.salesService.createReport(user, body);
  }

  // ---------- Theo dõi doanh số NPP ----------
  @Get('targets')
  getTargets(@CurrentUser() user: JwtUser, @Query('year') year: string, @Query('month') month: string) {
    return this.salesService.getTargets(user, Number(year), Number(month));
  }

  // ---------- Phiếu lương (Payroll) ----------
  @Get('payroll')
  getMyPayroll(@CurrentUser() user: JwtUser) {
    return this.salesService.getMyPayroll(user);
  }
}
