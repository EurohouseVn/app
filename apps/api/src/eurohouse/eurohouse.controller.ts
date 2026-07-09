import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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
  UpdateOrderExportFieldsInput,
  UpdateOrderInput,
  UpdateOrgInput,
} from '@eurohouse/types';
import { EurohouseService } from './eurohouse.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { OrderPdfService } from './order-pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../auth/current-user.decorator';

@Controller()
export class EurohouseController {
  constructor(
    private readonly service: EurohouseService,
    private readonly pdfService: QuotationPdfService,
    private readonly orderPdfService: OrderPdfService,
  ) {}

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
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    const createdById = user.role === 'FACTORY' ? user.sub : undefined;
    const nppOrgId = user.role === 'NPP' ? user.organizationId : undefined;
    const pageNum = page ? Number(page) : undefined;
    const pageSizeNum = pageSize ? Number(pageSize) : undefined;
    if (pageNum !== undefined) {
      return this.service.listOrders({ sourceType, status, createdById, nppOrgId, page: pageNum, pageSize: pageSizeNum });
    }
    return this.service.listOrders({ sourceType, status, createdById, nppOrgId });
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOrder(@Param('id') id: string) {
    return this.service.getOrder(id);
  }

  @Get('orders/:id/pdf')
  @UseGuards(JwtAuthGuard)
  async orderPdf(@Param('id') id: string, @Res() res: Response) {
    const order = await this.service.getOrder(id);
    const colors = await this.service.colors();
    const colorNameByCode: Record<string, string> = {};
    for (const c of colors) colorNameByCode[c.code] = c.name;

    const pdf = await this.orderPdfService.render({
      code: order.code,
      customerCode: order.customerCode ?? '',
      customerName: order.customerName ?? '',
      customerPhone: order.customerPhone ?? '',
      deliveryAddress: order.deliveryAddress ?? '',
      invoiceNo: order.invoiceNo ?? '',
      poNo: order.poNo ?? '',
      createdAt: order.createdAt,
      colorNameByCode,
      items: order.items.map((it) => ({
        profileCode: it.profile?.code ?? it.productCode,
        productName: it.productName,
        colorCode: it.colorCode ?? '',
        quantity: it.quantity,
        totalKg: it.totalKg,
        kgPerMeter: it.profile?.kgPerMeter,
        barsPerBundle: it.profile?.barsPerBundle,
      })),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="phieu-xuat-kho-${order.code}.pdf"`);
    res.end(pdf);
  }

  @Patch('orders/:id/export-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateExportFields(@Param('id') id: string, @Body() body: UpdateOrderExportFieldsInput) {
    return this.service.updateExportFields(id, body);
  }

  @Patch('orders/:id')
  @UseGuards(JwtAuthGuard)
  updateOrder(@Param('id') id: string, @Body() body: UpdateOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.updateOrder(id, body, user.sub);
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

  // NPP Web Manager
  // ADMIN có thể truyền ?nppOrgId= để xem hộ/kiểm tra; NPP luôn bị ép theo organizationId trong JWT của mình.
  private resolveNppOrgId(user: JwtUser, queryNppOrgId?: string): string {
    if (user.role === 'NPP') {
      if (!user.organizationId) throw new BadRequestException('Tài khoản NPP chưa được gán tổ chức.');
      return user.organizationId;
    }
    if (!queryNppOrgId) throw new BadRequestException('Thiếu tham số nppOrgId.');
    return queryNppOrgId;
  }

  @Get('npp/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppDashboard(@Query('nppOrgId') nppOrgId: string | undefined, @CurrentUser() user: JwtUser) {
    return this.service.nppDashboard(this.resolveNppOrgId(user, nppOrgId));
  }

  @Get('npp/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppOrders(
    @Query('nppOrgId') queryNppOrgId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    const nppOrgId = this.resolveNppOrgId(user, queryNppOrgId);
    const pageNum = page ? Number(page) : undefined;
    const pageSizeNum = pageSize ? Number(pageSize) : undefined;
    if (pageNum !== undefined) {
      return this.service.listOrders({ nppOrgId, status, page: pageNum, pageSize: pageSizeNum });
    }
    return this.service.listOrders({ nppOrgId, status });
  }

  @Get('npp/orders/reconciliation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppOrderReconciliation(
    @Query('nppOrgId') queryNppOrgId: string | undefined,
    @Query('month') month: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.nppOrderReconciliation(this.resolveNppOrgId(user, queryNppOrgId), { month });
  }

  @Get('npp/debts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppDebts(
    @Query('nppOrgId') queryNppOrgId: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.listDebts({ nppOrgId: this.resolveNppOrgId(user, queryNppOrgId), status, type: 'NPP' });
  }

  @Post('npp/debts/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppPayDebt(@Param('id') id: string, @Body() body: PayDebtInput, @CurrentUser() user: JwtUser) {
    return this.service.payDebt(id, body, user.sub);
  }

  @Get('npp/reports/pnl')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP', 'ADMIN')
  nppReportsPnl(
    @Query('nppOrgId') queryNppOrgId: string | undefined,
    @Query('months') months: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.nppFinancialReport(this.resolveNppOrgId(user, queryNppOrgId), months ? Number(months) : undefined);
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
    return this.service.updateOrg(id, body);
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

  @Post('quotations')
  @UseGuards(JwtAuthGuard)
  createQuotation(@Body() body: QuotationInput, @CurrentUser() user: JwtUser) {
    return this.service.createQuotation(body, user.sub);
  }

  @Get('quotations')
  @UseGuards(JwtAuthGuard)
  listQuotations(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    // ADMIN/STAFF xem tất cả báo giá; các role khác chỉ xem báo giá do mình tạo.
    const createdById = user.role === 'ADMIN' || user.role === 'STAFF' ? undefined : user.sub;
    const pageNum = page ? Number(page) : undefined;
    const pageSizeNum = pageSize ? Number(pageSize) : undefined;
    if (pageNum !== undefined) {
      return this.service.listQuotations({ createdById, page: pageNum, pageSize: pageSizeNum });
    }
    return this.service.listQuotations({ createdById });
  }

  @Get('quotations/:id')
  @UseGuards(JwtAuthGuard)
  getQuotation(@Param('id') id: string) {
    return this.service.getQuotation(id);
  }

  @Get('quotations/:id/pdf')
  @UseGuards(JwtAuthGuard)
  async quotationPdf(@Param('id') id: string, @Res() res: Response) {
    const quotation = await this.service.getQuotation(id);
    const pdf = await this.pdfService.render(quotation);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="bao-gia-${quotation.code}.pdf"`);
    res.end(pdf);
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
