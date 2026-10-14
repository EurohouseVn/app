import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from './storage-provider';

export type StoredUploadInput = {
  buffer: Buffer;
  originalName?: string;
  mime: string;
  purpose: string;
  ownerOrganizationId?: string;
  ownerUserId?: string;
  extension?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  async putUpload(input: StoredUploadInput) {
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const extension = this.extension(input.extension ?? path.extname(input.originalName ?? ''));
    const tenant = this.segment(input.ownerOrganizationId ?? input.ownerUserId ?? 'system');
    const purpose = this.segment(input.purpose);
    const objectKey = `${tenant}/${purpose}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const stored = await this.provider.put({ objectKey, body: input.buffer, mime: input.mime, sha256 });
    return this.prisma.storageObject.create({
      data: {
        provider: stored.provider,
        objectKey: stored.objectKey,
        sha256,
        mime: input.mime,
        sizeBytes: input.buffer.byteLength,
        ownerOrganizationId: input.ownerOrganizationId,
        ownerUserId: input.ownerUserId,
        purpose: input.purpose,
        metadata: { originalName: input.originalName, ...input.metadata } as any,
        publicUrl: stored.publicUrl,
      },
    });
  }

  async read(id: string) {
    const object = await this.prisma.storageObject.findUniqueOrThrow({ where: { id } });
    return { object, body: await this.provider.get(object.objectKey) };
  }

  private segment(value: string) { return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'object'; }
  private extension(value: string) { const ext = value.toLowerCase(); return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : ''; }
}
