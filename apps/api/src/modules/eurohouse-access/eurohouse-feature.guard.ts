import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EurohouseFeatureKey } from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { EurohouseAccessService } from './eurohouse-access.service';
import { EUROHOUSE_FEATURE_REQUIRED_KEY } from './eurohouse-feature.decorator';

function denial(featureKey: EurohouseFeatureKey) {
  const isOrdering = featureKey === 'EUROHOUSE_ORDERING';
  return {
    statusCode: 403,
    code: isOrdering ? 'EUROHOUSE_ORDERING_REQUIRED' : 'FORMULA_ACCESS_REQUIRED',
    message: isOrdering
      ? 'Tính năng đặt hàng chỉ áp dụng cho cơ sở đang sản xuất Nhôm Eurohouse.'
      : 'Công thức Eurohouse chưa được kích hoạt cho cơ sở này.',
  };
}

@Injectable()
export class EurohouseFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: EurohouseAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<EurohouseFeatureKey>(
      EUROHOUSE_FEATURE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException(denial(featureKey));
    if (user.role === 'ADMIN' || user.role === 'STAFF' || user.role === 'NPP') return true;
    if ((user.role !== 'FACTORY' && user.role !== 'DAILY') || !user.organizationId) {
      throw new ForbiddenException(denial(featureKey));
    }
    const capability = await this.service.getCapability(user.organizationId, featureKey);
    if (capability.status !== 'ACTIVE') throw new ForbiddenException(denial(featureKey));
    return true;
  }
}
