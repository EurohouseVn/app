import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  WebsiteChannel,
  WebsiteMediaIntakeStatus,
  WebsiteMediaType,
  WebsiteRightsStatus,
} from '@prisma/client';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export function selectPublicChannelAssets<T extends { channels: readonly string[] }>(assets: T[]): T[] {
  return assets.filter((asset) => asset.channels.includes('PUBLIC'));
}

export type CreateWebsiteMediaInput = {
  storageObjectId: string;
  mediaType: WebsiteMediaType;
  sourceReference: string;
  rightsStatus?: WebsiteRightsStatus;
  altText: string;
  caption?: string | null;
  posterStorageObjectId?: string | null;
  transcript?: string | null;
  focalPointX?: number | null;
  focalPointY?: number | null;
  channels?: WebsiteChannel[];
  intakeStatus?: WebsiteMediaIntakeStatus;
};

export type UpdateWebsiteMediaInput = Partial<Omit<CreateWebsiteMediaInput, 'storageObjectId' | 'mediaType'>> & {
  intakeStatus?: WebsiteMediaIntakeStatus;
};

export type CreateWebsiteDocumentInput = {
  storageObjectId: string;
  title: string;
  documentType: string;
  revisionLabel: string;
  effectiveDate: Date | string | null;
  channels?: WebsiteChannel[];
  aluSystemId?: string | null;
};

export type UpdateWebsiteDocumentInput = Partial<Omit<CreateWebsiteDocumentInput, 'storageObjectId'>>;

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPreviewEligibleMedia(media: { archivedAt?: Date | null }): boolean {
  return !media.archivedAt;
}

export function assertPublishEligibleMedia(media: {
  mediaType: WebsiteMediaType | string;
  intakeStatus: WebsiteMediaIntakeStatus | string;
  rightsStatus: WebsiteRightsStatus | string;
  posterStorageObjectId?: string | null;
  transcript?: string | null;
  caption?: string | null;
  channels: readonly (WebsiteChannel | string)[];
}) {
  if ('archivedAt' in media && media.archivedAt) throw new BadRequestException('Archived media cannot be published.');
  if (media.channels.includes('PUBLIC') && media.rightsStatus !== 'APPROVED') {
    throw new BadRequestException('Public website media requires approved usage rights.');
  }
  if (media.mediaType === 'VIDEO' && media.intakeStatus === 'PUBLISHED') {
    if (!nonEmpty(media.posterStorageObjectId)) {
      throw new BadRequestException('A published video requires a poster image.');
    }
    if (!nonEmpty(media.transcript) && !nonEmpty(media.caption)) {
      throw new BadRequestException('A published video requires a transcript or description.');
    }
  }
}

function assertDocumentPublishable(document: {
  channels: readonly (WebsiteChannel | string)[];
  revisionLabel?: string | null;
  effectiveDate?: Date | string | null;
}) {
  if (!document.channels.includes('PUBLIC')) return;
  if (!nonEmpty(document.revisionLabel)) {
    throw new BadRequestException('A public technical document requires a revision label.');
  }
  if (!document.effectiveDate || Number.isNaN(new Date(document.effectiveDate).getTime())) {
    throw new BadRequestException('A public technical document requires a valid effective date.');
  }
}

