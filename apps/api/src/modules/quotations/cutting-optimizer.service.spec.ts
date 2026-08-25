import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { calculateBarsNeeded, CuttingOptimizerService } from './cutting-optimizer.service';

function profile(systemCode = 'EU-55') {
  return {
    name: 'Thanh thử nghiệm',
    kgPerMeter: 1,
    barLengthMm: 6000,
    aluSystem: { code: systemCode, name: 'Hệ thử nghiệm' },
  };
}

function service(profiles = [profile()]) {
  const prisma = {
    profile: { findMany: async () => profiles },
    inventoryItem: { findMany: async () => [] },
  };
  return new CuttingOptimizerService(prisma as never);
}

test('a full-length piece does not create negative remaining capacity', async () => {
  const result = await service().optimizeCuts('worker', [{ materialCode: 'TEST', systemCode: 'EU-55', lengths: [6000] }]);
  assert.equal(result[0].barLayouts?.[0].remainingLengthMm, 0);
  assert.equal(result[0].scrapGeneratedKg, 0);
});

test('a piece longer than the catalog bar is rejected', async () => {
  await assert.rejects(
    service().optimizeCuts('worker', [{ materialCode: 'TEST', systemCode: 'EU-55', lengths: [6001] }]),
    BadRequestException,
  );
});

test('duplicate profile codes require an explicit matching system', async () => {
  await assert.rejects(
    service([profile('EU-55'), profile('EU-70')]).optimizeCuts('worker', [{ materialCode: 'TEST', lengths: [1000] }]),
    BadRequestException,
  );
});

test('bar planning groups cuts with blade loss', () => {
  assert.equal(calculateBarsNeeded([3000, 2995], 6000), 1);
  assert.equal(calculateBarsNeeded([3000, 3000], 6000), 2);
});
