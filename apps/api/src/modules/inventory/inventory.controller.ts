import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type {
  AdjustProfileStockInput,
  CreateMaterialInput,
  ApplyStocktakeInput,
  CreateNppCutPlanInput,
  CreateStocktakeInput,
  EnqueuePrintJobInput,
  CreateStockMovementInput,
  GlassCutPieceInput,
  NppCutPlanStatus,
  ReceiveNppGlassStockInput,
  ScanGlassStockInput,
  StocktakeScanInput,
  UpdateMaterialInput,
  UpsertNppAccessoryInput,
  NppAccessorySettings,
  ReadAccessoryPhotoInput,
  ReceiveAccessoriesInput,
  UpsertNppBarcodeSchemeInput,
  UpsertNppGlassSheetInput,
} from '@eurohouse/types';
import { NppGlassStockService } from './glass-stock.service';
import { NppGlassCuttingService } from './glass-cutting.service';
import { NppStocktakeService } from './glass-stocktake.service';
import { NppPrintService } from './glass-print.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { assertInventoryMutationAllowed, type InventoryOwnerType } from './inventory-mutation-policy';
import type { InventoryCommandContext } from './inventory-command.service';

function commandContext(user: JwtUser, idempotencyKey: string | undefined, ownerType: InventoryOwnerType, ownerId: string, command: string): InventoryCommandContext {
  if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required for inventory mutations.');
  assertInventoryMutationAllowed({ actorId: user.sub, role: user.role, organizationId: user.organizationId }, ownerType, ownerId);
  return { idempotencyKey, actorId: user.sub, organizationId: user.organizationId, ownerType, ownerId, command };
}

@Controller()
export class InventoryController {
  constructor(private readonly service: InventoryService, private readonly glass: NppGlassStockService, private readonly cutting: NppGlassCuttingService, private readonly stocktakes: NppStocktakeService, private readonly printing: NppPrintService) {}

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
  createStockMovement(@Body() body: CreateStockMovementInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    return this.service.createStockMovement(body, commandContext(user, key, 'COMPANY_STOCK', 'GLOBAL', 'MATERIAL_STOCK_MOVEMENT'));
  }

  @Get('profiles/:id/movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  profileMovements(@Param('id') id: string) {
    return this.service.listProfileMovements(id);
  }

  @Post('profiles/:id/stock-adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  adjustProfileStock(@Param('id') id: string, @Body() body: AdjustProfileStockInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    return this.service.adjustProfileStock(id, body, commandContext(user, key, 'COMPANY_STOCK', 'GLOBAL', 'PROFILE_STOCK_ADJUST'));
  }

  @Get('npp/inventory/profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppProfiles(@CurrentUser() user: JwtUser) {
    return this.service.listNppProfiles(user.organizationId!);
  }

  @Get('npp/inventory/movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppProfileMovements(@CurrentUser() user: JwtUser, @Query('profileId') profileId?: string) {
    return this.service.listNppProfileMovements(user.organizationId!, profileId);
  }

  @Post('npp/inventory/profiles/:id/stock-adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  adjustNppProfileStock(@Param('id') id: string, @Body() body: AdjustProfileStockInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    const ownerId = user.organizationId!;
    return this.service.adjustNppProfileStock(ownerId, id, body, commandContext(user, key, 'NPP_STOCK', ownerId, 'NPP_PROFILE_STOCK_ADJUST'));
  }

  @Get('npp/inventory/inbound-shipments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppInboundShipments(@CurrentUser() user: JwtUser) {
    return this.service.listNppInboundShipments(user.organizationId!);
  }

  @Post('npp/inventory/inbound-shipments/:id/receive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  receiveNppInboundShipment(@Param('id') id: string, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    const ownerId = user.organizationId!;
    return this.service.receiveNppInboundShipment(id, ownerId, commandContext(user, key, 'NPP_STOCK', ownerId, 'RECEIVE_NPP_INBOUND'));
  }

  @Get('npp/accessories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppAccessories(@CurrentUser() user: JwtUser, @Query('q') query?: string) {
    return this.service.listNppAccessories(user.organizationId!, query);
  }

  @Post('npp/accessories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppAccessory(@Body() body: UpsertNppAccessoryInput, @CurrentUser() user: JwtUser) {
    return this.service.createNppAccessory(user.organizationId!, body);
  }

