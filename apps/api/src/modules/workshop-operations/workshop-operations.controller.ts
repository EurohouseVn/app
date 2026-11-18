import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { assertWorkshopOperationsFeature } from './workshop-operations.feature-flags';
import { WorkshopOperationsService } from './workshop-operations.service';
import { WorkshopEventWorkerService } from './workshop-event-worker.service';
import { WorkshopPilotGuard } from './workshop-pilot.guard';
import { WorkshopPilotService } from './workshop-pilot.service';
import { ProjectFinancialPdfService } from './project-financial-pdf.service';
import { ProjectAcceptancePdfService } from './project-acceptance-pdf.service';

const ROLES = ['ADMIN', 'STAFF', 'NPP', 'FACTORY', 'DAILY'] as const;

@Controller('workshop/v2')
@UseGuards(JwtAuthGuard, RolesGuard, WorkshopPilotGuard)
@Roles(...ROLES)
export class WorkshopOperationsController {
  constructor(
    private readonly service: WorkshopOperationsService,
    private readonly pilot: WorkshopPilotService,
    private readonly eventWorker: WorkshopEventWorkerService,
    private readonly projectFinancialPdf: ProjectFinancialPdfService,
    private readonly projectAcceptancePdf: ProjectAcceptancePdfService,
  ) {}

  @Get('flags')
  flags(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.pilot.flags(user, organizationId); }

  @Get('pilot/config')
  pilotConfig(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.pilot.getPilotConfig(user, organizationId); }

  @Patch('pilot/config')
  updatePilotConfig(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.pilot.updatePilotConfig(user, body); }

  @Post('pilot/rollback')
  rollbackPilot(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.pilot.rollbackPilot(user, body.organizationId ? String(body.organizationId) : undefined); }

  @Get('workspace')
  workspace(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.pilot.workspace(user, organizationId); }

  @Get('people')
  people(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.pilot.organizationPeople(user, organizationId); }

  @Post('roles')
  assignRole(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.pilot.assignRole(user, body); }

  @Get('admin/context')
  adminContext(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.pilot.adminContext(user, organizationId); }

  @Patch('admin/master/:entity/:id')
  updateMasterEntity(@CurrentUser() user: JwtUser, @Param('entity') entity: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.pilot.updateMasterEntity(user, entity, id, body);
  }

  @Post('teams/:teamId/members')
  addTeamMember(@CurrentUser() user: JwtUser, @Param('teamId') teamId: string, @Body() body: Record<string, unknown>) {
    return this.pilot.addTeamMember(user, teamId, body);
  }

