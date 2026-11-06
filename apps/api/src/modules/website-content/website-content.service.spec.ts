import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { JwtUser } from '../../auth/current-user.decorator';
import { CreateWebsiteContentDto } from './dto/create-website-content.dto';
import { WebsiteContentService } from './website-content.service';

const actor: JwtUser = {
  sub: 'admin-1',
  email: 'admin@eurohouse.vn',
  role: 'ADMIN',
};

type ContentRow = {
  id: string;
  kind: string;
  family: string | null;
  slug: string;
  locale: string;
  aluSystemId: string | null;
  operationalProjectId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

type RevisionRow = {
  id: string;
  websiteContentId: string;
  revision: number;
  status: string;
  title: string;
  eyebrow: string | null;
  summary: string;
  body: unknown;
  specifications: unknown;
  sourceRefs: unknown;
  hasHighRiskClaims: boolean;
  createdById: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createPrismaStub() {
  let sequence = 0;
  const now = () => new Date(`2026-10-31T00:00:${String(sequence++).padStart(2, '0')}.000Z`);
  const state = {
    contents: [] as ContentRow[],
    revisions: [] as RevisionRow[],
    reviews: [] as Array<Record<string, unknown>>,
    seo: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
    aluSystems: [{ id: 'system-eu55', code: 'EU55', name: 'EUROHOUSE EU55' }],
    transactionCalls: 0,
  };

  const revisionWithRelations = (row: RevisionRow | undefined) => row && ({
    ...row,
    reviews: state.reviews.filter((review) => review.revisionId === row.id),
    seo: state.seo.find((item) => item.revisionId === row.id) ?? null,
  });

  const tx: any = {
    aluSystem: {
      findUnique: async ({ where }: any) => state.aluSystems.find((item) => item.id === where.id) ?? null,
    },
    websiteContent: {
      findUnique: async ({ where }: any) => {
        const row = where.id
          ? state.contents.find((item) => item.id === where.id)
          : state.contents.find((item) => item.locale === where.locale_slug.locale && item.slug === where.locale_slug.slug);
        return row ?? null;
      },
      create: async ({ data }: any) => {
        const createdAt = now();
        const row: ContentRow = {
          id: `content-${state.contents.length + 1}`,
          kind: data.kind,
          family: data.family ?? null,
          slug: data.slug,
          locale: data.locale,
          aluSystemId: data.aluSystemId ?? null,
          operationalProjectId: data.operationalProjectId ?? null,
          createdById: data.createdById,
          createdAt,
          updatedAt: createdAt,
        };
        state.contents.push(row);
        return row;
      },
    },
    websiteContentRevision: {
      findUnique: async ({ where }: any) => revisionWithRelations(state.revisions.find((item) => item.id === where.id)) ?? null,
      findFirst: async ({ where }: any) => {
        const rows = state.revisions
          .filter((item) => item.websiteContentId === where.websiteContentId)
          .sort((a, b) => b.revision - a.revision);
        return revisionWithRelations(rows[0]) ?? null;
      },
      create: async ({ data }: any) => {
        const createdAt = now();
        const row: RevisionRow = {
          id: `revision-${state.revisions.length + 1}`,
          websiteContentId: data.websiteContentId,
          revision: data.revision,
          status: data.status ?? 'DRAFT',
          title: data.title,
          eyebrow: data.eyebrow ?? null,
          summary: data.summary,
          body: data.body,
          specifications: data.specifications ?? null,
          sourceRefs: data.sourceRefs ?? null,
          hasHighRiskClaims: data.hasHighRiskClaims ?? false,
          createdById: data.createdById,
          publishedAt: data.publishedAt ?? null,
          createdAt,
          updatedAt: createdAt,
        };
        state.revisions.push(row);
        return revisionWithRelations(row);
      },
      update: async ({ where, data }: any) => {
        const row = state.revisions.find((item) => item.id === where.id);
        if (!row) throw new Error('missing revision');
        Object.assign(row, data, { updatedAt: now() });
        return revisionWithRelations(row);
      },
    },
    websiteContentReview: {
      create: async ({ data }: any) => {
        const row = { id: `review-${state.reviews.length + 1}`, ...data, createdAt: now() };
        state.reviews.push(row);
        return row;
      },
    },
    websiteSeoRecord: {
      create: async ({ data }: any) => {
        const row = { id: `seo-${state.seo.length + 1}`, ...data, createdAt: now(), updatedAt: now() };
        state.seo.push(row);
        return row;
      },
      upsert: async ({ where, create, update }: any) => {
        const row = state.seo.find((item) => item.revisionId === where.revisionId);
        if (row) {
          Object.assign(row, update, { updatedAt: now() });
          return row;
        }
        return tx.websiteSeoRecord.create({ data: create });
      },
    },
    websitePublicationAudit: {
      create: async ({ data }: any) => {
        const row = { id: `audit-${state.audits.length + 1}`, ...data, createdAt: now() };
        state.audits.push(row);
        return row;
      },
    },
  };

  const prisma = {
    ...tx,
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      state.transactionCalls += 1;
      return callback(tx);
    },
  };

  return { prisma, state };
}

function validInput() {
  return {
    kind: 'PRODUCT' as const,
    family: 'RESIDENTIAL' as const,
    slug: 'he-cua-eu55',
    locale: 'vi',
    aluSystemId: 'system-eu55',
    title: 'Hệ cửa EUROHOUSE EU55',
    summary: 'Giải pháp nhôm dân dụng đồng bộ.',
    body: { blocks: [] },
    specifications: { thickness: '1.4 mm' },
    sourceRefs: [{ source: 'Catalog R19' }],
    hasHighRiskClaims: true,
    seo: {
      title: 'Hệ cửa nhôm EUROHOUSE EU55',
      description: 'Thông số và ứng dụng của hệ cửa EUROHOUSE EU55.',
      canonicalPath: '/nhom-dan-dung/he-cua-eu55',
      schemaType: 'Product',
    },
  };
}

test('DTO normalizes Vietnamese slug and rejects a full canonical URL', async () => {
  const dto = plainToInstance(CreateWebsiteContentDto, {
    ...validInput(),
    slug: '  Nhôm Công Nghiệp Định Hình  ',
    seo: { ...validInput().seo, canonicalPath: 'https://example.com/sai-pham-vi' },
  });
  assert.equal(dto.slug, 'nhom-cong-nghiep-dinh-hinh');
  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'seo'));
});

