import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AI_PROVIDER, AiProviderError, type AiProviderPort } from './ai-provider';
import { AiKnowledgeService } from './ai-knowledge.service';
import {
  ASSISTANT_NAME,
  RequestGate,
  buildMusePrompt,
  sanitizeUserText,
  type PromptTurn,
} from './ai-policy';

export const AI_GATE = Symbol('AI_GATE');
export const AI_CLOCK = Symbol('AI_CLOCK');

const MAX_MESSAGE_CHARS = 4000;
const MAX_INSTRUCTION_CHARS = 4000;
const HISTORY_TURNS = 40;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProviderPort,
    private readonly storage: StorageService,
    @Inject(AI_GATE) private readonly gate: RequestGate,
    @Optional() @Inject(AI_CLOCK) private readonly clock: () => Date = () => new Date(),
    @Optional() private readonly knowledge?: AiKnowledgeService,
  ) {}

  private organizationId(user: JwtUser): string {
    if (!user.organizationId) throw new ForbiddenException('Tài khoản chưa được gắn tổ chức.');
    return user.organizationId;
  }

  private async profile(organizationId: string) {
    return this.prisma.aiWorkspaceProfile.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
  }

  private async workshopName(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
    return organization?.name ?? 'Xưởng';
  }

  async status(user: JwtUser) {
    const organizationId = this.organizationId(user);
    const profile = await this.profile(organizationId);
    return { assistantName: ASSISTANT_NAME, configured: this.provider.configured, enabled: profile.enabled };
  }

  async getProfile(user: JwtUser) {
    const profile = await this.profile(this.organizationId(user));
    return { enabled: profile.enabled, systemInstructions: profile.systemInstructions };
  }

  async updateProfile(user: JwtUser, body: { enabled?: boolean; systemInstructions?: string }) {
    const organizationId = this.organizationId(user);
    const data: { enabled?: boolean; systemInstructions?: string } = {};
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.systemInstructions === 'string') data.systemInstructions = sanitizeUserText(body.systemInstructions, MAX_INSTRUCTION_CHARS);
    await this.profile(organizationId);
    const saved = await this.prisma.aiWorkspaceProfile.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
    return { enabled: saved.enabled, systemInstructions: saved.systemInstructions };
  }

  async conversations(user: JwtUser) {
    const organizationId = this.organizationId(user);
    return this.prisma.aiConversation.findMany({
      where: { organizationId, userId: user.sub, kind: 'CHAT' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, updatedAt: true },
    });
  }

  async messages(user: JwtUser, conversationId: string) {
    const organizationId = this.organizationId(user);
    const conversation = await this.prisma.aiConversation.findFirst({ where: { id: conversationId, organizationId, userId: user.sub, kind: 'CHAT' } });
    if (!conversation) throw new NotFoundException('Không tìm thấy cuộc trò chuyện.');
    return this.prisma.aiMessage.findMany({
      where: { conversationId, status: 'DONE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  async chat(user: JwtUser, input: { conversationId?: string; message: string }) {
    const organizationId = this.organizationId(user);
    const profile = await this.profile(organizationId);
    if (!profile.enabled) throw new ForbiddenException('Trợ lý AI của xưởng đã tắt.');
    const message = sanitizeUserText(String(input.message ?? ''), MAX_MESSAGE_CHARS);
    if (!message) throw new BadRequestException('Vui lòng nhập nội dung.');

    let conversation = input.conversationId
      ? await this.prisma.aiConversation.findFirst({ where: { id: input.conversationId, organizationId, userId: user.sub, kind: 'CHAT' } })
      : null;
    if (input.conversationId && !conversation) throw new NotFoundException('Không tìm thấy cuộc trò chuyện.');
    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({
        data: { organizationId, userId: user.sub, kind: 'CHAT', title: message.slice(0, 60) },
      });
    }

    if (!this.gate.tryAcquire()) throw new HttpException('AI_BUSY', HttpStatus.TOO_MANY_REQUESTS);

    const previous = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id, status: 'DONE' },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_TURNS,
    });
    const history: PromptTurn[] = previous.map((row: { role: string; content: string }) => ({
      role: row.role === 'USER' ? 'USER' : 'ASSISTANT',
      content: row.content,
    }));

    // Gửi lại đúng câu hỏi đang lỗi thì dùng lại, không tạo bản sao.
    const failed = await this.prisma.aiMessage.findFirst({
      where: { conversationId: conversation.id, role: 'USER', status: 'FAILED', content: message },
    });
    const userMessage = failed
      ? await this.prisma.aiMessage.update({ where: { id: failed.id }, data: { status: 'DONE' } })
      : await this.prisma.aiMessage.create({
          data: { conversationId: conversation.id, organizationId, userId: user.sub, role: 'USER', content: message },
        });

    const name = await this.workshopName(organizationId);
    const facts = this.knowledge ? await this.knowledge.retrieve(message).catch(() => []) : [];
    const build = (mode: 'replay' | 'continue') =>
      buildMusePrompt({ workshopName: name, systemInstructions: profile.systemInstructions ?? '', summary: conversation!.summary ?? '', history, message, mode, knowledge: facts });

    try {
      let result;
      if (conversation.museThreadId) {
        try {
          result = await this.provider.ask({ threadId: conversation.museThreadId, prompt: build('continue') });
        } catch (error) {
          if (!(error instanceof AiProviderError) || error.code !== 'THREAD_LOST') throw error;
          result = await this.provider.ask({ prompt: build('replay') });
        }
      } else {
        result = await this.provider.ask({ prompt: build('replay') });
      }
      const reply = result.text.trim();
      if (!reply) throw new AiProviderError('UNAVAILABLE', 'EMPTY_REPLY');
      const assistant = await this.prisma.aiMessage.create({
        data: { conversationId: conversation.id, organizationId, userId: user.sub, role: 'ASSISTANT', content: reply },
      });
      await this.prisma.aiConversation.update({ where: { id: conversation.id }, data: { museThreadId: result.threadId ?? conversation.museThreadId } });
      return { conversationId: conversation.id, messageId: assistant.id, reply };
    } catch (error) {
      await this.prisma.aiMessage.update({ where: { id: userMessage.id }, data: { status: 'FAILED' } });
      if (error instanceof AiProviderError) throw new ServiceUnavailableException('AI_UNAVAILABLE');
      throw error;
    }
  }
}
