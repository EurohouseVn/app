import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../../auth/auth.service';
import { FormulaAccessGuard } from './formula-access.guard';
import { FormulaAccessService } from './formula-access.service';

function fixture() {
  const organizations: any[] = [{ id: 'npp-a', code: 'NPP-A', name: 'NPP A', type: 'NPP', managedByNppId: null, province: null }];
  const users: any[] = [{ id: 'npp-user', email: 'npp@example.com', role: 'NPP', organizationId: 'npp-a', displayName: 'NPP A' }];
  const invites: any[] = [];
  const grants: any[] = [];
  const audits: any[] = [];
  const prisma: any = {
    user: {
      findFirst: async ({ where }: any) => users.find((user) => where.OR?.some((condition: any) => condition.emailNormalized ? user.emailNormalized === condition.emailNormalized : user.phoneNormalized === condition.phoneNormalized)) ?? null,
      findUnique: async ({ where }: any) => { const user = users.find((item) => item.id === where.id); return user ? { department: null, rbacRole: null, jobTitle: '', isCeo: false, departmentId: null, rbacRoleId: null, ...user, organization: organizations.find((org) => org.id === user.organizationId) } : null; },
      create: async ({ data }: any) => { const row = { id: `user-${users.length}`, jobTitle: '', isCeo: false, departmentId: null, rbacRoleId: null, ...data }; users.push(row); return row; },
      update: async ({ where, data }: any) => Object.assign(users.find((row) => row.id === where.id), data),
    },
    organization: {
      create: async ({ data }: any) => { const row = { id: `factory-${organizations.length}`, managedByNppId: null, province: null, ...data }; organizations.push(row); return row; },
      findUnique: async ({ where }: any) => organizations.find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(organizations.find((row) => row.id === where.id), data),
    },
    formulaInvite: {
      create: async ({ data }: any) => { const row = { id: `invite-${invites.length + 1}`, createdAt: new Date(), ...data }; invites.push(row); return row; },
      findUnique: async ({ where }: any) => { const invite = invites.find((row) => row.codeHash === where.codeHash); return invite ? { ...invite, nppOrganization: organizations.find((row) => row.id === invite.nppOrganizationId) } : null; },
      updateMany: async ({ where, data }: any) => { const matching = invites.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value)); matching.forEach((row) => Object.assign(row, data)); return { count: matching.length }; },
    },
    formulaAccessGrant: {
      findUnique: async ({ where }: any) => grants.find((row) => row.organizationId === where.organizationId) ?? null,
      upsert: async ({ where, create, update }: any) => { let row = grants.find((item) => item.organizationId === where.organizationId); if (row) Object.assign(row, update); else { row = { id: `grant-${grants.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...create }; grants.push(row); } return row; },
      update: async ({ where, data }: any) => Object.assign(grants.find((row) => row.organizationId === where.organizationId), data),
    },
    formulaAccessAudit: {
      create: async ({ data }: any) => { const row = { id: `audit-${audits.length + 1}`, createdAt: new Date(), ...data }; audits.push(row); return row; },
      findMany: async ({ where }: any) => audits.filter((row) => row.organizationId === where.organizationId).reverse(),
    },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };
  const formula = new FormulaAccessService(prisma, { randomCode: () => 'EH-E2E-ONE-TIME' });
  const challenges: any[] = [];
  const verification = {
    create: async (userId: string, channel: string, target: string) => { challenges.push({ userId, channel, target }); return { challengeId: 'challenge-1', expiresAt: new Date() }; },
    confirm: async (userId: string) => ({ userId, channel: 'EMAIL', targetNormalized: 'owner@example.com', consumedAt: new Date() }),
  };
  const jwt = { signAsync: async () => 'signed-jwt' };
  const auth = new AuthService(prisma, jwt as never, verification as never, formula);
  return { auth, formula, organizations, users, audits };
}

function guardContext(user: any) {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as any;
}

test('self-register → locked guard → NPP invite → active guard → live revoke and audit sequence', async () => {
  const { auth, formula, users, audits } = fixture();
  const registration = await auth.registerWorkshop({ displayName: 'Anh An', organizationName: 'Xưởng An', email: 'owner@example.com', password: 'secret123' });
  const login = await auth.confirmWorkshopVerification({ pendingVerificationId: registration.pendingVerificationId, code: '123456' });
  const factory = users.find((user) => user.id === registration.pendingVerificationId);
  const meLocked = await auth.me(factory.id);
  assert.ok(meLocked.modules.includes('factory:quotations'));
  assert.equal(meLocked.modules.includes('factory:formulas'), false);
  assert.equal(meLocked.capabilities.formulas.status, 'LOCKED');

  const guard = new FormulaAccessGuard(formula);
  const jwtUser = { sub: factory.id, role: 'FACTORY', organizationId: factory.organizationId };
  await assert.rejects(() => guard.canActivate(guardContext(jwtUser)), /Công thức Eurohouse chưa được kích hoạt/);

  const issued = await formula.createInvite({ userId: 'npp-user', role: 'NPP', organizationId: 'npp-a' }, factory.organizationId);
  const access = await formula.redeemInvite({ userId: factory.id, role: 'FACTORY', organizationId: factory.organizationId }, issued.plainCode);
  assert.equal(access.nppOrganizationName, 'NPP A');
  assert.equal((await formula.getAccessView(factory.organizationId)).status, 'ACTIVE');
  assert.equal(await guard.canActivate(guardContext(jwtUser)), true);
  assert.equal((await auth.me(factory.id)).capabilities.formulas.status, 'ACTIVE');

  await formula.revoke({ userId: 'npp-user', role: 'NPP', organizationId: 'npp-a' }, factory.organizationId, 'Tạm dừng theo yêu cầu');
  await assert.rejects(() => guard.canActivate(guardContext(jwtUser)), /Công thức Eurohouse chưa được kích hoạt/);
  assert.deepEqual(audits.map((row) => row.action), ['INVITE_CREATED', 'INVITE_REDEEMED', 'REVOKED']);
  assert.equal(login.user.token, 'signed-jwt');
});
