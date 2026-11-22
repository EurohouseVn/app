import { Body, Controller, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.service.status(user);
  }

  @Get('profile')
  profile(@CurrentUser() user: JwtUser) {
    return this.service.getProfile(user);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: JwtUser, @Body() body: { enabled?: boolean; systemInstructions?: string; imageWeeklyLimit?: number }) {
    return this.service.updateProfile(user, body ?? {});
  }

  @Get('conversations')
  conversations(@CurrentUser() user: JwtUser) {
    return this.service.conversations(user);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.messages(user, id);
  }

  @Post('chat')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  chat(@CurrentUser() user: JwtUser, @Body() body: { conversationId?: string; message: string }) {
    return this.service.chat(user, body ?? ({} as { message: string }));
  }

  @Post('images')
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  createImage(@CurrentUser() user: JwtUser, @Body() body: { prompt: string }) {
    return this.service.createImage(user, body ?? ({} as { prompt: string }));
  }

  @Get('images')
  images(@CurrentUser() user: JwtUser) {
    return this.service.listImages(user);
  }

  @Get('images/:id/file')
  async imageFile(@CurrentUser() user: JwtUser, @Param('id') id: string, @Res() res: any) {
    const { mime, body } = await this.service.imageFile(user, id);
    res.set({ 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600', 'Content-Length': body.length });
    res.end(body);
  }
}
