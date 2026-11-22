import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkshopPilotService } from './workshop-pilot.service';

const user = { sub: 'user-1', email: 'owner@example.com', role: 'FACTORY' as const, organizationId: 'org-a' };

test('tenant pilot config overrides global flags for exactly one organization', async () => {
  const prisma = {
    workshopPilotConfig: {
      findUnique: async ({ where }: { where: { organizationId: string } }) => where.organizationId === 'org-a' ? {
        active: true, survey: true, inventory: true, shopFloor: false, quality: true, installation: false, warranty: false, version: 3,
      } : null,
    },
  };
  const access = { organization: (_user: unknown, requested?: string) => requested || 'org-a' };
  const service = new WorkshopPilotService(prisma as never, {} as never, access as never);
  const flags = await service.flags(user, 'org-a');
  assert.equal(flags.source, 'TENANT_PILOT');
  assert.equal(flags.version, 3);
  assert.equal(flags.survey, true);
  assert.equal(flags.shopFloor, false);
});

test('inactive tenant config is an immediate rollback even when individual flags are true', async () => {
  const prisma = { workshopPilotConfig: { findUnique: async () => ({ active: false, survey: true, inventory: true, shopFloor: true, quality: true, installation: true, warranty: true, version: 4 }) } };
  const access = { organization: () => 'org-a' };
  const service = new WorkshopPilotService(prisma as never, {} as never, access as never);
  const flags = await service.flags(user);
  assert.equal(flags.source, 'TENANT_ROLLBACK');
  assert.equal(Object.entries(flags).filter(([key]) => !['source', 'version'].includes(key)).every(([, value]) => value === false), true);
});

test('organization without a tenant pilot config gets the core survey/project module only', async () => {
  const prisma = { workshopPilotConfig: { findUnique: async () => null } };
  const access = { organization: () => 'org-without-config' };
  const service = new WorkshopPilotService(prisma as never, {} as never, access as never);
  const flags = await service.flags(user);
  assert.equal(flags.source, 'NO_TENANT_CONFIG');
  assert.equal(flags.version, 0);
  assert.equal(flags.survey, true);
  const gated = Object.entries(flags).filter(([key]) => !['source', 'version', 'survey'].includes(key));
  assert.equal(gated.every(([, value]) => value === false), true);
});