  @Get('npp/accessory-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppAccessorySettings(@CurrentUser() user: JwtUser) {
    return this.service.getAccessorySettings(user.organizationId!);
  }

  @Put('npp/accessory-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  updateNppAccessorySettings(@Body() body: NppAccessorySettings, @CurrentUser() user: JwtUser) {
    return this.service.updateAccessorySettings(user.organizationId!, body);
  }

  @Post('npp/accessories/read-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  readNppAccessoryPhoto(@Body() body: ReadAccessoryPhotoInput) {
    return this.service.readAccessoryPhoto(body);
  }

  @Post('npp/accessories/receive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  receiveNppAccessories(@Body() body: ReceiveAccessoriesInput, @CurrentUser() user: JwtUser) {
    return this.service.receiveAccessories(user.organizationId!, body.lines);
  }

  @Patch('npp/accessories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  updateNppAccessory(@Param('id') id: string, @Body() body: Partial<UpsertNppAccessoryInput>, @CurrentUser() user: JwtUser) {
    return this.service.updateNppAccessory(user.organizationId!, id, body);
  }

  @Get('npp/glass/sheets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppGlassSheets(@CurrentUser() user: JwtUser) {
    return this.service.listNppGlassSheets(user.organizationId!);
  }

  @Post('npp/glass/sheets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppGlassSheet(@Body() body: UpsertNppGlassSheetInput, @CurrentUser() user: JwtUser) {
    return this.service.createNppGlassSheet(user.organizationId!, body);
  }

  @Post('npp/glass/cut-plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppGlassCutPlan(@Body() body: { sheetId: string; pieces: GlassCutPieceInput[] }, @CurrentUser() user: JwtUser) {
    return this.service.planNppGlassCut(user.organizationId!, body.sheetId, body.pieces ?? []);
  }

  @Get('npp/glass/schemes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppGlassSchemes(@CurrentUser() user: JwtUser) {
    return this.glass.listSchemes(user.organizationId!);
  }

  @Post('npp/glass/schemes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppGlassScheme(@Body() body: UpsertNppBarcodeSchemeInput, @CurrentUser() user: JwtUser) {
    return this.glass.createScheme(user.organizationId!, body);
  }

  @Patch('npp/glass/schemes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  updateNppGlassScheme(@Param('id') id: string, @Body() body: UpsertNppBarcodeSchemeInput, @CurrentUser() user: JwtUser) {
    return this.glass.updateScheme(user.organizationId!, id, body);
  }

  @Get('npp/glass/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppGlassStock(@CurrentUser() user: JwtUser) {
    return this.glass.listStock(user.organizationId!);
  }

  @Get('npp/glass/stock/lookup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  lookupNppGlassStock(@Query('code') code: string, @CurrentUser() user: JwtUser) {
    return this.glass.lookupByBarcode(user.organizationId!, code ?? '');
  }

  @Post('npp/glass/stock/scan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  scanNppGlassStock(@Body() body: ScanGlassStockInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    const input = { ...body, idempotencyKey: body.idempotencyKey || key || '' };
    if (body.mode === 'ISSUE') return this.glass.scanIssue(user.organizationId!, user.sub, input);
    if (body.mode === 'RECEIVE') return this.glass.scanReceive(user.organizationId!, user.sub, input);
    throw new BadRequestException('mode phải là RECEIVE hoặc ISSUE.');
  }

  @Post('npp/glass/stock/receive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  receiveNppGlassStock(@Body() body: ReceiveNppGlassStockInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    return this.glass.receiveStock(user.organizationId!, user.sub, { ...body, idempotencyKey: body.idempotencyKey || key || '' });
  }

  @Get('npp/glass/cut-plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppCutPlans(@CurrentUser() user: JwtUser, @Query('status') status?: NppCutPlanStatus) {
    return this.cutting.listPlans(user.organizationId!, status);
  }

  @Post('npp/glass/cut-plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppCutPlan(@Body() body: CreateNppCutPlanInput, @CurrentUser() user: JwtUser) {
    return this.cutting.createPlan(user.organizationId!, user.sub, body);
  }

