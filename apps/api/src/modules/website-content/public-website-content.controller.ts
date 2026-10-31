import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WebsiteContentKind, WebsiteProductFamily } from '@prisma/client';
import { WebsiteContentQueryService } from './website-content.query.service';
import { WebsitePreviewTokenService } from './website-preview-token';

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

function family(value?: string): WebsiteProductFamily | undefined {
  if (!value) return undefined;
  if (value === 'RESIDENTIAL' || value === 'INDUSTRIAL') return value;
  throw new BadRequestException('Unknown website product family.');
}

function kind(value?: string): WebsiteContentKind | undefined {
  if (!value) return undefined;
  if (Object.values(WebsiteContentKind).includes(value as WebsiteContentKind)) {
    return value as WebsiteContentKind;
  }
  throw new BadRequestException('Unknown website content kind.');
}

function page(value?: string): number {
  if (!value) return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('Page must be a positive integer.');
  return parsed;
}

@Controller('public/website')
export class PublicWebsiteContentController {
  constructor(
    private readonly query: WebsiteContentQueryService,
    private readonly previewTokens: WebsitePreviewTokenService,
  ) {}

  @Get('content')
  @Header('Cache-Control', PUBLIC_CACHE)
  list(
    @Query('family') familyValue?: string,
    @Query('kind') kindValue?: string,
    @Query('q') q?: string,
    @Query('page') pageValue?: string,
  ) {
    return this.query.listPublished({
      family: family(familyValue),
      kind: kind(kindValue),
      q,
      page: page(pageValue),
    });
  }

  @Get('content/:slug')
  async detail(
    @Param('slug') slug: string,
    @Query('locale') locale = 'vi',
    @Query('previewToken') previewToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (previewToken) {
      response.setHeader('Cache-Control', 'private, no-store');
      const payload = this.previewTokens.verify(previewToken);
      return this.query.getPreview(slug, locale, payload.revisionId);
    }
    response.setHeader('Cache-Control', PUBLIC_CACHE);
    return this.query.getPublished(slug, locale);
  }

  @Get('documents')
  @Header('Cache-Control', PUBLIC_CACHE)
  documents(
    @Query('family') familyValue?: string,
    @Query('type') documentType?: string,
  ) {
    return this.query.listPublicDocuments(family(familyValue), documentType?.trim());
  }

  @Get('search')
  @Header('Cache-Control', PUBLIC_CACHE)
  search(
    @Query('q') q?: string,
    @Query('family') familyValue?: string,
    @Query('kind') kindValue?: string,
    @Query('page') pageValue?: string,
  ) {
    return this.query.search({
      q,
      family: family(familyValue),
      kind: kind(kindValue),
      page: page(pageValue),
    });
  }
}
