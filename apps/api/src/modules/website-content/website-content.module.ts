import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminWebsiteContentController } from './admin-website-content.controller';
import { PublicWebsiteContentController } from './public-website-content.controller';
import { WebsiteContentQueryService } from './website-content.query.service';
import { WebsiteContentService } from './website-content.service';
import { WebsitePreviewTokenService } from './website-preview-token';
import { WebsiteAssetsService } from './website-assets.service';
import { WebsiteRedirectsService } from './website-redirects.service';
import { HomepagePublicationService } from './homepage-publication.service';
import { WebsiteMediaUploadService } from './website-media-upload.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicWebsiteContentController, AdminWebsiteContentController],
  providers: [
    WebsiteContentService,
    WebsiteContentQueryService,
    WebsitePreviewTokenService,
    WebsiteAssetsService,
    WebsiteRedirectsService,
    HomepagePublicationService,
    WebsiteMediaUploadService,
  ],
  exports: [WebsiteContentService, WebsiteContentQueryService],
})
export class WebsiteContentModule {}
