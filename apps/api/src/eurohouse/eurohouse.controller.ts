import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type {
  CreateOrderInput,
  DebtItem,
  ProjectDetail,
  QuotationInput,
} from '@eurohouse/types';
import { EurohouseService } from './eurohouse.service';

@Controller()
export class EurohouseController {
  constructor(private readonly service: EurohouseService) {}

  // Danh mục đặt hàng
  @Get('catalog/systems')
  catalog() {
    return this.service.catalog();
  }

  @Get('catalog/colors')
  colors() {
    return this.service.colors();
  }

  // Đơn hàng
  @Post('orders')
  createOrder(@Body() body: CreateOrderInput) {
    return this.service.createOrder(body);
  }

  @Get('orders')
  listOrders(@Query('sourceType') sourceType?: string, @Query('status') status?: string) {
    return this.service.listOrders({ sourceType, status });
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.service.getOrder(id);
  }

  @Patch('orders/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; actor?: string; title?: string; note?: string }) {
    return this.service.updateOrderStatus(id, body.status, body.actor ?? 'Hệ thống', body.title ?? 'Cập nhật', body.note);
  }

  @Post('npp/orders/:id/receive')
  nppReceive(@Param('id') id: string) {
    return this.service.updateOrderStatus(id, 'RECEIVED_BY_NPP', 'NPP', 'NPP tiếp nhận', 'NPP đã tiếp nhận đơn');
  }

  @Post('npp/orders/:id/send-admin')
  nppSendAdmin(@Param('id') id: string) {
    return this.service.updateOrderStatus(id, 'SENT_TO_ADMIN', 'NPP', 'Gửi công ty', 'NPP chuyển đơn lên công ty');
  }

  // Người dùng & tổ chức (Web Admin)
  @Get('admin/users')
  adminUsers() {
    return this.service.adminUsers();
  }

  @Get('admin/orgs')
  adminOrgs() {
    return this.service.adminOrgs();
  }

  // Công trình
  @Get('projects')
  listProjects(@Query('owner') owner?: string) {
    return this.service.listProjects(owner);
  }

  @Post('projects')
  createProject(@Body() body: Partial<ProjectDetail> & { ownerEmail?: string }) {
    return this.service.createProject(body);
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string) {
    return this.service.getProject(id);
  }

  @Patch('projects/:id')
  updateProject(@Param('id') id: string, @Body() body: Partial<ProjectDetail>) {
    return this.service.updateProject(id, body);
  }

  // Công nợ
  @Get('debts')
  listDebts() {
    return this.service.listDebts();
  }

  @Post('debts')
  createDebt(@Body() body: Partial<DebtItem> & { projectId?: string }) {
    return this.service.createDebt(body);
  }

  // Báo giá tự động
  @Post('quotations/calc')
  calcQuotation(@Body() body: QuotationInput) {
    return this.service.calcQuotation(body);
  }

  // Nội dung
  @Get('promotions')
  promotions() {
    return this.service.promotions();
  }

  @Get('gifts')
  gifts() {
    return this.service.gifts();
  }

  @Get('library')
  library() {
    return this.service.library();
  }
}
