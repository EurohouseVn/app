import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import type { WorkshopOperationsFeature } from './workshop-operations.feature-flags';
import { WorkshopPilotService } from './workshop-pilot.service';

type PilotRequest = {
  user?: JwtUser;
  originalUrl?: string;
  url?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

const FEATURE_BY_PREFIX: Array<[string, WorkshopOperationsFeature]> = [
  ['/customers', 'survey'],
  ['/projects', 'survey'],
  ['/sites', 'survey'],
  ['/openings', 'survey'],
  ['/master-data', 'inventory'],
  ['/settings', 'inventory'],
  ['/teams', 'inventory'],
  ['/warehouses', 'inventory'],
  ['/machines', 'inventory'],
  ['/suppliers', 'inventory'],
  ['/inventory', 'inventory'],
  ['/price-books', 'inventory'],
  ['/price-book-versions', 'inventory'],
  ['/quick-quotes', 'inventory'],
  ['/work-orders', 'shopFloor'],
  ['/packages', 'shopFloor'],
  ['/qc', 'quality'],
  ['/installations', 'installation'],
  ['/warranty', 'warranty'],
];

@Injectable()
export class WorkshopPilotGuard implements CanActivate {
  constructor(private readonly pilot: WorkshopPilotService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PilotRequest>();
    if (!request.user) return false;
    const rawUrl = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const relativePath = rawUrl.replace(/^.*\/workshop\/v2/i, '');
    const feature = FEATURE_BY_PREFIX.find(([prefix]) => relativePath.startsWith(prefix))?.[1];
    if (!feature) return true;
    const organizationId = String(request.query?.organizationId ?? request.body?.organizationId ?? '') || undefined;
    if (await this.pilot.featureEnabled(request.user, feature, organizationId)) return true;
    throw new ServiceUnavailableException(`Module ${feature} chưa được bật cho cơ sở sản xuất này.`);
  }
}
