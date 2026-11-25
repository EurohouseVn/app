import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NppGlassStockService } from './glass-stock.service';
import { NppStocktakeService } from './glass-stocktake.service';
import { fakeGlassPrisma } from './glass-test-fake';

async function setup() {
  const fake = fakeGlassPrisma();
  const stock = new NppGlassStockService(fake.prisma as never);
  const service = new NppStocktakeService(fake.prisma as never);
  const scheme = await stock.createScheme('npp-1', { prefix: 'CL8', glassType: 'Cường lực 8 ly' });
  let n = 0;
  const receive = (barcodeW: number, barcodeH: number, quantity: number, over: Record<string, unknown> = {}) =>
    stock.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: barcodeW, heightMm: barcodeH, quantity, location: 'Kệ A1', idempotencyKey: `seed-${++n}`, ...over } as never);
  const scan = (stocktakeId: string, barcode: string, key: string, over: Record<string, unknown> = {}, session = 'sid-1') =>
    service.addScan('npp-1', 'u', session, stocktakeId, { barcode, idempotencyKey: key, ...over } as never);
  return { ...fake, stock, service, scheme, receive, scan };
}

const lineOf = (summary: Awaited<ReturnType<NppStocktakeService['getSummary']>>, barcode: string, kind = 'SHEET', location = 'Kệ A1') =>
  summary.lines.find((l) => l.barcode === barcode && l.kind === kind && l.location === location);

test('creates an OPEN stocktake and lists it for the same NPP only', async () => {
  const { service } = await setup();
  const created = await service.createStocktake('npp-1', 'u', { name: 'Kiểm kê cuối tuần', location: 'Kệ A1' });
  assert.equal(created.status, 'OPEN');
  assert.equal(created.location, 'Kệ A1');
  assert.equal((await service.listStocktakes('npp-1')).length, 1);
  assert.equal((await service.listStocktakes('npp-2')).length, 0);
  await assert.rejects(service.getSummary('npp-2', created.id), NotFoundException);
});

test('several phones scanning the same code are added together', async () => {
  const { service, scan, receive } = await setup();
  await receive(600, 900, 5);
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  await scan(st.id, 'CL8-0600-0900', 'a1', {}, 'phone-1');
  await scan(st.id, 'CL8-0600-0900', 'b1', {}, 'phone-2');
  const last = await scan(st.id, 'cl8-0600-0900', 'c1', { quantity: 2 }, 'phone-3');
  assert.equal(last.counted, 4);
  const summary = await service.getSummary('npp-1', st.id);
  assert.equal(lineOf(summary, 'CL8-0600-0900')!.counted, 4);
  assert.equal(lineOf(summary, 'CL8-0600-0900')!.system, 5);
  assert.equal(lineOf(summary, 'CL8-0600-0900')!.delta, -1);
  assert.equal(summary.scanCount, 3);
  assert.equal(summary.deviceCount, 3);
});

test('a repeated scan key is counted once and returns the same count', async () => {
  const { service, scan, receive, tables } = await setup();
  await receive(600, 900, 5);
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  const first = await scan(st.id, 'CL8-0600-0900', 'same');
  const again = await scan(st.id, 'CL8-0600-0900', 'same');
  assert.equal(first.counted, 1);
  assert.equal(again.counted, 1);
  assert.equal(tables.stocktakeScans.length, 1);
});

test('a negative scan undoes a count but never below zero', async () => {
  const { service, scan, receive } = await setup();
  await receive(600, 900, 5);
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  await scan(st.id, 'CL8-0600-0900', 'a', { quantity: 3 });
  const undone = await scan(st.id, 'CL8-0600-0900', 'u1', { quantity: -1 });
  assert.equal(undone.counted, 2);
  await assert.rejects(scan(st.id, 'CL8-0600-0900', 'u2', { quantity: -3 }), BadRequestException);
  await assert.rejects(scan(st.id, 'CL8-0600-0900', 'z', { quantity: 0 }), BadRequestException);
});

