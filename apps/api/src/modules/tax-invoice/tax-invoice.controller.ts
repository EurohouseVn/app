import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { RecordExternalInvoiceInput, SaveWorkshopSalesInvoiceInput, UpdateWorkshopTaxProfileInput } from '@eurohouse/types';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { TaxInvoiceService } from './tax-invoice.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function yearOf(value?: string): number {
  return value ? Number(value) : Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4));
}

@Controller('workshop/tax')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACTORY', 'DAILY')
export class TaxInvoiceController {
  constructor(
    private readonly service: TaxInvoiceService,
    private readonly documents: InvoiceDocumentsService,
  ) {}

  @Get('profile')
  profile(@CurrentUser() user: JwtUser) {
    return this.service.profile(user);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: JwtUser, @Body() body: UpdateWorkshopTaxProfileInput) {
    return this.service.updateProfile(user, body);
  }

  @Get('ledger')
  ledger(@CurrentUser() user: JwtUser, @Query('year') year?: string) {
    return this.service.ledger(user, year);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: JwtUser, @Query('year') year?: string, @Query('status') status?: string, @Query('q') q?: string) {
    return this.service.invoices(user, { year, status, q });
  }

  @Post('invoices')
  createInvoice(@CurrentUser() user: JwtUser, @Body() body: SaveWorkshopSalesInvoiceInput) {
    return this.service.createInvoice(user, body);
  }

  @Post('invoices/from-project/:projectId')
  createFromProject(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string) {
    return this.service.createFromProject(user, projectId);
  }

  @Get('invoices/:id')
  invoice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.invoice(user, id);
  }

  @Patch('invoices/:id')
  updateInvoice(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: SaveWorkshopSalesInvoiceInput) {
    return this.service.updateInvoice(user, id, body);
  }

  @Delete('invoices/:id')
  deleteInvoice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteInvoice(user, id);
  }

  @Post('invoices/:id/issue')
  issue(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.issue(user, id);
  }

  @Post('invoices/:id/record-external')
  recordExternal(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: RecordExternalInvoiceInput) {
    return this.service.recordExternal(user, id, body);
  }

  @Post('invoices/:id/cancel')
  cancel(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.cancel(user, id, body?.reason ?? '');
  }

  @Post('invoices/:id/replace')
  replace(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.replace(user, id);
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@CurrentUser() user: JwtUser, @Param('id') id: string, @Res() res: any) {
    const data = await this.service.pdfData(user, id);
    const pdf = await this.documents.renderInvoicePdf(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="hoa-don-${data.invoice.series || 'nhap'}-${data.invoice.number ?? data.invoice.id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('reports/s1a.xlsx')
  async s1a(@CurrentUser() user: JwtUser, @Query('year') year: string | undefined, @Res() res: any) {
    const y = yearOf(year);
    const file = await this.documents.renderS1a(await this.service.reportData(user, y));
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename="so-doanh-thu-S1a-${y}.xlsx"`, 'Content-Length': file.length });
    res.end(file);
  }

  @Get('reports/invoices.xlsx')
  async invoiceList(@CurrentUser() user: JwtUser, @Query('year') year: string | undefined, @Query('quarter') quarter: string | undefined, @Res() res: any) {
    const y = yearOf(year);
    const q = quarter ? Number(quarter) : undefined;
    const file = await this.documents.renderInvoiceList(await this.service.reportData(user, y), q && q >= 1 && q <= 4 ? q : undefined);
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename="bang-ke-hoa-don-${y}${q ? `-Q${q}` : ''}.xlsx"`, 'Content-Length': file.length });
    res.end(file);
  }
}
