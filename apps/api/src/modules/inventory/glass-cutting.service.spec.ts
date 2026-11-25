import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NppGlassStockService } from './glass-stock.service';
import { NppGlassCuttingService } from './glass-cutting.service';
import { fakeGlassPrisma } from './glass-test-fake';

async function setup() {
  const fake = fakeGlassPrisma();
  const stockService = new NppGlassStockService(fake.prisma as never);
  const service = new NppGlassCuttingService(fake.prisma as never);
  const scheme = await stockService.createScheme('npp-1', { prefix: 'CL8', glassType: 'Cường lực 8 ly' });
  const receive = (widthMm: number, heightMm: number, quantity: number, over: Record<string, unknown> = {}) =>
    stockService.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm, heightMm, quantity, location: 'Kệ A1', idempotencyKey: `rcv-${Math.random()}`, ...over } as never);
  return { ...fake, service, stockService, scheme, receive };
}

const stockQty = (tables: ReturnType<typeof fakeGlassPrisma>['tables'], barcode: string, kind = 'SHEET', location = 'Kệ A1') =>
  tables.stocks.find((r) => r.barcode === barcode && r.kind === kind && r.location === location)?.quantity;

test('creating a plan saves a DRAFT and does not touch stock', async () => {
  const { service, scheme, receive, tables } = await setup();
  await receive(2440, 3660, 3);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 4 }], options: { kerfMm: 3 } });
  assert.equal(plan.status, 'DRAFT');
  assert.equal(plan.schemePrefix, 'CL8');
  assert.equal(plan.result.totals.sheetsUsed, 1);
  assert.equal(plan.result.sheets[0].sourceBarcode, 'CL8-2440-3660');
  assert.equal(plan.result.sheets[0].sourceLocation, 'Kệ A1');
  assert.equal(stockQty(tables, 'CL8-2440-3660'), 3);
  assert.equal(tables.moves.filter((m) => m.type === 'CUT').length, 0);
  assert.equal(tables.plans.length, 1);
});

test('plan uses remnants before whole sheets and only stock of the chosen scheme in the same NPP', async () => {
  const { service, scheme, receive, stockService, tables } = await setup();
  await receive(2440, 3660, 2);
  await receive(1000, 1000, 1, { kind: 'REMNANT' });
  const other = await stockService.createScheme('npp-1', { prefix: 'KD5' });
  await stockService.receiveStock('npp-1', 'u', { schemeId: other.id, widthMm: 700, heightMm: 700, quantity: 9, idempotencyKey: 'other-scheme' });
  const otherOrgScheme = await stockService.createScheme('npp-2', { prefix: 'CL8' });
  await stockService.receiveStock('npp-2', 'u', { schemeId: otherOrgScheme.id, widthMm: 700, heightMm: 700, quantity: 9, idempotencyKey: 'other-org' });
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 800, heightMm: 800, quantity: 1 }] });
  assert.equal(plan.result.sheets.length, 1);
  assert.equal(plan.result.sheets[0].sourceKind, 'REMNANT');
  assert.equal(tables.plans.length, 1);
});

test('plan rejects an unknown or inactive scheme and invalid pieces', async () => {
  const { service, scheme, receive, stockService } = await setup();
  await receive(2440, 3660, 1);
  await assert.rejects(service.createPlan('npp-2', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 1 }] }), NotFoundException);
  await assert.rejects(service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 0, heightMm: 900, quantity: 1 }] }), BadRequestException);
  await assert.rejects(service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [] }), /ít nhất một/);
  await stockService.updateScheme('npp-1', scheme.id, { active: false });
  await assert.rejects(service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 1 }] }), /ngừng dùng/);
});

test('a plan with pieces that do not fit is saved but cannot be confirmed', async () => {
  const { service, scheme, receive } = await setup();
  await receive(1000, 1000, 1);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 900, heightMm: 900, quantity: 2 }] });
  assert.equal(plan.result.unplaced.length, 1);
  await assert.rejects(service.confirmPlan('npp-1', 'u', plan.id), /chưa xếp được/);
});

