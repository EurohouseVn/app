import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminWebsiteRevision,
  WebsiteContentKind,
  WebsiteProductFamily,
  WebsitePublicationStatus,
  WebsiteReviewStage,
} from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WebsitePublicationPolicyError,
  assertRevisionPublishable,
  assertWebsiteTransition,
} from './publication-policy';
import {
  CreateWebsiteContentDto,
  normalizeWebsiteSlug,
} from './dto/create-website-content.dto';
import { ReviewWebsiteRevisionDto } from './dto/review-website-revision.dto';
import { UpdateWebsiteRevisionDto } from './dto/update-website-revision.dto';

export interface AdminWebsiteContent {
  id: string;
  kind: WebsiteContentKind;
  family?: WebsiteProductFamily;
  slug: string;
  locale: string;
  aluSystemId?: string;
  operationalProjectId?: string;
  linkedSystem?: { id: string; code: string; name: string };
  revisions: AdminWebsiteRevision[];
  createdAt: string;
  updatedAt: string;
}

type RevisionWithRelations = {
  id: string;
  websiteContentId: string;
  revision: number;
  status: WebsitePublicationStatus;
  title: string;
  eyebrow: string | null;
  summary: string;
  body: unknown;
  specifications: unknown;
  sourceRefs: unknown;
  hasHighRiskClaims: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reviews?: Array<{
    id: string;
    stage: 'TECHNICAL' | 'MARKETING';
    decision: 'APPROVED' | 'CHANGES_REQUESTED';
    note: string | null;
    reviewerId: string;
    createdAt: Date;
  }>;
  seo?: {
    title: string;
    description: string;
    canonicalPath: string;
    schemaType: string;
  } | null;
};

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : value as Prisma.InputJsonValue;
}