  @Post('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }))
  uploadMedia(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Parameters<WorkshopPilotService['uploadMedia']>[2],
  ) {
    return this.pilot.uploadMedia(user, body, file);
  }

  @Get('media')
  media(@CurrentUser() user: JwtUser, @Query() query: { organizationId?: string; deviceId?: string; state?: string }) { return this.pilot.media(user, query); }

  @Post('media/:id/cancel')
  cancelMedia(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.pilot.cancelMedia(user, id, body.organizationId ? String(body.organizationId) : undefined);
  }

  @Post('telemetry')
  recordTelemetry(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.pilot.recordTelemetry(user, body); }

  @Get('telemetry/summary')
  telemetrySummary(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string, @Query('days') days?: string) {
    return this.pilot.telemetrySummary(user, organizationId, Number(days) || 7);
  }

  @Get('sync/conflicts')
  conflicts(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.pilot.conflicts(user, organizationId); }

  @Post('sync/conflicts/:id/resolve')
  resolveConflict(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.pilot.resolveConflict(user, id, body); }

  @Get('events/health')
  eventHealth(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.eventWorker.health(user, organizationId); }

  @Get('events')
  events(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string, @Query('status') status?: string) {
    return this.eventWorker.list(user, organizationId, status);
  }

  @Post('events/:id/retry')
  retryEvent(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.eventWorker.retry(user, id, body.organizationId ? String(body.organizationId) : undefined);
  }

  @Get('customers')
  customers(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string, @Query('search') search?: string) {
    assertWorkshopOperationsFeature('survey');
    return this.service.customers(user, organizationId, search);
  }

  @Post('customers')
  createCustomer(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.createCustomer(user, body);
  }

  @Get('projects')
  projects(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('survey');
    return this.service.projects(user, organizationId);
  }

  @Post('projects')
  createProject(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.createOperationsProject(user, body);
  }

  @Patch('projects/:projectId')
  updateProject(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.updateOperationsProject(user, projectId, body);
  }

  @Delete('projects/:projectId')
  deleteProject(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('survey');
    return this.service.deleteOperationsProject(user, projectId, organizationId);
  }

  @Get('projects/:projectId/financial-pdf')
  async projectFinancialReport(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Query('organizationId') organizationId: string | undefined,
    @Res() res: any,
  ) {
    assertWorkshopOperationsFeature('survey');
    const data = await this.service.projectFinancialPdfData(user, projectId, organizationId);
    const pdf = await this.projectFinancialPdf.render(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tong-hop-thu-chi-${data.code}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get('projects/:projectId/cash-transactions')
  projectCashTransactions(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.service.projectCashTransactions(user, projectId, organizationId);
  }

  @Post('projects/:projectId/cash-transactions')
  createProjectCashTransaction(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.createProjectCashTransaction(user, projectId, body);
  }

  @Delete('projects/:projectId/cash-transactions/:transactionId')
  deleteProjectCashTransaction(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Param('transactionId') transactionId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.service.deleteProjectCashTransaction(user, projectId, transactionId, organizationId);
  }

  @Get('projects/:projectId/acceptance-pdf')
  async projectAcceptanceReport(
    @CurrentUser() user: JwtUser,
    @Param('projectId') projectId: string,
    @Query('organizationId') organizationId: string | undefined,
    @Res() res: any,
  ) {
    assertWorkshopOperationsFeature('survey');
    const data = await this.service.projectFinancialPdfData(user, projectId, organizationId);
    const pdf = await this.projectAcceptancePdf.render(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bien-ban-nghiem-thu-${data.code}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Post('projects/:projectId/complete')
  completeProject(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.completeProject(user, projectId, body);
  }

  @Get('projects/:projectId/survey')
  survey(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('survey');
    return this.service.survey(user, projectId, organizationId);
  }

  @Post('projects/:projectId/sites')
  createSite(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.createSite(user, projectId, body);
  }

  @Post('sites/:siteId/zones')
  createZone(@CurrentUser() user: JwtUser, @Param('siteId') siteId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.createZone(user, siteId, body);
  }

  @Post('projects/:projectId/openings')
  createOpening(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.createOpening(user, projectId, body);
  }

  @Post('openings/:openingId/measurements')
  recordMeasurement(@CurrentUser() user: JwtUser, @Param('openingId') openingId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.recordMeasurement(user, openingId, body);
  }

  @Post('projects/:projectId/notes')
  addSiteNote(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.addSiteNote(user, projectId, body);
  }

  @Post('projects/:projectId/photos')
  addSitePhoto(@CurrentUser() user: JwtUser, @Param('projectId') projectId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('survey');
    return this.service.addSitePhoto(user, projectId, body);
  }

  @Get('master-data')
  masterData(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.masterData(user, organizationId);
  }

  @Patch('settings')
  saveSettings(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.saveSettings(user, body);
  }

  @Post('teams')
  createTeam(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createTeam(user, body);
  }

  @Post('warehouses')
  createWarehouse(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createWarehouse(user, body);
  }

  @Post('warehouses/:warehouseId/locations')
  createWarehouseLocation(@CurrentUser() user: JwtUser, @Param('warehouseId') warehouseId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createWarehouseLocation(user, warehouseId, body);
  }

  @Post('machines')
  createMachine(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createMachine(user, body);
  }

  @Post('suppliers')
  createSupplier(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createSupplier(user, body);
  }

  @Get('inventory/items')
  stockItems(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.stockItems(user, organizationId);
  }

  @Post('inventory/items')
  createStockItem(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createStockItem(user, body);
  }

  @Post('inventory/transactions')
  transactInventory(
    @CurrentUser() user: JwtUser,
    @Body() body: Parameters<WorkshopOperationsService['transactInventory']>[1] & { organizationId?: string },
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    assertWorkshopOperationsFeature('inventory');
    const { organizationId, ...input } = body;
    return this.service.transactInventory(user, input, idempotencyKey, organizationId);
  }

  @Get('inventory/remnants')
  remnants(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.remnants(user, organizationId);
  }

  @Post('inventory/remnants')
  createRemnant(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key: string) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.createRemnant(user, body, key);
  }

  @Patch('inventory/remnants/:id/status')
  transitionRemnant(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key: string) {
    assertWorkshopOperationsFeature('inventory');
    return this.service.transitionRemnant(user, id, body, key);
  }

  @Get('price-books')
  priceBooks(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.service.priceBooks(user, organizationId); }

  @Post('price-books')
  createPriceBook(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.service.createPriceBook(user, body); }

  @Post('price-books/:id/versions')
  createPriceBookVersion(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.createPriceBookVersion(user, id, body); }

  @Patch('price-book-versions/:id/activate')
  activatePriceBookVersion(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.activatePriceBookVersion(user, id, body); }

  @Get('quick-quotes')
  quickQuotes(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.service.quickQuotes(user, organizationId); }

  @Post('quick-quotes')
  createQuickQuote(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.service.createQuickQuote(user, body); }

  @Get('activities')
  activities(@CurrentUser() user: JwtUser, @Query() query: { organizationId?: string; projectId?: string; customerId?: string }) { return this.service.activities(user, query); }

  @Get('work-orders')
  workOrders(@CurrentUser() user: JwtUser, @Query() query: { organizationId?: string; status?: string; assignedWorkerId?: string }) {
    assertWorkshopOperationsFeature('shopFloor');
    return this.service.workOrders(user, query);
  }

  @Post('work-orders')
  createWorkOrder(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('shopFloor');
    return this.service.createWorkOrder(user, body);
  }

  @Patch('work-orders/:id/actions/:action')
  transitionWorkOrder(@CurrentUser() user: JwtUser, @Param('id') id: string, @Param('action') action: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('shopFloor');
    return this.service.transitionWorkOrder(user, id, action, body);
  }

  @Post('work-orders/:id/issues')
  reportWorkOrderIssue(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('shopFloor');
    return this.service.reportWorkOrderIssue(user, id, body);
  }

  @Post('packages')
  createPackage(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.service.createPackage(user, body); }

  @Post('qr')
  issueQr(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.service.issueQr(user, body); }

  @Get('qr/:publicId')
  resolveQr(@CurrentUser() user: JwtUser, @Param('publicId') publicId: string, @Query('organizationId') organizationId?: string) { return this.service.resolveQr(user, publicId, organizationId); }

  @Get('qc/templates')
  qcTemplates(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('quality');
    return this.service.qcTemplates(user, organizationId);
  }

  @Post('qc/templates')
  createQcTemplate(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('quality');
    return this.service.createQcTemplate(user, body);
  }

  @Post('qc/inspections')
  createQcInspection(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('quality');
    return this.service.createQcInspection(user, body);
  }

  @Patch('qc/inspections/:id/complete')
  completeQcInspection(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('quality');
    return this.service.completeQcInspection(user, id, body);
  }

  @Get('installations')
  installations(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('installation');
    return this.service.installations(user, organizationId);
  }

  @Post('installations')
  createInstallation(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('installation');
    return this.service.createInstallation(user, body);
  }

  @Patch('installations/:id/status')
  transitionInstallation(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('installation');
    return this.service.transitionInstallation(user, id, body);
  }

  @Get('warranty/assets')
  warrantyAssets(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) {
    assertWorkshopOperationsFeature('warranty');
    return this.service.warrantyAssets(user, organizationId);
  }

  @Post('warranty/assets')
  createWarrantyAsset(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('warranty');
    return this.service.createWarrantyAsset(user, body);
  }

  @Post('warranty/assets/:assetId/tickets')
  createWarrantyTicket(@CurrentUser() user: JwtUser, @Param('assetId') assetId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('warranty');
    return this.service.createWarrantyTicket(user, assetId, body);
  }

  @Post('warranty/tickets/:ticketId/events')
  addWarrantyServiceEvent(@CurrentUser() user: JwtUser, @Param('ticketId') ticketId: string, @Body() body: Record<string, unknown>) {
    assertWorkshopOperationsFeature('warranty');
    return this.service.addWarrantyServiceEvent(user, ticketId, body);
  }

  @Get('search')
  globalSearch(@CurrentUser() user: JwtUser, @Query('q') q = '', @Query('organizationId') organizationId?: string) { return this.service.globalSearch(user, q, organizationId); }

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser, @Query('organizationId') organizationId?: string) { return this.service.dashboard(user, organizationId); }

  @Post('sync/mutations')
  applyOfflineMutation(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) { return this.service.applyOfflineMutation(user, body); }

  @Post('events/dispatch')
  dispatchEvents(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    const organizationId = body.organizationId ? String(body.organizationId) : undefined;
    return this.eventWorker.health(user, organizationId).then(() => this.eventWorker.processBatch(organizationId));
  }
}
