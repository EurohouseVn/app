import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export function normalizeInternalRedirectPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new BadRequestException('Redirect path is required.');
  if (trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('\\')) {
    throw new BadRequestException('Redirect paths cannot contain query strings, fragments, or backslashes.');
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) {
    throw new BadRequestException('Only internal redirect paths are allowed.');
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    throw new BadRequestException('Redirect path contains invalid encoding.');
  }
  if (decoded.startsWith('//') || decoded.includes('?') || decoded.includes('#') || decoded.includes('\\')) {
    throw new BadRequestException('Only internal redirect paths without query or fragment are allowed.');
  }
  const normalized = `/${trimmed}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

export type WebsiteRedirectInput = {
  sourcePath: string;
  destinationPath: string;
  statusCode?: number;
  active?: boolean;
};

function validatePair(input: WebsiteRedirectInput) {
  const sourcePath = normalizeInternalRedirectPath(input.sourcePath);
  const destinationPath = normalizeInternalRedirectPath(input.destinationPath);
  if (sourcePath === destinationPath) throw new BadRequestException('A redirect cannot point to itself.');
  if (sourcePath === '/') throw new BadRequestException('The site root cannot be a redirect source.');
  const statusCode = input.statusCode ?? 301;
  if (statusCode !== 301 && statusCode !== 308) {
    throw new BadRequestException('Permanent redirects must use status 301 or 308.');
  }
  return { sourcePath, destinationPath, statusCode, active: input.active ?? true };
}

@Injectable()
export class WebsiteRedirectsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.websiteRedirect.findMany({ orderBy: [{ active: 'desc' }, { sourcePath: 'asc' }] });
  }

  async resolve(path: string) {
    const sourcePath = normalizeInternalRedirectPath(path);
    const row = await this.prisma.websiteRedirect.findUnique({ where: { sourcePath } });
    if (!row?.active) return null;
    return { destinationPath: row.destinationPath, statusCode: row.statusCode };
  }

  async create(input: WebsiteRedirectInput, actor: JwtUser) {
    const data = validatePair(input);
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.websiteRedirect.findUnique({ where: { sourcePath: data.sourcePath } });
      if (duplicate) throw new ConflictException('A redirect already exists for this source path.');
      await this.assertSingleHop(tx, data.sourcePath, data.destinationPath);
      const created = await tx.websiteRedirect.create({
        data: { ...data, createdById: actor.sub },
      });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REDIRECT',
          entityId: created.id,
          action: 'REDIRECT_CREATED',
          actorId: actor.sub,
          metadata: { sourcePath: data.sourcePath, destinationPath: data.destinationPath },
        },
      });
      return created;
    });
  }

  async update(id: string, input: WebsiteRedirectInput, actor: JwtUser) {
    const data = validatePair(input);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteRedirect.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Website redirect was not found.');
      const duplicate = await tx.websiteRedirect.findUnique({ where: { sourcePath: data.sourcePath } });
      if (duplicate && duplicate.id !== id) throw new ConflictException('A redirect already exists for this source path.');
      await this.assertSingleHop(tx, data.sourcePath, data.destinationPath, id);
      const updated = await tx.websiteRedirect.update({ where: { id }, data });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REDIRECT',
          entityId: id,
          action: 'REDIRECT_UPDATED',
          actorId: actor.sub,
          metadata: { sourcePath: data.sourcePath, destinationPath: data.destinationPath, active: data.active },
        },
      });
      return updated;
    });
  }

  async deactivate(id: string, actor: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.websiteRedirect.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Website redirect was not found.');
      const updated = await tx.websiteRedirect.update({ where: { id }, data: { active: false } });
      await tx.websitePublicationAudit.create({
        data: {
          entityType: 'WEBSITE_REDIRECT',
          entityId: id,
          action: 'REDIRECT_DEACTIVATED',
          actorId: actor.sub,
          metadata: { sourcePath: current.sourcePath },
        },
      });
      return updated;
    });
  }

  private async assertSingleHop(
    tx: Prisma.TransactionClient,
    sourcePath: string,
    destinationPath: string,
    excludeId?: string,
  ) {
    const conflict = await tx.websiteRedirect.findFirst({
      where: {
        active: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { sourcePath: destinationPath },
          { destinationPath: sourcePath },
        ],
      },
    });
    if (conflict) {
      throw new BadRequestException('Redirect chains and loops are not allowed; use one direct hop.');
    }
  }
}
