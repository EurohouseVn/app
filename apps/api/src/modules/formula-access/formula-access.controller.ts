import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FormulaAccessService, type FormulaAccessActor } from './formula-access.service';

class RedeemFormulaInviteDto {
  @IsString()
  @MinLength(8)
  code!: string;
}

export function formulaActor(user?: JwtUser): FormulaAccessActor {
  if (!user) throw new UnauthorizedException();
  return { userId: user.sub, role: user.role, organizationId: user.organizationId };
}

@Controller('formula-access')
@UseGuards(JwtAuthGuard)
export class FormulaAccessController {
  constructor(private readonly service: FormulaAccessService) {}

  @Get('me')
  me(@CurrentUser() user?: JwtUser) {
    return this.service.getAccessView(formulaActor(user).organizationId);
  }

  @Post('redeem')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  redeem(@CurrentUser() user: JwtUser | undefined, @Body() body: RedeemFormulaInviteDto) {
    return this.service.redeemInvite(formulaActor(user), body.code);
  }
}
