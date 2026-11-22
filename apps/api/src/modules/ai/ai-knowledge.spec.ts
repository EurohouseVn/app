import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESEARCH_TOPICS,
  buildCatalogKnowledge,
  buildPrimer,
  buildResearchPrompt,
  normalizeText,
  parseResearchReply,
  rankKnowledge,
  slugify,
  type KnowledgeEntry,
} from './ai-knowledge';
import { buildMusePrompt } from './ai-policy';

const entry = (over: Partial<KnowledgeEntry>): KnowledgeEntry => ({ key: 'k', topic: 't', title: 'Tiêu đề', content: 'Nội dung', priority: 0, ...over });

test('normalizeText lowercases and strips Vietnamese diacritics including đ', () => {
  assert.equal(normalizeText('Nhôm Đùn ÉP – Sơn Tĩnh Điện'), 'nhom dun ep – son tinh dien');
});

test('rankKnowledge puts the entry whose title and text match the question first', () => {
  const entries = [
    entry({ key: 'a', title: 'Sơn tĩnh điện', content: 'Lớp sơn bột phủ bề mặt nhôm, màu bền.' }),
    entry({ key: 'b', title: 'Kính cường lực', content: 'Kính tôi nhiệt chịu lực gấp 4 lần.' }),
    entry({ key: 'c', title: 'Hệ Ecento 70', content: 'Hệ cửa mở quay cao cấp, thanh 70mm.' }),
  ];
  const ranked = rankKnowledge(entries, 'sơn tĩnh điện có bền không?', { limit: 2, maxChars: 5000 });
  assert.equal(ranked[0].key, 'a');
  assert.equal(ranked.some((item) => item.key === 'b'), false);
});

test('rankKnowledge respects the character budget and returns nothing for unrelated questions', () => {
  const entries = [entry({ key: 'a', title: 'Nhôm', content: 'nhôm '.repeat(400) }), entry({ key: 'b', title: 'Nhôm hệ 55', content: 'nhôm 55 ' + 'x'.repeat(500) })];
  const ranked = rankKnowledge(entries, 'nhôm', { limit: 5, maxChars: 700 });
  assert.equal(ranked.length, 1);
  assert.deepEqual(rankKnowledge(entries, 'thời tiết hôm nay thế nào', { limit: 3, maxChars: 5000 }), []);
});

test('catalog knowledge is built from systems, profiles and colors', () => {
  const entries = buildCatalogKnowledge({
    systems: [{
      code: 'EU-70', name: 'Hệ 70 Ecento', description: 'Cửa mở quay cao cấp',
      profiles: [{ code: 'C3225', name: 'Khung cửa đi', thicknessMm: '1.4', kgPerMeter: 1.234, barLengthMm: 6000 }],
    }],
    colors: [{ code: 'W', name: 'Trắng' }],
  });
  const keys = entries.map((item) => item.key);
  assert.ok(keys.includes('catalog:overview'));
  assert.ok(keys.includes('catalog:system:eu-70'));
  assert.ok(keys.includes('catalog:colors'));
  const system = entries.find((item) => item.key === 'catalog:system:eu-70')!;
  assert.match(system.content, /C3225/);
  assert.match(system.content, /1,234 kg\/m/);
  assert.match(system.content, /6\.000 mm/);
  assert.equal(entries.find((item) => item.key === 'catalog:overview')!.priority > 0, true);
});

test('primer packs the highest-priority knowledge within budget and ends with the ready instruction', () => {
  const entries = [
    entry({ key: 'low', title: 'Thấp', content: 'x'.repeat(2000), priority: 1 }),
    entry({ key: 'high', title: 'Cao', content: 'Nội dung quan trọng', priority: 9 }),
  ];
  const primer = buildPrimer(entries, 1600);
  assert.match(primer, /Bé Eu/);
  assert.match(primer, /Nội dung quan trọng/);
  assert.equal(primer.includes('xxxxxxxxxx'), false);
  assert.match(primer, /SẴN SÀNG/);
});

test('research prompt asks for a self-contained note with sources and the reply is parsed', () => {
  const prompt = buildResearchPrompt('Sơn tĩnh điện cho nhôm');
  assert.match(prompt, /Sơn tĩnh điện cho nhôm/);
  assert.match(prompt, /NGUỒN:/);
  const parsed = parseResearchReply('Sơn tĩnh điện là...\n- Độ dày 60–80 µm\nNGUỒN:\nhttps://example.com/a\n- https://example.org/b.');
  assert.match(parsed.content, /Độ dày 60/);
  assert.equal(parsed.content.includes('NGUỒN'), false);
  assert.deepEqual(parsed.sources, ['https://example.com/a', 'https://example.org/b']);
  assert.equal(parseResearchReply('   ').content, '');
});

test('research topics are unique, non-empty and slugify to stable keys', () => {
  assert.ok(RESEARCH_TOPICS.length >= 20);
  assert.equal(new Set(RESEARCH_TOPICS.map(slugify)).size, RESEARCH_TOPICS.length);
  assert.equal(slugify('Sơn tĩnh điện cho nhôm'), 'son-tinh-dien-cho-nhom');
});

test('knowledge is injected into both the replay and the continue prompt', () => {
  const knowledge = ['Hệ 70 Ecento: thanh 70mm, mở quay.'];
  const replay = buildMusePrompt({ workshopName: 'Xưởng An', systemInstructions: '', summary: '', history: [], message: 'hệ 70 là gì', mode: 'replay', knowledge });
  const again = buildMusePrompt({ workshopName: 'Xưởng An', systemInstructions: '', summary: '', history: [], message: 'hệ 70 là gì', mode: 'continue', knowledge });
  for (const prompt of [replay, again]) {
    assert.match(prompt, /KIẾN THỨC EUROHOUSE/);
    assert.match(prompt, /thanh 70mm/);
  }
  const none = buildMusePrompt({ workshopName: 'Xưởng An', systemInstructions: '', summary: '', history: [], message: 'chào', mode: 'continue' });
  assert.equal(none.includes('KIẾN THỨC EUROHOUSE'), false);
});
