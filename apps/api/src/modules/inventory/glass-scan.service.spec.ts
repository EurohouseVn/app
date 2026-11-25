import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NppGlassStockService } from './glass-stock.service';
import { fakeGlassPrisma } from './glass-test-fake';

async function setup() {
  const fake = fakeGlassPrisma();
  const service = new NppGlassStockService(fake.prisma as never);
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8', glassType: 'Cường lực 8 ly' });
  const base = { quantity: 1, location: 'Kệ A1', note: '' };
  return { ...fake, service, scheme, base };
}

const qty = (tables: ReturnType<typeof fakeGlassPrisma>['tables'], barcode: string, kind = 'SHEET', location = 'Kệ A1') =>
  tables.stocks.find((r) => r.barcode === barcode && r.kind === kind && r.location === location)?.quantity;

test('scan receive adds one piece of the size encoded in the barcode', async () => {
  const { service, tables } = await setup();
  const item = await service.scanReceive('npp-1', 'u', { barcode: ' cl8-0600-0900 ', quantity: 1, location: 'Kệ A1', idempotencyKey: 's1' });
  assert.equal(item.barcode, 'CL8-0600-0900');
  assert.equal(item.widthMm, 600);
  assert.equal(item.heightMm, 900);
  assert.equal(item.quantity, 1);
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 2, location: 'Kệ A1', idempotencyKey: 's2' });
  assert.equal(qty(tables, 'CL8-0600-0900'), 3);
});

test('scan receive with the same idempotency key does not add twice', async () => {
  const { service, tables } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'dup' });
  const again = await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'dup' });
  assert.equal(again.quantity, 1);
  assert.equal(tables.moves.length, 1);
});

test('scan receive rejects bad barcodes, unknown or inactive prefixes', async () => {
  const { service, scheme } = await setup();
  await assert.rejects(service.scanReceive('npp-1', 'u', { barcode: 'khong-phai-ma', quantity: 1, idempotencyKey: 'a' }), BadRequestException);
  await assert.rejects(service.scanReceive('npp-1', 'u', { barcode: 'ZZ9-0600-0900', quantity: 1, idempotencyKey: 'b' }), /chưa được thiết lập/);
  await assert.rejects(service.scanReceive('npp-2', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'c' }), /chưa được thiết lập/);
  await service.updateScheme('npp-1', scheme.id, { active: false });
  await assert.rejects(service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'd' }), /ngừng dùng/);
});

test('scan issue takes one piece out and writes an ISSUE ledger line', async () => {
  const { service, tables, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, quantity: 5, idempotencyKey: 'seed' });
  const item = await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'out1', reason: 'Giao đơn 12' });
  assert.equal(item.quantity, 4);
  assert.equal(qty(tables, 'CL8-0600-0900'), 4);
  const move = tables.moves.find((m) => m.type === 'ISSUE')!;
  assert.equal(move.direction, 'OUT');
  assert.equal(move.quantity, 1);
  assert.equal(move.reason, 'Giao đơn 12');
});

test('scan issue never goes below zero and says so', async () => {
  const { service, tables, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, quantity: 1, idempotencyKey: 'seed' });
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 2, idempotencyKey: 'out' }), (e: any) => e instanceof ConflictException && /không đủ/i.test(e.message));
  assert.equal(qty(tables, 'CL8-0600-0900'), 1);
  assert.equal(tables.moves.filter((m) => m.type === 'ISSUE').length, 0);
});

test('scan issue of a code with no stock is a not-found, scoped to the NPP', async () => {
  const { service, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, idempotencyKey: 'seed' });
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'CL8-0700-0900', quantity: 1, idempotencyKey: 'x' }), NotFoundException);
  await assert.rejects(service.scanIssue('npp-2', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'y' }), NotFoundException);
});

test('scan issue asks which row when the same code is stocked in several places or kinds', async () => {
  const { service, tables } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 2, location: 'Kệ A1', idempotencyKey: 'a' });
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 3, location: 'Kệ B2', idempotencyKey: 'b' });
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, location: 'Kệ A1', kind: 'REMNANT', idempotencyKey: 'c' });
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'out' }), (e: any) => {
    assert.ok(e instanceof ConflictException);
    const body = e.getResponse();
    assert.equal(body.code, 'AMBIGUOUS_STOCK');
    assert.equal(body.options.length, 3);
    assert.deepEqual(body.options.map((o: any) => [o.kind, o.location, o.quantity]).sort(), [['REMNANT', 'Kệ A1', 1], ['SHEET', 'Kệ A1', 2], ['SHEET', 'Kệ B2', 3]]);
    return true;
  });
  const item = await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, kind: 'SHEET', location: 'Kệ B2', idempotencyKey: 'out2' });
  assert.equal(item.quantity, 2);
  assert.equal(qty(tables, 'CL8-0600-0900', 'SHEET', 'Kệ A1'), 2);
});

test('rows with zero stock are not offered or issued', async () => {
  const { service, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, location: 'Kệ A1', quantity: 1, idempotencyKey: 'a' });
  await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'out' });
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 4, location: 'Kệ B2', idempotencyKey: 'b' });
  const item = await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'out2' });
  assert.equal(item.location, 'Kệ B2');
  assert.equal(item.quantity, 3);
});

test('repeating an issue idempotency key does not take stock twice', async () => {
  const { service, tables, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, quantity: 5, idempotencyKey: 'seed' });
  await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'once' });
  const again = await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'once' });
  assert.equal(again.quantity, 4);
  assert.equal(qty(tables, 'CL8-0600-0900'), 4);
  assert.equal(tables.moves.filter((m) => m.type === 'ISSUE').length, 1);
});

test('scan issue rejects missing key, bad quantity and bad barcode', async () => {
  const { service, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, idempotencyKey: 'seed' });
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: '' }), BadRequestException);
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 0, idempotencyKey: 'k' }), BadRequestException);
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1.5, idempotencyKey: 'k' }), BadRequestException);
  await assert.rejects(service.scanIssue('npp-1', 'u', { barcode: 'nonsense', quantity: 1, idempotencyKey: 'k' }), BadRequestException);
});

test('a concurrent duplicate issue key replays instead of failing', async () => {
  const { service, prisma, tables, hooks, base } = await setup();
  await service.scanReceive('npp-1', 'u', { barcode: 'CL8-0600-0900', ...base, quantity: 5, idempotencyKey: 'seed' });
  const realCreate = prisma.nppGlassMovement.create;
  let raced = false;
  prisma.nppGlassMovement.create = async (args: Record<string, any>) => {
    if (!raced && args.data.type === 'ISSUE') {
      raced = true;
      // yêu cầu trùng khóa đã trừ kho và ghi sổ trước; giao dịch của ta thua ràng buộc duy nhất
      hooks.afterRollback = () => {
        const row = tables.stocks.find((r) => r.barcode === 'CL8-0600-0900')!;
        row.quantity -= 1;
        tables.moves.push({ id: 'winner', nppOrgId: 'npp-1', stockId: row.id, type: 'ISSUE', quantity: 1, direction: 'OUT', idempotencyKey: 'race', createdAt: new Date(), reason: '' });
      };
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    }
    return realCreate(args);
  };
  const item = await service.scanIssue('npp-1', 'u', { barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: 'race' });
  assert.equal(item.quantity, 4);
  assert.equal(tables.moves.filter((m) => m.type === 'ISSUE').length, 1);
});