test('the kind is inferred when only one exists, asked when several do, SHEET for unknown codes', async () => {
  const { service, scan, receive } = await setup();
  await receive(600, 900, 2, { kind: 'REMNANT' });
  await receive(700, 800, 1);
  await receive(700, 800, 1, { kind: 'CUT_PIECE' });
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  assert.equal((await scan(st.id, 'CL8-0600-0900', 'a')).kind, 'REMNANT');
  await assert.rejects(scan(st.id, 'CL8-0700-0800', 'b'), (e: any) => {
    assert.ok(e instanceof ConflictException);
    assert.equal(e.getResponse().code, 'AMBIGUOUS_KIND');
    assert.deepEqual(e.getResponse().kinds.sort(), ['CUT_PIECE', 'SHEET']);
    return true;
  });
  assert.equal((await scan(st.id, 'CL8-0700-0800', 'c', { kind: 'CUT_PIECE' })).kind, 'CUT_PIECE');
  assert.equal((await scan(st.id, 'CL8-0999-0999', 'd')).kind, 'SHEET');
});

test('scan input is validated', async () => {
  const { service, scan } = await setup();
  const st = await service.createStocktake('npp-1', 'u', { name: 'K' });
  await assert.rejects(scan(st.id, 'nonsense', 'a'), BadRequestException);
  await assert.rejects(scan(st.id, 'CL8-0600-0900', ''), BadRequestException);
  await assert.rejects(scan(st.id, 'CL8-0600-0900', 'b', { quantity: 1.5 }), BadRequestException);
  await assert.rejects(service.addScan('npp-2', 'u', 's', st.id, { barcode: 'CL8-0600-0900', idempotencyKey: 'x' } as never), NotFoundException);
});

test('summary lists unscanned stock at the location with counted 0, scoped by location, legacy rows excluded', async () => {
  const { service, scan, receive, prisma } = await setup();
  await receive(600, 900, 5);
  await receive(700, 800, 2);
  await receive(800, 900, 4, { location: 'Kệ B2' });
  await prisma.nppGlassSheet.create({ data: { nppOrgId: 'npp-1', code: 'old', glassType: '', widthMm: 100, heightMm: 100, quantity: 9, schemeId: null, kind: 'SHEET', location: 'Kệ A1', barcode: 'LEGACY-1' } });
  const scoped = await service.createStocktake('npp-1', 'u', { name: 'A1', location: 'Kệ A1' });
  await scan(scoped.id, 'CL8-0600-0900', 'a', { quantity: 5 });
  const summary = await service.getSummary('npp-1', scoped.id);
  assert.deepEqual(summary.lines.map((l) => l.barcode).sort(), ['CL8-0600-0900', 'CL8-0700-0800']);
  assert.equal(lineOf(summary, 'CL8-0700-0800')!.counted, 0);
  assert.equal(lineOf(summary, 'CL8-0700-0800')!.scanned, false);
  assert.equal(lineOf(summary, 'CL8-0600-0900')!.delta, 0);
  const all = await service.createStocktake('npp-1', 'u', { name: 'Tất cả' });
  const allSummary = await service.getSummary('npp-1', all.id);
  assert.equal(allSummary.lines.length, 3);
  assert.ok(!allSummary.lines.some((l) => l.barcode.startsWith('LEGACY-')));
});

test('apply sets stock to the counted numbers, writes ADJUST lines and is idempotent', async () => {
  const { service, scan, receive, tables } = await setup();
  await receive(600, 900, 5);
  await receive(700, 800, 2);
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  await scan(st.id, 'CL8-0600-0900', 'a', { quantity: 3 });
  const done = await service.applyStocktake('npp-1', 'u', st.id, { zeroUnscanned: false });
  assert.equal(done.status, 'APPLIED');
  const qty = (barcode: string) => tables.stocks.find((r) => r.barcode === barcode)?.quantity;
  assert.equal(qty('CL8-0600-0900'), 3);
  assert.equal(qty('CL8-0700-0800'), 2, 'unscanned lines are left alone by default');
  const adjusts = tables.moves.filter((m) => m.type === 'ADJUST');
  assert.equal(adjusts.length, 1);
  assert.equal(adjusts[0].direction, 'OUT');
  assert.equal(adjusts[0].quantity, 2);
  const before = tables.moves.length;
  const again = await service.applyStocktake('npp-1', 'u', st.id, { zeroUnscanned: false });
  assert.equal(again.status, 'APPLIED');
  assert.equal(tables.moves.length, before);
  assert.equal(qty('CL8-0600-0900'), 3);
});

test('apply adds stock when more pieces were counted than the system had', async () => {
  const { service, scan, receive, tables } = await setup();
  await receive(600, 900, 2);
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  await scan(st.id, 'CL8-0600-0900', 'a', { quantity: 5 });
  await service.applyStocktake('npp-1', 'u', st.id, { zeroUnscanned: false });
  assert.equal(tables.stocks.find((r) => r.barcode === 'CL8-0600-0900')!.quantity, 5);
  const adjust = tables.moves.find((m) => m.type === 'ADJUST')!;
  assert.equal(adjust.direction, 'IN');
  assert.equal(adjust.quantity, 3);
});

