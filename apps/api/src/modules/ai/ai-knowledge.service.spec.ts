import test from 'node:test';
import assert from 'node:assert/strict';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiProviderError, type AiProviderAsk, type AiProviderPort, type AiProviderResult } from './ai-provider';
import { RESEARCH_TOPICS, slugify } from './ai-knowledge';

type Row = Record<string, any>;

function fixture(replies: Array<AiProviderResult | AiProviderError> = []) {
  const knowledge: Row[] = [];
  const conversations: Row[] = [];
  let seq = 0;
  const prisma: any = {
    aluSystem: {
      findMany: async () => [{
        code: 'EU-70', name: 'Hệ 70 Ecento', description: 'Cửa mở quay cao cấp',
        profiles: [{ code: 'C3225', name: 'Khung cửa đi', thicknessMm: '1.4', kgPerMeter: 1.234, barLengthMm: 6000 }],
      }],
    },
    colorCode: { findMany: async () => [{ code: 'W', name: 'Trắng' }] },
    aiKnowledge: {
      count: async () => knowledge.length,
      findMany: async ({ where }: any = {}) => knowledge.filter((row) => !where || Object.entries(where).every(([key, value]) => row[key] === value)),
      findUnique: async ({ where }: any) => knowledge.find((row) => row.id === where.id) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = knowledge.find((row) => row.key === where.key);
        if (existing) return Object.assign(existing, update);
        const row = { id: `k${++seq}`, status: 'APPROVED', ...create };
        knowledge.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(knowledge.find((row) => row.id === where.id)!, data),
    },
    aiConversation: {
      findFirst: async () => conversations[0] ?? null,
      create: async ({ data }: any) => {
        const row = { id: 'c1', museThreadId: null, ...data };
        conversations.push(row);
        return row;
      },
      update: async ({ data }: any) => Object.assign(conversations[0], data),
    },
  };
  const calls: AiProviderAsk[] = [];
  const primers: Array<{ text: string; version: string }> = [];
  const queue = [...replies];
  const provider: AiProviderPort = {
    configured: true,
    ask: async (input) => {
      calls.push(input);
      const next = queue.shift() ?? {
        threadId: 'rt',
        text: `Ghi chú về chủ đề. ${'Nội dung chi tiết hữu ích về nhôm. '.repeat(10)}\nNGUỒN:\nhttps://example.com/n`,
        images: [],
      };
      if (next instanceof AiProviderError) throw next;
      return next;
    },
    setPrimer: async (text, version) => {
      primers.push({ text, version });
    },
  };
  const service = new AiKnowledgeService(prisma, provider, () => Date.now());
  return { service, knowledge, calls, primers };
}

const admin = { sub: 'a', role: 'ADMIN' } as any;
const worker = { sub: 'w', role: 'FACTORY', organizationId: 'org' } as any;

test('seed writes the general knowledge and the Eurohouse catalog and retrieval finds them', async () => {
  const { service, knowledge } = fixture();
  const result = await service.seed();
  assert.ok(result.written >= 10);
  assert.ok(knowledge.some((row) => row.key === 'catalog:system:eu-70' && row.origin === 'CATALOG'));
  assert.ok(knowledge.some((row) => row.key === 'general:dau-thua' && row.origin === 'GENERAL'));
  const facts = await service.retrieve('đầu thừa sau khi cắt nhôm xử lý thế nào?');
  assert.match(facts[0], /Đầu thừa/);
  const system = await service.retrieve('hệ 70 Ecento có mã thanh C3225 không');
  assert.match(system.join('\n'), /C3225/);
  assert.deepEqual(await service.retrieve('thời tiết hôm nay'), []);
});

test('research stores a note with its sources and refuses answers that are too short', async () => {
  const { service, knowledge, calls } = fixture();
  const saved = await service.research('Sơn tĩnh điện cho nhôm');
  assert.equal(saved.key, 'research:son-tinh-dien-cho-nhom');
  assert.equal(saved.sources, 1);
  assert.deepEqual(knowledge[0].sources, ['https://example.com/n']);
  assert.equal(knowledge[0].origin, 'RESEARCH');
  assert.match(calls[0].prompt, /Sơn tĩnh điện cho nhôm/);
  const short = fixture([{ threadId: 't', text: 'ngắn', images: [] }]);
  await assert.rejects(() => short.service.research('Chủ đề'), /RESEARCH_TOO_SHORT/);
});

test('researchNext only covers topics without a note, up to the requested count, and refreshes the primer', async () => {
  const { service, knowledge, primers } = fixture();
  await service.research(RESEARCH_TOPICS[0]);
  const run = await service.researchNext(2);
  assert.equal(run.done.length, 2);
  assert.equal(run.done.includes(RESEARCH_TOPICS[0]), false);
  assert.equal(knowledge.filter((row) => row.origin === 'RESEARCH').length, 3);
  assert.equal(primers.length, 1);
  assert.equal(knowledge.some((row) => row.key === `research:${slugify(RESEARCH_TOPICS[1])}`), true);
});

test('research stops early when the provider is unavailable', async () => {
  const { service } = fixture([new AiProviderError('UNAVAILABLE'), new AiProviderError('UNAVAILABLE')]);
  const run = await service.researchNext(3);
  assert.deepEqual(run.done, []);
});

test('only administrators manage knowledge and rejected notes are no longer used', async () => {
  const { service, knowledge } = fixture();
  await service.seed();
  await assert.rejects(() => service.list(worker), /quản trị/);
  await assert.rejects(() => service.adminSeed(worker), /quản trị/);
  const row = knowledge.find((item) => item.key === 'general:dau-thua')!;
  assert.equal((await service.retrieve('đầu thừa nhôm')).length > 0, true);
  await service.setStatus(admin, row.id, 'REJECTED');
  const after = await service.retrieve('đầu thừa nhôm');
  assert.equal(after.some((text) => text.startsWith('Đầu thừa và hao hụt')), false);
});

test('pushPrimer sends the packed knowledge with a stable version', async () => {
  const { service, primers } = fixture();
  await service.seed();
  const first = await service.pushPrimer();
  const second = await service.pushPrimer();
  assert.equal(first!.version, second!.version);
  assert.equal(primers.length, 2);
  assert.match(primers[0].text, /SẴN SÀNG/);
  assert.match(primers[0].text, /Các hệ nhôm Eurohouse/);
});
