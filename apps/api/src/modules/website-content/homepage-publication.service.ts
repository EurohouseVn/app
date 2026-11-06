import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  HomepageMediaRole,
  HomepagePayloadV1,
  HomepagePublishReadiness,
  HomepageReadinessIssue,
  HomepageSaveInput,
} from '@eurohouse/types';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { parseHomepagePayload, HomepagePayloadValidationError } from './homepage-payload';
import { computeHomepageTechnicalRiskHash } from './homepage-risk';
import { resolveTechnicalApprovalCarryForward } from './publication-policy';

type DbClient = Prisma.TransactionClient | PrismaService;

function referenceIds(payload: HomepagePayloadV1): string[] {
  return [...new Set([
    payload.residential.dominant.contentId,
    ...payload.residential.supporting.map((item) => item.contentId),
    ...payload.industrial.services.map((item) => item.contentId),
    ...payload.projects.featured.map((item) => item.contentId),
  ])];
}

function canPublish(actor: JwtUser): boolean {
  return actor.role === 'ADMIN' || actor.isCeo === true || actor.permissions?.includes('website-publish') === true;
}

function latestApproval(reviews: Array<{ stage: string; decision: string }>, stage: string): boolean {
  return reviews.filter((review) => review.stage === stage).at(-1)?.decision === 'APPROVED';
}

@Injectable()
export class HomepagePublicationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateHomepage(actor: JwtUser) {
    const existing = await this.prisma.websiteContent.findUnique({
      where: { locale_slug: { locale: 'vi', slug: 'trang-chu' } },
      select: { id: true },
    });
    if (existing) return this.getHomepageAdminDetail();

    const starter = this.starterPayload();
    try {
      await this.prisma.$transaction(async (tx) => {
        const content = await tx.websiteContent.create({
          data: { kind: 'PAGE', slug: 'trang-chu', locale: 'vi', createdById: actor.sub },
        });
        const revision = await tx.websiteContentRevision.create({
          data: {
            websiteContentId: content.id,
            revision: 1,
            status: 'DRAFT',
            title: 'Trang chủ',
            summary: starter.hero.summary,
            body: starter as unknown as Prisma.InputJsonValue,
            createdById: actor.sub,
          },
        });
        await tx.websiteSeoRecord.create({
          data: {
            revisionId: revision.id,
            title: 'Nhôm EUROHOUSE',
            description: 'Nhôm hệ cao cấp và giải pháp nhôm công nghiệp EUROHOUSE.',
            canonicalPath: '/',
            schemaType: 'WebPage',
          },
        });
        await tx.websitePublicationAudit.create({
          data: {
            entityType: 'WEBSITE_CONTENT', entityId: content.id, action: 'HOMEPAGE_CREATED',
            toState: 'DRAFT', actorId: actor.sub, metadata: { revisionId: revision.id },
          },
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    return this.getHomepageAdminDetail();
  }

  async saveHomepageDraft(revisionId: string, input: HomepageSaveInput, actor: JwtUser) {
    let payload: HomepagePayloadV1;
    try {
      payload = parseHomepagePayload(input.payload);
    } catch (error) {
      if (error instanceof HomepagePayloadValidationError) {
        throw new BadRequestException({ message: error.message, issues: error.issues });
      }
      throw error;
    }
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime())) throw new BadRequestException('expectedUpdatedAt is invalid.');

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteContentRevision.findUnique({
        where: { id: revisionId },
        include: { reviews: { orderBy: { createdAt: 'asc' } }, media: true, seo: true },
      });
      if (!current) throw new NotFoundException('Homepage revision was not found.');
      if (current.status !== 'DRAFT') throw new ConflictException('Only a homepage draft can be edited.');

      const context = await this.resolveTechnicalContext(tx, payload, input.mediaByRole);
      const technicalRiskHash = computeHomepageTechnicalRiskHash({
        payload,
        specifications: current.specifications,
        sourceRefs: current.sourceRefs,
        references: context.references,
        media: context.media,
        seo: input.seo,
      });
      const previous = current.revision > 1
        ? await tx.websiteContentRevision.findFirst({
          where: { websiteContentId: current.websiteContentId, revision: current.revision - 1 },
          include: { reviews: { orderBy: { createdAt: 'asc' } } },
        })
        : null;
      const carry = resolveTechnicalApprovalCarryForward({
        currentTechnicalRiskHash: technicalRiskHash,
        previousRevision: previous ? {
          id: previous.id,
          technicalRiskHash: previous.technicalRiskHash,
          isImmediatelyPreceding: previous.revision === current.revision - 1,
          reviews: previous.reviews,
        } : null,
      });

      const updated = await tx.websiteContentRevision.updateMany({
        where: { id: revisionId, status: 'DRAFT', updatedAt: expectedUpdatedAt },
        data: {
          title: 'Trang chủ',
          summary: payload.hero.summary,
          body: payload as unknown as Prisma.InputJsonValue,
          technicalRiskHash,
          technicalApprovalSourceRevisionId: carry.allowed ? carry.sourceRevisionId : null,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Bản nháp đã được thay đổi ở phiên khác. Hãy tải lại trước khi lưu.');

      await tx.websiteSeoRecord.upsert({
        where: { revisionId },
        create: { revisionId, ...input.seo },
        update: input.seo,
      });
      await tx.websiteContentMedia.deleteMany({ where: { revisionId } });
      const links = Object.entries(input.mediaByRole)
        .filter((entry): entry is [HomepageMediaRole, string] => Boolean(entry[1]))
        .map(([role, mediaAssetId], sortOrder) => ({ revisionId, mediaAssetId, role, sortOrder }));
      if (links.length) await tx.websiteContentMedia.createMany({ data: links });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION', entityId: revisionId, action: 'HOMEPAGE_DRAFT_SAVED',
          fromState: 'DRAFT', toState: 'DRAFT', actorId: actor.sub,
          metadata: { technicalRiskHash, technicalApprovalSourceRevisionId: carry.allowed ? carry.sourceRevisionId : null },
        },
      });
      return { revisionId, payload, seo: input.seo, mediaByRole: input.mediaByRole, technicalRiskHash };
    });
  }

