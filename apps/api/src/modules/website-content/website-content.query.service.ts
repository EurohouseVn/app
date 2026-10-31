import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WebsiteContentKind, WebsiteProductFamily } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  serializePublishedWebsiteContent,
  serializePublishedWebsiteSummary,
  serializeWebsiteRevisionPreview,
} from './public-website-content.serializer';

const publicRevisionInclude = Prisma.validator<Prisma.WebsiteContentRevisionInclude>()({
  seo: { include: { reviewer: { select: { displayName: true } } } },
  media: {
    orderBy: { sortOrder: 'asc' },
    include: {
      mediaAsset: {
        include: {
          storageObject: { select: { publicUrl: true, metadata: true } },
          posterStorageObject: { select: { publicUrl: true } },
        },
      },
    },
  },
  documents: {
    orderBy: { sortOrder: 'asc' },
    include: {
      document: { include: { storageObject: { select: { publicUrl: true } } } },
    },
  },
});

const publishedContentInclude = Prisma.validator<Prisma.WebsiteContentInclude>()({
  aluSystem: { select: { id: true, code: true, name: true } },
  revisions: {
    where: { status: 'PUBLISHED' },
    orderBy: { revision: 'desc' },
    take: 1,
    include: publicRevisionInclude,
  },
});

export type PublicWebsiteListQuery = {
  family?: WebsiteProductFamily;
  kind?: WebsiteContentKind;
  q?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class WebsiteContentQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(query: PublicWebsiteListQuery = {}) {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize ?? 12)));
    const q = query.q?.trim();
    const where: Prisma.WebsiteContentWhereInput = {
      ...(query.family ? { family: query.family } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      revisions: { some: { status: 'PUBLISHED' } },
      ...(q
        ? {
          OR: [
            { slug: { contains: q, mode: 'insensitive' } },
            {
              revisions: {
                some: {
                  status: 'PUBLISHED',
                  OR: [
                    { title: { contains: q, mode: 'insensitive' } },
                    { summary: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.websiteContent.findMany({
        where,
        include: publishedContentInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.websiteContent.count({ where }),
    ]);
    return {
      items: rows.map(serializePublishedWebsiteSummary).filter((item) => item !== null),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  search(query: Omit<PublicWebsiteListQuery, 'pageSize'>) {
    return this.listPublished({ ...query, pageSize: 20 });
  }

  async getPublished(slug: string, locale = 'vi') {
    const row = await this.prisma.websiteContent.findUnique({
      where: { locale_slug: { locale: locale.toLowerCase(), slug: slug.toLowerCase() } },
      include: publishedContentInclude,
    });
    const serialized = row ? serializePublishedWebsiteContent(row) : null;
    if (!serialized) throw new NotFoundException('Published website content was not found.');
    return serialized;
  }

  async getPreview(slug: string, locale: string, revisionId: string) {
    const row = await this.prisma.websiteContent.findFirst({
      where: {
        slug: slug.toLowerCase(),
        locale: locale.toLowerCase(),
        revisions: { some: { id: revisionId } },
      },
      include: {
        aluSystem: { select: { id: true, code: true, name: true } },
        revisions: {
          where: { id: revisionId },
          take: 1,
          include: publicRevisionInclude,
        },
      },
    });
    const serialized = row ? serializeWebsiteRevisionPreview(row, revisionId) : null;
    if (!serialized) throw new NotFoundException('Preview revision was not found for this content path.');
    return serialized;
  }

  async listPublicDocuments(family?: WebsiteProductFamily, documentType?: string) {
    const rows = await this.prisma.websiteTechnicalDocument.findMany({
      where: {
        channels: { has: 'PUBLIC' },
        ...(documentType ? { documentType } : {}),
        ...(family
          ? {
            contentLinks: {
              some: { revision: { websiteContent: { family } } },
            },
          }
          : {}),
      },
      include: { storageObject: { select: { publicUrl: true } } },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'asc' }],
    });
    return rows
      .filter((row) => Boolean(row.storageObject.publicUrl))
      .map((row) => ({
        id: row.id,
        title: row.title,
        documentType: row.documentType,
        revisionLabel: row.revisionLabel,
        effectiveDate: row.effectiveDate.toISOString(),
        downloadUrl: row.storageObject.publicUrl!,
      }));
  }

  listAdminContent() {
    return this.prisma.websiteContent.findMany({
      select: {
        id: true,
        kind: true,
        family: true,
        slug: true,
        locale: true,
        aluSystem: { select: { id: true, code: true, name: true } },
        revisions: {
          orderBy: { revision: 'desc' },
          select: { id: true, revision: true, status: true, title: true, updatedAt: true, publishedAt: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async getAdminContent(id: string) {
    const row = await this.prisma.websiteContent.findUnique({
      where: { id },
      include: {
        aluSystem: { select: { id: true, code: true, name: true } },
        revisions: {
          orderBy: { revision: 'desc' },
          include: {
            reviews: { orderBy: { createdAt: 'asc' } },
            seo: true,
            media: { orderBy: { sortOrder: 'asc' } },
            documents: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Website content was not found.');
    return row;
  }

  async assertRevisionExists(revisionId: string) {
    const row = await this.prisma.websiteContentRevision.findUnique({
      where: { id: revisionId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Website revision was not found.');
  }

  listAudit(entityId?: string) {
    return this.prisma.websitePublicationAudit.findMany({
      where: entityId ? { entityId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
