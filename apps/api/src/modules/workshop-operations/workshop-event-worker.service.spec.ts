import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkshopEventWorkerService } from './workshop-event-worker.service';

const event = { id: 'event-1', organizationId: 'org-a', eventType: 'WORK_ORDER_READY', aggregateType: 'WorkshopWorkOrder', aggregateId: 'wo-1', status: 'PROCESSING', attempts: 1, createdAt: new Date(Date.now() - 1000) };

test('event consumer is idempotent when consumption already exists', async () => {
  let notificationWrites = 0;
  let published = false;
  const tx = {
    workshopEventConsumption: { findUnique: async () => ({ id: 'consumed' }), create: async () => { throw new Error('must not create duplicate consumption'); } },
    user: { findMany: async () => [{ id: 'u1' }] },
    notification: { createMany: async () => { notificationWrites += 1; } },
    workshopDomainEventOutbox: { update: async () => { published = true; } },
  };
  const prisma = {
    workshopDomainEventOutbox: { findFirst: async () => event },
    $transaction: async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
  };
  const worker = new WorkshopEventWorkerService(prisma as never);
  const ok = await (worker as unknown as { processEvent(id: string, token: string): Promise<boolean> }).processEvent('event-1', 'lock');
  assert.equal(ok, true);
  assert.equal(notificationWrites, 0);
  assert.equal(published, true);
});

test('fifth event failure moves event to dead-letter', async () => {
  let status = '';
  const prisma = {
    workshopDomainEventOutbox: {
      findFirst: async () => ({ ...event, attempts: 4 }),
      update: async ({ data }: { data: { status: string } }) => { status = data.status; },
    },
    $transaction: async () => { throw new Error('provider unavailable'); },
  };
  const worker = new WorkshopEventWorkerService(prisma as never);
  const ok = await (worker as unknown as { processEvent(id: string, token: string): Promise<boolean> }).processEvent('event-1', 'lock');
  assert.equal(ok, false);
  assert.equal(status, 'DEAD_LETTER');
});
