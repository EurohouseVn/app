import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Query } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import type {
  RedeemGiftInput,
  AdjustPointsInput,
  CreatePromotionInput,
  UpdatePromotionInput,
  CreateGiftInput,
  UpdateGiftInput,
  CreateLibraryItemInput,
  UpdateLibraryItemInput,
} from '@eurohouse/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';

@Controller()
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  @Get('me/points')
  @UseGuards(JwtAuthGuard)
  myPoints(@CurrentUser() user: JwtUser) {
    return this.service.getUserPoints(user.sub);
  }

  @Post('me/redeem-gift')
  @UseGuards(JwtAuthGuard)
  redeemGift(@Body() body: RedeemGiftInput, @CurrentUser() user: JwtUser) {
    return this.service.redeemGift(user.sub, body);
  }

  @Post('admin/users/:id/points-adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  adjustUserPoints(@Param('id') userId: string, @Body() body: AdjustPointsInput, @CurrentUser() admin: JwtUser) {
    return this.service.adjustUserPoints(userId, body, admin.sub);
  }

//   @Get('promotions')
//   promotions() {
//     return this.service.promotions();
//   }

//   @Get('admin/promotions')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   adminPromotions() {
//     return this.service.adminPromotions();
//   }

//   @Post('admin/promotions')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   createPromotion(@Body() body: CreatePromotionInput) {
//     return this.service.createPromotion(body);
//   }

//   @Patch('admin/promotions/:id')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   updatePromotion(@Param('id') id: string, @Body() body: UpdatePromotionInput) {
//     return this.service.updatePromotion(id, body);
//   }

//   @Delete('admin/promotions/:id')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   deletePromotion(@Param('id') id: string) {
//     return this.service.deletePromotion(id);
//   }

  @Get('gifts')
  gifts() {
    return this.service.gifts();
  }

  @Post('admin/gifts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  createGift(@Body() body: CreateGiftInput) {
    return this.service.createGift(body);
  }

  @Patch('admin/gifts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  updateGift(@Param('id') id: string, @Body() body: UpdateGiftInput) {
    return this.service.updateGift(id, body);
  }

  @Delete('admin/gifts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  deleteGift(@Param('id') id: string) {
    return this.service.deleteGift(id);
  }

//   @Get('library')
//   library() {
//     return this.service.library();
//   }

//   @Post('admin/library')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   createLibraryItem(@Body() body: CreateLibraryItemInput) {
//     return this.service.createLibraryItem(body);
//   }

//   @Patch('admin/library/:id')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   updateLibraryItem(@Param('id') id: string, @Body() body: UpdateLibraryItemInput) {
//     return this.service.updateLibraryItem(id, body);
//   }

//   @Delete('admin/library/:id')
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('ADMIN', 'STAFF')
//   deleteLibraryItem(@Param('id') id: string) {
//     return this.service.deleteLibraryItem(id);
//   }
}
