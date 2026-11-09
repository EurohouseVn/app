import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { imageExtension, IMAGE_UPLOAD_OPTIONS, pdfExtension, PDF_UPLOAD_OPTIONS, uploadedFileBuffer } from '../../common/upload';
import { StorageService } from '../storage/storage.service';

@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService, private readonly storage: StorageService) {}

  // --- Promotions ---
  @Get('promotions')
  getPromotions(@Query('audience') audience?: 'WORKER' | 'NPP_DEALER') {
    return this.service.getPromotions(audience);
  }

  @Get('admin/promotions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  getAllPromotionsAdmin() {
    return this.service.getAllPromotionsAdmin();
  }

  @Post('admin/promotions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createPromotion(@Body() body: any) {
    return this.service.createPromotion(body);
  }

  @Patch('admin/promotions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updatePromotion(@Param('id') id: string, @Body() body: any) {
    return this.service.updatePromotion(id, body);
  }

  @Delete('admin/promotions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  deletePromotion(@Param('id') id: string) {
    return this.service.deletePromotion(id);
  }

  @Post('admin/promotions/:id/image')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN', 'STAFF')
  @Throttle({ default: { limit: 15, ttl: 600_000 } })
  @UseInterceptors(FilesInterceptor('images', 10, IMAGE_UPLOAD_OPTIONS))
  async uploadPromotionImage(
    @Param('id') id: string,
    @UploadedFiles() files: any[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No images provided');

    const storedImages = await Promise.all(files.map(async (file, index) => this.storage.putUpload({
      buffer: await uploadedFileBuffer(file),
      originalName: file.originalname,
      mime: file.mimetype,
      purpose: 'promotion-image',
      extension: imageExtension(file),
      metadata: { promotionId: id, galleryIndex: index },
    })));
    const imageUrls = storedImages.map((item) => item.publicUrl).filter((url): url is string => Boolean(url));
    if (imageUrls.length !== files.length) throw new BadRequestException('Storage provider does not expose public URLs for promotion images.');

    const imageUrl = imageUrls[0];
    const gallery = JSON.stringify(imageUrls);

    return this.service.updatePromotion(id, { imageUrl, gallery });
  }

  @Delete('admin/promotions/:id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async clearPromotionImages(@Param('id') id: string) {
    return this.service.updatePromotion(id, { imageUrl: '', gallery: '[]' });
  }

  // --- Knowledge Articles ---
  @Get('knowledge')
  getKnowledgeArticles() {
    return this.service.getKnowledgeArticles(true);
  }

  @Get('admin/knowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  getAllKnowledgeArticlesAdmin() {
    return this.service.getKnowledgeArticles(false);
  }

  @Post('admin/knowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createKnowledgeArticle(@Body() body: any) {
    return this.service.createKnowledgeArticle(body);
  }

  @Patch('admin/knowledge/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateKnowledgeArticle(@Param('id') id: string, @Body() body: any) {
    return this.service.updateKnowledgeArticle(id, body);
  }

  @Delete('admin/knowledge/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  deleteKnowledgeArticle(@Param('id') id: string) {
    return this.service.deleteKnowledgeArticle(id);
  }

  // --- Library Items ---
  @Get('library')
  getLibraryItems() {
    return this.service.getLibraryItems();
  }

  @Get('admin/library')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  getLibraryItemsAdmin() {
    return this.service.getLibraryItems(false);
  }

  @Post('admin/library/catalog')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles('ADMIN', 'STAFF')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('file', PDF_UPLOAD_OPTIONS))
  async uploadCatalog(
    @UploadedFile() file: any,
    @Body() body: { title?: string; description?: string },
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file catalog PDF.');
    const buffer = await uploadedFileBuffer(file);
    const extension = pdfExtension(file, buffer);
    const stored = await this.storage.putUpload({
      buffer,
      originalName: file.originalname,
      mime: file.mimetype,
      purpose: 'product-catalog',
      extension,
      metadata: { title: body.title || file.originalname },
    });
    if (!stored.publicUrl) throw new BadRequestException('Kho tệp chưa cung cấp đường dẫn công khai cho catalog.');

    return this.service.createLibraryItem({
      title: body.title?.trim() || String(file.originalname || 'Catalog Eurohouse').replace(/\.pdf$/i, ''),
      description: body.description?.trim() || null,
      mediaUrl: stored.publicUrl,
      mediaType: 'DOCUMENT',
      categoryId: 'PRODUCT_CATALOG',
    });
  }

  @Post('admin/library')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createLibraryItem(@Body() body: any) {
    return this.service.createLibraryItem(body);
  }

  @Patch('admin/library/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateLibraryItem(@Param('id') id: string, @Body() body: any) {
    return this.service.updateLibraryItem(id, body);
  }

  @Delete('admin/library/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  deleteLibraryItem(@Param('id') id: string) {
    return this.service.deleteLibraryItem(id);
  }
}
