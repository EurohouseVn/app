import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NppGlassStockService } from './glass-stock.service';

type Row = Record<string, any>;

function fakePrisma() {
  const hooks: { afterRollback: (() => void) | null } = { afterRollback: null };
  const schemes: Row[] = [];
  const stocks: Row[] = [];
  const moves: Row[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}${++seq}`;
  const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => value === undefined || row[key] === value);
  const prisma: Row = {
    nppBarcodeScheme: {
      findMany: async ({ where }: Row) => schemes.filter((row) => matches(row, where)),
      findFirst: async ({ where }: Row) => schemes.find((row) => matches(row, where)) ?? null,
      create: async ({ data }: Row) => {
        if (schemes.some((row) => row.nppOrgId === data.nppOrgId && row.prefix === data.prefix)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const row = { id: nextId('sch'), label: '', glassType: '', thicknessMm: null, active: true, createdAt: new Date(), updatedAt: new Date(), ...data };
        schemes.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = schemes.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    nppGlassSheet: {
      findMany: async ({ where }: Row) => stocks.filter((row) => matches(row, where)),
      findUnique: async ({ where }: Row) => {
        if (where.id) return stocks.find((row) => row.id === where.id) ?? null;
        const key = where.nppOrgId_barcode_kind_location;
        return stocks.find((row) => row.nppOrgId === key.nppOrgId && row.barcode === key.barcode && row.kind === key.kind && row.location === key.location) ?? null;
      },
      create: async ({ data }: Row) => {
        const row = { id: nextId('stk'), note: '', unitCost: 0, quantity: 0, createdAt: new Date(), updatedAt: new Date(), ...data };
        stocks.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = stocks.find((item) => item.id === where.id)!;
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as Row)) row[key] += (value as Row).increment;
          else row[key] = value;
        }
        return row;
      },
    },
    nppGlassMovement: {
      findUnique: async ({ where }: Row) => {
        const key = where.nppOrgId_idempotencyKey;
        return moves.find((row) => row.nppOrgId === key.nppOrgId && row.idempotencyKey === key.idempotencyKey) ?? null;
      },
      create: async ({ data }: Row) => {
        const row = { id: nextId('mov'), createdAt: new Date(), ...data };
        moves.push(row);
        return row;
      },
    },
    // Giao dịch giả có hoàn tác như Postgres thật; afterRollback chèn dòng của "yêu cầu khác đã chốt" sau khi hoàn tác.
    $transaction: async (fn: (tx: Row) => unknown) => {
      const snapshot = { schemes: schemes.map((r) => ({ ...r })), stocks: stocks.map((r) => ({ ...r })), moves: moves.map((r) => ({ ...r })) };
      try {
        return await fn(prisma);
      } catch (error) {
        schemes.splice(0, schemes.length, ...snapshot.schemes);
        stocks.splice(0, stocks.length, ...snapshot.stocks);
        moves.splice(0, moves.length, ...snapshot.moves);
        const hook = hooks.afterRollback;
        hooks.afterRollback = null;
        hook?.();
        throw error;
      }
    },
  };
  return { prisma, schemes, stocks, moves, hooks };
}

function setup() {
  const fake = fakePrisma();
  return { ...fake, service: new NppGlassStockService(fake.prisma as never) };
}

test('creates a scheme with a normalized prefix and lists only that NPP schemes', async () => {
  const { service } = setup();
  const created = await service.createScheme('npp-1', { prefix: ' cl8 ', label: 'Cường lực 8 ly', glassType: 'Cường lực', thicknessMm: 8 });
  assert.equal(created.prefix, 'CL8');
  assert.equal(created.active, true);
  await service.createScheme('npp-2', { prefix: 'KD5' });
  const list = await service.listSchemes('npp-1');
  assert.deepEqual(list.map((item) => item.prefix), ['CL8']);
});

test('rejects an invalid or duplicate prefix inside the same NPP', async () => {
  const { service } = setup();
  await assert.rejects(service.createScheme('npp-1', { prefix: 'C' }), BadRequestException);
  await service.createScheme('npp-1', { prefix: 'CL8' });
  await assert.rejects(service.createScheme('npp-1', { prefix: 'cl8' }), /đã tồn tại/);
  await service.createScheme('npp-2', { prefix: 'CL8' });
});

test('updating a scheme cannot change its prefix and is scoped to the NPP', async () => {
  const { service } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  const updated = await service.updateScheme('npp-1', scheme.id, { label: 'Mới', active: false, prefix: 'XX9' } as never);
  assert.equal(updated.prefix, 'CL8');
  assert.equal(updated.label, 'Mới');
  assert.equal(updated.active, false);
  await assert.rejects(service.updateScheme('npp-2', scheme.id, { label: 'x' }), NotFoundException);
});

test('receive creates a stock row with the generated barcode and canonical sides', async () => {
  const { service, moves } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8', glassType: 'Cường lực 8 ly' });
  const item = await service.receiveStock('npp-1', 'user-1', { schemeId: scheme.id, widthMm: 3660, heightMm: 2440, quantity: 5, unitCost: 900000, location: 'Kệ A1', idempotencyKey: 'k1' });
  assert.equal(item.barcode, 'CL8-2440-3660');
  assert.equal(item.widthMm, 2440);
  assert.equal(item.heightMm, 3660);
  assert.equal(item.quantity, 5);
  assert.equal(item.glassType, 'Cường lực 8 ly');
  assert.equal(item.location, 'Kệ A1');
  assert.equal(item.kind, 'SHEET');
  assert.equal(moves.length, 1);
  assert.equal(moves[0].type, 'RECEIVE');
  assert.equal(moves[0].direction, 'IN');
  assert.equal(moves[0].quantity, 5);
});

test('receiving the same size and place again adds to the same row', async () => {
  const { service, stocks } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 2, idempotencyKey: 'a' });
  const second = await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 900, heightMm: 600, quantity: 3, idempotencyKey: 'b' });
  assert.equal(stocks.length, 1);
  assert.equal(second.quantity, 5);
});

test('same size in another location or kind is a separate row', async () => {
  const { service, stocks } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 1, location: 'A', idempotencyKey: 'a' });
  await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 1, location: 'B', idempotencyKey: 'b' });
  await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 1, location: 'A', kind: 'REMNANT', idempotencyKey: 'c' });
  assert.equal(stocks.length, 3);
});

test('repeating an idempotency key does not add the quantity twice', async () => {
  const { service, moves } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  const input = { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 4, idempotencyKey: 'same' };
  const first = await service.receiveStock('npp-1', 'u', input);
  const again = await service.receiveStock('npp-1', 'u', input);
  assert.equal(first.quantity, 4);
  assert.equal(again.quantity, 4);
  assert.equal(moves.length, 1);
});

test('receive rejects bad quantity, missing key, foreign or inactive scheme, bad size', async () => {
  const { service } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  const base = { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 1, idempotencyKey: 'k' };
  await assert.rejects(service.receiveStock('npp-1', 'u', { ...base, quantity: 0 }), BadRequestException);
  await assert.rejects(service.receiveStock('npp-1', 'u', { ...base, quantity: 1.5 }), BadRequestException);
  await assert.rejects(service.receiveStock('npp-1', 'u', { ...base, idempotencyKey: '' }), BadRequestException);
  await assert.rejects(service.receiveStock('npp-1', 'u', { ...base, widthMm: 0 }), BadRequestException);
  await assert.rejects(service.receiveStock('npp-1', 'u', { ...base, widthMm: 10000 }), BadRequestException);
  await assert.rejects(service.receiveStock('npp-2', 'u', base), NotFoundException);
  await service.updateScheme('npp-1', scheme.id, { active: false });
  await assert.rejects(service.receiveStock('npp-1', 'u', { ...base, idempotencyKey: 'k2' }), /ngừng dùng/);
});

test('a concurrent insert of the same row is retried and adds to the winner', async () => {
  const { service, prisma, stocks, hooks } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  const realCreate = prisma.nppGlassSheet.create;
  let raced = false;
  prisma.nppGlassSheet.create = async (args: Row) => {
    if (!raced) {
      raced = true;
      // yêu cầu khác đã chốt dòng này trước; giao dịch của ta thua ràng buộc duy nhất
      hooks.afterRollback = () => { stocks.push({ id: 'winner', note: '', unitCost: 0, createdAt: new Date(), updatedAt: new Date(), ...args.data, quantity: 1 }); };
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    }
    return realCreate(args);
  };
  const item = await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 2, idempotencyKey: 'r1' });
  assert.equal(stocks.length, 1);
  assert.equal(item.quantity, 3);
});

test('a concurrent duplicate idempotency key replays instead of failing', async () => {
  const { service, prisma, stocks, moves, hooks } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  const realMovementCreate = prisma.nppGlassMovement.create;
  let raced = false;
  prisma.nppGlassMovement.create = async (args: Row) => {
    if (!raced) {
      raced = true;
      // yêu cầu trùng khóa đã ghi xong dòng tồn và sổ trước khi yêu cầu này kịp ghi
      hooks.afterRollback = () => {
        stocks.push({ id: 'winner', nppOrgId: 'npp-1', code: 'x', glassType: '', widthMm: 600, heightMm: 900, quantity: 2, unitCost: 0, note: '', schemeId: scheme.id, kind: 'SHEET', location: '', barcode: 'CL8-0600-0900', createdAt: new Date(), updatedAt: new Date() });
        moves.push({ id: 'winner-move', nppOrgId: 'npp-1', stockId: 'winner', type: 'RECEIVE', quantity: 2, direction: 'IN', idempotencyKey: 'dup', createdAt: new Date() });
      };
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    }
    return realMovementCreate(args);
  };
  const item = await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 2, idempotencyKey: 'dup' });
  assert.equal(item.quantity, 2);
  assert.equal(stocks.length, 1);
  assert.equal(moves.length, 1);
});

test('lookup finds stock by scanned barcode, only inside the caller NPP', async () => {
  const { service } = setup();
  const scheme = await service.createScheme('npp-1', { prefix: 'CL8' });
  await service.receiveStock('npp-1', 'u', { schemeId: scheme.id, widthMm: 600, heightMm: 900, quantity: 2, location: 'A', idempotencyKey: 'a' });
  const other = await service.createScheme('npp-2', { prefix: 'CL8' });
  await service.receiveStock('npp-2', 'u', { schemeId: other.id, widthMm: 600, heightMm: 900, quantity: 9, idempotencyKey: 'b' });
  const found = await service.lookupByBarcode('npp-1', ' cl8-0600-0900 ');
  assert.equal(found.length, 1);
  assert.equal(found[0].quantity, 2);
  await assert.rejects(service.lookupByBarcode('npp-1', 'khong-phai-ma'), BadRequestException);
});