@Injectable()
export class WebsiteAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMedia(input: CreateWebsiteMediaInput, actor: JwtUser) {
    this.assertGovernanceAuthority(input, actor);
    const data = {
      storageObjectId: input.storageObjectId,
      mediaType: input.mediaType,
      sourceReference: input.sourceReference,
      rightsStatus: input.rightsStatus ?? WebsiteRightsStatus.UNKNOWN,
      altText: input.altText,
      caption: input.caption,
      posterStorageObjectId: input.posterStorageObjectId,
      transcript: input.transcript,
      focalPointX: input.focalPointX,
      focalPointY: input.focalPointY,
      channels: input.channels ?? [WebsiteChannel.ADMIN_ONLY],
      intakeStatus: input.intakeStatus ?? WebsiteMediaIntakeStatus.DISCOVERED,
    };
    assertPublishEligibleMedia(data);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.websiteMediaAsset.create({
        data: { ...data, createdById: actor.sub },
      });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_MEDIA_ASSET',
          entityId: created.id,
          action: 'MEDIA_CREATED',
          actorId: actor.sub,
          metadata: { channels: created.channels, rightsStatus: created.rightsStatus },
        },
      });
      return created;
    });
  }

  async updateMedia(id: string, input: UpdateWebsiteMediaInput, actor: JwtUser) {
    this.assertGovernanceAuthority(input, actor);
    this.assertMetadata(input);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteMediaAsset.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Website media asset was not found.');
      const next = { ...current, ...input };
      assertPublishEligibleMedia(next);
      const data: Prisma.WebsiteMediaAssetUncheckedUpdateInput = {
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
        ...(input.rightsStatus !== undefined ? { rightsStatus: input.rightsStatus } : {}),
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.posterStorageObjectId !== undefined
          ? { posterStorageObjectId: input.posterStorageObjectId }
          : {}),
        ...(input.transcript !== undefined ? { transcript: input.transcript } : {}),
        ...(input.focalPointX !== undefined ? { focalPointX: input.focalPointX } : {}),
        ...(input.focalPointY !== undefined ? { focalPointY: input.focalPointY } : {}),
        ...(input.channels !== undefined ? { channels: input.channels } : {}),
        ...(input.intakeStatus !== undefined ? { intakeStatus: input.intakeStatus } : {}),
      };
      const updated = await tx.websiteMediaAsset.update({ where: { id }, data });
      const governedFields = [
        'rightsStatus',
        'channels',
        'sourceReference',
        'posterStorageObjectId',
        'transcript',
        'caption',
        'intakeStatus',
      ] as const;
      const changedFields = governedFields.filter((field) => input[field] !== undefined);
      if (changedFields.length > 0) {
        await tx.websitePublicationAudit.create({
          data: {
            entityType: 'WEBSITE_MEDIA_ASSET',
            entityId: id,
            action: 'MEDIA_GOVERNANCE_UPDATED',
            actorId: actor.sub,
            metadata: { changedFields },
          },
        });
      }
      return updated;
    });
  }

  async linkMedia(
    revisionId: string,
    mediaAssetId: string,
    role: string,
    sortOrder: number,
    actor: JwtUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraft(tx, revisionId);
      const created = await tx.websiteContentMedia.create({
        data: { revisionId, mediaAssetId, role: role.trim() || 'CONTENT', sortOrder },
      });
      await this.auditLink(tx, 'MEDIA_LINKED', created.id, revisionId, actor.sub);
      return created;
    });
  }

  async unlinkMedia(linkId: string, actor: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.websiteContentMedia.delete({ where: { id: linkId } });
      await this.assertDraft(tx, deleted.revisionId);
      await this.auditLink(tx, 'MEDIA_UNLINKED', linkId, deleted.revisionId, actor.sub);
      return deleted;
    });
  }

  async createDocument(input: CreateWebsiteDocumentInput, actor: JwtUser) {
    const channels = input.channels ?? [WebsiteChannel.ADMIN_ONLY];
    if (!input.effectiveDate || Number.isNaN(new Date(input.effectiveDate).getTime())) {
      throw new BadRequestException('A technical document requires a valid effective date.');
    }
    assertDocumentPublishable({ ...input, channels });
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.websiteTechnicalDocument.create({
        data: {
          storageObjectId: input.storageObjectId,
          title: input.title,
          documentType: input.documentType,
          revisionLabel: input.revisionLabel,
          effectiveDate: new Date(input.effectiveDate!),
          channels,
          aluSystemId: input.aluSystemId,
          createdById: actor.sub,
        },
      });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_TECHNICAL_DOCUMENT',
          entityId: created.id,
          action: 'DOCUMENT_CREATED',
          actorId: actor.sub,
          metadata: { channels: created.channels, revisionLabel: created.revisionLabel },
        },
      });
      return created;
    });
  }

  async updateDocument(id: string, input: UpdateWebsiteDocumentInput, actor: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteTechnicalDocument.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Website technical document was not found.');
      const next = { ...current, ...input };
      assertDocumentPublishable(next);
      if (input.effectiveDate === null) {
        throw new BadRequestException('Technical document effective date cannot be cleared.');
      }
      const data: Prisma.WebsiteTechnicalDocumentUncheckedUpdateInput = {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.documentType !== undefined ? { documentType: input.documentType } : {}),
        ...(input.revisionLabel !== undefined ? { revisionLabel: input.revisionLabel } : {}),
        ...(input.effectiveDate !== undefined ? { effectiveDate: new Date(input.effectiveDate) } : {}),
        ...(input.channels !== undefined ? { channels: input.channels } : {}),
        ...(input.aluSystemId !== undefined ? { aluSystemId: input.aluSystemId } : {}),
      };
      const updated = await tx.websiteTechnicalDocument.update({ where: { id }, data });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_TECHNICAL_DOCUMENT',
          entityId: id,
          action: 'DOCUMENT_GOVERNANCE_UPDATED',
          actorId: actor.sub,
          metadata: { changedFields: Object.keys(input) },
        },
      });
      return updated;
    });
  }

  async linkDocument(revisionId: string, documentId: string, sortOrder: number, actor: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDraft(tx, revisionId);
      const created = await tx.websiteContentDocument.create({
        data: { revisionId, documentId, sortOrder },
      });
      await this.auditLink(tx, 'DOCUMENT_LINKED', created.id, revisionId, actor.sub);
      return created;
    });
  }

  async unlinkDocument(linkId: string, actor: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.websiteContentDocument.delete({ where: { id: linkId } });
      await this.assertDraft(tx, deleted.revisionId);
      await this.auditLink(tx, 'DOCUMENT_UNLINKED', linkId, deleted.revisionId, actor.sub);
      return deleted;
    });
  }

  async listMedia(filters: { mediaType?: WebsiteMediaType; intakeStatus?: WebsiteMediaIntakeStatus; rightsStatus?: WebsiteRightsStatus; q?: string } = {}) {
    const q = filters.q?.trim();
    const rows = await this.prisma.websiteMediaAsset.findMany({
      where: {
        archivedAt: null,
        ...(filters.mediaType ? { mediaType: filters.mediaType } : {}),
        ...(filters.intakeStatus ? { intakeStatus: filters.intakeStatus } : {}),
        ...(filters.rightsStatus ? { rightsStatus: filters.rightsStatus } : {}),
        ...(q ? { OR: [{ altText: { contains: q, mode: 'insensitive' } }, { caption: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      include: {
        storageObject: { select: { publicUrl: true, sizeBytes: true, metadata: true } },
        posterStorageObject: { select: { publicUrl: true } },
        contentLinks: {
          include: { revision: { select: { id: true, revision: true, status: true, websiteContent: { select: { id: true, slug: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toLibraryItem(row));
  }

  async getUsage(id: string) {
    const row = await this.prisma.websiteMediaAsset.findUnique({
      where: { id },
      include: { contentLinks: { include: { revision: { include: { websiteContent: true } } } } },
    });
    if (!row) throw new NotFoundException('Website media asset was not found.');
    return row.contentLinks.map((link) => ({
      contentId: link.revision.websiteContent.id,
      contentTitle: link.revision.title,
      revisionId: link.revision.id,
      revision: link.revision.revision,
      status: link.revision.status,
      role: link.role,
    }));
  }

  async archiveMedia(id: string, actor: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.websiteMediaAsset.findUnique({
        where: { id },
        include: { contentLinks: { include: { revision: { select: { status: true } } } } },
      });
      if (!row) throw new NotFoundException('Website media asset was not found.');
      if (row.contentLinks.some((link) => link.revision.status === 'PUBLISHED')) {
        throw new ConflictException('Không thể lưu trữ tệp đang được dùng trong nội dung đã xuất bản.');
      }
      const updated = await tx.websiteMediaAsset.update({ where: { id }, data: { archivedAt: new Date() } });
      await tx.websitePublicationAudit.create({
        data: { entityType: 'WEBSITE_MEDIA_ASSET', entityId: id, action: 'MEDIA_ARCHIVED', actorId: actor.sub },
      });
      return updated;
    });
  }

  private assertGovernanceAuthority(input: Pick<UpdateWebsiteMediaInput, 'rightsStatus' | 'channels'>, actor: JwtUser) {
    const governed = input.rightsStatus === 'APPROVED' || input.channels?.includes('PUBLIC');
    if (governed && actor.role !== 'ADMIN' && actor.isCeo !== true && !actor.permissions?.includes('website-media-approve')) {
      throw new ForbiddenException('Bạn không có quyền duyệt bản quyền hoặc công khai tệp website.');
    }
  }

  private assertMetadata(input: UpdateWebsiteMediaInput) {
    if (input.altText !== undefined && !input.altText.trim()) throw new BadRequestException('Alt text cannot be empty.');
    for (const point of [input.focalPointX, input.focalPointY]) {
      if (point !== undefined && point !== null && (point < 0 || point > 1)) throw new BadRequestException('Focal points must be between 0 and 1.');
    }
  }

  private toLibraryItem(row: any) {
    const metadata = row.storageObject.metadata && typeof row.storageObject.metadata === 'object' ? row.storageObject.metadata : {};
    return {
      id: row.id,
      mediaType: row.mediaType,
      originalFilename: metadata.originalFilename ?? metadata.originalName ?? '',
      ...(row.storageObject.publicUrl ? { previewUrl: row.storageObject.publicUrl } : {}),
      ...(row.channels.includes('PUBLIC') && row.storageObject.publicUrl ? { publicUrl: row.storageObject.publicUrl } : {}),
      altText: row.altText,
      ...(row.caption ? { caption: row.caption } : {}),
      ...(row.transcript ? { transcript: row.transcript } : {}),
      ...(row.posterStorageObject?.publicUrl ? { posterUrl: row.posterStorageObject.publicUrl } : {}),
      ...(row.focalPointX !== null ? { focalPointX: row.focalPointX } : {}),
      ...(row.focalPointY !== null ? { focalPointY: row.focalPointY } : {}),
      ...(typeof metadata.width === 'number' ? { width: metadata.width } : {}),
      ...(typeof metadata.height === 'number' ? { height: metadata.height } : {}),
      ...(typeof metadata.durationSeconds === 'number' ? { durationSeconds: metadata.durationSeconds } : {}),
      sizeBytes: row.storageObject.sizeBytes,
      rightsStatus: row.rightsStatus,
      intakeStatus: row.intakeStatus,
      channels: row.channels,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      usages: row.contentLinks.map((link: any) => ({
        contentId: link.revision.websiteContent.id,
        contentTitle: link.revision.websiteContent.slug,
        revisionId: link.revision.id,
        revision: link.revision.revision,
        status: link.revision.status,
        role: link.role,
      })),
    };
  }

  private async assertDraft(tx: Prisma.TransactionClient, revisionId: string) {
    const revision = await tx.websiteContentRevision.findUnique({
      where: { id: revisionId },
      select: { status: true },
    });
    if (!revision) throw new NotFoundException('Website revision was not found.');
    if (revision.status !== 'DRAFT') throw new ConflictException('Assets can be changed only on draft revisions.');
  }

  private auditLink(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    revisionId: string,
    actorId: string,
  ) {
    return tx.websitePublicationAudit.create({
      data: {
        entityType: 'WEBSITE_REVISION_ASSET',
        entityId,
        action,
        actorId,
        metadata: { revisionId },
      },
    });
  }
}
