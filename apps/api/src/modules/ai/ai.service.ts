import {
  BadGatewayException,
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
import {
  IMAGE_WEEKLY_LIMIT,
  RequestGate,
  buildImagePrompt,
  buildMusePrompt,
  imageQuota,
  sanitizeUserText,
  type PromptTurn,
} from './ai-policy';

export const AI_GATE = Symbol('AI_GATE');
export const AI_CLOCK = Symbol('AI_CLOCK');

const MAX_MESSAGE_CHARS = 4000;
const MAX_IMAGE_PROMPT_CHARS = 1000;
const MAX_INSTRUCTION_CHARS = 4000;
const HISTORY_TURNS = 40;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXTENSIONS: Record<string, string> = { 'image/webp': '.webp', 'image/png': '.png', 'image/jpeg': '.jpg' };

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProviderPort,
    private readonly storage: StorageService,
    @Inject(AI_GATE) private readonly gate: RequestGate,
    @Optional() @Inject(AI_CLOCK) private readonly clock: () => Date = () => new Date(),
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

  private async imageStamps(organizationId: string, userId: string) {
    const rows = await this.prisma.aiImage.findMany({
      where: { organizationId, userId, status: { in: ['PENDING', 'DONE'] }, createdAt: { gt: new Date(this.clock().getTime() - WEEK_MS) } },
      select: { createdAt: true },
    });
    return rows.map((row: { createdAt: Date }) => row.createdAt);
  }

  async status(user: JwtUser) {
    const organizationId = this.organizationId(user);
    const profile = await this.profile(organizationId);
    const quota = imageQuota(await this.imageStamps(organizationId, user.sub), this.clock(), profile.imageWeeklyLimit ?? IMAGE_WEEKLY_LIMIT);
    return { configured: this.provider.configured, enabled: profile.enabled, imageQuota: quota };
  }

  async getProfile(user: JwtUser) {
    const profile = await this.profile(this.organizationId(user));
    return { enabled: profile.enabled, systemInstructions: profile.systemInstructions, imageWeeklyLimit: profile.imageWeeklyLimit };
  }

  async updateProfile(user: JwtUser, body: { enabled?: boolean; systemInstructions?: string; imageWeeklyLimit?: number }) {
    const organizationId = this.organizationId(user);
    const data: { enabled?: boolean; systemInstructions?: string; imageWeeklyLimit?: number } = {};
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.systemInstructions === 'string') data.systemInstructions = sanitizeUserText(body.systemInstructions, MAX_INSTRUCTION_CHARS);
    if (body.imageWeeklyLimit !== undefined) {
      if (!(user.isCeo || user.role === 'ADMIN')) throw new ForbiddenException('Chỉ quản trị hệ thống được đổi hạn mức ảnh.');
      const limit = Math.floor(Number(body.imageWeeklyLimit));
      if (!Number.isFinite(limit) || limit < 0 || limit > 1000) throw new BadRequestException('Hạn mức ảnh không hợp lệ.');
      data.imageWeeklyLimit = limit;
    }
    await this.profile(organizationId);
    const saved = await this.prisma.aiWorkspaceProfile.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
    return { enabled: saved.enabled, systemInstructions: saved.systemInstructions, imageWeeklyLimit: saved.imageWeeklyLimit };
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
    const build = (mode: 'replay' | 'continue') =>
      buildMusePrompt({ workshopName: name, systemInstructions: profile.systemInstructions ?? '', summary: conversation!.summary ?? '', history, message, mode });

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

  async createImage(user: JwtUser, input: { prompt: string }) {
    const organizationId = this.organizationId(user);
    const profile = await this.profile(organizationId);
    if (!profile.enabled) throw new ForbiddenException('Trợ lý AI của xưởng đã tắt.');
    const prompt = sanitizeUserText(String(input.prompt ?? ''), MAX_IMAGE_PROMPT_CHARS);
    if (!prompt) throw new BadRequestException('Vui lòng mô tả ảnh cần tạo.');

    const limit = profile.imageWeeklyLimit ?? IMAGE_WEEKLY_LIMIT;
    const before = imageQuota(await this.imageStamps(organizationId, user.sub), this.clock(), limit);
    if (before.remaining <= 0) {
      throw new HttpException({ message: 'IMAGE_LIMIT_REACHED', resetsAt: before.resetsAt?.toISOString() ?? null }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!this.gate.tryAcquire()) throw new HttpException('AI_BUSY', HttpStatus.TOO_MANY_REQUESTS);

    const record = await this.prisma.aiImage.create({ data: { organizationId, userId: user.sub, prompt } });
    let conversation = await this.prisma.aiConversation.findFirst({ where: { organizationId, userId: user.sub, kind: 'IMAGE' } });
    if (!conversation) conversation = await this.prisma.aiConversation.create({ data: { organizationId, userId: user.sub, kind: 'IMAGE', title: 'Tạo ảnh' } });

    const name = await this.workshopName(organizationId);
    try {
      const askWith = (threadId?: string | null) => this.provider.ask({ threadId, prompt: buildImagePrompt(name, prompt), timeoutMs: 180_000, expectImage: true });
      let result;
      try {
        result = await askWith(conversation.museThreadId);
      } catch (error) {
        if (!(error instanceof AiProviderError) || error.code !== 'THREAD_LOST') throw error;
        result = await askWith(null);
      }
      const image = result.images[0];
      if (!image) {
        await this.prisma.aiImage.update({ where: { id: record.id }, data: { status: 'FAILED', error: 'NO_IMAGE' } });
        throw new BadGatewayException('IMAGE_FAILED');
      }
      const buffer = Buffer.from(image.base64, 'base64');
      const object = await this.storage.putUpload({
        buffer,
        mime: image.mime,
        purpose: 'ai-image',
        ownerOrganizationId: organizationId,
        ownerUserId: user.sub,
        extension: EXTENSIONS[image.mime] ?? '.png',
        metadata: { prompt },
      });
      await this.prisma.aiImage.update({
        where: { id: record.id },
        data: { status: 'DONE', storageObjectId: object.id, mime: image.mime, width: image.width ?? 0, height: image.height ?? 0 },
      });
      if (result.threadId && result.threadId !== conversation.museThreadId) {
        await this.prisma.aiConversation.update({ where: { id: conversation.id }, data: { museThreadId: result.threadId } });
      }
      const quota = imageQuota(await this.imageStamps(organizationId, user.sub), this.clock(), limit);
      return { id: record.id, url: `/ai/images/${record.id}/file`, quota };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      await this.prisma.aiImage.update({ where: { id: record.id }, data: { status: 'FAILED', error: String((error as Error)?.message ?? error).slice(0, 200) } });
      if (error instanceof AiProviderError) throw new ServiceUnavailableException('AI_UNAVAILABLE');
      throw error;
    }
  }

  async listImages(user: JwtUser) {
    const organizationId = this.organizationId(user);
    const rows = await this.prisma.aiImage.findMany({
      where: { organizationId, userId: user.sub, status: 'DONE' },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { id: true, prompt: true, createdAt: true, width: true, height: true },
    });
    return rows.map((row: { id: string; prompt: string; createdAt: Date; width: number; height: number }) => ({ ...row, url: `/ai/images/${row.id}/file` }));
  }

  async imageFile(user: JwtUser, id: string) {
    const organizationId = this.organizationId(user);
    const image = await this.prisma.aiImage.findFirst({ where: { id, organizationId, userId: user.sub, status: 'DONE' } });
    if (!image?.storageObjectId) throw new NotFoundException('Không tìm thấy ảnh.');
    const { object, body } = await this.storage.read(image.storageObjectId);
    return { mime: object.mime, body };
  }
}
