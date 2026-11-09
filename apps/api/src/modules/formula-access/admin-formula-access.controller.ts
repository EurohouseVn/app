import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireModule } from '../../auth/module.decorator';
import { ModuleGuard } from '../../auth/module.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { formulaActor } from './formula-access.controller';
import { FormulaAccessService } from './formula-access.service';

class AdminActivateFormulaDto {
  @IsString()
  @IsOptional()
  nppOrganizationId?: string;
}
class AdminFormulaReasonDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
class AdminTransferFormulaDto extends AdminFormulaReasonDto {
  @IsString()
  nextNppOrganizationId!: string;
}

@Controller('admin/formula-access')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Roles('ADMIN', 'STAFF')
@RequireModule('users')
export class AdminFormulaAccessController {
  constructor(private readonly service: FormulaAccessService) {}

  @Get()
  list(@Query('status') status?: string, @Query('nppOrganizationId') nppOrganizationId?: string) {
    return this.service.adminList({ status, nppOrganizationId });
  }

  @Post(':organizationId/activate')
  activate(@CurrentUser() user: JwtUser | undefined, @Param('organizationId') organizationId: string, @Body() body: AdminActivateFormulaDto) {
    return this.service.activateDirect(formulaActor(user), organizationId, body.nppOrganizationId);
  }

  @Post(':organizationId/revoke')
  revoke(@CurrentUser() user: JwtUser | undefined, @Param('organizationId') organizationId: string, @Body() body: AdminFormulaReasonDto) {
    return this.service.revoke(formulaActor(user), organizationId, body.reason);
  }

  @Post(':organizationId/transfer-npp')
  transfer(@CurrentUser() user: JwtUser | undefined, @Param('organizationId') organizationId: string, @Body() body: AdminTransferFormulaDto) {
    return this.service.transferNpp(formulaActor(user), organizationId, body.nextNppOrganizationId, body.reason);
  }

  @Get(':organizationId/audit')
  audit(@Param('organizationId') organizationId: string) {
    return this.service.audit(organizationId);
  }
}

