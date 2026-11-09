import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../auth/roles.decorator';
import { MODULE_KEY } from '../../auth/module.decorator';

const controllerPath = resolve(__dirname, 'eurohouse-access.controller.ts');
const adminControllerPath = resolve(__dirname, 'eurohouse-access-admin.controller.ts');

async function controllers() {
  assert.equal(existsSync(controllerPath), true, 'Eurohouse access controller must exist');
  assert.equal(existsSync(adminControllerPath), true, 'Eurohouse Admin controller must exist');
  return {
    ...(await import('./eurohouse-access.controller')),
    ...(await import('./eurohouse-access-admin.controller')),
    ...(await import('./dto/eurohouse-access.dto')),
  } as any;
}

const factoryUser = {
  sub: 'factory-user', role: 'FACTORY', organizationId: 'factory-from-jwt', email: 'factory@x.vn',
} as any;
const nppUser = {
  sub: 'npp-user', role: 'NPP', organizationId: 'npp-from-jwt', email: 'npp@x.vn',
} as any;
const staffUser = { sub: 'staff-user', role: 'STAFF', email: 'staff@x.vn' } as any;

test('DTO validation rejects an empty feature invite and unknown feature keys', async () => {
  const { CreateEurohouseInviteDto } = await controllers();
  const empty = Object.assign(new CreateEurohouseInviteDto(), {
    targetOrganizationId: 'factory-a', featureKeys: [],
  });
  const unknown = Object.assign(new CreateEurohouseInviteDto(), {
    targetOrganizationId: 'factory-a', featureKeys: ['UNKNOWN'],
  });
  const valid = Object.assign(new CreateEurohouseInviteDto(), {
    targetOrganizationId: 'factory-a', featureKeys: ['FORMULA_CUTTING'],
  });

  assert.ok((await validate(empty)).length > 0);
  assert.ok((await validate(unknown)).length > 0);
  assert.equal((await validate(valid)).length, 0);
});

test('customer routes derive organization from JWT and throttle code redemption', async () => {
  const { EurohouseAccessController } = await controllers();
  const service: any = {
    getAccessView: async (organizationId: string) => ({ organizationId }),
    redeemInvite: async (actor: any, code: string) => ({ actor, code }),
  };
  const controller = new EurohouseAccessController(service);

  assert.deepEqual(await controller.me(factoryUser), { organizationId: 'factory-from-jwt' });
  const redeemed = await controller.redeem(factoryUser, {
    code: 'EH-ONE-TIME', organizationId: 'forged',
  } as any);
  assert.equal(redeemed.actor.organizationId, 'factory-from-jwt');
  assert.equal(
    Reflect.getMetadata('THROTTLER:LIMITdefault', EurohouseAccessController.prototype.redeem),
    5,
  );
});

test('NPP routes mask identifiers and ignore every client-supplied NPP scope', async () => {
  const { NppEurohouseAccessController } = await controllers();
  const calls: any[] = [];
  const service: any = {
    searchAccounts: async () => [{
      organizationId: 'factory-a', organizationName: 'Xưởng A',
      email: 'owner@example.com', phone: '+84912345678',
    }],
    createInvite: async (...args: any[]) => { calls.push(args); return { plainCode: 'EH-CODE' }; },
    activateFeature: async (...args: any[]) => { calls.push(args); return {}; },
  };
  const controller = new NppEurohouseAccessController(service);

  const rows = await controller.search(nppUser, 'owner@example.com');
  assert.equal(rows[0].maskedEmail, 'ow***@example.com');
  assert.equal(rows[0].maskedPhone, '+849***678');
  assert.equal('email' in rows[0], false);
  assert.equal('phone' in rows[0], false);

  await controller.createInvite(nppUser, {
    targetOrganizationId: 'factory-a', featureKeys: ['FORMULA_CUTTING'],
    nppOrganizationId: 'forged-npp',
  } as any);
  await controller.activate(nppUser, 'factory-a', {
    featureKey: 'EUROHOUSE_ORDERING', nppOrganizationId: 'forged-npp',
  } as any);
  assert.equal(calls[0][0].organizationId, 'npp-from-jwt');
  assert.deepEqual(calls[0].slice(1), ['factory-a', ['FORMULA_CUTTING']]);
  assert.deepEqual(calls[1].slice(1), ['factory-a', 'EUROHOUSE_ORDERING']);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, NppEurohouseAccessController), ['NPP']);
});

test('Admin routes retain STAFF governance permission and pass explicit feature scope', async () => {
  const { EurohouseAccessAdminController } = await controllers();
  const calls: any[] = [];
  const service: any = {
    activateFeature: async (...args: any[]) => { calls.push(args); return {}; },
  };
  const controller = new EurohouseAccessAdminController(service);
  await controller.activate(staffUser, 'factory-a', {
    featureKey: 'FORMULA_CUTTING', nppOrganizationId: 'npp-a',
  });

  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, EurohouseAccessAdminController), ['ADMIN', 'STAFF']);
  assert.equal(Reflect.getMetadata(MODULE_KEY, EurohouseAccessAdminController), 'users');
  assert.deepEqual(calls[0].slice(1), ['factory-a', 'FORMULA_CUTTING', 'npp-a']);
});
