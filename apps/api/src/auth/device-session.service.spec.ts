import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DEVICE_LIMITS, DEVICE_SESSION_TTL_MS, DeviceSessionService, resolveDeviceKind } from './device-session.service';

type Row = Record<string, any>;

function fake() {
  const rows: Row[] = [];
  let seq = 0;
  const matchValue = (actual: any, expected: any): boolean => {
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('gt' in expected) return actual > expected.gt;
      if ('lt' in expected) return actual < expected.lt;
      if ('not' in expected) return actual !== expected.not;
    }
    return expected === undefined || actual === expected;
  };
  const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([k, v]) => matchValue(row[k], v));
  const prisma: Row = {
    nppDeviceSession: {
      create: async ({ data }: Row) => { const row = { id: `sid${++seq}`, label: '', userAgent: '', revokedAt: null, createdAt: new Date(), lastSeenAt: new Date(), ...data }; rows.push(row); return row; },
      findMany: async ({ where }: Row) => rows.filter((r) => matches(r, where)).sort((a, b) => a.createdAt - b.createdAt),
      findFirst: async ({ where }: Row) => rows.find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where }: Row) => rows.find((r) => r.id === where.id) ?? null,
      updateMany: async ({ where, data }: Row) => { const hit = rows.filter((r) => matches(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length }; },
    },
    $executeRaw: async () => 0,
    $transaction: async (fn: (tx: Row) => unknown) => fn(prisma),
  };
  return { prisma, rows };
}

const login = (service: DeviceSessionService, kind: 'DESKTOP' | 'PHONE', over: Row = {}) =>
  service.register({ userId: 'u1', organizationId: 'org1', kind, label: `${kind} máy`, ...over });

test('limits are 2 computers and 3 phones per organisation', () => {
  assert.deepEqual(DEVICE_LIMITS, { DESKTOP: 2, PHONE: 3 });
});

