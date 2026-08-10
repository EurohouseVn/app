import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PointReason,
  UserPoints,
  RedeemGiftInput,
  RedeemGiftResult,
  AdjustPointsInput,
  Promotion,
  CreatePromotionInput,
  UpdatePromotionInput,
  GiftItem,
  CreateGiftInput,
  UpdateGiftInput,
  LibraryItem,
  CreateLibraryItemInput,
  UpdateLibraryItemInput,
} from '@eurohouse/types';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  private async awardPoints(
    userId: string, delta: number, reason: PointReason,
    opts?: { refType?: string; refId?: string; note?: string; createdById?: string },
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
      if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
      const balanceAfter = user.points + delta;
      if (balanceAfter < 0) throw new BadRequestException('Số dư điểm không đủ.');
      await tx.user.update({ where: { id: userId }, data: { points: balanceAfter } });
      await tx.pointLedger.create({
        data: {
          userId, delta, balanceAfter, reason, refType: opts?.refType ?? '', refId: opts?.refId ?? '',
          note: opts?.note ?? '', createdById: opts?.createdById ?? null,
        },
      });
      return balanceAfter;
    });
  }

  async getUserPoints(userId: string): Promise<UserPoints> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    const ledger = await this.prisma.pointLedger.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    return {
      points: user.points,
      ledger: ledger.map((l) => ({
        id: l.id, delta: l.delta, balanceAfter: l.balanceAfter, reason: l.reason as PointReason,
        note: l.note, createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async redeemGift(userId: string, input: RedeemGiftInput): Promise<RedeemGiftResult> {
    const giftId = (input.giftId ?? '').trim();
    if (!giftId) throw new BadRequestException('Vui lòng chọn quà cần đổi.');
    const gift = await this.prisma.gift.findUnique({ where: { id: giftId } });
    if (!gift) throw new NotFoundException('Không tìm thấy quà.');
    if (gift.stock !== null && gift.stock <= 0) throw new BadRequestException('Quà đã hết hàng.');

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
      if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
      if (user.points < gift.points) throw new BadRequestException('Số dư điểm không đủ để đổi quà này.');
      const balanceAfter = user.points - gift.points;
      await tx.user.update({ where: { id: userId }, data: { points: balanceAfter } });
      const redemption = await tx.giftRedemption.create({
        data: { userId, giftId: gift.id, giftName: gift.name, pointsCost: gift.points },
      });
      await tx.pointLedger.create({
        data: {
          userId, delta: -gift.points, balanceAfter, reason: 'REDEEM', refType: 'GIFT',
          refId: redemption.id, note: `Đổi quà: ${gift.name}`,
        },
      });
      if (gift.stock !== null) {
        await tx.gift.update({ where: { id: gift.id }, data: { stock: { decrement: 1 } } });
      }
      return balanceAfter;
    });

    return { giftName: gift.name, pointsCost: gift.points, pointsBalance: result };
  }

  async adjustUserPoints(userId: string, input: AdjustPointsInput, createdById?: string): Promise<UserPoints> {
    const delta = Math.trunc(input.delta ?? 0);
    if (!delta) throw new BadRequestException('Số điểm điều chỉnh phải khác 0.');
    await this.awardPoints(userId, delta, 'ADMIN_ADJUST', { note: input.note ?? '', createdById });
    return this.getUserPoints(userId);
  }

  // private toPromotion(p: {
  //   id: string; title: string; subtitle: string; imageUrl: string; bannerUrl: string;
  //   gallery: string; content: string; active: boolean; startDate: Date | null; endDate: Date | null;
  // }): Promotion {
  //   return null as any;
  // }
  //
  // private parseGallery(raw: string): string[] {
  //   return [];
  // }
  //
  // async promotions(): Promise<Promotion[]> {
  //   return [];
  // }
  //
  // async adminPromotions(): Promise<Promotion[]> {
  //   return [];
  // }
  //
  // async createPromotion(data: CreatePromotionInput): Promise<Promotion> {
  //   return null as any;
  // }
  //
  // async updatePromotion(id: string, data: UpdatePromotionInput): Promise<Promotion> {
  //   return null as any;
  // }
  //
  // async deletePromotion(id: string): Promise<{ id: string }> {
  //   return { id };
  // }

  private toGift(g: { id: string; name: string; points: number; icon: string; imageUrl: string; stock: number }): GiftItem {
    return { id: g.id, name: g.name, points: g.points, icon: g.icon, imageUrl: g.imageUrl, stock: g.stock };
  }

  async gifts(): Promise<GiftItem[]> {
    const list = await this.prisma.gift.findMany({ orderBy: { points: 'asc' } });
    return list.map((g) => this.toGift(g));
  }

  async createGift(data: CreateGiftInput): Promise<GiftItem> {
    if (!data.name?.trim()) throw new BadRequestException('Vui lòng nhập tên quà.');
    const created = await this.prisma.gift.create({
      data: {
        name: data.name.trim(), points: Math.max(0, Math.trunc(data.points ?? 0)),
        icon: data.icon ?? '', imageUrl: data.imageUrl ?? '', stock: Math.max(0, Math.trunc(data.stock ?? 0)),
      },
    });
    return this.toGift(created);
  }

  async updateGift(id: string, data: UpdateGiftInput): Promise<GiftItem> {
    const existing = await this.prisma.gift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy quà.');
    const updated = await this.prisma.gift.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.points !== undefined ? { points: Math.max(0, Math.trunc(data.points)) } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.stock !== undefined ? { stock: Math.max(0, Math.trunc(data.stock)) } : {}),
      },
    });
    return this.toGift(updated);
  }

  async deleteGift(id: string): Promise<{ id: string }> {
    const existing = await this.prisma.gift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy quà.');
    await this.prisma.gift.delete({ where: { id } });
    return { id };
  }

//   private toLibraryItem(l: { id: string; type: string; title: string; imageUrl: string; videoUrl: string; tag: string }) {
//     return { id: l.id, type: l.type, title: l.title, imageUrl: l.imageUrl, videoUrl: l.videoUrl, tag: l.tag };
//   }

//   async library() {
//     return [];
//   }

//   async createLibraryItem(data: CreateLibraryItemInput) {
//     return null as any;
//   }

//   async updateLibraryItem(id: string, data: UpdateLibraryItemInput) {
//     return null as any;
//   }

//   async deleteLibraryItem(id: string) {
//     return { id };
//   }
}
