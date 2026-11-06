import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WebsiteChannel, WebsiteRightsStatus } from '@prisma/client';
import type { JwtUser } from '../../auth/current-user.decorator';
import { assertWebsiteMediaUpload, type UploadedFileLike } from '../../common/upload';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export type WebsiteMediaUploadMetadata = {
  altText: string;
  sourceReference: string;
  caption?: string;
  transcript?: string;
};

export type WebsiteMediaGovernanceInput = {
  rightsStatus?: WebsiteRightsStatus;
  channels?: WebsiteChannel[];
};

@Injectable()
export class WebsiteMediaUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  assertGovernanceAuthority(input: WebsiteMediaGovernanceInput, actor: JwtUser): void {
    const governing = input.rightsStatus === 'APPROVED' || input.channels?.includes('PUBLIC');
    if (governing && actor.role !== 'ADMIN' && actor.isCeo !== true && !actor.permissions?.includes('website-media-approve')) {
      throw new ForbiddenException('Bạn không có quyền duyệt bản quyền hoặc công khai tệp website.');
    }
  }

  async upload(file: UploadedFileLike, metadata: WebsiteMediaUploadMetadata, actor: JwtUser) {
    const inspection = assertWebsiteMediaUpload(file);
    if (!metadata.altText?.trim()) throw new BadRequestException('Mô tả thay thế là bắt buộc.');
    if (!metadata.sourceReference?.trim()) throw new BadRequestException('Nguồn tệp là bắt buộc.');
    const stored = await this.storage.putUpload({
      buffer: file.buffer!,
      originalName: file.originalname,
      mime: inspection.mime,
      extension: inspection.extension,
      purpose: 'website-media',
      ownerOrganizationId: actor.organizationId,
      ownerUserId: actor.sub,
      metadata: {
        originalFilename: file.originalname,
        width: inspection.width,
        height: inspection.height,
        durationSeconds: inspection.durationSeconds,
      },
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.websiteMediaAsset.create({
          data: {
            storageObjectId: stored.id,
            mediaType: inspection.mediaType,
            sourceReference: metadata.sourceReference.trim(),
            rightsStatus: 'UNKNOWN',
            altText: metadata.altText.trim(),
            caption: metadata.caption?.trim() || null,
            transcript: metadata.transcript?.trim() || null,
            channels: ['ADMIN_ONLY'],
            intakeStatus: 'DISCOVERED',
            createdById: actor.sub,
          },
          include: { storageObject: true, contentLinks: true },
        });
        await tx.websitePublicationAudit.create({
          data: {
            entityType: 'WEBSITE_MEDIA_ASSET', entityId: created.id, action: 'MEDIA_UPLOADED', actorId: actor.sub,
            metadata: { originalFilename: file.originalname, mime: inspection.mime, sizeBytes: stored.sizeBytes },
          },
        });
        return created;
      });
    } catch (error) {
      await this.storage.delete(stored.id).catch(() => undefined);
      throw error;
    }
  }

  async uploadPoster(mediaId: string, file: UploadedFileLike, actor: JwtUser) {
    const inspection = assertWebsiteMediaUpload(file);
    if (inspection.mediaType !== 'IMAGE') throw new BadRequestException('Poster phải là ảnh JPG, PNG hoặc WebP.');
    const current = await this.prisma.websiteMediaAsset.findUnique({ where: { id: mediaId } });
    if (!current) throw new NotFoundException('Website media asset was not found.');
    const stored = await this.storage.putUpload({
      buffer: file.buffer!, originalName: file.originalname, mime: inspection.mime, extension: inspection.extension,
      purpose: 'website-media-poster', ownerOrganizationId: actor.organizationId, ownerUserId: actor.sub,
      metadata: { originalFilename: file.originalname, width: inspection.width, height: inspection.height },
    });
    try {
      const updated = await this.prisma.websiteMediaAsset.update({
        where: { id: mediaId }, data: { posterStorageObjectId: stored.id },
      });
      await this.prisma.websitePublicationAudit.create({
        data: { entityType: 'WEBSITE_MEDIA_ASSET', entityId: mediaId, action: 'MEDIA_POSTER_UPDATED', actorId: actor.sub },
      });
      return updated;
    } catch (error) {
      await this.storage.delete(stored.id).catch(() => undefined);
      throw error;
    }
  }
}
