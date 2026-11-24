import test from 'node:test';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

function fixture(existingUsers: any[] = [], verificationFailure?: Error) {
  const users = [...existingUsers];
  const organizations: any[] = [];
  const pilotConfigs: any[] = [];
  const prisma: any = {
    user: {
      findFirst: async ({ where }: any) => users.find((user) =>
        where.OR?.some((condition: any) =>
          condition.emailNormalized ? user.emailNormalized === condition.emailNormalized : user.phoneNormalized === condition.phoneNormalized,
        ),
      ) ?? null,
      findUnique: async ({ where }: any) => users.find((user) => user.id === where.id || user.email === where.email) ?? null,
      count: async ({ where }: any) => users.filter((user) => user.organizationId === where.organizationId && user.id !== where.id?.not && user.role !== where.role?.not).length,
      create: async ({ data }: any) => {
        const user = { id: `u${users.length + 1}`, isCeo: false, moduleAccess: '[]', jobTitle: '', ...data };
        users.push(user);
        return user;
      },
      update: async ({ where, data }: any) => {
        const user = users.find((item) => item.id === where.id)!;
        Object.assign(user, data);
        return user;
      },
      delete: async ({ where }: any) => { const index = users.findIndex((item) => item.id === where.id); if (index >= 0) users.splice(index, 1); },
    },
    organization: {
      create: async ({ data }: any) => {
        const organization = { id: `o${organizations.length + 1}`, ...data };
        organizations.push(organization);
        return organization;
      },
      findFirst: async () => null,
      update: async ({ where, data }: any) => { const org = organizations.find((item) => item.id === where.id)!; Object.assign(org, data); return org; },
      delete: async ({ where }: any) => { const index = organizations.findIndex((item) => item.id === where.id); if (index >= 0) organizations.splice(index, 1); },
    },
    verificationChallenge: { deleteMany: async () => ({ count: 0 }) },
    workshopPilotConfig: {
      create: async ({ data }: any) => { pilotConfigs.push(data); return data; },
      deleteMany: async ({ where }: any) => { for (let i = pilotConfigs.length - 1; i >= 0; i--) if (pilotConfigs[i].organizationId === where.organizationId) pilotConfigs.splice(i, 1); return { count: 0 }; },
    },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };
  const jwt = { signAsync: async () => 'signed-jwt' };
  const challenges: any[] = [];
  const verification = {
    create: async (userId: string, channel: string, target: string) => {
      if (verificationFailure) throw verificationFailure;
      challenges.push({ userId, channel, target });
      return { challengeId: 'challenge-1', expiresAt: new Date() };
    },
    confirm: async (userId: string) => ({
      userId,
      channel: challenges[0]?.channel ?? 'EMAIL',
      targetNormalized: challenges[0]?.target ?? 'user@example.com',
      consumedAt: new Date('2026-11-08T10:00:00.000Z'),
    }),
  };
  const service = new AuthService(prisma, jwt as never, verification as never);
  return { service, users, organizations, challenges, pilotConfigs };
}

test('public workshop registration grants registered modules but not Eurohouse formulas or ordering', async () => {
  const { service, users } = fixture();
  await service.registerWorkshop({
    displayName: 'Nguyễn An', organizationName: 'Xưởng Nhôm An', password: 'secret123', email: 'an@example.com',
  });
  const modules = JSON.parse(users[0].moduleAccess);
  assert.equal(modules.includes('factory:projects'), true);
  assert.equal(modules.includes('factory:orders'), false);
  assert.equal(modules.includes('factory:formulas'), false);
});