  async getHomepageReadiness(revisionId: string): Promise<HomepagePublishReadiness> {
    return this.readiness(this.prisma, revisionId);
  }

  async publishHomepage(revisionId: string, actor: JwtUser): Promise<void> {
    if (!canPublish(actor)) throw new ForbiddenException('Bạn không có quyền xuất bản website.');
    await this.prisma.$transaction(async (tx) => {
      const readiness = await this.readiness(tx, revisionId);
      if (!readiness.ready) throw new BadRequestException({ message: 'Homepage is not ready to publish.', ...readiness });
      const current = await tx.websiteContentRevision.findUnique({ where: { id: revisionId } });
      if (!current) throw new NotFoundException('Homepage revision was not found.');
      const publishedAt = new Date();
      await tx.websiteContentRevision.updateMany({
        where: { websiteContentId: current.websiteContentId, status: 'PUBLISHED', id: { not: revisionId } },
        data: { status: 'ARCHIVED' },
      });
      await tx.websiteContentRevision.update({
        where: { id: revisionId },
        data: { status: 'PUBLISHED', publishedAt },
      });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REVISION', entityId: revisionId, action: 'HOMEPAGE_PUBLISHED',
          fromState: current.status, toState: 'PUBLISHED', actorId: actor.sub,
          metadata: { publishedAt: publishedAt.toISOString(), technicalRiskHash: current.technicalRiskHash },
        },
      });
    });
  }

  async getHomepageAdminDetail() {
    const content = await this.prisma.websiteContent.findUnique({
      where: { locale_slug: { locale: 'vi', slug: 'trang-chu' } },
      include: {
        revisions: {
          orderBy: { revision: 'desc' },
          include: {
            reviews: { orderBy: { createdAt: 'asc' } },
            seo: true,
            media: { orderBy: { sortOrder: 'asc' }, include: { mediaAsset: true } },
          },
        },
      },
    });
    if (!content || !content.revisions[0]) throw new NotFoundException('Homepage was not found.');
    const current = content.revisions[0];
    const parsed = parseHomepagePayload(current.body);
    const readiness = await this.readiness(this.prisma, current.id, false);
    return {
      contentId: content.id,
      slug: 'trang-chu' as const,
      locale: 'vi' as const,
      revisionId: current.id,
      revision: current.revision,
      status: current.status,
      updatedAt: current.updatedAt.toISOString(),
      payload: parsed,
      seo: current.seo,
      mediaByRole: Object.fromEntries(current.media.map((link) => [link.role, link.mediaAsset])),
      repairWarnings: readiness.warnings,
      history: content.revisions.map((revision) => ({
        id: revision.id,
        revision: revision.revision,
        status: revision.status,
        updatedAt: revision.updatedAt.toISOString(),
        ...(revision.publishedAt ? { publishedAt: revision.publishedAt.toISOString() } : {}),
        ...(revision.createdById ? { editorId: revision.createdById } : {}),
        reviews: revision.reviews,
      })),
    };
  }

  private async readiness(client: DbClient, revisionId: string, requireApprovals = true): Promise<HomepagePublishReadiness> {
    const revision = await client.websiteContentRevision.findUnique({
      where: { id: revisionId },
      include: {
        reviews: { orderBy: { createdAt: 'asc' } },
        seo: true,
        media: { include: { mediaAsset: true } },
        websiteContent: { select: { slug: true, locale: true } },
      },
    });
    if (!revision) throw new NotFoundException('Homepage revision was not found.');
    const blockers: HomepageReadinessIssue[] = [];
    const warnings: HomepageReadinessIssue[] = [];
    let payload: HomepagePayloadV1 | null = null;
    try {
      payload = parseHomepagePayload(revision.body);
    } catch (error) {
      if (error instanceof HomepagePayloadValidationError) blockers.push(...error.issues);
      else throw error;
    }
    if (revision.websiteContent?.slug !== 'trang-chu' || revision.websiteContent?.locale !== 'vi') {
      blockers.push({ path: 'content', code: 'NOT_HOMEPAGE', message: 'Bản nội dung không thuộc trang chủ tiếng Việt.' });
    }
    if (payload) {
      const ids = referenceIds(payload);
      const rows = await client.websiteContent.findMany({
        where: { id: { in: ids }, revisions: { some: { status: 'PUBLISHED' } } },
        select: { id: true },
      });
      const live = new Set(rows.map((row) => row.id));
      for (const id of ids) {
        if (!live.has(id)) {
          const issue = { path: 'references', code: 'REFERENCE_UNAVAILABLE', message: `Nội dung tham chiếu ${id} chưa được xuất bản hoặc đã lưu trữ.` };
          (requireApprovals ? blockers : warnings).push(issue);
        }
      }
    }
    for (const link of revision.media ?? []) {
      const asset = link.mediaAsset;
      if (asset.archivedAt) blockers.push({ path: `media.${link.role}`, code: 'MEDIA_ARCHIVED', message: 'Tệp đã được lưu trữ và không thể xuất bản.' });
      if (!asset.channels.includes('PUBLIC') || asset.rightsStatus !== 'APPROVED' || asset.intakeStatus !== 'PUBLISHED') {
        blockers.push({ path: `media.${link.role}`, code: 'MEDIA_NOT_PUBLIC', message: 'Tệp chưa đủ điều kiện công khai.' });
      }
    }
    if (!revision.seo) blockers.push({ path: 'seo', code: 'SEO_REQUIRED', message: 'Cần hoàn thiện thông tin SEO trước khi xuất bản.' });
    if (requireApprovals && revision.status !== 'MARKETING_REVIEW') {
      blockers.push({ path: 'status', code: 'MARKETING_REVIEW_REQUIRED', message: 'Bản nháp phải hoàn tất bước duyệt marketing trước khi xuất bản.' });
    }
    const technicalApproved = Boolean(revision.technicalApprovalSourceRevisionId) || latestApproval(revision.reviews, 'TECHNICAL');
    if (requireApprovals && !technicalApproved) blockers.push({ path: 'reviews.technical', code: 'TECHNICAL_APPROVAL_REQUIRED', message: 'Cần phê duyệt kỹ thuật.' });
    if (requireApprovals && !latestApproval(revision.reviews, 'MARKETING')) blockers.push({ path: 'reviews.marketing', code: 'MARKETING_APPROVAL_REQUIRED', message: 'Cần phê duyệt marketing.' });
    const reviewClass = revision.technicalApprovalSourceRevisionId ? 'MARKETING_ONLY' : 'TECHNICAL_AND_MARKETING';
    return { ready: blockers.length === 0, reviewClass, blockers, warnings };
  }

  private async resolveTechnicalContext(client: DbClient, payload: HomepagePayloadV1, mediaByRole: HomepageSaveInput['mediaByRole']) {
    const ids = referenceIds(payload);
    const rows = await client.websiteContent.findMany({
      where: { id: { in: ids }, revisions: { some: { status: 'PUBLISHED' } } },
      select: { id: true, revisions: { where: { status: 'PUBLISHED' }, orderBy: { revision: 'desc' }, take: 1, select: { id: true } } },
    });
    const revisionByContent = new Map(rows.map((row) => [row.id, row.revisions[0]?.id ?? '']));
    const references = ids.map((contentId) => ({ contentId, publishedRevisionId: revisionByContent.get(contentId) ?? '' }));
    const entries = Object.entries(mediaByRole).filter((entry): entry is [HomepageMediaRole, string] => Boolean(entry[1]));
    const mediaIds = [...new Set(entries.map(([, id]) => id))];
    const assets = mediaIds.length ? await client.websiteMediaAsset.findMany({ where: { id: { in: mediaIds } } }) : [];
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const media = entries.map(([role, mediaAssetId]) => {
      const asset = assetById.get(mediaAssetId);
      return { role, mediaAssetId, caption: asset?.caption ?? undefined, transcript: asset?.transcript ?? undefined };
    });
    return { references, media };
  }

  private starterPayload(): HomepagePayloadV1 {
    const cta = (label: string, href: string) => ({ label, href });
    const copy = (title: string, summary: string) => ({ eyebrow: 'EUROHOUSE', title, summary });
    return {
      schemaVersion: 1,
      hero: { ...copy('Định hình không gian. Kiến tạo sản xuất.', 'Nhôm hệ cao cấp cho kiến trúc và giải pháp nhôm định hình cho công nghiệp.'), primaryCta: cta('Khám phá hệ nhôm', '/nhom-dan-dung'), secondaryCta: cta('Năng lực sản xuất', '/nhom-cong-nghiep') },
      productFields: { ...copy('Hai lĩnh vực. Một chuẩn mực.', 'Từ không gian sống đến dây chuyền sản xuất.'), residential: { title: 'NHÔM DÂN DỤNG', summary: 'Hệ nhôm kiến trúc cao cấp.', route: '/nhom-dan-dung', cta: cta('Khám phá', '/nhom-dan-dung') }, industrial: { title: 'NHÔM CÔNG NGHIỆP', summary: 'Profile theo bản vẽ và ứng dụng.', route: '/nhom-cong-nghiep', cta: cta('Khám phá', '/nhom-cong-nghiep') } },
      residential: { ...copy('Hệ nhôm cho từng ngôn ngữ kiến trúc', 'Giải pháp đồng bộ cho công trình.'), dominant: { contentId: 'REPLACE_WITH_PUBLISHED_CONTENT' }, supporting: [], cta: cta('Xem hệ nhôm', '/nhom-dan-dung') },
      industrial: { ...copy('Nhôm định hình theo yêu cầu sản xuất', 'Đùn thuê, gia công và hoàn thiện bề mặt.'), services: [{ contentId: 'REPLACE_WITH_PUBLISHED_SERVICE' }], primaryCta: cta('Gửi bản vẽ', '/lien-he'), secondaryCta: cta('Xem năng lực', '/nang-luc') },
      evidence: { ...copy('Năng lực được chứng minh bằng quy trình', 'Từ khuôn, đùn ép đến gia công hoàn thiện.'), items: [{ title: 'Đùn ép', summary: 'Profile theo ứng dụng.' }, { title: 'Gia công', summary: 'Cắt, khoan và hoàn thiện.' }] },
      projects: { ...copy('Vật liệu đi vào công trình', 'Hình ảnh thực tế từ các ứng dụng tiêu biểu.'), featured: [{ contentId: 'REPLACE_WITH_PUBLISHED_PROJECT' }], cta: cta('Xem dự án', '/du-an') },
      video: copy('Hành trình tạo nên thanh nhôm EUROHOUSE', 'Khám phá quy trình và năng lực sản xuất.'),
      contact: { ...copy('Bắt đầu từ yêu cầu của bạn', 'Trao đổi cùng đội ngũ EUROHOUSE.'), architecturalCta: cta('Tư vấn hệ nhôm', '/lien-he'), industrialCta: cta('Gửi bản vẽ', '/lien-he') },
    };
  }
}
