import test from 'node:test';
import assert from 'node:assert/strict';
import { AiService } from './ai.service';
import { AiProviderError, type AiProviderAsk, type AiProviderPort, type AiProviderResult } from './ai-provider';
import { RequestGate } from './ai-policy';

type Row = Record<string, any>;

function fixture(options: { replies?: Array<AiProviderResult | AiProviderError>; gateLimit?: number } = {}) {
  const profiles: Row[] = [];
  const conversations: Row[] = [];
  const messages: Row[] = [];
  const images: Row[] = [];
  const stored: Row[] = [];
  let seq = 0;
  const id = (prefix: string) => `${prefix}${++seq}`;
  const now = new Date('2026-11-22T10:00:00.000Z');
  const match = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
      if (value && typeof value === 'object' && 'gt' in value) return row[key] > value.gt;
      return row[key] === value;
    });
  const prisma: any = {
    organization: {
      findUnique: async ({ where }: any) => ({ id: where.id, name: where.id === 'org-a' ? 'Xưởng An' : 'Xưởng Bình' }),
    },
    aiWorkspaceProfile: {
      findUnique: async ({ where }: any) => profiles.find((row) => row.organizationId === where.organizationId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = profiles.find((row) => row.organizationId === where.organizationId);
        if (existing) return Object.assign(existing, update);
        const row = { id: id('p'), enabled: true, systemInstructions: '', imageWeeklyLimit: 10, ...create };
        profiles.push(row);
        return row;
      },
    },
    aiConversation: {
      findFirst: async ({ where }: any) => conversations.find((row) => match(row, where)) ?? null,
      create: async ({ data }: any) => {
        const row = { id: id('c'), museThreadId: null, summary: '', title: '', createdAt: now, updatedAt: now, ...data };
        conversations.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(conversations.find((row) => row.id === where.id)!, data),
      findMany: async ({ where }: any) => conversations.filter((row) => match(row, where)),
    },
    aiMessage: {
      create: async ({ data }: any) => {
        const row = { id: id('m'), status: 'DONE', createdAt: new Date(now.getTime() + seq), ...data };
        messages.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(messages.find((row) => row.id === where.id)!, data),
      findMany: async ({ where, take }: any) => {
        const rows = messages.filter((row) => match(row, where)).sort((a, b) => a.createdAt - b.createdAt);
        return take ? rows.slice(-take) : rows;
      },
      findFirst: async ({ where }: any) => [...messages].reverse().find((row) => match(row, where)) ?? null,
    },
    aiImage: {
      create: async ({ data }: any) => {
        const row = { id: id('i'), status: 'PENDING', createdAt: now, ...data };
        images.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(images.find((row) => row.id === where.id)!, data),
      findMany: async ({ where }: any) => images.filter((row) => match(row, where)),
      findFirst: async ({ where }: any) => images.find((row) => match(row, where)) ?? null,
    },
  };
  const calls: AiProviderAsk[] = [];
  const replies = [...(options.replies ?? [])];
  const provider: AiProviderPort = {
    configured: true,
    ask: async (input) => {
      calls.push(input);
      const next = replies.shift() ?? { threadId: 't-1', text: 'Trả lời mẫu', images: [] };
      if (next instanceof AiProviderError) throw next;
      return next;
    },
  };
  const storage: any = {
    putUpload: async (input: Row) => {
      const row = { id: id('s'), ...input };
      stored.push(row);
      return row;
    },
    read: async () => ({ object: { mime: 'image/webp' }, body: Buffer.from('x') }),
  };
  const service = new AiService(prisma, provider, storage, new RequestGate(options.gateLimit ?? 100, 60_000), () => now);
  return { service, profiles, conversations, messages, images, stored, calls };
}

const userA = { sub: 'u-a', role: 'FACTORY' as const, organizationId: 'org-a', email: 'a@example.com' } as any;
const userB = { sub: 'u-b', role: 'FACTORY' as const, organizationId: 'org-b', email: 'b@example.com' } as any;

test('a new conversation replays the workshop prompt and stores both sides in the database', async () => {
  const { service, messages, conversations, calls } = fixture();
  const result = await service.chat(userA, { message: 'Cửa đi 4 cánh dùng hệ nào?' });
  assert.equal(result.reply, 'Trả lời mẫu');
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].museThreadId, 't-1');
  assert.deepEqual(messages.map((row) => row.role), ['USER', 'ASSISTANT']);
  assert.match(calls[0].prompt, /Xưởng An/);
  assert.equal(calls[0].threadId ?? null, null);
});