test('creates an identity and revision 1 linked to a real AluSystem', async () => {
  const { prisma, state } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);

  const result = await service.createContent(validInput(), actor);

  assert.equal(result.slug, 'he-cua-eu55');
  assert.equal(result.linkedSystem?.code, 'EU55');
  assert.equal(result.revisions[0]?.revision, 1);
  assert.equal(state.contents[0]?.aluSystemId, 'system-eu55');
  assert.equal('profiles' in result, false);
  assert.equal(state.transactionCalls, 1);
  assert.equal(state.audits[0]?.action, 'CONTENT_CREATED');
});

test('rejects a duplicate locale and slug inside the transaction', async () => {
  const { prisma } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);
  await service.createContent(validInput(), actor);

  await assert.rejects(() => service.createContent(validInput(), actor), ConflictException);
});

test('rejects an AluSystem link that does not resolve to an operational record', async () => {
  const { prisma } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);

  await assert.rejects(
    () => service.createContent({ ...validInput(), aluSystemId: 'missing-system' }, actor),
    NotFoundException,
  );
});

test('clones the latest published revision into a new audited draft', async () => {
  const { prisma, state } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);
  const content = await service.createContent(validInput(), actor);
  state.revisions[0]!.status = 'PUBLISHED';
  state.revisions[0]!.publishedAt = new Date('2026-10-30T00:00:00.000Z');

  const draft = await service.createDraftRevision(content.id, actor);

  assert.equal(draft.revision, 2);
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.title, validInput().title);
  assert.equal(state.seo.some((item) => item.revisionId === draft.id), true);
  assert.equal(state.audits.at(-1)?.action, 'DRAFT_REVISION_CREATED');
});

test('published revisions are immutable', async () => {
  const { prisma, state } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);
  const content = await service.createContent(validInput(), actor);
  const revision = content.revisions[0]!;
  state.revisions[0]!.status = 'PUBLISHED';

  await assert.rejects(
    () => service.updateDraft(revision.id, { title: 'Không được sửa trực tiếp' }, actor),
    ConflictException,
  );
});

test('technical and marketing review approvals gate publication and every transition is audited', async () => {
  const { prisma, state } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);
  const content = await service.createContent(validInput(), actor);
  const revisionId = content.revisions[0]!.id;

  await service.submit(revisionId, 'TECHNICAL', actor);
  await service.review(revisionId, { stage: 'TECHNICAL', decision: 'APPROVED', note: 'Đạt thông số.' }, actor);
  await service.submit(revisionId, 'MARKETING', actor);
  await service.review(revisionId, { stage: 'MARKETING', decision: 'APPROVED' }, actor);
  await service.publish(revisionId, actor);

  assert.equal(state.revisions[0]?.status, 'PUBLISHED');
  assert.ok(state.revisions[0]?.publishedAt instanceof Date);
  await service.archive(content.id, actor);
  assert.equal(state.revisions[0]?.status, 'ARCHIVED');
  assert.deepEqual(
    state.audits.slice(1).map((audit) => audit.action),
    [
      'SUBMITTED_TECHNICAL',
      'REVIEW_RECORDED',
      'SUBMITTED_MARKETING',
      'REVIEW_RECORDED',
      'PUBLISHED',
      'ARCHIVED',
    ],
  );
  assert.equal(state.transactionCalls, 7);
});

test('a requested review change returns the revision to draft', async () => {
  const { prisma, state } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);
  const content = await service.createContent(validInput(), actor);
  const revisionId = content.revisions[0]!.id;

  await service.submit(revisionId, 'TECHNICAL', actor);
  await service.review(revisionId, { stage: 'TECHNICAL', decision: 'CHANGES_REQUESTED', note: 'Bổ sung nguồn.' }, actor);

  assert.equal(state.revisions[0]?.status, 'DRAFT');
  assert.equal(state.audits.at(-1)?.toState, 'DRAFT');
});

test('Staff reviewers need the matching permission and rejection requires a reason', async () => {
  const { prisma } = createPrismaStub();
  const service = new WebsiteContentService(prisma as never);
  const content = await service.createContent(validInput(), actor);
  const revisionId = content.revisions[0]!.id;
  await service.submit(revisionId, 'TECHNICAL', actor);
  const staffReviewer: JwtUser = { sub: 'staff-1', email: 'staff@eurohouse.vn', role: 'STAFF', permissions: [] };
  await assert.rejects(
    () => service.review(revisionId, { stage: 'TECHNICAL', decision: 'APPROVED' }, staffReviewer),
    ForbiddenException,
  );
  staffReviewer.permissions = ['website-review-technical'];
  await assert.rejects(
    () => service.review(revisionId, { stage: 'TECHNICAL', decision: 'CHANGES_REQUESTED' }, staffReviewer),
    BadRequestException,
  );
});
