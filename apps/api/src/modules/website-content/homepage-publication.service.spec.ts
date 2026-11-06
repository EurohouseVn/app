import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { HomepagePayloadV1, HomepageSaveInput } from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { HomepagePublicationService } from './homepage-publication.service';

const admin: JwtUser = { sub: 'admin-1', email: 'admin@eurohouse.vn', role: 'ADMIN' };
const staff: JwtUser = { sub: 'staff-1', email: 'staff@eurohouse.vn', role: 'STAFF', permissions: [] };

function payload(): HomepagePayloadV1 {
  const copy = (title: string) => ({ eyebrow: 'EUROHOUSE', title, summary: `Giới thiệu ${title}` });
  const cta = (label: string, href: string) => ({ label, href });
  return {
    schemaVersion: 1,
    hero: { ...copy('Định hình không gian'), primaryCta: cta('Dân dụng', '/nhom-dan-dung'), secondaryCta: cta('Công nghiệp', '/nhom-cong-nghiep') },
    productFields: {
      ...copy('Hai lĩnh vực'),
      residential: { title: 'NHÔM DÂN DỤNG', summary: 'Kiến trúc', route: '/nhom-dan-dung', cta: cta('Khám phá', '/nhom-dan-dung') },
      industrial: { title: 'NHÔM CÔNG NGHIỆP', summary: 'Sản xuất', route: '/nhom-cong-nghiep', cta: cta('Khám phá', '/nhom-cong-nghiep') },
    },
    residential: { ...copy('Hệ nhôm dân dụng'), dominant: { contentId: 'res-1' }, supporting: [], cta: cta('Xem hệ nhôm', '/nhom-dan-dung') },
    industrial: { ...copy('Đùn profile theo bản vẽ'), services: [{ contentId: 'service-1' }], primaryCta: cta('Gửi bản vẽ', '/lien-he'), secondaryCta: cta('Năng lực', '/nang-luc') },
    evidence: { ...copy('Năng lực sản xuất'), items: [{ title: 'Đùn ép', summary: 'Profile theo ứng dụng.' }, { title: 'Gia công', summary: 'Cắt và khoan.' }] },
    projects: { ...copy('Công trình'), featured: [{ contentId: 'project-1' }], cta: cta('Xem dự án', '/du-an') },
    video: copy('Hành trình EUROHOUSE'),
    contact: { ...copy('Bắt đầu cùng EUROHOUSE'), architecturalCta: cta('Tư vấn', '/lien-he'), industrialCta: cta('Gửi bản vẽ', '/lien-he') },
  };
}

function saveInput(updatedAt: Date): HomepageSaveInput {
  return {
    payload: payload(),
    expectedUpdatedAt: updatedAt.toISOString(),
    seo: { title: 'Nhôm EUROHOUSE', description: 'Nhôm hệ cao cấp và nhôm công nghiệp.', canonicalPath: '/', schemaType: 'WebPage' },
    mediaByRole: { HERO_BACKGROUND: 'media-hero', INDUSTRIAL_BACKGROUND: 'media-factory', VIDEO_PRIMARY: 'media-video' },
  };
}

function prismaStub() {
  const updatedAt = new Date('2026-11-06T02:00:00.000Z');
  const state: any = {
    revision: {
      id: 'revision-2', websiteContentId: 'homepage', revision: 2, status: 'DRAFT', title: 'Trang chủ', eyebrow: null,
      summary: 'Trang chủ', body: payload(), specifications: null, sourceRefs: null, hasHighRiskClaims: false,
      technicalRiskHash: null, technicalApprovalSourceRevisionId: null, createdById: admin.sub, publishedAt: null,
      createdAt: updatedAt, updatedAt,
    },
    previous: null,
    reviews: [] as any[],
    links: [] as any[],
    audits: [] as any[],
    archived: 0,
    published: 0,
    contentCreates: 0,
    failPublishAudit: false,
  };
  const publishedRefs = ['res-1', 'service-1', 'project-1'].map((id) => ({ id, revisions: [{ id: `published-${id}`, revision: 1, status: 'PUBLISHED', title: id, summary: id, updatedAt }] }));
  const assets = ['media-hero', 'media-factory', 'media-video'].map((id) => ({
    id, mediaType: id === 'media-video' ? 'VIDEO' : 'IMAGE', channels: ['PUBLIC'], rightsStatus: 'APPROVED', intakeStatus: 'PUBLISHED', archivedAt: null,
    altText: id, caption: id, transcript: id === 'media-video' ? 'Quy trình sản xuất.' : null,
  }));
  const tx: any = {
    websiteContent: {
      findMany: async ({ where }: any) => publishedRefs.filter((item) => where.id.in.includes(item.id)),
      findUnique: async () => ({
        id: 'homepage', kind: 'PAGE', slug: 'trang-chu', locale: 'vi',
        revisions: [{ ...state.revision, reviews: state.reviews, media: state.links, seo: state.seo ?? null }],
      }),
      create: async () => { state.contentCreates += 1; throw new Error('must not create duplicate homepage'); },
    },
    websiteMediaAsset: { findMany: async ({ where }: any) => assets.filter((item) => where.id.in.includes(item.id)) },
    websiteContentRevision: {
      findUnique: async ({ where }: any) => where.id === state.revision.id ? { ...state.revision, reviews: state.reviews, media: state.links, seo: state.seo ?? null, websiteContent: { id: 'homepage', slug: 'trang-chu', locale: 'vi' } } : null,
      findFirst: async ({ where }: any) => where.revision === 1 ? state.previous : null,
      updateMany: async ({ where, data }: any) => {
        if (typeof where.id === 'string' && (where.id !== state.revision.id || where.updatedAt?.getTime() !== state.revision.updatedAt.getTime())) return { count: 0 };
        if (where.status === 'PUBLISHED') { state.archived += 1; return { count: 1 }; }
        Object.assign(state.revision, data, { updatedAt: new Date('2026-11-06T02:01:00.000Z') }); return { count: 1 };
      },
      update: async ({ data }: any) => { Object.assign(state.revision, data); state.published += 1; return state.revision; },
    },
    websiteSeoRecord: { upsert: async ({ create, update }: any) => { state.seo = { ...(state.seo ?? create), ...update }; return state.seo; } },
    websiteContentMedia: {
      deleteMany: async () => { state.links = []; },
      createMany: async ({ data }: any) => { state.links = data.map((item: any) => ({ ...item, mediaAsset: assets.find((asset) => asset.id === item.mediaAssetId) })); },
    },
    websitePublicationAudit: { create: async ({ data }: any) => {
      if (state.failPublishAudit && data.action === 'HOMEPAGE_PUBLISHED') throw new Error('injected audit failure');
      state.audits.push(data);
    } },
  };
  const prisma: any = { ...tx, $transaction: async (fn: any) => {
    const snapshot = {
      revision: structuredClone(state.revision),
      archived: state.archived,
      published: state.published,
      audits: structuredClone(state.audits),
    };
    try {
      return await fn(tx);
    } catch (error) {
      state.revision = snapshot.revision;
      state.archived = snapshot.archived;
      state.published = snapshot.published;
      state.audits = snapshot.audits;
      throw error;
    }
  } };
  return { prisma, state };
}

