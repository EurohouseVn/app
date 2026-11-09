import test from 'node:test';
import assert from 'node:assert/strict';
import { FormulaAccessController } from './formula-access.controller';
import { NppFormulaAccessController } from './npp-formula-access.controller';

test('factory redeem always derives organization scope from the authenticated user', async () => {
  const service: any = {
    redeemInvite: async (actor: any, code: string) => ({ actor, code }),
  };
  const controller = new FormulaAccessController(service);
  const result: any = await controller.redeem(
    { sub: 'factory-user', role: 'FACTORY', organizationId: 'factory-from-jwt', email: 'x@y.vn' } as any,
    { code: 'EH-CODE', organizationId: 'forged-client-org' } as any,
  );
  assert.deepEqual(result.actor, {
    userId: 'factory-user',
    role: 'FACTORY',
    organizationId: 'factory-from-jwt',
  });
});

test('factory status returns persistent grant details for the authenticated organization', async () => {
  const service: any = { getAccessView: async (organizationId: string) => ({ organizationId, status: 'ACTIVE', nppOrganizationName: 'NPP A' }) };
  const controller = new FormulaAccessController(service);
  const result: any = await controller.me({ sub: 'factory-user', role: 'FACTORY', organizationId: 'factory-from-jwt' } as any);
  assert.deepEqual(result, { organizationId: 'factory-from-jwt', status: 'ACTIVE', nppOrganizationName: 'NPP A' });
});

test('NPP invite creation ignores forged NPP scope and enforces minimum search length', async () => {
  const service: any = {
    createInvite: async (actor: any, target: string) => ({ actor, target }),
    searchAccounts: async (actor: any, search: string) => ({ actor, search }),
  };
  const controller = new NppFormulaAccessController(service);
  const user = { sub: 'npp-user', role: 'NPP', organizationId: 'npp-from-jwt', email: 'npp@x.vn' } as any;
  const created: any = await controller.createInvite(user, {
    targetOrganizationId: 'factory-a',
    nppOrganizationId: 'forged-npp',
  } as any);
  assert.equal(created.actor.organizationId, 'npp-from-jwt');
  await assert.rejects(() => controller.search(user, '123'), /SEARCH_TERM_TOO_SHORT/);
});

test('search output masks email and phone identifiers', async () => {
  const service: any = {
    searchAccounts: async () => [{
      organizationId: 'factory-a',
      organizationName: 'Xưởng A',
      province: 'Hà Nội',
      email: 'owner@example.com',
      phone: '+84912345678',
      status: 'LOCKED',
    }],
  };
  const controller = new NppFormulaAccessController(service);
  const result: any[] = await controller.search(
    { sub: 'npp-user', role: 'NPP', organizationId: 'npp-a' } as any,
    'owner@example.com',
  );
  assert.equal(result[0].maskedEmail, 'ow***@example.com');
  assert.equal(result[0].maskedPhone, '+849***678');
  assert.equal('email' in result[0], false);
  assert.equal('phone' in result[0], false);
});
