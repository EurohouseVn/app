import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import {
  CreateEurohouseInviteDto,
  FeatureMutationDto,
  RedeemEurohouseInviteDto,
  RevokeEurohouseInviteDto,
  RevokeFeatureDto,
} from './dto/eurohouse-access.dto';
import {
  EurohouseAccessService,
  type EurohouseAccessActor,
} from './eurohouse-access.service';

export function eurohouseActor(user?: JwtUser): EurohouseAccessActor {
  if (!user) throw new UnauthorizedException();
  return { userId: user.sub, role: user.role, organizationId: user.organizationId };
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

@Controller('eurohouse-access')
@UseGuards(JwtAuthGuard)
export class EurohouseAccessController {
  constructor(private readonly service: EurohouseAccessService) {}

  @Get('me')
  me(@CurrentUser() user?: JwtUser) {
    return this.service.getAccessView(eurohouseActor(user).organizationId);
  }

  @Post('redeem')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  redeem(@CurrentUser() user: JwtUser | undefined, @Body() body: RedeemEurohouseInviteDto) {
    return this.service.redeemInvite(eurohouseActor(user), body.code);
  }
}

@Controller('npp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('NPP')
export class NppEurohouseAccessController {
  constructor(private readonly service: EurohouseAccessService) {}

  @Get('eurohouse-access/accounts')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async search(@CurrentUser() user: JwtUser | undefined, @Query('search') search: string) {
    if (!search || search.trim().length < 6) {
      throw new BadRequestException('SEARCH_TERM_TOO_SHORT');
    }
    const rows = await this.service.searchAccounts(eurohouseActor(user), search.trim());
    return rows.map(({ email, phone, ...row }) => ({
      ...row,
      maskedEmail: maskEmail(email),
      maskedPhone: maskPhone(phone),
    }));
  }

  @Post('eurohouse-invites')
  createInvite(@CurrentUser() user: JwtUser | undefined, @Body() body: CreateEurohouseInviteDto) {
    return this.service.createInvite(
      eurohouseActor(user),
      body.targetOrganizationId,
      body.featureKeys,
    );
  }

  @Get('eurohouse-invites')
  listInvites(@CurrentUser() user?: JwtUser) {
    return this.service.listInvites(eurohouseActor(user));
  }

  @Post('eurohouse-invites/:inviteId/revoke')
  revokeInvite(
    @CurrentUser() user: JwtUser | undefined,
    @Param('inviteId') inviteId: string,
    @Body() body: RevokeEurohouseInviteDto,
  ) {
    return this.service.revokeInvite(eurohouseActor(user), inviteId, body.reason);
  }

  @Post('eurohouse-access/:organizationId/activate')
  activate(
    @CurrentUser() user: JwtUser | undefined,
    @Param('organizationId') organizationId: string,
    @Body() body: FeatureMutationDto,
  ) {
    return this.service.activateFeature(eurohouseActor(user), organizationId, body.featureKey);
  }

  @Post('eurohouse-access/:organizationId/revoke')
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
}
