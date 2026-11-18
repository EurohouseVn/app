import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { QuotationBomService } from './quotation-bom.service';

function service(formulaCode = 'C3328m') {
  const prisma = {
    aluSystem: { findMany: async () => [{ id: 'system-55', code: 'EU-55', name: 'Hệ 55 Vát Cạnh' }] },
    profile: {
      findMany: async () => [{
        id: 'profile-c3328',
        aluSystemId: 'system-55',
        code: 'C3328',
        name: 'Khung cửa đi',
        kgPerMeter: 1,
        barLengthMm: 6000,
      }],
    },
    systemFormula: { findMany: async () => [] },
  };
  const formulas = {
    evaluateTemplate: async () => ({
      aluminum: [{ code: formulaCode, length_mm: 3000, quantity: 2 }],
    }),
  };
  return new QuotationBomService(prisma as never, formulas as never);
}

const quotationItem = {
  templateId: 'template-1',
  system: 'EU-55',
  widthMm: 1200,
  heightMm: 2200,
  quantity: 1,
  color: 'CAFE_METALIC',
  dynamicInputs: {},
};

test('quotation BOM maps formula suffix codes only inside the selected Eurohouse system', async () => {
  const result = await service().buildOrderItems([quotationItem], { defaultColor: 'CAFE_METALIC' });
  assert.equal(result[0].profileId, 'profile-c3328');
  assert.equal(result[0].quantity, 2);
});

test('quotation BOM rejects unmapped reference codes instead of selecting an arbitrary profile', async () => {
  await assert.rejects(
    service('NSVN-3318').buildOrderItems([quotationItem], { defaultColor: 'CAFE_METALIC' }),
    BadRequestException,
  );
});

test('quotation BOM uses the saved formula snapshot instead of recalculating a changed template', async () => {
  const result = await service('NSVN-3318').buildOrderItems([{
    ...quotationItem,
    formulaSnapshot: {
      templateId: 'template-1',
      capturedAt: '2026-08-25T00:00:00.000Z',
      result: { aluminum: [{ code: 'C3328m', length_mm: 3000, quantity: 2 }] },
    },
  }], { defaultColor: 'CAFE_METALIC' });
  assert.equal(result[0].profileId, 'profile-c3328');
  assert.equal(result[0].quantity, 2);
});

test('quotation BOM evaluates a published WebAdmin managed formula', async () => {
  const prisma = {
    aluSystem: { findMany: async () => [{ id: 'system-55', code: 'EU-55', name: 'Hệ 55 Vát Cạnh' }] },
    profile: { findMany: async () => [{ id: 'profile-c3328', aluSystemId: 'system-55', code: 'C3328', name: 'Khung cửa đi', kgPerMeter: 1, barLengthMm: 6000 }] },
    systemFormula: { findMany: async () => [{ id: 'managed-1' }] },
  };
  let managedCalled = false;
  const formulas = {
    evaluateTemplate: async () => { throw new Error('Không được dùng engine legacy.'); },
    evaluateManagedFormula: async () => {
      managedCalled = true;
      return { aluminum: [{ code: 'C3328', length_mm: 3000, quantity: 2 }] };
    },
  };
  const bom = new QuotationBomService(prisma as never, formulas as never);
  const result = await bom.buildOrderItems([{ ...quotationItem, templateId: 'managed-1' }], { defaultColor: 'CAFE_METALIC' });
  assert.equal(managedCalled, true);
  assert.equal(result[0].quantity, 2);
});
