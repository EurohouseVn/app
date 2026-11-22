import { createHash } from 'crypto';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_PROVIDER, AiProviderError, type AiProviderPort } from './ai-provider';
import {
  GENERAL_KNOWLEDGE,
  RESEARCH_TOPICS,
  buildCatalogKnowledge,
  buildPrimer,
  buildResearchPrompt,
  parseResearchReply,
  rankKnowledge,
  slugify,
  type KnowledgeEntry,
} from './ai-knowledge';

const CACHE_MS = 5 * 60 * 1000;
const RESEARCH_USER = 'system';
const RESEARCH_ORG = 'system';

@Injectable()
export class AiKnowledgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiKnowledgeService.name);
  private cache: { at: number; entries: KnowledgeEntry[] } | null = null;
  private timers: NodeJS.Timeout[] = [];
  private researching = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProviderPort,
    @Optional() @Inject('AI_KNOWLEDGE_CLOCK') private readonly now: () => number = Date.now,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || !this.provider.configured) return;
    // Không chặn khởi động: nạp kiến thức nền, đẩy "mồi" sang cầu nối, và (nếu bật) lên lịch tự nghiên cứu.
    this.timers.push(setTimeout(() => {
      void (async () => {
        try {
          if ((await this.prisma.aiKnowledge.count()) === 0) await this.seed();
          await this.pushPrimer();
        } catch (error) {
          this.logger.warn(`khởi tạo kiến thức lỗi: ${String((error as Error)?.message ?? error)}`);
        }
      })();
    }, 5000));
    this.timers.push(setInterval(() => { void this.pushPrimer().catch(() => undefined); }, 10 * 60 * 1000));
    if (process.env.AI_RESEARCH_SCHEDULE === 'true') {
      const perRun = Number(process.env.AI_RESEARCH_PER_RUN ?? 3);
      this.timers.push(setInterval(() => { void this.researchNext(perRun).catch(() => undefined); }, 6 * 60 * 60 * 1000));
    }
  }

  onModuleDestroy() { this.timers.forEach((timer) => clearTimeout(timer)); }

  private assertAdmin(user: JwtUser) {
    if (!(user.isCeo || user.role === 'ADMIN')) throw new ForbiddenException('Chỉ quản trị hệ thống được quản lý kiến thức.');
  }

  private invalidate() { this.cache = null; }

  async approved(): Promise<KnowledgeEntry[]> {
    if (this.cache && this.now() - this.cache.at < CACHE_MS) return this.cache.entries;
    const rows = await this.prisma.aiKnowledge.findMany({ where: { status: 'APPROVED' } });
    const entries = rows.map((row: { key: string; topic: string; title: string; content: string; priority: number }) => ({
      key: row.key, topic: row.topic, title: row.title, content: row.content, priority: row.priority,
    }));
    this.cache = { at: this.now(), entries };
    return entries;
  }

  /** Các đoạn kiến thức liên quan nhất tới câu hỏi, đã gọn để chèn vào câu lệnh. */
  async retrieve(query: string): Promise<string[]> {
    const ranked = rankKnowledge(await this.approved(), query, { limit: 3, maxChars: 3000 });
    return ranked.map((entry) => `${entry.title}: ${entry.content}`);
  }

  async seed() {
    const systems = await this.prisma.aluSystem.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true, name: true, description: true,
        profiles: { orderBy: { code: 'asc' }, select: { code: true, name: true, thicknessMm: true, kgPerMeter: true, barLengthMm: true } },
      },
    });
    const colors = await this.prisma.colorCode.findMany({ orderBy: { code: 'asc' }, select: { code: true, name: true } });
    const catalog = buildCatalogKnowledge({ systems, colors });
    let written = 0;
    for (const [origin, entries] of [['GENERAL', GENERAL_KNOWLEDGE], ['CATALOG', catalog]] as const) {
      for (const entry of entries) {
        await this.prisma.aiKnowledge.upsert({
          where: { key: entry.key },
          create: { key: entry.key, topic: entry.topic, title: entry.title, content: entry.content, priority: entry.priority, origin },
          // Danh mục và kiến thức nền được cập nhật theo nguồn; trạng thái do quản trị đặt không bị ghi đè.
          update: { topic: entry.topic, title: entry.title, content: entry.content, priority: entry.priority },
        });
        written += 1;
      }
    }
    this.invalidate();
    return { written };
  }

  async pushPrimer() {
    if (!this.provider.setPrimer) return null;
    const text = buildPrimer(await this.approved());
    const version = createHash('sha1').update(text).digest('hex').slice(0, 12);
    await this.provider.setPrimer(text, version);
    return { version, chars: text.length };
  }

  /** Nhờ Muse tìm hiểu một chủ đề và lưu ghi chú (kèm nguồn) vào CSDL của mình. */
  async research(topic: string) {
    let conversation = await this.prisma.aiConversation.findFirst({ where: { organizationId: RESEARCH_ORG, userId: RESEARCH_USER, kind: 'RESEARCH' } });
    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({ data: { organizationId: RESEARCH_ORG, userId: RESEARCH_USER, kind: 'RESEARCH', title: 'Tự nghiên cứu' } });
    }
    const prompt = buildResearchPrompt(topic);
    let result;
    try {
      result = await this.provider.ask({ threadId: conversation.museThreadId, prompt, timeoutMs: 180_000 });
    } catch (error) {
      if (!(error instanceof AiProviderError) || error.code !== 'THREAD_LOST') throw error;
      result = await this.provider.ask({ prompt, timeoutMs: 180_000 });
    }
    if (result.threadId && result.threadId !== conversation.museThreadId) {
      await this.prisma.aiConversation.update({ where: { id: conversation.id }, data: { museThreadId: result.threadId } });
    }
    const parsed = parseResearchReply(result.text);
    if (parsed.content.length < 120) throw new Error('RESEARCH_TOO_SHORT');
    const key = `research:${slugify(topic)}`;
    const data = { topic, title: topic, content: parsed.content, sources: parsed.sources, origin: 'RESEARCH', priority: 2 };
    await this.prisma.aiKnowledge.upsert({ where: { key }, create: { key, ...data }, update: data });
    this.invalidate();
    return { key, chars: parsed.content.length, sources: parsed.sources.length };
  }

  /** Nghiên cứu tối đa `count` chủ đề chưa có ghi chú; chạy tuần tự để không chiếm tài khoản Muse. */
  async researchNext(count: number) {
    if (this.researching) return { skipped: true, done: [] as string[] };
    this.researching = true;
    const done: string[] = [];
    try {
      const existing = new Set((await this.prisma.aiKnowledge.findMany({ where: { origin: 'RESEARCH' }, select: { key: true } })).map((row: { key: string }) => row.key));
      const pending = RESEARCH_TOPICS.filter((topic) => !existing.has(`research:${slugify(topic)}`)).slice(0, Math.max(0, count));
      for (const topic of pending) {
        try {
          await this.research(topic);
          done.push(topic);
        } catch (error) {
          this.logger.warn(`nghiên cứu "${topic}" lỗi: ${String((error as Error)?.message ?? error)}`);
          if (error instanceof AiProviderError && error.code === 'UNAVAILABLE') break;
        }
      }
      if (done.length) await this.pushPrimer().catch(() => undefined);
      return { skipped: false, done, remaining: RESEARCH_TOPICS.length - existing.size - done.length };
    } finally {
      this.researching = false;
    }
  }

  async list(user: JwtUser) {
    this.assertAdmin(user);
    return this.prisma.aiKnowledge.findMany({
      orderBy: [{ priority: 'desc' }, { key: 'asc' }],
      select: { id: true, key: true, title: true, origin: true, status: true, priority: true, updatedAt: true, sources: true },
    });
  }

  async setStatus(user: JwtUser, id: string, status: 'APPROVED' | 'REJECTED') {
    this.assertAdmin(user);
    const row = await this.prisma.aiKnowledge.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy mục kiến thức.');
    await this.prisma.aiKnowledge.update({ where: { id }, data: { status } });
    this.invalidate();
    return { id, status };
  }

  async adminSeed(user: JwtUser) { this.assertAdmin(user); const seeded = await this.seed(); await this.pushPrimer().catch(() => undefined); return seeded; }
  async adminResearch(user: JwtUser, input: { topic?: string; count?: number }) {
    this.assertAdmin(user);
    if (input.topic?.trim()) {
      const result = await this.research(input.topic.trim());
      await this.pushPrimer().catch(() => undefined);
      return result;
    }
    return this.researchNext(Math.min(Math.max(Math.floor(Number(input.count) || 1), 1), 10));
  }
}