test('the next message reuses the thread and sends only the short reminder', async () => {
  const { service, calls } = fixture();
  const first = await service.chat(userA, { message: 'câu 1' });
  await service.chat(userA, { conversationId: first.conversationId, message: 'câu 2' });
  assert.equal(calls[1].threadId, 't-1');
  assert.equal(calls[1].prompt.includes('[QUY TẮC RIÊNG'), false);
  assert.match(calls[1].prompt, /câu 2/);
});

test('a lost thread (new Muse account) is rebuilt from the stored history', async () => {
  const { service, calls, conversations } = fixture({
    replies: [
      { threadId: 't-1', text: 'A1', images: [] },
      new AiProviderError('THREAD_LOST'),
      { threadId: 't-2', text: 'A2', images: [] },
    ],
  });
  const first = await service.chat(userA, { message: 'câu 1' });
  const second = await service.chat(userA, { conversationId: first.conversationId, message: 'câu 2' });
  assert.equal(second.reply, 'A2');
  assert.equal(conversations[0].museThreadId, 't-2');
  assert.equal(calls[2].threadId ?? null, null);
  assert.match(calls[2].prompt, /câu 1/);
  assert.match(calls[2].prompt, /A1/);
});

test('when the provider is down the user message is kept and a retry does not duplicate it', async () => {
  const { service, messages } = fixture({
    replies: [new AiProviderError('UNAVAILABLE'), { threadId: 't-1', text: 'ổn rồi', images: [] }],
  });
  await assert.rejects(() => service.chat(userA, { message: 'xin chào' }), /AI_UNAVAILABLE/);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, 'FAILED');
  const conversationId = messages[0].conversationId;
  const retried = await service.chat(userA, { conversationId, message: 'xin chào' });
  assert.equal(retried.reply, 'ổn rồi');
  assert.deepEqual(messages.map((row) => `${row.role}:${row.status}`), ['USER:DONE', 'ASSISTANT:DONE']);
});

test('another workshop cannot read or continue a conversation (tenant isolation)', async () => {
  const { service } = fixture();
  const first = await service.chat(userA, { message: 'bí mật của xưởng An' });
  await assert.rejects(() => service.chat(userB, { conversationId: first.conversationId, message: 'đọc trộm' }), /không tìm thấy/i);
  await assert.rejects(() => service.messages(userB, first.conversationId), /không tìm thấy/i);
});

test('disabled workspace and missing organization are refused', async () => {
  const { service, profiles } = fixture();
  await service.updateProfile(userA, { enabled: false });
  assert.equal(profiles[0].enabled, false);
  await assert.rejects(() => service.chat(userA, { message: 'hi' }), /đã tắt/i);
  await assert.rejects(() => service.chat({ sub: 'x', role: 'FACTORY' } as any, { message: 'hi' }), /tổ chức/i);
});

test('global gate stops requests when the shared Muse account is saturated', async () => {
  const { service } = fixture({ gateLimit: 1 });
  await service.chat(userA, { message: 'một' });
  await assert.rejects(() => service.chat(userA, { message: 'hai' }), /AI_BUSY/);
});

test('image: stores the file, counts toward the weekly limit and blocks the 11th', async () => {
  const image = { mime: 'image/webp', base64: Buffer.from('abc').toString('base64'), width: 498, height: 332 };
  const { service, images, stored, calls } = fixture({
    replies: Array.from({ length: 12 }, () => ({ threadId: 'ti', text: 'xong', images: [image] })),
  });
  let last: any;
  for (let index = 0; index < 10; index += 1) last = await service.createImage(userA, { prompt: `cửa sổ nhôm ${index}` });
  assert.equal(last.quota.used, 10);
  assert.equal(last.quota.remaining, 0);
  assert.equal(stored.length, 10);
  assert.equal(stored[0].ownerOrganizationId, 'org-a');
  assert.equal(calls[0].expectImage, true);
  assert.equal(images.every((row) => row.status === 'DONE'), true);
  await assert.rejects(() => service.createImage(userA, { prompt: 'ảnh thứ 11' }), /IMAGE_LIMIT_REACHED/);
  const other = await service.createImage(userB, { prompt: 'ảnh của xưởng Bình' });
  assert.equal(other.quota.used, 1);
});

test('image failure does not consume quota and chat replies never leak images', async () => {
  const { service, images } = fixture({
    replies: [
      { threadId: 'ti', text: 'không tạo được', images: [] },
      { threadId: 't-1', text: 'đây là câu trả lời', images: [{ mime: 'image/png', base64: 'eA==' }] },
    ],
  });
  await assert.rejects(() => service.createImage(userA, { prompt: 'cửa' }), /IMAGE_FAILED/);
  assert.equal(images[0].status, 'FAILED');
  const status = await service.status(userA);
  assert.equal(status.imageQuota.used, 0);
  const chat = await service.chat(userA, { message: 'vẽ cho tôi cái cửa' });
  assert.equal((chat as any).images, undefined);
});
