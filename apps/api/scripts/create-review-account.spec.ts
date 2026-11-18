import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewAccountInput, runCreateReviewAccount, REVIEW_ORG_CODE } from './create-review-account';

test('đầu vào: bắt buộc email và mật khẩu đủ mạnh, không in mật khẩu', () => {
  assert.throws(() => parseReviewAccountInput({}), /REVIEW_EMAIL/);
  assert.throws(() => parseReviewAccountInput({ REVIEW_EMAIL: 'kiemduyet@eurohouse.vn' }), /REVIEW_PASSWORD/);
  assert.throws(() => parseReviewAccountInput({ REVIEW_EMAIL: 'khong-phai-email', REVIEW_PASSWORD: 'Abcdef12345' }), /email/);
  assert.throws(() => parseReviewAccountInput({ REVIEW_EMAIL: 'a@b.vn', REVIEW_PASSWORD: 'ngan1' }), /ít nhất 10/);
  assert.throws(() => parseReviewAccountInput({ REVIEW_EMAIL: 'a@b.vn', REVIEW_PASSWORD: 'chiconchuthuong' }), /chữ và số/);
  const ok = parseReviewAccountInput({ REVIEW_EMAIL: '  KiemDuyet@Eurohouse.VN ', REVIEW_PASSWORD: 'KiemDuyet2026', REVIEW_NPP_CODE: 'NPP-MN' });
  assert.deepEqual(ok, { email: 'kiemduyet@eurohouse.vn', password: 'KiemDuyet2026', nppCode: 'NPP-MN', displayName: 'Kiểm duyệt Eurohouse' });
});

type Row = Record<string, any>;

function fakePrisma(seed: { users?: Row[]; orgs?: Row[] } = {}) {
  const users: Row[] = seed.users ?? [];
  const orgs: Row[] = seed.orgs ?? [{ id: 'npp-1', code: 'NPP-MN', name: 'NPP Miền Nam', type: 'NPP' }];
  const grants: Row[] = [];
  const audits: Row[] = [];
  let n = 0;
  const prisma: any = {
    users, orgs, grants, audits,
    organization: {
      findUnique: async ({ where }: Row) => orgs.find((o) => (where.code ? o.code === where.code : o.id === where.id)) ?? null,
      findMany: async ({ where }: Row) => orgs.filter((o) => o.type === where.type),
      upsert: async ({ where, create, update }: Row) => {
        const found = orgs.find((o) => o.code === where.code);
        if (found) { Object.assign(found, update); return found; }
        const row = { id: `org-${++n}`, ...create }; orgs.push(row); return row;
      },
    },
    user: {
      findFirst: async ({ where }: Row) => users.find((u) => where.OR.some((c: Row) => (c.emailNormalized && u.emailNormalized === c.emailNormalized) || (c.email && u.email === c.email))) ?? null,
      findFirstCeo: null,
      create: async ({ data }: Row) => { const row = { id: `user-${++n}`, ...data }; users.push(row); return row; },
      update: async ({ where, data }: Row) => { const u = users.find((x) => x.id === where.id)!; Object.assign(u, data); return u; },
    },
    eurohouseFeatureGrant: {
      upsert: async ({ where, create, update }: Row) => {
        const key = where.organizationId_featureKey;
        const found = grants.find((g) => g.organizationId === key.organizationId && g.featureKey === key.featureKey);
        if (found) { Object.assign(found, update); return found; }
        grants.push({ ...create }); return create;
      },
    },
    eurohouseAccessAudit: { create: async ({ data }: Row) => { audits.push(data); return data; } },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return prisma;
}

const input = { email: 'kiemduyet@eurohouse.vn', password: 'KiemDuyet2026', nppCode: 'NPP-MN', displayName: 'Kiểm duyệt Eurohouse' };
const hash = async (p: string) => `hashed:${p}`;
const now = () => new Date('2026-11-18T10:00:00Z');

test('tạo mới: xưởng kiểm duyệt gắn NPP, tài khoản đã xác minh, mở cả hai quyền, có nhật ký', async () => {
  const prisma = fakePrisma();
  const result = await runCreateReviewAccount(prisma, input, { hash, now });
  const org = prisma.orgs.find((o: Row) => o.code === REVIEW_ORG_CODE);
  assert.equal(org.type, 'FACTORY');
  assert.equal(org.managedByNppId, 'npp-1');
  const user = prisma.users[0];
  assert.equal(user.role, 'FACTORY');
  assert.equal(user.organizationId, org.id);
  assert.equal(user.emailNormalized, 'kiemduyet@eurohouse.vn');
  assert.equal(user.passwordHash, 'hashed:KiemDuyet2026');
  assert.equal(user.verificationChannel, 'EMAIL');
  assert.ok(user.verifiedAt);
  assert.deepEqual(prisma.grants.map((g: Row) => [g.featureKey, g.status, g.source]).sort(), [['EUROHOUSE_ORDERING', 'ACTIVE', 'ADMIN_DIRECT'], ['FORMULA_CUTTING', 'ACTIVE', 'ADMIN_DIRECT']]);
  assert.equal(prisma.audits.length, 2);
  assert.deepEqual(result, { created: true, email: 'kiemduyet@eurohouse.vn', organizationCode: REVIEW_ORG_CODE, nppName: 'NPP Miền Nam', features: ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] });
  assert.ok(!JSON.stringify(result).includes('KiemDuyet2026'));
});

test('chạy lại: đổi mật khẩu, không tạo trùng', async () => {
  const prisma = fakePrisma();
  await runCreateReviewAccount(prisma, input, { hash, now });
  const again = await runCreateReviewAccount(prisma, { ...input, password: 'MatKhauMoi2027' }, { hash, now });
  assert.equal(again.created, false);
  assert.equal(prisma.users.length, 1);
  assert.equal(prisma.users[0].passwordHash, 'hashed:MatKhauMoi2027');
  assert.equal(prisma.orgs.filter((o: Row) => o.code === REVIEW_ORG_CODE).length, 1);
  assert.equal(prisma.grants.length, 2);
});

test('không chiếm tài khoản đã thuộc cơ sở khác', async () => {
  const prisma = fakePrisma({ users: [{ id: 'u-x', email: 'kiemduyet@eurohouse.vn', emailNormalized: 'kiemduyet@eurohouse.vn', organizationId: 'xuong-that' }] });
  await assert.rejects(() => runCreateReviewAccount(prisma, input, { hash, now }), /đang thuộc một cơ sở khác/);
});

test('NPP: báo lỗi nếu mã không có; không truyền mã thì chỉ tự chọn khi có đúng một NPP', async () => {
  await assert.rejects(() => runCreateReviewAccount(fakePrisma(), { ...input, nppCode: 'SAI' }, { hash, now }), /Không tìm thấy NPP/);
  const one = await runCreateReviewAccount(fakePrisma(), { ...input, nppCode: undefined }, { hash, now });
  assert.equal(one.nppName, 'NPP Miền Nam');
  const two = fakePrisma({ orgs: [{ id: 'n1', code: 'A', name: 'A', type: 'NPP' }, { id: 'n2', code: 'B', name: 'B', type: 'NPP' }] });
  await assert.rejects(() => runCreateReviewAccount(two, { ...input, nppCode: undefined }, { hash, now }), /REVIEW_NPP_CODE/);
});
