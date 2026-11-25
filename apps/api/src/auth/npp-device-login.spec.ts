import test from 'node:test';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { ConflictException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

async function build(role: string, sessions?: Record<string, unknown>) {
  const passwordHash = await bcrypt.hash('secret123', 4);
  const user = {
    id: 'u1', displayName: 'NPP Miền Nam', email: 'npp@example.com', emailNormalized: 'npp@example.com', phone: '', role, organizationId: 'org1',
    organization: { name: 'NPP Miền Nam', province: 'HCM' }, passwordHash, verifiedAt: new Date(), isCeo: false, moduleAccess: '[]', jobTitle: '',
  };
  const prisma: any = { user: { findFirst: async () => user } };
  const signed: any[] = [];
  const jwt = { signAsync: async (payload: unknown) => { signed.push(payload); return 'signed-jwt'; } };
  const service = new AuthService(prisma, jwt as never, {} as never, undefined, undefined, sessions as never);
  return { service, signed };
}

test('an NPP login registers a device session and the token carries its id', async () => {
  const registered: any[] = [];
  const { service, signed } = await build('NPP', { register: async (input: unknown) => { registered.push(input); return { id: 'sid-1' }; } });
  await service.login('npp@example.com', 'secret123', { kind: 'PHONE', label: 'iPhone của anh', userAgent: 'UA', revokeSessionId: 'old-1' });
  assert.equal(registered.length, 1);
  assert.deepEqual(registered[0], { userId: 'u1', organizationId: 'org1', kind: 'PHONE', label: 'iPhone của anh', userAgent: 'UA', revokeSessionId: 'old-1' });
  assert.equal(signed[0].sid, 'sid-1');
});

test('without device info the label falls back to a readable default and the kind to a computer', async () => {
  const registered: any[] = [];
  const { service } = await build('NPP', { register: async (input: unknown) => { registered.push(input); return { id: 'sid-2' }; } });
  await service.login('npp@example.com', 'secret123');
  assert.equal(registered[0].kind, 'DESKTOP');
  assert.equal(registered[0].label, 'Máy tính');
});

test('other roles never get a device session', async () => {
  let called = false;
  const { service, signed } = await build('FACTORY', { register: async () => { called = true; return { id: 'x' }; } });
  await service.login('npp@example.com', 'secret123', { kind: 'PHONE' });
  assert.equal(called, false);
  assert.equal(signed[0].sid, undefined);
});

test('a refused device limit stops the login and issues no token', async () => {
  const { service, signed } = await build('NPP', { register: async () => { throw new ConflictException({ code: 'DEVICE_LIMIT' }); } });
  await assert.rejects(service.login('npp@example.com', 'secret123', { kind: 'PHONE' }), ConflictException);
  assert.equal(signed.length, 0);
});

test('a wrong password never reaches the device registration', async () => {
  let called = false;
  const { service } = await build('NPP', { register: async () => { called = true; return { id: 'x' }; } });
  await assert.rejects(service.login('npp@example.com', 'wrong-password'), UnauthorizedException);
  assert.equal(called, false);
});

test('without a device session service an NPP login still works (no sid)', async () => {
  const { service, signed } = await build('NPP');
  await service.login('npp@example.com', 'secret123', { kind: 'PHONE' });
  assert.equal(signed[0].sid, undefined);
});

function contextWith(token?: string): ExecutionContext {
  const request = { headers: token ? { authorization: `Bearer ${token}` } : {}, user: undefined as unknown };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

test('the guard rejects a token whose device session was revoked', async () => {
  const jwt = { verify: () => ({ sub: 'u1', role: 'NPP', sid: 'sid-revoked' }) };
  const sessions = { assertActive: async (sid: string) => { if (sid === 'sid-revoked') throw new UnauthorizedException('đã bị đăng xuất'); } };
  const guard = new JwtAuthGuard(jwt as never, sessions as never);
  await assert.rejects(guard.canActivate(contextWith('t')), UnauthorizedException);
});

test('the guard accepts a live device session and exposes the sid on the user', async () => {
  const jwt = { verify: () => ({ sub: 'u1', role: 'NPP', sid: 'sid-ok' }) };
  const checked: string[] = [];
  const sessions = { assertActive: async (sid: string) => { checked.push(sid); } };
  const guard = new JwtAuthGuard(jwt as never, sessions as never);
  const context = contextWith('t');
  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(checked, ['sid-ok']);
  assert.equal((context.switchToHttp().getRequest() as { user: { sid: string } }).user.sid, 'sid-ok');
});

test('the guard does not check sessions for tokens without a sid, or when no service is wired', async () => {
  let called = false;
  const sessions = { assertActive: async () => { called = true; } };
  const jwt = { verify: () => ({ sub: 'u1', role: 'FACTORY' }) };
  assert.equal(await new JwtAuthGuard(jwt as never, sessions as never).canActivate(contextWith('t')), true);
  assert.equal(called, false);
  const withSid = { verify: () => ({ sub: 'u1', role: 'NPP', sid: 'sid-1' }) };
  assert.equal(await new JwtAuthGuard(withSid as never).canActivate(contextWith('t')), true);
});

test('the guard still rejects a missing or invalid token', async () => {
  const jwt = { verify: () => { throw new Error('bad'); } };
  await assert.rejects(new JwtAuthGuard(jwt as never).canActivate(contextWith()), UnauthorizedException);
  await assert.rejects(new JwtAuthGuard(jwt as never).canActivate(contextWith('t')), UnauthorizedException);
});
