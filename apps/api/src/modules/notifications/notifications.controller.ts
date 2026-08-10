import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  listMyNotifications(@CurrentUser() user: JwtUser) {
    return this.service.listUserNotifications(user.sub);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.markAsRead(id, user.sub);
  }

  @Post('read-all')
  @UseGuards(JwtAuthGuard)
  markAllAsRead(@CurrentUser() user: JwtUser) {
    return this.service.markAllAsRead(user.sub);
  }
}
