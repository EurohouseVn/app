import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdjustProfileStockInput,
  CreateCashTransactionInput,
  CreateMaterialInput,
  CreateOrderInput,
  CreateStockMovementInput,
  DebtItem,
  PayDebtInput,
  ProjectDetail,
  QuotationInput,
  UpdateMaterialInput,
  UpdateOrgInput,
} from '@eurohouse/types';
import { EurohouseService } from './eurohouse.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../auth/current-user.decorator';

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

  // Kho NVL & chi phí sản xuất chung
  @Get('materials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  listMaterials(@Query('category') category?: string, @Query('group') group?: string) {
    return this.service.listMaterials({ category, group });
  }

  @Post('materials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createMaterial(@Body() body: CreateMaterialInput) {
    return this.service.createMaterial(body);
  }

  @Patch('materials/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateMaterial(@Param('id') id: string, @Body() body: UpdateMaterialInput) {
    return this.service.updateMaterial(id, body);
  }

  @Get('materials/:id/movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  materialMovements(@Param('id') id: string) {
    return this.service.listMaterialMovements(id);
  }

  @Get('stock-movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  listStockMovements(
    @Query('direction') direction?: string,
    @Query('materialId') materialId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listStockMovements({ direction, materialId, from, to });
  }

  @Post('stock-movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createStockMovement(@Body() body: CreateStockMovementInput, @CurrentUser() user: JwtUser) {
    return this.service.createStockMovement(body, user.sub);
  }

  // Tồn kho thanh nhôm (Profile)
  @Get('profiles/:id/movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  profileMovements(@Param('id') id: string) {
    return this.service.listProfileMovements(id);
  }

  @Post('profiles/:id/stock-adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  adjustProfileStock(@Param('id') id: string, @Body() body: AdjustProfileStockInput, @CurrentUser() user: JwtUser) {
    return this.service.adjustProfileStock(id, body, user.sub);
  }

  // Thu chi
  @Get('cash-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  listCashTransactions(
    @Query('type') type?: string,
    @Query('debtId') debtId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listCashTransactions({ type, debtId, from, to });
  }

  @Post('cash-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createCashTransaction(@Body() body: CreateCashTransactionInput, @CurrentUser() user: JwtUser) {
    return this.service.createCashTransaction(body, user.sub);
  }

  // Báo cáo tài chính
  @Get('reports/pnl')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  monthlyPnL(@Query('months') months?: string) {
    return this.service.monthlyPnL(months ? Number(months) : undefined);
  }

  // Đơn hàng
  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(@Body() body: CreateOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.createOrder(body, user.sub);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  listOrders(
    @Query('sourceType') sourceType: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    // Thợ (FACTORY) chỉ được xem đơn của chính mình — không tin filter từ client.
    const createdById = user.role === 'FACTORY' ? user.sub : undefined;
    return this.service.listOrders({ sourceType, status, createdById });
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOrder(@Param('id') id: string) {
    return this.service.getOrder(id);
  }

  @Patch('orders/:id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(@Param('id') id: string, @Body() body: { status: string; actor?: string; title?: string; note?: string }) {
    return this.service.updateOrderStatus(id, body.status, body.actor ?? 'Hệ thống', body.title ?? 'Cập nhật', body.note);
  }

  @Post('npp/orders/:id/receive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppReceive(@Param('id') id: string) {
    return this.service.updateOrderStatus(id, 'RECEIVED_BY_NPP', 'NPP', 'NPP tiếp nhận', 'NPP đã tiếp nhận đơn');
  }

  @Post('npp/orders/:id/send-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppSendAdmin(@Param('id') id: string) {
    return this.service.updateOrderStatus(id, 'SENT_TO_ADMIN', 'NPP', 'Gửi công ty', 'NPP chuyển đơn lên công ty');
  }

  // Người dùng & tổ chức (Web Admin)
  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  adminUsers() {
    return this.service.adminUsers();
  }

  @Get('admin/orgs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  adminOrgs() {
    return this.service.adminOrgs();
  }

  @Patch('admin/orgs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateOrg(@Param('id') id: string, @Body() body: UpdateOrgInput) {
    return this.service.updateOrgManagedNpp(id, body.managedByNppId ?? null);
  }

  // Công trình
  @Get('projects')
  @UseGuards(JwtAuthGuard)
  listProjects(@CurrentUser() user: JwtUser) {
    return this.service.listProjects(user.sub);
  }

  @Post('projects')
  @UseGuards(JwtAuthGuard)
  createProject(@Body() body: Partial<ProjectDetail>, @CurrentUser() user: JwtUser) {
    return this.service.createProject(body, user.sub);
  }

  @Get('projects/:id')
  @UseGuards(JwtAuthGuard)
  getProject(@Param('id') id: string) {
    return this.service.getProject(id);
  }

  @Patch('projects/:id')
  @UseGuards(JwtAuthGuard)
  updateProject(@Param('id') id: string, @Body() body: Partial<ProjectDetail>) {
    return this.service.updateProject(id, body);
  }

  // Công nợ
  @Get('debts')
  @UseGuards(JwtAuthGuard)
  listDebts(@Query('direction') direction?: string, @Query('status') status?: string, @Query('type') type?: string) {
    return this.service.listDebts({ direction, status, type });
  }

  @Post('debts')
  @UseGuards(JwtAuthGuard)
  createDebt(@Body() body: Partial<DebtItem> & { projectId?: string }) {
    return this.service.createDebt(body);
  }

  @Patch('debts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateDebt(@Param('id') id: string, @Body() body: Partial<DebtItem>) {
    return this.service.updateDebt(id, body);
  }

  @Post('debts/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  payDebt(@Param('id') id: string, @Body() body: PayDebtInput, @CurrentUser() user: JwtUser) {
    return this.service.payDebt(id, body, user.sub);
  }

  // Báo giá tự động
  @Post('quotations/calc')
  @UseGuards(JwtAuthGuard)
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
