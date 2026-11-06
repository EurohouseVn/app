import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { WebsiteAssetsService, selectPublicChannelAssets } from './website-assets.service';

const actor: JwtUser = { sub: 'admin-1', email: 'admin@eurohouse.vn', role: 'ADMIN' };

function prismaStub() {
  const state = {
    media: [{
      id: 'media-video',
      mediaType: 'VIDEO',
      storageObjectId: 'storage-video',
      sourceReference: 'Drive 2026',
      rightsStatus: 'APPROVED',
      altText: 'Video dây chuyền đùn nhôm',
      caption: null,
      posterStorageObjectId: null,
      transcript: null,
      channels: ['ADMIN_ONLY'],
      intakeStatus: 'OPTIMIZED',
      archivedAt: null,
      contentLinks: [] as any[],
    }],
    documents: [] as Array<Record<string, unknown>>,
    mediaLinks: [] as Array<Record<string, unknown>>,
    documentLinks: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
    revisions: [{ id: 'revision-draft', status: 'DRAFT' }],
  };
  const tx: any = {
    websiteMediaAsset: {
      findUnique: async ({ where }: any) => state.media.find((item) => item.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = { id: `media-${state.media.length + 1}`, ...data };
        state.media.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.media.find((item) => item.id === where.id);
        if (!row) throw new Error('missing media');
        Object.assign(row, data);
        return row;
      },
      findMany: async () => state.media,
    },
    websiteTechnicalDocument: {
      create: async ({ data }: any) => {
        const row = { id: `document-${state.documents.length + 1}`, ...data };
        state.documents.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => state.documents.find((item) => item.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const row = state.documents.find((item) => item.id === where.id);
        if (!row) throw new Error('missing document');
        Object.assign(row, data);
        return row;
      },
    },
    websiteContentRevision: {
      findUnique: async ({ where }: any) => state.revisions.find((item) => item.id === where.id) ?? null,
    },
    websiteContentMedia: {
      create: async ({ data }: any) => {
        const row = { id: `media-link-${state.mediaLinks.length + 1}`, ...data };
        state.mediaLinks.push(row);
        return row;
      },
      delete: async ({ where }: any) => {
        const index = state.mediaLinks.findIndex((item) => item.id === where.id);
        if (index < 0) throw new Error('missing media link');
        return state.mediaLinks.splice(index, 1)[0];
      },
    },
    websiteContentDocument: {
      create: async ({ data }: any) => {
        const row = { id: `document-link-${state.documentLinks.length + 1}`, ...data };
        state.documentLinks.push(row);
        return row;
      },
      delete: async ({ where }: any) => {
        const index = state.documentLinks.findIndex((item) => item.id === where.id);
        if (index < 0) throw new Error('missing document link');
        return state.documentLinks.splice(index, 1)[0];
      },
    },
    websitePublicationAudit: {
      create: async ({ data }: any) => {
        const row = { id: `audit-${state.audits.length + 1}`, ...data };
        state.audits.push(row);
        return row;
      },
    },
  };
  return {
    state,
    prisma: { ...tx, $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
  };
}

test('public asset selection exposes only the PUBLIC channel and defers NPP selection', () => {
  const assets = [
    { id: 'public', channels: ['PUBLIC'] },
    { id: 'npp', channels: ['NPP'] },
    { id: 'admin', channels: ['ADMIN_ONLY'] },
  ];
  assert.deepEqual(selectPublicChannelAssets(assets).map((item) => item.id), ['public']);
});

test('a video cannot become PUBLISHED without a poster and transcript or description', async () => {
  const { prisma } = prismaStub();
  const service = new WebsiteAssetsService(prisma as never);

  await assert.rejects(
    () => service.updateMedia('media-video', { intakeStatus: 'PUBLISHED', channels: ['PUBLIC'] }, actor),
    BadRequestException,
  );
});

test('governed media changes publish a complete video and create an audit event', async () => {
  const { prisma, state } = prismaStub();
  const service = new WebsiteAssetsService(prisma as never);

  const updated = await service.updateMedia('media-video', {
    intakeStatus: 'PUBLISHED',
    channels: ['PUBLIC'],
    posterStorageObjectId: 'storage-poster',
    transcript: 'Giới thiệu dây chuyền đùn nhôm EUROHOUSE.',
  }, actor);

  assert.equal(updated.intakeStatus, 'PUBLISHED');
  assert.equal(state.audits.at(-1)?.action, 'MEDIA_GOVERNANCE_UPDATED');
});

test('a public technical document requires revision and effective-date metadata', async () => {
  const { prisma } = prismaStub();
  const service = new WebsiteAssetsService(prisma as never);

  await assert.rejects(
    () => service.createDocument({
      storageObjectId: 'storage-doc',
      title: 'Thông số kỹ thuật EU55',
      documentType: 'TECHNICAL_DATASHEET',
      revisionLabel: '',
      effectiveDate: null,
      channels: ['PUBLIC'],
    }, actor),
    BadRequestException,
  );
});

test('link and unlink operations are draft-only and audited', async () => {
  const { prisma, state } = prismaStub();
  const service = new WebsiteAssetsService(prisma as never);

  const link = await service.linkMedia('revision-draft', 'media-video', 'VIDEO', 0, actor);
  await service.unlinkMedia(link.id, actor);

  assert.equal(state.mediaLinks.length, 0);
  assert.deepEqual(state.audits.slice(-2).map((item) => item.action), ['MEDIA_LINKED', 'MEDIA_UNLINKED']);
});

test('only an authorized reviewer may approve rights or expose media publicly', async () => {
  const { prisma } = prismaStub();
  const service = new WebsiteAssetsService(prisma as never);
  const staff: JwtUser = { sub: 'staff-1', email: 'staff@eurohouse.vn', role: 'STAFF', permissions: [] };
  await assert.rejects(
    () => service.updateMedia('media-video', { rightsStatus: 'APPROVED', channels: ['PUBLIC'] }, staff),
    ForbiddenException,
  );
});

test('archival is blocked for published usage and allowed when unused', async () => {
  const { prisma, state } = prismaStub();
  const service = new WebsiteAssetsService(prisma as never);
  state.media[0]!.contentLinks = [{ revision: { status: 'PUBLISHED' } }];
  await assert.rejects(() => service.archiveMedia('media-video', actor), ConflictException);
  state.media[0]!.contentLinks = [];
  await service.archiveMedia('media-video', actor);
  assert.ok((state.media[0]!.archivedAt as unknown) instanceof Date);
  assert.equal(state.audits.at(-1)?.action, 'MEDIA_ARCHIVED');
});
