import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadPromotionImage(
    @Param('id') id: string,
    @UploadedFiles() files: any[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No images provided');

    const imagesDir = path.join(process.cwd(), 'public', 'images', 'promotions');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const imageUrls = files.map((file, index) => {
      const fileExt = path.extname(file.originalname) || '.png';
      const fileName = `${id}-${Date.now()}-${index}${fileExt}`;
      const filePath = path.join(imagesDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      return `/static/images/promotions/${fileName}`;
    });

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