test('save reconciles payload, SEO and exact media roles in one transaction', async () => {
  const { prisma, state } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  const result = await service.saveHomepageDraft('revision-2', saveInput(state.revision.updatedAt), admin);
  assert.equal(result.payload.hero.title, 'Định hình không gian');
  assert.deepEqual(state.links.map((link: any) => link.role).sort(), ['HERO_BACKGROUND', 'INDUSTRIAL_BACKGROUND', 'VIDEO_PRIMARY']);
  assert.equal(state.seo.canonicalPath, '/');
  assert.equal(state.audits.at(-1).action, 'HOMEPAGE_DRAFT_SAVED');
});

test('a stale expectedUpdatedAt cannot overwrite a newer draft', async () => {
  const { prisma } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  await assert.rejects(
    () => service.saveHomepageDraft('revision-2', saveInput(new Date('2026-11-05T00:00:00.000Z')), admin),
    ConflictException,
  );
});

test('missing live references become structured readiness blockers', async () => {
  const { prisma, state } = prismaStub();
  prisma.websiteContent.findMany = async () => [];
  const service = new HomepagePublicationService(prisma);
  await service.saveHomepageDraft('revision-2', saveInput(state.revision.updatedAt), admin);
  const readiness = await service.getHomepageReadiness('revision-2');
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.some((issue) => issue.code === 'REFERENCE_UNAVAILABLE'));
});

test('Staff needs explicit website-publish permission', async () => {
  const { prisma } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  await assert.rejects(() => service.publishHomepage('revision-2', staff), ForbiddenException);
});

test('getOrCreate reuses the single existing homepage record', async () => {
  const { prisma, state } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  const result = await service.getOrCreateHomepage(admin);
  assert.equal(result.contentId, 'homepage');
  assert.equal(state.contentCreates, 0);
});

test('unchanged technical risk carries only technical approval, never marketing approval', async () => {
  const { prisma, state } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  await service.saveHomepageDraft('revision-2', saveInput(state.revision.updatedAt), admin);
  state.previous = {
    id: 'revision-1', revision: 1, technicalRiskHash: state.revision.technicalRiskHash,
    reviews: [{ stage: 'TECHNICAL', decision: 'APPROVED' }],
  };
  await service.saveHomepageDraft('revision-2', saveInput(state.revision.updatedAt), admin);
  assert.equal(state.revision.technicalApprovalSourceRevisionId, 'revision-1');
  const readiness = await service.getHomepageReadiness('revision-2');
  assert.equal(readiness.reviewClass, 'MARKETING_ONLY');
  assert.ok(readiness.blockers.some((issue) => issue.code === 'MARKETING_APPROVAL_REQUIRED'));
  assert.equal(readiness.blockers.some((issue) => issue.code === 'TECHNICAL_APPROVAL_REQUIRED'), false);
});

test('publication archives the previous live row and leaves the target published', async () => {
  const { prisma, state } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  await service.saveHomepageDraft('revision-2', saveInput(state.revision.updatedAt), admin);
  state.revision.status = 'MARKETING_REVIEW';
  state.reviews.push(
    { stage: 'TECHNICAL', decision: 'APPROVED' },
    { stage: 'MARKETING', decision: 'APPROVED' },
  );
  await service.publishHomepage('revision-2', admin);
  assert.equal(state.archived, 1);
  assert.equal(state.revision.status, 'PUBLISHED');
  assert.equal(state.published, 1);
  assert.equal(state.audits.at(-1).action, 'HOMEPAGE_PUBLISHED');
});

test('an injected transaction failure preserves the prior live state', async () => {
  const { prisma, state } = prismaStub();
  const service = new HomepagePublicationService(prisma);
  await service.saveHomepageDraft('revision-2', saveInput(state.revision.updatedAt), admin);
  state.revision.status = 'MARKETING_REVIEW';
  state.reviews.push(
    { stage: 'TECHNICAL', decision: 'APPROVED' },
    { stage: 'MARKETING', decision: 'APPROVED' },
  );
  state.failPublishAudit = true;
  await assert.rejects(() => service.publishHomepage('revision-2', admin), /injected audit failure/);
  assert.equal(state.revision.status, 'MARKETING_REVIEW');
  assert.equal(state.archived, 0);
  assert.equal(state.published, 0);
});
