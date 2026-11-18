import test from 'node:test';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

function fixture(existingUsers: any[] = [], verificationFailure?: Error) {
  const users = [...existingUsers];
  const organizations: any[] = [];
  const prisma: any = {
    user: {
      findFirst: async ({ where }: any) => users.find((user) =>
        where.OR?.some((condition: any) =>
          condition.emailNormalized ? user.emailNormalized === condition.emailNormalized : user.phoneNormalized === condition.phoneNormalized,
        ),
      ) ?? null,
      findUnique: async ({ where }: any) => users.find((user) => user.id === where.id || user.email === where.email) ?? null,
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
      delete: async ({ where }: any) => { const index = organizations.findIndex((item) => item.id === where.id); if (index >= 0) organizations.splice(index, 1); },
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
  return { service, users, organizations, challenges };
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

test('/auth/me exposes independent locked Eurohouse capabilities and the legacy formula projection', async () => {
  const user = {
    id: 'u1', displayName: 'An', email: 'an@example.com', phone: '', role: 'FACTORY',
    organizationId: 'o1', organization: { id: 'o1', name: 'Xưởng An', type: 'FACTORY', province: null },
    department: null, rbacRole: null, moduleAccess: '[]', isCeo: false, jobTitle: '',
    departmentId: null, rbacRoleId: null,
  };
  const { service } = fixture([user]);
  const result = await service.me('u1');
  assert.equal(result.capabilities.eurohouse.features.FORMULA_CUTTING.status, 'LOCKED');
  assert.equal(result.capabilities.eurohouse.features.EUROHOUSE_ORDERING.status, 'LOCKED');
  assert.equal(result.capabilities.formulas.status, 'LOCKED');
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
