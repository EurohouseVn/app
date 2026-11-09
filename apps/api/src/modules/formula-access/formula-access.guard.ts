import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { FormulaAccessService } from './formula-access.service';

const DENIAL = {
  statusCode: 403,
  code: 'FORMULA_ACCESS_REQUIRED',
  message: 'Công thức Eurohouse chưa được kích hoạt cho cơ sở này.',
};

@Injectable()
export class FormulaAccessGuard implements CanActivate {
  constructor(private readonly service: FormulaAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException(DENIAL);

    if (user.role === 'ADMIN' || user.role === 'STAFF') {
      if (user.isCeo || user.modules?.includes('formulas')) return true;
      throw new ForbiddenException(DENIAL);
    }
    if (user.role === 'NPP') return true;
    if (!user.organizationId) throw new ForbiddenException(DENIAL);
    const capability = await this.service.getCapability(user.organizationId);
    if (capability.status !== 'ACTIVE') throw new ForbiddenException(DENIAL);
    return true;
  }
}