test('/auth/me exposes open formulas and locked ordering capabilities and the legacy formula projection', async () => {
  const user = {
    id: 'u1', displayName: 'An', email: 'an@example.com', phone: '', role: 'FACTORY',
    organizationId: 'o1', organization: { id: 'o1', name: 'Xưởng An', type: 'FACTORY', province: null },
    department: null, rbacRole: null, moduleAccess: '[]', isCeo: false, jobTitle: '',
    departmentId: null, rbacRoleId: null,
  };
  const { service } = fixture([user]);
  const result = await service.me('u1');
  assert.equal(result.capabilities.eurohouse.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(result.capabilities.eurohouse.features.EUROHOUSE_ORDERING.status, 'LOCKED');
  assert.equal(result.capabilities.formulas.status, 'ACTIVE');
});

test('registers email and optional phone workshops as unverified atomic tenants', async () => {
  for (const identities of [
    { email: 'owner@example.com' },
    { email: 'owner@example.com', phone: '0912345678' },
  ]) {
    const { service, users, organizations, challenges } = fixture();
    const result = await service.registerWorkshop({
      displayName: 'Nguyễn An',
      organizationName: 'Xưởng Nhôm An',
      password: 'secret123',
      ...identities,
    });
    assert.equal(result.pendingVerificationId, 'u1');
    assert.equal(organizations.length, 1);
    assert.match(organizations[0].code, /^CSSX-/);
    assert.equal(users[0].organizationId, organizations[0].id);
    assert.equal(users[0].verifiedAt, null);
    assert.equal(challenges.length, 1);
  }
});

test('always uses normalized email for new public workshop verification', async () => {
  const { service, challenges } = fixture();
  await service.registerWorkshop({
    displayName: 'Nguyễn An',
    organizationName: 'Xưởng Nhôm An',
    password: 'secret123',
    email: 'an@example.com',
    phone: '0912345678',
  });
  assert.deepEqual(challenges[0], { userId: 'u1', channel: 'EMAIL', target: 'an@example.com' });
});

test('rejects phone-only registration before creating a tenant', async () => {
  const phoneOnly = fixture();
  await assert.rejects(() => phoneOnly.service.registerWorkshop({ displayName: 'An', organizationName: 'Xưởng An', password: 'secret123', phone: '0912345678' } as never), /EMAIL_REQUIRED/);
  assert.equal(phoneOnly.users.length, 0);
  assert.equal(phoneOnly.organizations.length, 0);
});

test('delivery failure removes the newly created tenant so the identity can retry registration', async () => {
  const { service, users, organizations } = fixture([], new Error('VERIFICATION_DELIVERY_FAILED:503'));
  await assert.rejects(() => service.registerWorkshop({ displayName: 'An', organizationName: 'Xưởng An', password: 'secret123', email: 'an@example.com' }), /VERIFICATION_DELIVERY_FAILED/);
  assert.equal(users.length, 0);
  assert.equal(organizations.length, 0);
});

test('registration requires email and blocks normalized email duplicates', async () => {
  const { service } = fixture([
    { id: 'existing-email', emailNormalized: 'user@example.com' },
    { id: 'existing-phone', phoneNormalized: '+84912345678' },
  ]);
  const base = { displayName: 'User', organizationName: 'Xưởng User', password: 'secret123' };
  await assert.rejects(() => service.registerWorkshop(base as never), /EMAIL_REQUIRED/);
  await assert.rejects(
    () => service.registerWorkshop({ ...base, email: ' User@Example.com ' }),
    /IDENTIFIER_ALREADY_USED/,
  );
});

test('identifier login rejects unverified workshops and accepts normalized email or phone after verification', async () => {
  const passwordHash = await bcrypt.hash('secret123', 4);
  const baseUser = {
    id: 'u1',
    email: 'user@example.com',
    emailNormalized: 'user@example.com',
    phone: '0912345678',
    phoneNormalized: '+84912345678',
    displayName: 'User',
    passwordHash,
    role: 'FACTORY',
    organizationId: 'o1',
    organization: { id: 'o1', name: 'Xưởng User', type: 'FACTORY', province: null },
    department: null,
    rbacRole: null,
    moduleAccess: '[]',
    jobTitle: '',
    isCeo: false,
    departmentId: null,
    rbacRoleId: null,
    verifiedAt: null,
  };
  const { service, users } = fixture([baseUser]);
  await assert.rejects(() => service.login('USER@EXAMPLE.COM', 'secret123'), /VERIFICATION_REQUIRED/);
  users[0].verifiedAt = new Date();
  assert.equal((await service.login(' USER@example.com ', 'secret123')).user.token, 'signed-jwt');
  assert.equal((await service.login('+84912345678', 'secret123')).user.token, 'signed-jwt');
});

test('each newly registered workshop gets its own pilot config with every workshop module on', async () => {
  const { service, organizations, pilotConfigs } = fixture();
  await service.registerWorkshop({ displayName: 'An', organizationName: 'Xưởng An', password: 'secret123', email: 'an@example.com' });
  await service.registerWorkshop({ displayName: 'Bình', organizationName: 'Xưởng Bình', password: 'secret123', email: 'binh@example.com' });
  assert.equal(pilotConfigs.length, 2);
  assert.deepEqual(pilotConfigs.map((config) => config.organizationId), organizations.map((organization) => organization.id));
  for (const config of pilotConfigs) {
    assert.equal(config.active, true);
    for (const key of ['survey', 'inventory', 'shopFloor', 'quality', 'installation', 'warranty']) assert.equal(config[key], true, key);
  }
});

test('phone registration signs the workshop in at once without any verification challenge', async () => {
  const { service, users, organizations, challenges, pilotConfigs } = fixture();
  const result = await service.registerWorkshopByPhone({ organizationName: ' Xưởng Nhôm An ', address: '46 Lạc Long Quân, Hà Nội', phone: '0912 345 678', password: 'secret123' });
  assert.equal(result.user.token, 'signed-jwt');
  assert.equal(challenges.length, 0);
  assert.equal(users[0].phoneNormalized, '+84912345678');
  assert.equal(users[0].email, null);
  assert.equal(users[0].role, 'FACTORY');
  assert.ok(users[0].verifiedAt instanceof Date);
  assert.equal(users[0].verificationChannel, null);
  assert.equal(organizations[0].name, 'Xưởng Nhôm An');
  assert.equal(organizations[0].address, '46 Lạc Long Quân, Hà Nội');
  assert.equal(pilotConfigs.length, 1);
  assert.equal(JSON.parse(users[0].moduleAccess).includes('factory:orders'), false);
});

test('phone registration rejects bad phones, short passwords, missing fields and used numbers', async () => {
  const { service } = fixture();
  const base = { organizationName: 'Xưởng An', address: 'Hà Nội', phone: '0912345678', password: 'secret123' };
  await assert.rejects(() => service.registerWorkshopByPhone({ ...base, phone: '12345' }), /INVALID_IDENTIFIER/);
  await assert.rejects(() => service.registerWorkshopByPhone({ ...base, phone: 'an@example.com' }), /INVALID_IDENTIFIER/);
  await assert.rejects(() => service.registerWorkshopByPhone({ ...base, password: '123' }), /PASSWORD_TOO_SHORT/);
  await assert.rejects(() => service.registerWorkshopByPhone({ ...base, organizationName: ' ' }), /WORKSHOP_NAME_REQUIRED/);
  await assert.rejects(() => service.registerWorkshopByPhone({ ...base, address: '' }), /ADDRESS_REQUIRED/);
  await service.registerWorkshopByPhone(base);
  await assert.rejects(() => service.registerWorkshopByPhone({ ...base, phone: '+84 912 345 678' }), /IDENTIFIER_ALREADY_USED/);
});

async function seedPhoneWorkshop() {
  const ctx = fixture();
  await ctx.service.registerWorkshopByPhone({ organizationName: 'Xưởng An', address: 'Hà Nội', phone: '0912345678', password: 'secret123' });
  return ctx;
}

test('deleteAccount anonymizes the user and the sole-owner workshop contact data', async () => {
  const { service, users, organizations } = await seedPhoneWorkshop();
  const id = users[0].id;
  await service.deleteAccount(id, 'secret123');
  assert.equal(users[0].email, null);
  assert.equal(users[0].phone, null);
  assert.equal(users[0].phoneNormalized, null);
  assert.equal(users[0].role, 'DELETED');
  assert.equal(users[0].displayName, 'Tài khoản đã xóa');
  assert.equal(await bcrypt.compare('secret123', users[0].passwordHash), false);
  assert.equal(organizations[0].phone, null);
  assert.equal(organizations[0].address, null);
  assert.equal(organizations[0].name, 'Cơ sở đã xóa');
});

test('deleteAccount refuses a wrong password and changes nothing', async () => {
  const { service, users } = await seedPhoneWorkshop();
  await assert.rejects(() => service.deleteAccount(users[0].id, 'wrong-pass'), /INVALID_PASSWORD/);
  assert.equal(users[0].role, 'FACTORY');
  assert.equal(users[0].phoneNormalized !== null, true);
});

test('deleteAccount is not available to internal staff or NPP accounts', async () => {
  for (const role of ['ADMIN', 'STAFF', 'NPP']) {
    const { service } = fixture([{ id: 'x1', role, passwordHash: await bcrypt.hash('secret123', 4), organizationId: null }]);
    await assert.rejects(() => service.deleteAccount('x1', 'secret123'), /ACCOUNT_DELETE_NOT_ALLOWED/);
  }
});

test('deleted accounts can no longer log in or load /me', async () => {
  const { service, users } = await seedPhoneWorkshop();
  await service.deleteAccount(users[0].id, 'secret123');
  await assert.rejects(() => service.me(users[0].id), /không tồn tại/);
  await assert.rejects(() => service.login('0912345678', 'secret123'), /Sai tài khoản/);
});