  @Get('npp/glass/cut-plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppCutPlan(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.cutting.getPlan(user.organizationId!, id);
  }

  @Post('npp/glass/cut-plans/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  confirmNppCutPlan(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.cutting.confirmPlan(user.organizationId!, user.sub, id);
  }

  @Post('npp/glass/cut-plans/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  cancelNppCutPlan(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.cutting.cancelPlan(user.organizationId!, id);
  }

  @Get('npp/glass/stocktakes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppStocktakes(@CurrentUser() user: JwtUser) {
    return this.stocktakes.listStocktakes(user.organizationId!);
  }

  @Post('npp/glass/stocktakes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  createNppStocktake(@Body() body: CreateStocktakeInput, @CurrentUser() user: JwtUser) {
    return this.stocktakes.createStocktake(user.organizationId!, user.sub, body ?? {});
  }

  @Get('npp/glass/stocktakes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppStocktake(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.stocktakes.getSummary(user.organizationId!, id);
  }

  @Post('npp/glass/stocktakes/:id/scans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  scanNppStocktake(@Param('id') id: string, @Body() body: StocktakeScanInput, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    return this.stocktakes.addScan(user.organizationId!, user.sub, user.sid, id, { ...body, idempotencyKey: body.idempotencyKey || key || '' });
  }

  @Post('npp/glass/stocktakes/:id/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  applyNppStocktake(@Param('id') id: string, @Body() body: ApplyStocktakeInput, @CurrentUser() user: JwtUser) {
    return this.stocktakes.applyStocktake(user.organizationId!, user.sub, id, body ?? {});
  }

  @Post('npp/glass/stocktakes/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  cancelNppStocktake(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.stocktakes.cancelStocktake(user.organizationId!, id);
  }

  @Get('npp/print-jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppPrintJobs(@CurrentUser() user: JwtUser) {
    return this.printing.listJobs(user.organizationId!);
  }

  @Post('npp/print-jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  enqueueNppPrintJob(@Body() body: EnqueuePrintJobInput, @CurrentUser() user: JwtUser) {
    return this.printing.enqueue(user.organizationId!, user.sub, user.sid, body);
  }

  @Get('npp/print-jobs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  nppPrintJob(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.printing.getJob(user.organizationId!, id);
  }

  @Post('npp/print-jobs/:id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  completeNppPrintJob(@Param('id') id: string, @Body() body: { ok?: boolean; error?: string }, @CurrentUser() user: JwtUser) {
    return this.printing.complete(user.organizationId!, id, { ok: body?.ok !== false, error: body?.error });
  }

  @Get('npp/print-station/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  async nppPrintStationStatus(@CurrentUser() user: JwtUser) {
    return { online: await this.printing.stationOnline(user.organizationId!) };
  }

  @Post('npp/print-station/poll')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('NPP')
  pollNppPrintStation(@CurrentUser() user: JwtUser) {
    return this.printing.poll(user.organizationId!, user.sid);
  }

  @Get('inventory-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  getInventorySummary(@CurrentUser() user: JwtUser) {
    return this.service.getInventorySummary(user.sub);
  }

  @Get('inventory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  getUserInventory(@CurrentUser() user: JwtUser) {
    return this.service.getUserInventory(user.sub);
  }

  @Post('inventory/items/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
  adjustUserInventory(@CurrentUser() user: JwtUser, @Body() body: { materialCode?: string; lengthMm?: number; quantity?: number; type?: 'FULL_BAR' | 'DE_XE' }) {
    return this.service.adjustUserInventory(user.sub, body);
  }

  @Post('inventory/sync-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  syncOrderStock(@Body('orderId') orderId: string, @CurrentUser() user: JwtUser, @Headers('idempotency-key') key?: string) {
    return this.service.syncOrderStock(orderId, commandContext(user, key, 'COMPANY_STOCK', 'GLOBAL', 'SYNC_ORDER_STOCK'));
  }

  @Post('inventory/cut')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  cutProfile(
    @Body('profileId') profileId: string,
    @Body('cutLengths') cutLengths: number[],
    @Body('projectId') projectId: string | undefined,
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.cutProfile(profileId, cutLengths, projectId, commandContext(user, key, 'COMPANY_STOCK', 'GLOBAL', 'CUT_COMPANY_PROFILE'));
  }
}
