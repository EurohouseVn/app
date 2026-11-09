import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { formulaActor } from './formula-access.controller';
import { FormulaAccessService } from './formula-access.service';

class CreateFormulaInviteDto {
  @IsString()
  targetOrganizationId!: string;
}
class RevokeFormulaAccessDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

function maskEmail(value?: string | null) {
  if (!value) return undefined;
  const at = value.indexOf('@');
  return at > 1 ? `${value.slice(0, 2)}***${value.slice(at)}` : `***${value.slice(at)}`;
}
function maskPhone(value?: string | null) {
  if (!value) return undefined;
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

@Controller('npp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('NPP')
export class NppFormulaAccessController {
  constructor(private readonly service: FormulaAccessService) {}

  @Get('formula-access/accounts')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async search(@CurrentUser() user: JwtUser | undefined, @Query('search') search: string) {
    if (!search || search.trim().length < 6) throw new BadRequestException('SEARCH_TERM_TOO_SHORT');
    const rows = await this.service.searchAccounts(formulaActor(user), search.trim());
    return rows.map(({ email, phone, ...row }) => ({ ...row, maskedEmail: maskEmail(email), maskedPhone: maskPhone(phone) }));
  }

  @Post('formula-invites')
  createInvite(@CurrentUser() user: JwtUser | undefined, @Body() body: CreateFormulaInviteDto) {
    return this.service.createInvite(formulaActor(user), body.targetOrganizationId);
  }

  @Get('formula-invites')
  listInvites(@CurrentUser() user?: JwtUser) {
    return this.service.listInvites(formulaActor(user));
  }

  @Post('formula-access/:organizationId/activate')
  activate(@CurrentUser() user: JwtUser | undefined, @Param('organizationId') organizationId: string) {
    return this.service.activateDirect(formulaActor(user), organizationId);
  }

  @Post('formula-access/:organizationId/revoke')
  revoke(@CurrentUser() user: JwtUser | undefined, @Param('organizationId') organizationId: string, @Body() body: RevokeFormulaAccessDto) {
    return this.service.revoke(formulaActor(user), organizationId, body.reason);
  }
}