test('confirm deducts the sheets, adds remnants and cut pieces, and writes the ledger', async () => {
  const { service, scheme, receive, tables } = await setup();
  await receive(2440, 3660, 3);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 4 }], options: { kerfMm: 0, trimMm: 0, minRemnantMm: 300 } });
  const confirmed = await service.confirmPlan('npp-1', 'u', plan.id);
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.ok(confirmed.confirmedAt);
  assert.equal(stockQty(tables, 'CL8-2440-3660'), 2);
  assert.equal(stockQty(tables, 'CL8-0600-0900', 'CUT_PIECE'), 4);
  const remnantRows = tables.stocks.filter((r) => r.kind === 'REMNANT');
  assert.ok(remnantRows.length >= 1);
  for (const row of remnantRows) {
    assert.ok(Math.min(row.widthMm, row.heightMm) >= 300);
    assert.equal(row.location, 'Kệ A1');
    assert.equal(row.schemeId, scheme.id);
    assert.match(row.barcode, /^CL8-\d{4}-\d{4}$/);
  }
  const effects = confirmed.result.effects!;
  assert.deepEqual(effects.consumed.map((l) => [l.barcode, l.quantity]), [['CL8-2440-3660', 1]]);
  assert.equal(effects.pieces.reduce((n, l) => n + l.quantity, 0), 4);
  assert.equal(effects.remnants.reduce((n, l) => n + l.quantity, 0), confirmed.result.sheets.reduce((n, s) => n + s.remnants.length, 0));
  const types = tables.moves.map((m) => m.type);
  assert.ok(types.includes('CUT') && types.includes('REMNANT_IN') && types.includes('CUT_IN'));
});

test('confirming twice changes the stock only once', async () => {
  const { service, scheme, receive, tables } = await setup();
  await receive(2440, 3660, 3);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 4 }] });
  await service.confirmPlan('npp-1', 'u', plan.id);
  const movesAfterFirst = tables.moves.length;
  const again = await service.confirmPlan('npp-1', 'u', plan.id);
  assert.equal(again.status, 'CONFIRMED');
  assert.equal(stockQty(tables, 'CL8-2440-3660'), 2);
  assert.equal(tables.moves.length, movesAfterFirst);
});

test('confirm fails with a conflict when the stock dropped, and changes nothing', async () => {
  const { service, scheme, receive, stockService, tables } = await setup();
  await receive(2440, 3660, 1);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 2 }] });
  // có người dùng hết tấm trước khi chốt
  tables.stocks.find((r) => r.barcode === 'CL8-2440-3660')!.quantity = 0;
  const before = JSON.stringify(tables.stocks);
  await assert.rejects(service.confirmPlan('npp-1', 'u', plan.id), ConflictException);
  assert.equal(JSON.stringify(tables.stocks), before);
  assert.equal(tables.plans[0].status, 'DRAFT');
  assert.equal(tables.moves.filter((m) => m.type === 'CUT').length, 0);
  void stockService;
});

test('cancel works on a draft only and a cancelled plan cannot be confirmed', async () => {
  const { service, scheme, receive, tables } = await setup();
  await receive(2440, 3660, 2);
  const draft = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 1 }] });
  const cancelled = await service.cancelPlan('npp-1', draft.id);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal((await service.cancelPlan('npp-1', draft.id)).status, 'CANCELLED');
  await assert.rejects(service.confirmPlan('npp-1', 'u', draft.id), /đã hủy/);
  const second = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 1 }] });
  await service.confirmPlan('npp-1', 'u', second.id);
  await assert.rejects(service.cancelPlan('npp-1', second.id), /đã chốt/);
  assert.equal(stockQty(tables, 'CL8-2440-3660'), 1);
});

test('plans are scoped to the NPP', async () => {
  const { service, scheme, receive } = await setup();
  await receive(2440, 3660, 1);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 1 }] });
  await assert.rejects(service.getPlan('npp-2', plan.id), NotFoundException);
  await assert.rejects(service.confirmPlan('npp-2', 'u', plan.id), NotFoundException);
  await assert.rejects(service.cancelPlan('npp-2', plan.id), NotFoundException);
  assert.equal((await service.listPlans('npp-2')).length, 0);
  assert.equal((await service.listPlans('npp-1')).length, 1);
});

test('confirm retries when a concurrent request wins the same remnant row', async () => {
  const { service, scheme, receive, prisma, tables, hooks } = await setup();
  await receive(2440, 3660, 2);
  const plan = await service.createPlan('npp-1', 'u', { schemeId: scheme.id, pieces: [{ widthMm: 600, heightMm: 900, quantity: 1 }], options: { kerfMm: 0, minRemnantMm: 300 } });
  const realCreate = prisma.nppGlassSheet.create;
  let raced = false;
  prisma.nppGlassSheet.create = async (args: Record<string, any>) => {
    if (!raced && args.data.kind === 'REMNANT') {
      raced = true;
      hooks.afterRollback = () => { tables.stocks.push({ id: 'winner', note: '', unitCost: 0, createdAt: new Date(), updatedAt: new Date(), ...args.data, quantity: 5 }); };
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    }
    return realCreate(args);
  };
  const confirmed = await service.confirmPlan('npp-1', 'u', plan.id);
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(stockQty(tables, 'CL8-2440-3660'), 1);
  const winner = tables.stocks.find((r) => r.id === 'winner')!;
  assert.ok(winner.quantity >= 6, 'remnants were added on top of the winner row');
});
