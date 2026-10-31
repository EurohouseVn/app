import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { WebsiteReviewStage } from '@eurohouse/types';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { CreateWebsiteContentDto } from './dto/create-website-content.dto';
import { ReviewWebsiteRevisionDto } from './dto/review-website-revision.dto';
import { UpdateWebsiteRevisionDto } from './dto/update-website-revision.dto';
import { WebsiteContentQueryService } from './website-content.query.service';
import { WebsiteContentService } from './website-content.service';
import { WebsitePreviewTokenService } from './website-preview-token';

@Controller('website/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminWebsiteContentController {
  constructor(
    private readonly commands: WebsiteContentService,
    private readonly query: WebsiteContentQueryService,
    private readonly previewTokens: WebsitePreviewTokenService,
  ) {}

  @Get('content')
  listContent() {
    return this.query.listAdminContent();
  }

  @Get('content/:id')
  getContent(@Param('id') id: string) {
    return this.query.getAdminContent(id);
  }

  @Post('content')
  createContent(@Body() input: CreateWebsiteContentDto, @CurrentUser() actor: JwtUser) {
    return this.commands.createContent(input, actor);
  }

  @Post('content/:contentId/revisions')
  createDraftRevision(@Param('contentId') contentId: string, @CurrentUser() actor: JwtUser) {
    return this.commands.createDraftRevision(contentId, actor);
  }

  @Patch('revisions/:revisionId')
  updateDraft(
    @Param('revisionId') revisionId: string,
    @Body() input: UpdateWebsiteRevisionDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.commands.updateDraft(revisionId, input, actor);
  }

  @Post('revisions/:revisionId/submit/:stage')
  submit(
    @Param('revisionId') revisionId: string,
    @Param('stage') stageValue: string,
    @CurrentUser() actor: JwtUser,
  ) {
    const stage = stageValue.toUpperCase();
    if (stage !== 'TECHNICAL' && stage !== 'MARKETING') {
      throw new BadRequestException('Review stage must be TECHNICAL or MARKETING.');
    }
    return this.commands.submit(revisionId, stage as WebsiteReviewStage, actor);
  }

  @Post('revisions/:revisionId/review')
  review(
    @Param('revisionId') revisionId: string,
    @Body() input: ReviewWebsiteRevisionDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.commands.review(revisionId, input, actor);
  }

  @Post('revisions/:revisionId/publish')
  publish(@Param('revisionId') revisionId: string, @CurrentUser() actor: JwtUser) {
    return this.commands.publish(revisionId, actor);
  }

  @Post('content/:contentId/archive')
  archive(@Param('contentId') contentId: string, @CurrentUser() actor: JwtUser) {
    return this.commands.archive(contentId, actor);
  }

  @Get('audit')
  audit(@Query('entityId') entityId?: string) {
    return this.query.listAudit(entityId);
  }

  @Post('revisions/:revisionId/preview-token')
  async previewToken(@Param('revisionId') revisionId: string) {
    await this.query.assertRevisionExists(revisionId);
    return this.previewTokens.issue(revisionId);
  }
}
