import assert from 'node:assert/strict';
import test from 'node:test';
import { ManagedCuttingPlanService, type ManagedCuttingPlanResult } from './managed-cutting-plan.service';

test('committing a cutting plan consumes reused DC and stores generated DC exactly once', async () => {
  const calls = { decremented: 0, incremented: 0, scrapKg: 0, command: '' };
  const tx = {
    inventoryItem: {
      updateMany: async ({ data }: any) => { calls.decremented += data.quantity.decrement; return { count: 1 }; },
      findFirst: async () => ({ id: 'existing-remnant' }),
      update: async ({ data }: any) => { calls.incremented += data.quantity.increment; },
      create: async () => { throw new Error('existing DC should be incremented'); },
    },
    user: {
      update: async ({ data }: any) => { calls.scrapKg += data.scrapKg.increment; },
    },
  };
  const commands = {
    execute: async (context: any, _payload: unknown, handler: (transaction: any) => Promise<unknown>) => {
      calls.command = `${context.ownerType}:${context.ownerId}:${context.command}:${context.idempotencyKey}`;
      return handler(tx);
    },
  };
  const service = new ManagedCuttingPlanService({} as never, {} as never, {} as never, commands as never);
  const plan: ManagedCuttingPlanResult = {
    planRef: 'PC-TEST',
    generatedAt: new Date().toISOString(),
    sets: [],
    materials: [{
      materialCode: 'KH-TQ01', materialName: 'Ray khung', pieces: [1200], usedDeXeIds: ['old-remnant'],
      usedDeXe: [{ id: 'old-remnant', quantity: 2 }], newBarsNeeded: 1, newDeXeGenerated: [1500, 1500],
      kgPerMeter: 1, barLengthMm: 6000, inputKg: 6, newStockKg: 6, usedDeXeKg: 0,
      finishedKg: 2.5, reusableRemnantKg: 3, scrapGeneratedKg: 0.5, barLayouts: [],
    }],
    summary: {
      totalInputKg: 6, newStockKg: 6, reusedDeXeKg: 0, finishedKg: 2.5,
      reusableRemnantKg: 3, scrapKg: 0.5, newBars: 1, reusedDeXePieces: 2,
      reusableRemnantPieces: 2, massBalanceDifferenceKg: 0,
    },
  };
  service.preview = async () => plan;

  const result = await service.commitRemnants('worker-1', 'factory-1', { planRef: 'PC-TEST', sets: [] }, 'cut-plan-PC-TEST') as any;

  assert.equal(calls.command, 'USER_STOCK:worker-1:COMMIT_CUTTING_PLAN:cut-plan-PC-TEST');
  assert.equal(calls.decremented, 2);
  assert.equal(calls.incremented, 2);
  assert.equal(calls.scrapKg, 0.5);
  assert.equal(result.reusableRemnantPieces, 2);
});
