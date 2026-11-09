import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormulaAccessGuard } from './formula-access.guard';

function context(user: any) {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as any;
}

test('factory access is live from the grant and rejects locked, revoked, and missing organizations', async () => {
  let status: 'LOCKED' | 'ACTIVE' | 'REVOKED' = 'LOCKED';
  const guard = new FormulaAccessGuard({ getCapability: async () => ({ status, enabled: status === 'ACTIVE' }) } as any);
  const user = { sub: 'u1', role: 'FACTORY', organizationId: 'factory-a' };
  await assert.rejects(() => guard.canActivate(context(user)), (error: any) => {
    assert.equal(error.getResponse().code, 'FORMULA_ACCESS_REQUIRED');
    return true;
  });
  status = 'ACTIVE';
  assert.equal(await guard.canActivate(context(user)), true);
  status = 'REVOKED';
  await assert.rejects(() => guard.canActivate(context(user)), /Công thức Eurohouse chưa được kích hoạt/);
  await assert.rejects(() => guard.canActivate(context({ ...user, organizationId: undefined })), /Công thức Eurohouse chưa được kích hoạt/);
});

test('internal CEO bypasses module list while ordinary staff needs formulas module', async () => {
  const guard = new FormulaAccessGuard({ getCapability: async () => ({ status: 'LOCKED' }) } as any);
  assert.equal(await guard.canActivate(context({ sub: 'ceo', role: 'ADMIN', isCeo: true, modules: [] })), true);
  assert.equal(await guard.canActivate(context({ sub: 'staff', role: 'STAFF', modules: ['formulas'] })), true);
  await assert.rejects(() => guard.canActivate(context({ sub: 'staff', role: 'STAFF', modules: [] })), /Công thức Eurohouse chưa được kích hoạt/);
});

test('revocation after JWT issuance blocks the next request', async () => {
  let active = true;
  const guard = new FormulaAccessGuard({ getCapability: async () => ({ status: active ? 'ACTIVE' : 'REVOKED' }) } as any);
  const jwtUser = { sub: 'u1', role: 'FACTORY', organizationId: 'factory-a' };
  assert.equal(await guard.canActivate(context(jwtUser)), true);
  active = false;
  await assert.rejects(() => guard.canActivate(context(jwtUser)), /Công thức Eurohouse chưa được kích hoạt/);
});

