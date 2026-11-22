import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, type JwtUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles('ADMIN', 'STAFF', 'FACTORY', 'DAILY')
export class AiController {
  constructor(private readonly service: AiService, private readonly knowledge: AiKnowledgeService) {}

  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.service.status(user);
  }

  @Get('profile')
  profile(@CurrentUser() user: JwtUser) {
    return this.service.getProfile(user);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: JwtUser, @Body() body: { enabled?: boolean; systemInstructions?: string }) {
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

  // ── Kho kiến thức ngành nhôm (chỉ quản trị hệ thống) ──
  @Get('knowledge')
  knowledgeList(@CurrentUser() user: JwtUser) {
    return this.knowledge.list(user);
  }

  @Post('knowledge/seed')
  knowledgeSeed(@CurrentUser() user: JwtUser) {
    return this.knowledge.adminSeed(user);
  }

  @Post('knowledge/research')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  knowledgeResearch(@CurrentUser() user: JwtUser, @Body() body: { topic?: string; count?: number }) {
    return this.knowledge.adminResearch(user, body ?? {});
  }

  @Put('knowledge/:id/status')
  knowledgeStatus(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED' }) {
    return this.knowledge.setStatus(user, id, body?.status === 'REJECTED' ? 'REJECTED' : 'APPROVED');
  }
}
