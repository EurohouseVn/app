import assert from 'node:assert/strict';
import test from 'node:test';
import type { JwtUser } from '../../auth/current-user.decorator';
import { WorkshopOperationsService } from './workshop-operations.service';

const factoryUser: JwtUser = {
  sub: 'user-a',
  email: 'a@example.com',
  role: 'FACTORY',
  organizationId: 'org-a',
};

test('deleting a project archives it even when installation and warranty records exist', async () => {
  let updateArgs: Record<string, unknown> | undefined;
  const prisma = {
    project: {
      findFirst: async () => ({ id: 'project-1', organizationId: 'org-a' }),
      update: async (args: Record<string, unknown>) => {
        updateArgs = args;
        return { id: 'project-1' };
      },
    },
    workshopInstallationJob: { count: async () => 1 },
    workshopWarrantyAsset: { count: async () => 1 },
  };
  const service = new WorkshopOperationsService(prisma as never, {} as never, {} as never);

  await assert.doesNotReject(() => service.deleteOperationsProject(factoryUser, 'project-1'));
  assert.equal((updateArgs?.where as { id?: string })?.id, 'project-1');
  assert.ok((updateArgs?.data as { archivedAt?: unknown })?.archivedAt instanceof Date);
});
