import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type TechnicalReviewState, type TechnicalSourceType } from '@prisma/client';
import type { JwtUser } from '../../../auth/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDatasetOwnership, assertDatasetStudioActor, datasetOwnerForCreate } from '../datasets/dataset-studio.policy';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function technicalSourceVisibilityWhere(user: JwtUser | undefined): Prisma.TechnicalSourceWhereInput | undefined {
  assertDatasetStudioActor(user);
  return user.isCeo
    ? undefined
    : { OR: [{ ownerOrganizationId: user.organizationId ?? null }, { enteredById: user.sub }] };
}

@Injectable()
export class TechnicalSourceService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtUser | undefined, datasetRevisionId?: string) {
    return this.prisma.technicalSource.findMany({
      where: { AND: [technicalSourceVisibilityWhere(user) ?? {}, datasetRevisionId ? { datasetRevisionId } : {}] },
      orderBy: { createdAt: 'desc' },
      include: { datasetRevision: { select: { id: true, versionTag: true, status: true, dataset: { select: { name: true } } } }, links: true },
    });
  }

  async create(user: JwtUser | undefined, input: {
    datasetRevisionId?: string;
    sourceType: TechnicalSourceType;
    sourceDocument: string;
    sourceRevision?: string;
    sourcePage?: string;
    sourceDate?: string;
    sourceFileObjectId?: string;
    sourceHash?: string;
    technicalOwner?: string;
    ownerOrganizationId?: string | null;
    notes?: string;
    metadata?: unknown;
  }) {
    assertDatasetStudioActor(user);
    if (!input.sourceDocument.trim()) throw new BadRequestException('Document identity is required.');
    if (input.sourceFileObjectId && !input.sourceHash?.trim()) throw new BadRequestException('A file-backed technical source requires a checksum.');
    let ownerOrganizationId = datasetOwnerForCreate(user, input.ownerOrganizationId);
    if (input.datasetRevisionId) {
      const revision = await this.prisma.datasetRevision.findUnique({ where: { id: input.datasetRevisionId }, include: { dataset: true } });
      if (!revision) throw new NotFoundException('Dataset revision does not exist.');
      assertDatasetOwnership(user, revision.dataset.ownerOrganizationId);
      if (revision.status !== 'DRAFT') throw new BadRequestException('Technical sources can only be attached to a DRAFT dataset revision.');
      ownerOrganizationId = revision.dataset.ownerOrganizationId;
    }
    const sourceDate = input.sourceDate ? new Date(input.sourceDate) : undefined;
    if (sourceDate && Number.isNaN(sourceDate.getTime())) throw new BadRequestException('Source date is invalid.');
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.technicalSource.create({
        data: {
          datasetRevisionId: input.datasetRevisionId,
          sourceType: input.sourceType,
          sourceDocument: input.sourceDocument.trim(),
          sourceRevision: input.sourceRevision?.trim() ?? '',
          sourcePage: input.sourcePage?.trim() ?? '',
          sourceDate,
          sourceFileObjectId: input.sourceFileObjectId,
          sourceHash: input.sourceHash?.trim().toUpperCase() ?? '',
          technicalOwner: input.technicalOwner?.trim() ?? '',
          ownerOrganizationId,
          enteredById: user.sub,
          notes: input.notes?.trim() ?? '',
          metadata: input.metadata === undefined ? undefined : json(input.metadata),
        },
      });
      await tx.technicalReviewEvent.create({ data: { entityType: 'TECHNICAL_SOURCE', entityId: source.id, action: 'CREATE', toStatus: 'UNREVIEWED', actorId: user.sub, notes: source.notes } });
      return source;
    });
  }

  async review(user: JwtUser | undefined, id: string, input: { state: TechnicalReviewState; notes: string }) {
    assertDatasetStudioActor(user);
    const source = await this.findOwned(user, id);
    if (!['IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED'].includes(input.state)) throw new BadRequestException('Unsupported technical source review state.');
    if (!input.notes.trim()) throw new BadRequestException('Technical source review notes are required.');
    if (input.state === 'APPROVED') {
      if (source.sourceType === 'LEGACY_DATA') throw new BadRequestException('LEGACY_DATA cannot be approved as technical truth.');
      if (!source.sourceDocument.trim() || (source.sourceFileObjectId && !source.sourceHash.trim())) throw new BadRequestException('Source provenance is incomplete.');
    }
    const reviewed = input.state === 'APPROVED';
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.technicalSource.update({
        where: { id },
        data: { reviewState: input.state, reviewedById: reviewed ? user.sub : null, reviewedAt: reviewed ? new Date() : null, notes: input.notes.trim() },
      });
      await tx.technicalReviewEvent.create({ data: { entityType: 'TECHNICAL_SOURCE', entityId: id, action: 'REVIEW', fromStatus: source.reviewState, toStatus: input.state, actorId: user.sub, notes: input.notes.trim() } });
      return updated;
    });
  }

  async link(user: JwtUser | undefined, id: string, input: { entityType: string; entityId: string; fieldPath?: string; notes?: string }) {
    const source = await this.findOwned(user, id);
    if (!input.entityType.trim() || !input.entityId.trim()) throw new BadRequestException('Source link entity is required.');
    return this.prisma.technicalSourceLink.upsert({
      where: { technicalSourceId_entityType_entityId_fieldPath: { technicalSourceId: source.id, entityType: input.entityType.trim(), entityId: input.entityId.trim(), fieldPath: input.fieldPath?.trim() ?? '' } },
      create: { technicalSourceId: source.id, entityType: input.entityType.trim(), entityId: input.entityId.trim(), fieldPath: input.fieldPath?.trim() ?? '', notes: input.notes?.trim() ?? '' },
      update: { notes: input.notes?.trim() ?? '' },
    });
  }

  private async findOwned(user: JwtUser | undefined, id: string) {
    assertDatasetStudioActor(user);
    const source = await this.prisma.technicalSource.findFirst({ where: { id, AND: [technicalSourceVisibilityWhere(user) ?? {}] } });
    if (!source) throw new NotFoundException('Technical source does not exist.');
    return source;
  }
}
