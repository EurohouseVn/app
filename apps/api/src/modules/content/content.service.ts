import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private toStaticUrl(url?: string | null) {
    if (!url) return url;
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:') || url.startsWith('/static/')) return url;
    return url.startsWith('/') ? `/static${url}` : `/static/${url}`;
  }

  private toPromotion(promotion: any) {
    let gallery: string[] = [];
    if (Array.isArray(promotion.gallery)) {
      gallery = promotion.gallery;
    } else if (typeof promotion.gallery === 'string' && promotion.gallery.trim()) {
      try {
        const parsed = JSON.parse(promotion.gallery);
        gallery = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
      } catch {
        gallery = promotion.imageUrl ? [promotion.imageUrl] : [];
      }
    }
    const imageUrl = this.toStaticUrl(promotion.imageUrl);
    gallery = gallery.map((item) => this.toStaticUrl(item)).filter((item): item is string => typeof item === 'string');
    if (gallery.length === 0 && imageUrl) gallery = [imageUrl];
    return { ...promotion, imageUrl, gallery };
  }

  // --- Promotions ---
  async getPromotions(audience?: 'WORKER' | 'NPP_DEALER') {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        active: true,
        ...(audience ? {
          targetAudience: { in: [audience, 'ALL'] }
        } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    return promotions.map((promotion) => this.toPromotion(promotion));
  }

  async getAllPromotionsAdmin() {
    const promotions = await this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    return promotions.map((promotion) => this.toPromotion(promotion));
  }

  async createPromotion(data: any) {
    return this.prisma.promotion.create({ data });
  }

  async updatePromotion(id: string, data: any) {
    const promotion = await this.prisma.promotion.update({ where: { id }, data });
    return this.toPromotion(promotion);
  }

  async deletePromotion(id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }

  // --- Knowledge Articles ---
  async getKnowledgeArticles(isSharedOnly = true) {
    return this.prisma.knowledgeArticle.findMany({
      where: isSharedOnly ? { isShared: true } : {},
      include: { aluSystem: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createKnowledgeArticle(data: any) {
    return this.prisma.knowledgeArticle.create({ data });
  }

  async updateKnowledgeArticle(id: string, data: any) {
    return this.prisma.knowledgeArticle.update({ where: { id }, data });
  }

  async deleteKnowledgeArticle(id: string) {
    return this.prisma.knowledgeArticle.delete({ where: { id } });
  }

  // --- Library Items ---
  async getLibraryItems() {
    return this.prisma.libraryItem.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createLibraryItem(data: any) {
    return this.prisma.libraryItem.create({ data });
  }

  async updateLibraryItem(id: string, data: any) {
    return this.prisma.libraryItem.update({ where: { id }, data });
  }

  async deleteLibraryItem(id: string) {
    return this.prisma.libraryItem.delete({ where: { id } });
  }
}