test('device kind comes from the header first, then the user agent, defaulting to a computer', () => {
  assert.equal(resolveDeviceKind('phone', 'Mozilla/5.0 (Windows NT 10.0)'), 'PHONE');
  assert.equal(resolveDeviceKind('DESKTOP', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'DESKTOP');
  assert.equal(resolveDeviceKind(undefined, 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari'), 'PHONE');
  assert.equal(resolveDeviceKind(undefined, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'PHONE');
  assert.equal(resolveDeviceKind(undefined, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'), 'DESKTOP');
  assert.equal(resolveDeviceKind('weird', undefined), 'DESKTOP');
  assert.equal(resolveDeviceKind(undefined, undefined), 'DESKTOP');
});

test('registering creates an active session', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const { id } = await login(service, 'PHONE');
  assert.ok(id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'PHONE');
  assert.equal(rows[0].nppOrgId, 'org1');
});

test('a 4th phone is refused with the list of phones to choose from', async () => {
  const { prisma } = fake();
  const service = new DeviceSessionService(prisma as never);
  for (let i = 0; i < 3; i++) await login(service, 'PHONE', { label: `Phone ${i + 1}` });
  await assert.rejects(login(service, 'PHONE'), (error: any) => {
    assert.ok(error instanceof ConflictException);
    const body = error.getResponse();
    assert.equal(body.code, 'DEVICE_LIMIT');
    assert.equal(body.kind, 'PHONE');
    assert.equal(body.limit, 3);
    assert.equal(body.devices.length, 3);
    assert.deepEqual(body.devices.map((d: any) => d.label), ['Phone 1', 'Phone 2', 'Phone 3']);
    return true;
  });
});

test('computers and phones are limited independently', async () => {
  const { prisma } = fake();
  const service = new DeviceSessionService(prisma as never);
  for (let i = 0; i < 3; i++) await login(service, 'PHONE');
  await login(service, 'DESKTOP');
  await login(service, 'DESKTOP');
  await assert.rejects(login(service, 'DESKTOP'), ConflictException);
});

test('choosing a session of the same kind replaces it', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const first = await login(service, 'PHONE');
  await login(service, 'PHONE');
  await login(service, 'PHONE');
  const fresh = await login(service, 'PHONE', { revokeSessionId: first.id });
  assert.ok(fresh.id);
  assert.ok(rows.find((r) => r.id === first.id)!.revokedAt);
  assert.equal(rows.filter((r) => !r.revokedAt && r.kind === 'PHONE').length, 3);
});

test('a session of another organisation or kind cannot be used to make room', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const otherOrg = await service.register({ userId: 'x', organizationId: 'org2', kind: 'PHONE', label: 'khác' });
  const desktop = await login(service, 'DESKTOP');
  for (let i = 0; i < 3; i++) await login(service, 'PHONE');
  await assert.rejects(login(service, 'PHONE', { revokeSessionId: otherOrg.id }), ConflictException);
  await assert.rejects(login(service, 'PHONE', { revokeSessionId: desktop.id }), ConflictException);
  assert.equal(rows.find((r) => r.id === otherOrg.id)!.revokedAt, null);
  assert.equal(rows.find((r) => r.id === desktop.id)!.revokedAt, null);
});

test('revoked and expired sessions do not count against the limit', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const a = await login(service, 'PHONE');
  const b = await login(service, 'PHONE');
  await login(service, 'PHONE');
  await service.revokeById(a.id);
  rows.find((r) => r.id === b.id)!.createdAt = new Date(Date.now() - DEVICE_SESSION_TTL_MS - 1000);
  await login(service, 'PHONE');
  await login(service, 'PHONE');
  assert.equal(rows.filter((r) => !r.revokedAt && r.createdAt > new Date(Date.now() - DEVICE_SESSION_TTL_MS)).length, 3);
});

test('assertActive accepts a live session and rejects revoked, expired and unknown ones', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const live = await login(service, 'PHONE');
  await service.assertActive(live.id);
  const revoked = await login(service, 'DESKTOP');
  await service.revokeById(revoked.id);
  await assert.rejects(service.assertActive(revoked.id), UnauthorizedException);
  const old = await login(service, 'DESKTOP');
  rows.find((r) => r.id === old.id)!.createdAt = new Date(Date.now() - DEVICE_SESSION_TTL_MS - 1000);
  await assert.rejects(service.assertActive(old.id), UnauthorizedException);
  await assert.rejects(service.assertActive('does-not-exist'), UnauthorizedException);
});

test('assertActive refreshes lastSeenAt at most once a minute', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const { id } = await login(service, 'PHONE');
  const row = rows.find((r) => r.id === id)!;
  const fresh = row.lastSeenAt;
  await service.assertActive(id);
  assert.equal(row.lastSeenAt, fresh);
  row.lastSeenAt = new Date(Date.now() - 120_000);
  await service.assertActive(id);
  assert.ok(Date.now() - row.lastSeenAt.getTime() < 5000);
});

test('listActive is scoped to the organisation and marks the current device', async () => {
  const { prisma } = fake();
  const service = new DeviceSessionService(prisma as never);
  const mine = await login(service, 'PHONE', { label: 'Của tôi' });
  await login(service, 'DESKTOP', { label: 'Máy tính' });
  await service.register({ userId: 'x', organizationId: 'org2', kind: 'PHONE', label: 'NPP khác' });
  const revoked = await login(service, 'PHONE', { label: 'Đã gỡ' });
  await service.revokeById(revoked.id);
  const list = await service.listActive('org1', mine.id);
  assert.deepEqual(list.map((d) => d.label).sort(), ['Máy tính', 'Của tôi'].sort());
  assert.equal(list.find((d) => d.label === 'Của tôi')!.current, true);
  assert.equal(list.find((d) => d.label === 'Máy tính')!.current, false);
});

test('revoke is scoped to the organisation', async () => {
  const { prisma, rows } = fake();
  const service = new DeviceSessionService(prisma as never);
  const { id } = await login(service, 'PHONE');
  await assert.rejects(service.revoke('org2', id), NotFoundException);
  await service.revoke('org1', id);
  assert.ok(rows.find((r) => r.id === id)!.revokedAt);
  await assert.rejects(service.revoke('org1', 'missing'), NotFoundException);
});
