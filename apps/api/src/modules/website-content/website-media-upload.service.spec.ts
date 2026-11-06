import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { WebsiteMediaUploadService } from './website-media-upload.service';

const admin: JwtUser = { sub: 'admin-1', email: 'admin@eurohouse.vn', role: 'ADMIN' };
const staff: JwtUser = { sub: 'staff-1', email: 'staff@eurohouse.vn', role: 'STAFF', permissions: [] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function fixture() {
  const state: any = { media: [], audits: [], deleted: [] };
  const storage: any = {
    putUpload: async (input: any) => ({ id: 'storage-1', sizeBytes: input.buffer.length, metadata: { originalName: input.originalName, ...input.metadata }, publicUrl: '/uploads/one.png' }),
    delete: async (id: string) => { state.deleted.push(id); },
  };
  const tx: any = {
    websiteMediaAsset: {
      create: async ({ data }: any) => { const row = { id: 'media-1', ...data, createdAt: new Date(), updatedAt: new Date(), contentLinks: [], storageObject: { id: 'storage-1', sizeBytes: png.length, metadata: { originalName: 'one.png' }, publicUrl: '/uploads/one.png' } }; state.media.push(row); return row; },
    },
    websitePublicationAudit: { create: async ({ data }: any) => { state.audits.push(data); } },
  };
  const prisma: any = { $transaction: async (fn: any) => fn(tx) };
  return { state, storage, prisma };
}

test('new uploads start private with uploader, original filename and audit metadata', async () => {
  const { state, storage, prisma } = fixture();
  const service = new WebsiteMediaUploadService(prisma, storage);
  const result = await service.upload(
    { originalname: 'one.png', mimetype: 'image/png', size: png.length, buffer: png },
    { altText: 'Mẫu thanh nhôm', sourceReference: 'EUROHOUSE 2026' },
    admin,
  );
  assert.deepEqual(result.channels, ['ADMIN_ONLY']);
  assert.equal(result.rightsStatus, 'UNKNOWN');
  assert.equal(result.intakeStatus, 'DISCOVERED');
  assert.equal(state.audits[0].action, 'MEDIA_UPLOADED');
});

test('Staff cannot approve rights or expose an upload publicly without permission', async () => {
  const { storage, prisma } = fixture();
  const service = new WebsiteMediaUploadService(prisma, storage);
  assert.throws(
    () => service.assertGovernanceAuthority({ rightsStatus: 'APPROVED', channels: ['PUBLIC'] }, staff),
    ForbiddenException,
  );
});

test('storage and database failures never leave a media row or orphaned stored object', async () => {
  const first = fixture();
  first.storage.putUpload = async () => { throw new Error('storage unavailable'); };
  const storageFailure = new WebsiteMediaUploadService(first.prisma, first.storage);
  await assert.rejects(
    () => storageFailure.upload({ originalname: 'one.png', mimetype: 'image/png', buffer: png }, { altText: 'Ảnh', sourceReference: 'Nguồn' }, admin),
    /storage unavailable/,
  );
  assert.equal(first.state.media.length, 0);

  const second = fixture();
  second.prisma.$transaction = async () => { throw new Error('database unavailable'); };
  const databaseFailure = new WebsiteMediaUploadService(second.prisma, second.storage);
  await assert.rejects(
    () => databaseFailure.upload({ originalname: 'one.png', mimetype: 'image/png', buffer: png }, { altText: 'Ảnh', sourceReference: 'Nguồn' }, admin),
    /database unavailable/,
  );
  assert.deepEqual(second.state.deleted, ['storage-1']);
  assert.equal(second.state.media.length, 0);
});
