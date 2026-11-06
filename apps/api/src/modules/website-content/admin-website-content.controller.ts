import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import {
  CreateWebsiteDocumentInput,
  CreateWebsiteMediaInput,
  UpdateWebsiteDocumentInput,
  UpdateWebsiteMediaInput,
  WebsiteAssetsService,
} from './website-assets.service';
import { WebsiteRedirectInput, WebsiteRedirectsService } from './website-redirects.service';
import { SaveHomepageDto } from './dto/homepage.dto';
import { HomepagePublicationService } from './homepage-publication.service';
import { WebsiteMediaUploadService } from './website-media-upload.service';
import { WEBSITE_MEDIA_UPLOAD_OPTIONS, type UploadedFileLike } from '../../common/upload';

@Controller('website/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminWebsiteContentController {
  constructor(
    private readonly commands: WebsiteContentService,
    private readonly query: WebsiteContentQueryService,
    private readonly previewTokens: WebsitePreviewTokenService,
    private readonly assets: WebsiteAssetsService,
    private readonly redirects: WebsiteRedirectsService,
    private readonly homepage: HomepagePublicationService,
    private readonly mediaUploads: WebsiteMediaUploadService,
  ) {}

  @Get('homepage')
  getHomepage(@CurrentUser() actor: JwtUser) {
    return this.homepage.getOrCreateHomepage(actor);
  }

  @Patch('homepage/revisions/:revisionId')
  saveHomepage(
    @Param('revisionId') revisionId: string,
    @Body() input: SaveHomepageDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.homepage.saveHomepageDraft(revisionId, input, actor);
  }

  @Get('homepage/revisions/:revisionId/readiness')
  homepageReadiness(@Param('revisionId') revisionId: string) {
    return this.homepage.getHomepageReadiness(revisionId);
  }

  @Post('homepage/revisions/:revisionId/publish')
  publishHomepage(@Param('revisionId') revisionId: string, @CurrentUser() actor: JwtUser) {
    return this.homepage.publishHomepage(revisionId, actor);
  }

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

  @Post('media')
  createMedia(@Body() input: CreateWebsiteMediaInput, @CurrentUser() actor: JwtUser) {
    return this.assets.createMedia(input, actor);
  }

  @Get('media')
  listMedia(
    @Query('mediaType') mediaType?: 'IMAGE' | 'VIDEO',
    @Query('intakeStatus') intakeStatus?: any,
    @Query('rightsStatus') rightsStatus?: any,
    @Query('q') q?: string,
  ) {
    return this.assets.listMedia({ mediaType, intakeStatus, rightsStatus, q });
  }

  @Post('media/upload')
  @UseInterceptors(FileInterceptor('file', WEBSITE_MEDIA_UPLOAD_OPTIONS))
  uploadMedia(
    @UploadedFile() file: UploadedFileLike,
    @Body() metadata: { altText: string; sourceReference: string; caption?: string; transcript?: string },
    @CurrentUser() actor: JwtUser,
  ) {
    return this.mediaUploads.upload(file, metadata, actor);
  }

  @Post('media/:id/poster')
  @UseInterceptors(FileInterceptor('file', WEBSITE_MEDIA_UPLOAD_OPTIONS))
  uploadMediaPoster(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.mediaUploads.uploadPoster(id, file, actor);
  }

  @Get('media/:id/usages')
  mediaUsages(@Param('id') id: string) {
    return this.assets.getUsage(id);
  }

  @Post('media/:id/archive')
  archiveMedia(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.assets.archiveMedia(id, actor);
  }

  @Patch('media/:id')
  updateMedia(
    @Param('id') id: string,
    @Body() input: UpdateWebsiteMediaInput,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.assets.updateMedia(id, input, actor);
  }

  @Post('revisions/:revisionId/media/:mediaAssetId')
  linkMedia(
    @Param('revisionId') revisionId: string,
    @Param('mediaAssetId') mediaAssetId: string,
    @Body() input: { role?: string; sortOrder?: number },
    @CurrentUser() actor: JwtUser,
  ) {
    return this.assets.linkMedia(revisionId, mediaAssetId, input.role ?? 'CONTENT', input.sortOrder ?? 0, actor);
  }

  @Delete('media-links/:linkId')
  unlinkMedia(@Param('linkId') linkId: string, @CurrentUser() actor: JwtUser) {
    return this.assets.unlinkMedia(linkId, actor);
  }

  @Post('documents')
  createDocument(@Body() input: CreateWebsiteDocumentInput, @CurrentUser() actor: JwtUser) {
    return this.assets.createDocument(input, actor);
  }

  @Patch('documents/:id')
  updateDocument(
    @Param('id') id: string,
    @Body() input: UpdateWebsiteDocumentInput,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.assets.updateDocument(id, input, actor);
  }

  @Post('revisions/:revisionId/documents/:documentId')
  linkDocument(
    @Param('revisionId') revisionId: string,
    @Param('documentId') documentId: string,
    @Body() input: { sortOrder?: number },
    @CurrentUser() actor: JwtUser,
  ) {
    return this.assets.linkDocument(revisionId, documentId, input.sortOrder ?? 0, actor);
  }

  @Delete('document-links/:linkId')
  unlinkDocument(@Param('linkId') linkId: string, @CurrentUser() actor: JwtUser) {
    return this.assets.unlinkDocument(linkId, actor);
  }

  @Get('redirects')
  listRedirects() {
    return this.redirects.list();
  }

  @Post('redirects')
  createRedirect(@Body() input: WebsiteRedirectInput, @CurrentUser() actor: JwtUser) {
    return this.redirects.create(input, actor);
  }

  @Patch('redirects/:id')
  updateRedirect(
    @Param('id') id: string,
    @Body() input: WebsiteRedirectInput,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.redirects.update(id, input, actor);
  }

  @Delete('redirects/:id')
  deactivateRedirect(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.redirects.deactivate(id, actor);
  }
}
