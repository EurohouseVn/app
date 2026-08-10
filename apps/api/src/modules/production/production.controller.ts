import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { ProductionService } from './production.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../auth/current-user.decorator';

@Controller('admin/production')
@UseGuards(JwtAuthGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // ---------- Quản lý Khuôn (Dies) ----------
  @Get('dies')
  getDies() {
    return this.productionService.getDies();
  }

  @Post('dies')
  createDie(@Body() body: any) {
    return this.productionService.createDie(body);
  }

  // ---------- Quản lý Lệnh Sản Xuất (Work Orders) ----------
  @Get('work-orders')
  getWorkOrders() {
    return this.productionService.getWorkOrders();
  }

  @Post('work-orders')
  createWorkOrder(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.productionService.createWorkOrder(user, body);
  }

  // ---------- Quản lý Kiosk / Công đoạn (Shop floor) ----------
  @Get('shop-floor')
  getPendingSteps(@Query('stepName') stepName: string) {
    return this.productionService.getPendingSteps(stepName);
  }

  @Patch('shop-floor/start/:id')
  startStep(@Param('id') stepId: string, @Body() body: any) {
    return this.productionService.startStep(stepId, body);
  }

  @Patch('shop-floor/complete/:id')
  completeStep(@Param('id') stepId: string, @Body() body: any) {
    return this.productionService.completeStep(stepId, body);
  }

  // ---------- Dashboard Thống kê ----------
  @Get('dashboard')
  getDashboardStats() {
    return this.productionService.getDashboardStats();
  }
}
