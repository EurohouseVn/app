import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminWebsiteContentController } from './admin-website-content.controller';
import { PublicWebsiteContentController } from './public-website-content.controller';
import { WebsiteContentQueryService } from './website-content.query.service';
import { WebsiteContentService } from './website-content.service';
import { WebsitePreviewTokenService } from './website-preview-token';

@Module({
  imports: [PrismaModule],
  controllers: [PublicWebsiteContentController, AdminWebsiteContentController],
  providers: [WebsiteContentService, WebsiteContentQueryService, WebsitePreviewTokenService],
  exports: [WebsiteContentService, WebsiteContentQueryService],
})
export class WebsiteContentModule {}
