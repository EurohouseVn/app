import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { CreateAdminToNppShipmentInput, CreateOrderInput, UpdateOrderInput } from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { OrderPdfService } from './order-pdf.service';
import { CatalogService } from '../catalog/catalog.service';
import * as exceljs from 'exceljs';

@Controller()
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly orderPdfService: OrderPdfService,
    private readonly catalogService: CatalogService,
  ) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NPP', 'FACTORY')
  createOrder(@Body() body: CreateOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.createOrder(body, user.sub);
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY')
  deleteOrder(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.deleteOrder(id, user);
  }

  @Patch('orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('FACTORY')
  updateOrder(@Param('id') id: string, @Body() body: UpdateOrderInput, @CurrentUser() user: JwtUser) {
    return this.service.updateOrder(id, body, user.sub);
  }

  @Post('orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP')
  updateOrderStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }, @CurrentUser() user: JwtUser) {
    return this.service.updateOrderStatus(id, body.status, user.organizationName || user.displayName || 'Há»‡ thá»‘ng', 'Cáº­p nháº­t tráº¡ng thÃ¡i', body.note, user);
  }

  @Post('orders/:id/submit-npp')
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
      colorNameByCode,
      items: order.items.map((it: any) => ({
        profileCode: it.profile?.code ?? it.productCode,
        productName: it.productName,
        colorCode: it.colorCode ?? '',
        quantity: it.quantity,
        totalKg: it.totalKg,
        kgPerMeter: it.profile?.kgPerMeter,
        actualKgPerBar: it.profile?.actualKgPerBar,
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
    const factoryOrg = order.createdBy?.organization;

    const pdf = await this.orderPdfService.render({
      title: 'PHIEU GIAO HANG',
      code: order.code,
      issuerName: nppOrg?.productionName || nppOrg?.name || order.nppName || 'NPP EUROHOUSE',
      issuerAddress: nppOrg?.address || '',
      issuerPhone: nppOrg?.phone || '',
      issuerEmail: nppOrg?.email || '',
      issuerCategories: nppOrg?.mainCategories || 'Nha phan phoi Eurohouse',
      customerCode: order.customerCode ?? '',
      customerName: factoryOrg?.productionName || factoryOrg?.name || order.factoryName || order.customerName || '',
      customerPhone: factoryOrg?.phone || order.customerPhone || '',
      deliveryAddress: order.deliveryAddress || factoryOrg?.address || '',
      invoiceNo: order.invoiceNo ?? '',
      poNo: order.poNo ?? '',
      debtAmount: order.totalAmount,
      accessoriesNote: order.accessoriesNote ?? '',
      signatureLabels: ['CHU NPP', 'NHAN VIEN GIAO HANG', 'KHACH HANG NHAN HANG'],
      createdAt: order.createdAt,
      colorNameByCode,
      items: order.items.map((it: any) => ({
        profileCode: it.profile?.code ?? it.productCode,
        productName: it.productName,
        colorCode: it.colorCode ?? '',
        quantity: it.quantity,
        totalKg: it.totalKg,
        kgPerMeter: it.profile?.kgPerMeter,
        actualKgPerBar: it.profile?.actualKgPerBar,
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
    const factoryOrg = order.createdBy?.organization;
    const workbook = new exceljs.Workbook();
    workbook.creator = 'Eurohouse';
    const sheet = workbook.addWorksheet('Phieu giao hang');
    sheet.columns = [
      { header: 'STT', key: 'index', width: 8 },
      { header: 'Ma thanh', key: 'code', width: 16 },
      { header: 'Ten hang', key: 'name', width: 32 },
      { header: 'Mau', key: 'color', width: 14 },
      { header: 'So cay', key: 'quantity', width: 12 },
      { header: 'So kg', key: 'kg', width: 12 },
      { header: 'Don gia', key: 'unitPrice', width: 14 },
      { header: 'Thanh tien', key: 'amount', width: 16 },
    ];
    sheet.spliceRows(1, 0,
      ['PHIEU GIAO HANG'],
      [`Ma don: ${order.code}`, `Ngay tao: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`],
      [`NPP: ${nppOrg?.productionName || nppOrg?.name || order.nppName || ''}`, `SDT: ${nppOrg?.phone || ''}`],
      [`CSSX: ${factoryOrg?.productionName || factoryOrg?.name || order.factoryName || ''}`, `SDT: ${factoryOrg?.phone || order.customerPhone || ''}`],
      [`Dia chi giao: ${order.deliveryAddress || factoryOrg?.address || ''}`],
      [`Phu kien di kem: ${order.accessoriesNote || ''}`],
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
        unitPrice: item.unitPrice,
        amount: item.totalPrice,
      });
    });
    sheet.addRow([]);
    sheet.addRow(['', '', '', 'Tong cong', order.items.reduce((s: number, item: any) => s + item.quantity, 0), order.totalKg, '', order.totalAmount]);
    sheet.addRow([]);
    sheet.addRow(['Chu NPP', '', 'Nhan vien giao hang', '', '', 'Khach hang nhan hang']);
    sheet.addRow(['Ky, ghi ro ho ten', '', 'Ky, ghi ro ho ten', '', '', 'Ky, ghi ro ho ten']);
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
  createAdminToNppShipment(@Body() body: CreateAdminToNppShipmentInput, @CurrentUser() user: JwtUser) {
    return this.service.createAdminToNppShipment(body, user.sub);
  }

  @Post('npp/orders/:id/receive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  receiveNppOrder(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.updateOrderStatus(id, 'NPP_REVIEWING', user.organizationName || user.displayName || 'NPP', 'NPP tiáº¿p nháº­n', 'NPP Ä‘Ã£ tiáº¿p nháº­n Ä‘Æ¡n hÃ ng.', user);
  }

  @Post('npp/orders/:id/send-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  sendNppOrderToAdmin(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.updateOrderStatus(id, 'CONFIRMED', user.organizationName || user.displayName || 'NPP', 'Gá»­i cÃ´ng ty', 'NPP Ä‘Ã£ gá»­i Ä‘Æ¡n lÃªn cÃ´ng ty xá»­ lÃ½.', user);
  }

  @Post('npp/orders/:id/delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppDelivery(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.createNppDelivery(id, user);
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

  @Get('npp/financial-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppFinancialReport(@CurrentUser() user: JwtUser) {
    return this.service.nppFinancialReport(user.organizationId!);
  }
}