function toAdminRevision(row: RevisionWithRelations): AdminWebsiteRevision {
  return {
    id: row.id,
    websiteContentId: row.websiteContentId,
    revision: row.revision,
    status: row.status,
    title: row.title,
    ...(row.eyebrow ? { eyebrow: row.eyebrow } : {}),
    summary: row.summary,
    body: row.body,
    ...(row.specifications !== null && row.specifications !== undefined
      ? { specifications: row.specifications }
      : {}),
    ...(row.sourceRefs !== null && row.sourceRefs !== undefined ? { sourceRefs: row.sourceRefs } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.publishedAt ? { publishedAt: row.publishedAt.toISOString() } : {}),
    reviews: (row.reviews ?? []).map((review) => ({
      id: review.id,
      stage: review.stage,
      decision: review.decision,
      ...(review.note ? { note: review.note } : {}),
      reviewerId: review.reviewerId,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

function mapPolicyError(error: unknown): never {
  if (error instanceof WebsitePublicationPolicyError) {
    if (error.code === 'INVALID_TRANSITION') throw new ConflictException(error.message);
    throw new BadRequestException(error.message);
  }
  throw error;
}

@Injectable()
export class WebsiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  async createContent(input: CreateWebsiteContentDto, actor: JwtUser): Promise<AdminWebsiteContent> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locale = input.locale?.trim().toLowerCase() || 'vi';
        const slug = normalizeWebsiteSlug(input.slug);
        const duplicate = await tx.websiteContent.findUnique({
          where: { locale_slug: { locale, slug } },
        });
        if (duplicate) throw new ConflictException('A website content item already uses this locale and slug.');

        const linkedSystem = input.aluSystemId
          ? await tx.aluSystem.findUnique({
            where: { id: input.aluSystemId },
            select: { id: true, code: true, name: true },
          })
          : null;
        if (input.aluSystemId && !linkedSystem) {
          throw new NotFoundException('The linked aluminium system does not exist.');
        }

        const content = await tx.websiteContent.create({
          data: {
            kind: input.kind,
            family: input.family,
            slug,
            locale,
            aluSystemId: input.aluSystemId,
            operationalProjectId: input.operationalProjectId,
            createdById: actor.sub,
          },
        });
        const revision = await tx.websiteContentRevision.create({
          data: {
            websiteContentId: content.id,
            revision: 1,
            status: 'DRAFT',
            title: input.title,
            eyebrow: input.eyebrow,
            summary: input.summary,
            body: input.body as Prisma.InputJsonValue,
            specifications: optionalJson(input.specifications),
            sourceRefs: optionalJson(input.sourceRefs),
            hasHighRiskClaims: input.hasHighRiskClaims ?? false,
            createdById: actor.sub,
          },
        });
        await tx.websiteSeoRecord.create({
          data: {
            revisionId: revision.id,
            ...input.seo,
          },
        });
        await tx.websitePublicationAudit.create({
          data: {
            entityType: 'WEBSITE_CONTENT',
            entityId: content.id,
            action: 'CONTENT_CREATED',
            toState: 'DRAFT',
            actorId: actor.sub,
            metadata: { revisionId: revision.id, revision: 1 },
          },
        });

        return {
          id: content.id,
          kind: content.kind,
          ...(content.family ? { family: content.family } : {}),
          slug: content.slug,
          locale: content.locale,
          ...(content.aluSystemId ? { aluSystemId: content.aluSystemId } : {}),
          ...(content.operationalProjectId ? { operationalProjectId: content.operationalProjectId } : {}),
          ...(linkedSystem ? { linkedSystem } : {}),
          revisions: [toAdminRevision(revision as RevisionWithRelations)],
          createdAt: content.createdAt.toISOString(),
          updatedAt: content.updatedAt.toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A website content item already uses this locale and slug.');
      }
      throw error;
    }
  }

  async createDraftRevision(contentId: string, actor: JwtUser): Promise<AdminWebsiteRevision> {
    return this.prisma.$transaction(async (tx) => {
      const content = await tx.websiteContent.findUnique({ where: { id: contentId } });
      if (!content) throw new NotFoundException('Website content was not found.');
      const source = await tx.websiteContentRevision.findFirst({
        where: { websiteContentId: contentId },
        orderBy: { revision: 'desc' },
        include: { reviews: { orderBy: { createdAt: 'asc' } }, seo: true },
      });
      if (!source) throw new NotFoundException('Website content has no revision to clone.');
      if (source.status !== 'PUBLISHED' && source.status !== 'ARCHIVED') {
        throw new ConflictException('Only a published or archived revision can be cloned into a new draft.');
      }

      const created = await tx.websiteContentRevision.create({
        data: {
          websiteContentId: contentId,
          revision: source.revision + 1,
          status: 'DRAFT',
          title: source.title,
          eyebrow: source.eyebrow,
          summary: source.summary,
          body: source.body as Prisma.InputJsonValue,
          specifications: optionalJson(source.specifications),
          sourceRefs: optionalJson(source.sourceRefs),
          hasHighRiskClaims: source.hasHighRiskClaims,
          createdById: actor.sub,
        },
      });
      if (source.seo) {
        await tx.websiteSeoRecord.create({
          data: {
            revisionId: created.id,
            title: source.seo.title,
            description: source.seo.description,
            canonicalPath: source.seo.canonicalPath,
            schemaType: source.seo.schemaType,
          },
        });
      }
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION',
          entityId: created.id,
          action: 'DRAFT_REVISION_CREATED',
          fromState: source.status,
          toState: 'DRAFT',
          actorId: actor.sub,
          metadata: { sourceRevisionId: source.id, revision: created.revision },
        },
      });
      return toAdminRevision(created as RevisionWithRelations);
    });
  }

  async updateDraft(
    revisionId: string,
    input: UpdateWebsiteRevisionDto,
    actor: JwtUser,
  ): Promise<AdminWebsiteRevision> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteContentRevision.findUnique({
        where: { id: revisionId },
        include: { reviews: { orderBy: { createdAt: 'asc' } }, seo: true },
      });
      if (!current) throw new NotFoundException('Website revision was not found.');
      if (current.status !== 'DRAFT') throw new ConflictException('Only draft revisions can be edited.');

      const updated = await tx.websiteContentRevision.update({
        where: { id: revisionId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.eyebrow !== undefined ? { eyebrow: input.eyebrow } : {}),
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.body !== undefined ? { body: input.body as Prisma.InputJsonValue } : {}),
          ...(input.specifications !== undefined
            ? { specifications: input.specifications as Prisma.InputJsonValue }
            : {}),
          ...(input.sourceRefs !== undefined
            ? { sourceRefs: input.sourceRefs as Prisma.InputJsonValue }
            : {}),
          ...(input.hasHighRiskClaims !== undefined
            ? { hasHighRiskClaims: input.hasHighRiskClaims }
            : {}),
        },
        include: { reviews: { orderBy: { createdAt: 'asc' } }, seo: true },
      });
      if (input.seo) {
        await tx.websiteSeoRecord.upsert({
          where: { revisionId },
          create: { revisionId, ...input.seo },
          update: input.seo,
        });
      }
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION',
          entityId: revisionId,
          action: 'DRAFT_UPDATED',
          fromState: 'DRAFT',
          toState: 'DRAFT',
          actorId: actor.sub,
        },
      });
      return toAdminRevision(updated as RevisionWithRelations);
    });
  }

  async submit(revisionId: string, stage: WebsiteReviewStage, actor: JwtUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteContentRevision.findUnique({
        where: { id: revisionId },
        include: { reviews: { orderBy: { createdAt: 'asc' } } },
      });
      if (!current) throw new NotFoundException('Website revision was not found.');
      const target: WebsitePublicationStatus = stage === 'TECHNICAL'
        ? 'TECHNICAL_REVIEW'
        : 'MARKETING_REVIEW';
      if (stage === 'MARKETING') {
        const technicalReviews = current.reviews.filter((review) => review.stage === 'TECHNICAL');
        if (technicalReviews.at(-1)?.decision !== 'APPROVED') {
          throw new BadRequestException('Technical approval is required before marketing review.');
        }
      }
      try {
        assertWebsiteTransition(current.status, target);
      } catch (error) {
        mapPolicyError(error);
      }
      await tx.websiteContentRevision.update({ where: { id: revisionId }, data: { status: target } });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION',
          entityId: revisionId,
          action: stage === 'TECHNICAL' ? 'SUBMITTED_TECHNICAL' : 'SUBMITTED_MARKETING',
          fromState: current.status,
          toState: target,
          actorId: actor.sub,
        },
      });
    });
  }

  async review(revisionId: string, input: ReviewWebsiteRevisionDto, actor: JwtUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteContentRevision.findUnique({ where: { id: revisionId } });
      if (!current) throw new NotFoundException('Website revision was not found.');
      const expectedStatus = input.stage === 'TECHNICAL' ? 'TECHNICAL_REVIEW' : 'MARKETING_REVIEW';
      if (current.status !== expectedStatus) {
        throw new ConflictException(`Revision is not in ${input.stage.toLowerCase()} review.`);
      }
      await tx.websiteContentReview.create({
        data: {
          revisionId,
          stage: input.stage,
          decision: input.decision,
          note: input.note,
          reviewerId: actor.sub,
        },
      });
      const target = input.decision === 'CHANGES_REQUESTED' ? 'DRAFT' : current.status;
      if (target !== current.status) {
        await tx.websiteContentRevision.update({ where: { id: revisionId }, data: { status: target } });
      }
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION',
          entityId: revisionId,
          action: 'REVIEW_RECORDED',
          fromState: current.status,
          toState: target,
          actorId: actor.sub,
          note: input.note,
          metadata: { stage: input.stage, decision: input.decision },
        },
      });
    });
  }

  async publish(revisionId: string, actor: JwtUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteContentRevision.findUnique({
        where: { id: revisionId },
        include: { reviews: { orderBy: { createdAt: 'asc' } } },
      });
      if (!current) throw new NotFoundException('Website revision was not found.');
      try {
        assertRevisionPublishable({
          status: current.status,
          reviews: current.reviews,
          hasHighRiskClaims: current.hasHighRiskClaims,
          sourceRefs: current.sourceRefs,
        });
      } catch (error) {
        mapPolicyError(error);
      }
      const publishedAt = new Date();
      await tx.websiteContentRevision.update({
        where: { id: revisionId },
        data: { status: 'PUBLISHED', publishedAt },
      });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION',
          entityId: revisionId,
          action: 'PUBLISHED',
          fromState: current.status,
          toState: 'PUBLISHED',
          actorId: actor.sub,
          metadata: { publishedAt: publishedAt.toISOString() },
        },
      });
    });
  }

  async archive(contentId: string, actor: JwtUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteContentRevision.findFirst({
        where: { websiteContentId: contentId, status: 'PUBLISHED' },
        orderBy: { revision: 'desc' },
      });
      if (!current) throw new NotFoundException('Published website content was not found.');
      try {
        assertWebsiteTransition(current.status, 'ARCHIVED');
      } catch (error) {
        mapPolicyError(error);
      }
      await tx.websiteContentRevision.update({
        where: { id: current.id },
        data: { status: 'ARCHIVED' },
      });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION',
          entityId: current.id,
          action: 'ARCHIVED',
          fromState: 'PUBLISHED',
          toState: 'ARCHIVED',
          actorId: actor.sub,
          metadata: { websiteContentId: contentId },
        },
      });
    });
  }
}
