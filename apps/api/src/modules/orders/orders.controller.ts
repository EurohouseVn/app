import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { ConvertQuoteToOrderInput, CreateAdminToNppShipmentInput, CreateNppDeliveryInput, CreateOrderInput, UpdateOrderInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { OrderPdfService } from './order-pdf.service';
import { CatalogService } from '../catalog/catalog.service';
import * as exceljs from 'exceljs';
import { assertInventoryMutationAllowed } from '../inventory/inventory-mutation-policy';
import type { InventoryCommandContext } from '../inventory/inventory-command.service';
import { RequiresEurohouseFeature } from '../eurohouse-access/eurohouse-feature.decorator';

function inventoryCommand(user: JwtUser, key: string | undefined, ownerType: 'COMPANY_STOCK' | 'NPP_STOCK', ownerId: string, command: string): InventoryCommandContext {
  if (!key) throw new BadRequestException('Idempotency-Key header is required for inventory mutations.');
  assertInventoryMutationAllowed({ actorId: user.sub, role: user.role, organizationId: user.organizationId }, ownerType, ownerId);
  return { idempotencyKey: key, actorId: user.sub, organizationId: user.organizationId, ownerType, ownerId, command };
}

@Controller()
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly orderPdfService: OrderPdfService,
    private readonly catalogService: CatalogService,
  ) {}

  @Post('orders')
  @RequiresEurohouseFeature('EUROHOUSE_ORDERING')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NPP', 'FACTORY')
  createOrder(@Body() body: CreateOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.createOrder(body, user.sub, user);
  }

  @Post('orders/convert-from-quotation')
  @RequiresEurohouseFeature('EUROHOUSE_ORDERING')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  convertFromQuotation(@Body() body: ConvertQuoteToOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.convertQuotationToOrder(body, user);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  listOrders(
    @Query('sourceType') sourceType?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('mine') mine?: string,
    @CurrentUser() user?: JwtUser,
  ) {
    let createdById: string | undefined;
    let nppOrgId: string | undefined;
    if (user?.role === 'NPP') nppOrgId = user.organizationId;
    if (user?.role === 'FACTORY' || user?.role === 'DAILY' || mine === 'true') createdById = user?.sub;

    const filter = { sourceType, status, createdById, nppOrgId };
    if (page) return this.service.listOrders({ ...filter, page: parseInt(page, 10) }, user);
    return this.service.listOrders(filter, user);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  getOrder(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.getOrder(id, user);
  }

  @Delete('orders/:id')
  @RequiresEurohouseFeature('EUROHOUSE_ORDERING')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  deleteOrder(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.deleteOrder(id, user);
  }

  @Patch('orders/:id')
  @RequiresEurohouseFeature('EUROHOUSE_ORDERING')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FACTORY')
  updateOrder(@Param('id') id: string, @Body() body: UpdateOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.updateOrder(id, body, user.sub, user);
  }

  @Post('orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP')
  updateOrderStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }, @CurrentUser() user: JwtUser) {
    return this.service.updateOrderStatus(id, body.status, user.organizationName || user.displayName || 'Hệ thống', 'Cập nhật trạng thái', body.note, user);
  }

  @Post('orders/:id/submit-npp')
  @RequiresEurohouseFeature('EUROHOUSE_ORDERING')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FACTORY', 'DAILY')
  submitOrderToNpp(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.submitOrderToNpp(id, user);
  }

  @Put('orders/:id/export-fields')
  @Patch('orders/:id/export-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP')
  updateExportFields(
    @Param('id') id: string,
    @Body() body: { customerCode?: string; invoiceNo?: string; poNo?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.updateExportFields(id, body, user);
  }

  @Get('orders/:id/pdf')
  @UseGuards(JwtAuthGuard)
  async orderPdf(@Param('id') id: string, @Res() res: any, @CurrentUser() user: JwtUser) {
    const order = await this.service.getOrder(id, user);
    const colors = await this.catalogService.colors();
    const colorNameByCode: Record<string, string> = {};
    for (const c of colors) colorNameByCode[c.code] = c.name;

    const pdf = await this.orderPdfService.render({
      code: order.code,
      issuerName: order.createdBy?.organization?.productionName || order.createdBy?.organization?.name || order.createdBy?.displayName,
      issuerAddress: order.createdBy?.organization?.address || '',
      issuerPhone: order.createdBy?.organization?.phone || order.createdBy?.phone || '',
      issuerEmail: order.createdBy?.organization?.email || order.createdBy?.email || '',
      issuerCategories: order.createdBy?.organization?.mainCategories || '',
      customerCode: order.customerCode ?? '',
      customerName: order.customerName ?? '',
      customerPhone: order.customerPhone ?? '',
      deliveryAddress: order.deliveryAddress ?? '',
      invoiceNo: order.invoiceNo ?? '',
      poNo: order.poNo ?? '',
      createdAt: order.createdAt,
      actualTotalKg: order.actualTotalKg ?? undefined,
      colorNameByCode,
      items: order.items.map((it: any) => ({
        profileCode: it.profile?.code ?? it.productCode,
        productName: it.productName,
        colorCode: it.colorCode ?? '',
        quantity: it.quantity,
        totalKg: it.totalKg,
        kgPerMeter: it.profile?.kgPerMeter,
        theoreticalTotalKg: it.theoreticalTotalKg,
        barsPerBundle: it.profile?.barsPerBundle,
      })),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="phieu-dat-hang-${order.code}.pdf"`);
    res.end(pdf);
  }

  @Get('npp/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppDashboard(@CurrentUser() user: JwtUser) {
    return this.service.nppDashboard(user.organizationId!);
  }

  @Get('npp/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppOrders(@Query('status') status: string | undefined, @Query('page') page: string | undefined, @Query('pageSize') pageSize: string | undefined, @CurrentUser() user: JwtUser) {
    return this.service.listOrders({
      status,
      nppOrgId: user.organizationId!,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, user);
  }

  @Get('npp/orders/reconciliation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppOrdersReconciliation(@Query('month') month: string, @CurrentUser() user: JwtUser) {
    return this.service.nppOrderReconciliation(user.organizationId!, { month });
  }

  @Get('npp/orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppOrderDetail(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.getOrder(id, user);
  }

  @Get('npp/orders/:id/delivery-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  async nppDeliveryPdf(@Param('id') id: string, @Res() res: any, @CurrentUser() user: JwtUser) {
    const order = await this.service.getOrder(id, user);
    const colors = await this.catalogService.colors();
    const colorNameByCode: Record<string, string> = {};
    for (const c of colors) colorNameByCode[c.code] = c.name;
    const nppOrg = (order as any).nppOrg;
    const factoryOrg = (order as any).factoryOrg || order.createdBy?.organization;

    const pdf = await this.orderPdfService.render({
      title: 'PHIẾU GIAO HÀNG',
      code: order.code,
      issuerName: nppOrg?.productionName || nppOrg?.name || order.nppName || 'NPP EUROHOUSE',
      issuerAddress: nppOrg?.address || '',
      issuerPhone: nppOrg?.phone || '',
      issuerEmail: nppOrg?.email || '',
      issuerCategories: nppOrg?.mainCategories || 'Nhà phân phối Eurohouse',
      customerCode: order.customerCode ?? '',
      customerName: factoryOrg?.productionName || factoryOrg?.name || order.factoryName || order.customerName || '',
      customerPhone: factoryOrg?.phone || order.customerPhone || '',
      deliveryAddress: order.deliveryAddress || factoryOrg?.address || '',
      invoiceNo: order.invoiceNo ?? '',
      poNo: order.poNo ?? '',
      debtAmount: order.totalAmount,
      finalUnitPricePerKg: order.finalUnitPricePerKg ?? undefined,
      discountAmount: order.pricingDiscountAmount,
      surchargeAmount: order.pricingSurchargeAmount,
      pricingNote: order.pricingNote,
      accessoriesNote: order.accessoriesNote ?? '',
      signatureLabels: ['CHỦ NPP', 'NHÂN VIÊN GIAO HÀNG', 'KHÁCH HÀNG NHẬN HÀNG'],
      createdAt: order.createdAt,
      actualTotalKg: order.actualTotalKg ?? undefined,
      colorNameByCode,
      items: order.items.map((it: any) => ({
        profileCode: it.profile?.code ?? it.productCode,
        productName: it.productName,
        colorCode: it.colorCode ?? '',
        quantity: it.quantity,
        totalKg: it.totalKg,
        kgPerMeter: it.profile?.kgPerMeter,
        theoreticalTotalKg: it.theoreticalTotalKg,
        barsPerBundle: it.profile?.barsPerBundle,
      })),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="phieu-giao-hang-${order.code}.pdf"`);
    res.end(pdf);
  }

  @Get('npp/orders/:id/delivery-excel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  async nppDeliveryExcel(@Param('id') id: string, @Res() res: any, @CurrentUser() user: JwtUser) {
    const order = await this.service.getOrder(id, user);
    const nppOrg = (order as any).nppOrg;
    const factoryOrg = (order as any).factoryOrg || order.createdBy?.organization;
    const workbook = new exceljs.Workbook();
    workbook.creator = 'Eurohouse';
    const sheet = workbook.addWorksheet('Phiếu giao hàng');
    sheet.columns = [
      { header: 'STT', key: 'index', width: 8 },
      { header: 'Mã thanh', key: 'code', width: 16 },
      { header: 'Tên hàng', key: 'name', width: 32 },
      { header: 'Màu', key: 'color', width: 18 },
      { header: 'Số cây', key: 'quantity', width: 12 },
      { header: 'Kg theo tỷ trọng', key: 'kg', width: 18 },
      { header: 'Ghi chú giá', key: 'unitPrice', width: 18 },
      { header: 'Giá trị dòng', key: 'amount', width: 16 },
    ];
    sheet.spliceRows(1, 0,
      ['PHIẾU GIAO HÀNG'],
      [`Mã đơn: ${order.code}`, `Ngày tạo: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`],
      [`NPP: ${nppOrg?.productionName || nppOrg?.name || order.nppName || ''}`, `SĐT: ${nppOrg?.phone || ''}`],
      [`CSSX: ${factoryOrg?.productionName || factoryOrg?.name || order.factoryName || ''}`, `SĐT: ${factoryOrg?.phone || order.customerPhone || ''}`],
      [`Địa chỉ giao: ${order.deliveryAddress || factoryOrg?.address || ''}`],
      [`Phụ kiện đi kèm: ${order.accessoriesNote || ''}`],
      [],
    );
    const headerRow = sheet.getRow(8);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    order.items.forEach((item: any, index: number) => {
      sheet.addRow({
        index: index + 1,
        code: item.profile?.code ?? item.productCode,
        name: item.productName,
        color: item.colorCode ?? '',
        quantity: item.quantity,
        kg: item.totalKg,
        unitPrice: 'Chốt toàn đơn',
        amount: '',
      });
    });
    sheet.addRow([]);
    const totalRow = sheet.addRow(['', '', '', 'TỔNG KG THỰC TẾ CÂN', order.items.reduce((s: number, item: any) => s + item.quantity, 0), order.actualTotalKg ?? order.totalKg, '', '']);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E7' } };
    sheet.addRow(['', '', '', 'ĐƠN GIÁ NPP', '', '', order.finalUnitPricePerKg ?? 0, '']);
    sheet.addRow(['', '', '', 'GIẢM GIÁ', '', '', '', order.pricingDiscountAmount ?? 0]);
    sheet.addRow(['', '', '', 'PHỤ PHÍ', '', '', '', order.pricingSurchargeAmount ?? 0]);
    const valueRow = sheet.addRow(['', '', '', 'THÀNH TIỀN CHÍNH THỨC', '', '', '', order.totalAmount]);
    valueRow.font = { bold: true };
    sheet.addRow([]);
    sheet.addRow(['CHỦ NPP', '', 'NHÂN VIÊN GIAO HÀNG', '', '', 'KHÁCH HÀNG NHẬN HÀNG']);
    sheet.addRow(['Ký, ghi rõ họ tên', '', 'Ký, ghi rõ họ tên', '', '', 'Ký, ghi rõ họ tên']);
    sheet.eachRow((row) => row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FFD9DDE3' } }, left: { style: 'thin', color: { argb: 'FFD9DDE3' } }, bottom: { style: 'thin', color: { argb: 'FFD9DDE3' } }, right: { style: 'thin', color: { argb: 'FFD9DDE3' } } };
    }));
    sheet.getCell('A1').font = { bold: true, size: 16 };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="phieu-giao-hang-${order.code}.xlsx"`);
    res.end(Buffer.from(buffer));
  }

  @Post('admin/npp-shipments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createAdminToNppShipment(@Body() body: CreateAdminToNppShipmentInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    return this.service.createAdminToNppShipment(body, user.sub, inventoryCommand(user, key, 'COMPANY_STOCK', 'GLOBAL', 'CREATE_ADMIN_NPP_SHIPMENT'));
  }

  @Post('npp/orders/:id/receive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  receiveNppOrder(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.updateOrderStatus(id, 'NPP_REVIEWING', user.organizationName || user.displayName || 'NPP', 'NPP tiếp nhận', 'NPP đã tiếp nhận đơn hàng.', user);
  }

  @Post('npp/orders/:id/send-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  sendNppOrderToAdmin(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.updateOrderStatus(id, 'CONFIRMED', user.organizationName || user.displayName || 'NPP', 'Gửi công ty', 'NPP đã gửi đơn lên công ty xử lý.', user);
  }

  @Post('npp/orders/:id/delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppDelivery(@Param('id') id: string, @Body() body: CreateNppDeliveryInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    const ownerId = user.organizationId!;
    return this.service.createNppDelivery(id, user, body, inventoryCommand(user, key, 'NPP_STOCK', ownerId, 'CREATE_NPP_DELIVERY'));
  }

  @Post('npp/orders/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  completeNppDelivery(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.completeNppDelivery(id, user);
  }

  @Get('npp/factories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppFactories(@CurrentUser() user: JwtUser) {
    return this.service.listNppFactories(user.organizationId!);
  }

  @Post('npp/factories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppFactory(@Body() body: any, @CurrentUser() user: JwtUser) {
    return this.service.createNppFactory(user.organizationId!, body);
  }

  @Get('npp/reconciliation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppReconciliation(@Query('month') month: string, @CurrentUser() user: JwtUser) {
    return this.service.nppOrderReconciliation(user.organizationId!, { month });
  }

  // `npp/reports/pnl` là đường web NPP gọi (trang Báo cáo); `npp/financial-report` giữ lại cho tương thích.
  @Get(['npp/reports/pnl', 'npp/financial-report'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppFinancialReport(@Query('months') months: string | undefined, @CurrentUser() user: JwtUser) {
    const parsed = months ? parseInt(months, 10) : 6;
    const safeMonths = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 24) : 6;
    return this.service.nppFinancialReport(user.organizationId!, safeMonths);
  }
}

