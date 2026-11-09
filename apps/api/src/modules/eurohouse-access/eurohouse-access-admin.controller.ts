import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireModule } from '../../auth/module.decorator';
import { ModuleGuard } from '../../auth/module.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import {
  AdminActivateFeatureDto,
  RevokeFeatureDto,
  TransferEurohouseNppDto,
} from './dto/eurohouse-access.dto';
import { eurohouseActor } from './eurohouse-access.controller';
import { EurohouseAccessService } from './eurohouse-access.service';

@Controller('admin/eurohouse-access')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('ADMIN', 'STAFF')
@RequireModule('users')
export class EurohouseAccessAdminController {
  constructor(private readonly service: EurohouseAccessService) {}

  @Get()
  list(
    @Query('featureKey') featureKey?: string,
    @Query('status') status?: string,
    @Query('nppOrganizationId') nppOrganizationId?: string,
    @Query('province') province?: string,
  ) {
    return this.service.adminList({ featureKey, status, nppOrganizationId, province });
  }

  @Post(':organizationId/activate')
  activate(
    @CurrentUser() user: JwtUser | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: AdminActivateFeatureDto,
  ) {
    return this.service.activateFeature(
      eurohouseActor(user),
      organizationId,
      body.featureKey,
      body.nppOrganizationId,
    );
  }

  @Post(':organizationId/revoke')
  revoke(
    @CurrentUser() user: JwtUser | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: RevokeFeatureDto,
  ) {
    return this.service.revokeFeature(
      eurohouseActor(user),
      organizationId,
      body.featureKey,
      body.reason,
    );
  }

  @Post(':organizationId/transfer-npp')
  transfer(
    @CurrentUser() user: JwtUser | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: TransferEurohouseNppDto,
  ) {
    return this.service.transferNpp(
      eurohouseActor(user),
      organizationId,
      body.nextNppOrganizationId,
      body.reason,
    );
  }

  @Get(':organizationId/audit')
  audit(@Param('organizationId') organizationId: string) {
    return this.service.audit(organizationId);
  }
}
