import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AI_PROVIDER, MuseBridgeProvider } from './ai-provider';
import { RequestGate } from './ai-policy';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AI_GATE, AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AiKnowledgeService,
    // Chưa đặt MUSE_BRIDGE_URL/MUSE_BRIDGE_TOKEN thì AI báo "chưa cấu hình", API vẫn khởi động bình thường.
    { provide: AI_PROVIDER, useFactory: () => new MuseBridgeProvider(process.env.MUSE_BRIDGE_URL ?? '', process.env.MUSE_BRIDGE_TOKEN ?? '') },
    // Trần tổng toàn hệ thống: cả máy chủ dùng chung một tài khoản Muse.
    { provide: AI_GATE, useFactory: () => new RequestGate(Number(process.env.AI_MAX_REQUESTS_PER_HOUR ?? 60), 60 * 60 * 1000) },
  ],
  exports: [AiService, AiKnowledgeService],
})
export class AiModule {}
