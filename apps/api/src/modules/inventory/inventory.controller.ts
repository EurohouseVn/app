import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type {
  AdjustProfileStockInput,
  CreateMaterialInput,
  CreateStockMovementInput,
  GlassCutPieceInput,
  UpdateMaterialInput,
  UpsertNppAccessoryInput,
  UpsertNppGlassSheetInput,
} from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';

@Controller()
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

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

  @Get('profiles/:id/movements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP')
  profileMovements(@Param('id') id: string) {
    return this.service.listProfileMovements(id);
  }

  @Post('profiles/:id/stock-adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'NPP')
  adjustProfileStock(@Param('id') id: string, @Body() body: AdjustProfileStockInput, @CurrentUser() user: JwtUser) {
    return this.service.adjustProfileStock(id, body, user.sub);
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
  adjustNppProfileStock(@Param('id') id: string, @Body() body: AdjustProfileStockInput, @CurrentUser() user: JwtUser) {
    return this.service.adjustNppProfileStock(user.organizationId!, id, body, user.sub);
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
  receiveNppInboundShipment(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.receiveNppInboundShipment(id, user.organizationId!, user.sub);
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

  @Post('inventory/sync-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY')
  syncOrderStock(@Body('orderId') orderId: string, @CurrentUser() user: JwtUser) {
    return this.service.syncOrderStock(orderId, user.sub);
  }

  @Post('inventory/cut')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF', 'FACTORY')
  cutProfile(
    @Body('profileId') profileId: string,
    @Body('cutLengths') cutLengths: number[],
    @Body('projectId') projectId: string | undefined,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.cutProfile(profileId, cutLengths, projectId, user.sub);
  }
}