test('apply creates stock for a scanned code that was not in the warehouse, using the canonical barcode', async () => {
  const { service, scan, tables } = await setup();
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  await scan(st.id, 'CL8-0500-0999', 'a', { quantity: 4 });
  await service.applyStocktake('npp-1', 'u', st.id, { zeroUnscanned: false });
  const row = tables.stocks.find((r) => r.barcode === 'CL8-0500-0999')!;
  assert.equal(row.quantity, 4);
  assert.equal(row.widthMm, 500);
  assert.equal(row.heightMm, 999);
  assert.equal(row.kind, 'SHEET');
  assert.equal(row.location, 'Kệ A1');
  assert.ok(row.schemeId);
});

test('zeroUnscanned also zeroes the lines nobody scanned', async () => {
  const { service, scan, receive, tables } = await setup();
  await receive(600, 900, 5);
  await receive(700, 800, 2);
  const st = await service.createStocktake('npp-1', 'u', { name: 'K', location: 'Kệ A1' });
  await scan(st.id, 'CL8-0600-0900', 'a', { quantity: 5 });
  await service.applyStocktake('npp-1', 'u', st.id, { zeroUnscanned: true });
  assert.equal(tables.stocks.find((r) => r.barcode === 'CL8-0700-0800')!.quantity, 0);
  assert.equal(tables.stocks.find((r) => r.barcode === 'CL8-0600-0900')!.quantity, 5);
});

test('after apply or cancel the stocktake no longer accepts scans, and cancel only works while open', async () => {
  const { service, scan, receive } = await setup();
  await receive(600, 900, 5);
  const applied = await service.createStocktake('npp-1', 'u', { name: 'A' });
  await scan(applied.id, 'CL8-0600-0900', 'a');
  await service.applyStocktake('npp-1', 'u', applied.id, { zeroUnscanned: false });
  await assert.rejects(scan(applied.id, 'CL8-0600-0900', 'b'), /đã kết thúc/);
  await assert.rejects(service.cancelStocktake('npp-1', applied.id), /đã áp dụng/);
  const cancelled = await service.createStocktake('npp-1', 'u', { name: 'B' });
  assert.equal((await service.cancelStocktake('npp-1', cancelled.id)).status, 'CANCELLED');
  assert.equal((await service.cancelStocktake('npp-1', cancelled.id)).status, 'CANCELLED');
  await assert.rejects(scan(cancelled.id, 'CL8-0600-0900', 'c'), /đã kết thúc/);
  await assert.rejects(service.applyStocktake('npp-1', 'u', cancelled.id, { zeroUnscanned: false }), /đã hủy/);
});

test('apply is scoped to the NPP', async () => {
  const { service } = await setup();
  const st = await service.createStocktake('npp-1', 'u', { name: 'K' });
  await assert.rejects(service.applyStocktake('npp-2', 'u', st.id, { zeroUnscanned: false }), NotFoundException);
  await assert.rejects(service.cancelStocktake('npp-2', st.id), NotFoundException);
});

test('the ledger reason names the stocktake without repeating the words "Kiểm kê"', async () => {
  const { service, scan, receive, tables } = await setup();
  await receive(600, 900, 5);
  const named = await service.createStocktake('npp-1', 'u', { name: 'Kệ A1 cuối tuần', location: 'Kệ A1' });
  await scan(named.id, 'CL8-0600-0900', 'a', { quantity: 3 });
  await service.applyStocktake('npp-1', 'u', named.id, { zeroUnscanned: false });
  assert.equal(tables.moves.find((m) => m.type === 'ADJUST')!.reason, 'Kiểm kê · Kệ A1 cuối tuần');
  const prefixed = await service.createStocktake('npp-1', 'u', { name: 'Kiểm kê tháng 11', location: 'Kệ A1' });
  await scan(prefixed.id, 'CL8-0600-0900', 'b', { quantity: 1 });
  await service.applyStocktake('npp-1', 'u', prefixed.id, { zeroUnscanned: false });
  assert.equal(tables.moves.filter((m) => m.type === 'ADJUST')[1].reason, 'Kiểm kê tháng 11');
});
