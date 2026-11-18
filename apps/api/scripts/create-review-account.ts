// Tạo hoặc cập nhật tài khoản kiểm duyệt app mobile: một cơ sở sản xuất riêng "Eurohouse Kiểm duyệt",
// vai FACTORY, đã xác minh email, mở sẵn Đặt nhôm và Công thức cắt, gắn với một NPP.
//
// Chạy trên máy chủ (mật khẩu chỉ nằm trong biến môi trường, không ghi ra log):
//   REVIEW_EMAIL=kiemduyet@eurohouse.vn REVIEW_PASSWORD='...' [REVIEW_NPP_CODE=...] \
//     pnpm --filter @eurohouse/api review-account:create
//
// Chạy lại với mật khẩu mới để đổi mật khẩu. Không tạo trùng, không chiếm tài khoản của cơ sở khác.
import * as bcrypt from 'bcryptjs';

export const REVIEW_ORG_CODE = 'REVIEW-EUROHOUSE';
export const REVIEW_ORG_NAME = 'Eurohouse Kiểm duyệt';
const FEATURES = ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const;

export interface ReviewAccountInput {
  email: string;
  password: string;
  nppCode?: string;
  displayName: string;
}

export function parseReviewAccountInput(env: Record<string, string | undefined>): ReviewAccountInput {
  const email = String(env.REVIEW_EMAIL ?? '').trim().toLowerCase();
  const password = String(env.REVIEW_PASSWORD ?? '');
  if (!email) throw new Error('Thiếu REVIEW_EMAIL.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('REVIEW_EMAIL không phải email hợp lệ.');
  if (!password) throw new Error('Thiếu REVIEW_PASSWORD.');
  if (password.length < 10) throw new Error('REVIEW_PASSWORD cần ít nhất 10 ký tự.');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('REVIEW_PASSWORD cần có cả chữ và số.');
  const nppCode = String(env.REVIEW_NPP_CODE ?? '').trim() || undefined;
  return { email, password, nppCode, displayName: 'Kiểm duyệt Eurohouse' };
}

export async function runCreateReviewAccount(
  prisma: any,
  input: ReviewAccountInput,
  deps: { hash: (password: string) => Promise<string>; now: () => Date },
) {
  return prisma.$transaction(async (tx: any) => {
    let npp: { id: string; name: string } | null;
    if (input.nppCode) {
      npp = await tx.organization.findUnique({ where: { code: input.nppCode } });
      if (!npp || (npp as { type?: string }).type !== 'NPP') throw new Error(`Không tìm thấy NPP có mã ${input.nppCode}.`);
    } else {
      const npps = await tx.organization.findMany({ where: { type: 'NPP' } });
      if (npps.length !== 1) throw new Error(`Có ${npps.length} NPP. Đặt REVIEW_NPP_CODE để chọn NPP gắn với xưởng kiểm duyệt.`);
      npp = npps[0];
    }

    const org = await tx.organization.upsert({
      where: { code: REVIEW_ORG_CODE },
      create: { code: REVIEW_ORG_CODE, name: REVIEW_ORG_NAME, type: 'FACTORY', shortLabel: 'X.KiemDuyet', productionName: REVIEW_ORG_NAME, managedByNppId: npp!.id },
      update: { managedByNppId: npp!.id },
    });

    const existing = await tx.user.findFirst({ where: { OR: [{ emailNormalized: input.email }, { email: input.email }] } });
    if (existing && existing.organizationId && existing.organizationId !== org.id) {
      throw new Error(`Email ${input.email} đang thuộc một cơ sở khác. Dùng email khác cho tài khoản kiểm duyệt.`);
    }
    const passwordHash = await deps.hash(input.password);
    const identity = { passwordHash, role: 'FACTORY', organizationId: org.id, verifiedAt: deps.now(), verificationChannel: 'EMAIL' };
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: identity })
      : await tx.user.create({ data: { email: input.email, emailNormalized: input.email, displayName: input.displayName, ...identity } });

    for (const featureKey of FEATURES) {
      const grant = {
        status: 'ACTIVE', nppOrganizationId: npp!.id, source: 'ADMIN_DIRECT', activatedByUserId: user.id, activatedAt: deps.now(),
        revokedByUserId: null, revokedAt: null, revokeReason: null,
      };
      await tx.eurohouseFeatureGrant.upsert({
        where: { organizationId_featureKey: { organizationId: org.id, featureKey } },
        create: { organizationId: org.id, featureKey, ...grant },
        update: grant,
      });
      await tx.eurohouseAccessAudit.create({
        data: { organizationId: org.id, featureKey, actorUserId: user.id, actorRole: 'FACTORY', action: 'DIRECT_ACTIVATED', toNppOrganizationId: npp!.id, metadata: { reason: 'Tài khoản kiểm duyệt trước khi phát hành app' } },
      });
    }

    return { created: !existing, email: input.email, organizationCode: REVIEW_ORG_CODE, nppName: npp!.name, features: [...FEATURES] };
  });
}

async function main() {
  const input = parseReviewAccountInput(process.env);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const result = await runCreateReviewAccount(prisma, input, { hash: (p) => bcrypt.hash(p, 10), now: () => new Date() });
    console.log(`${result.created ? 'Đã tạo' : 'Đã cập nhật'} tài khoản kiểm duyệt ${result.email}`);
    console.log(`Cơ sở: ${REVIEW_ORG_NAME} (${result.organizationCode}) · NPP: ${result.nppName}`);
    console.log(`Đã mở: ${result.features.join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
