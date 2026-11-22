import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { KNOWLEDGE_ARTICLES } from './knowledge-articles';
import { importCatalog, seedKnowledgeArticles } from './seed-knowledge-library';

const CATEGORIES = new Set(['PRODUCT_INFO', 'CONSTRUCTION_GUIDE', 'CUTTING_GUIDE', 'CREATIVE_GUIDE']);

test('knowledge articles are complete, unique and cover all four categories', () => {
  assert.ok(KNOWLEDGE_ARTICLES.length >= 12);
  assert.equal(new Set(KNOWLEDGE_ARTICLES.map((article) => article.title)).size, KNOWLEDGE_ARTICLES.length);
  for (const article of KNOWLEDGE_ARTICLES) {
    assert.ok(CATEGORIES.has(article.categoryId), article.title);
    assert.ok(article.content.length > 600, `${article.title} quá ngắn`);
    assert.equal(article.content.includes('TODO'), false);
  }
  assert.equal(new Set(KNOWLEDGE_ARTICLES.map((article) => article.categoryId)).size, 4);
});

function fakePrisma() {
  const articles: any[] = [];
  const items: any[] = [];
  let seq = 0;
  return {
    articles,
    items,
    knowledgeArticle: {
      findFirst: async ({ where }: any) => articles.find((row) => row.title === where.title) ?? null,
      create: async ({ data }: any) => { const row = { id: `a${++seq}`, ...data }; articles.push(row); return row; },
      update: async ({ where, data }: any) => Object.assign(articles.find((row) => row.id === where.id), data),
    },
    libraryItem: {
      findFirst: async ({ where }: any) => items.find((row) => row.title === where.title && row.categoryId === where.categoryId) ?? null,
      create: async ({ data }: any) => { const row = { id: `l${++seq}`, ...data }; items.push(row); return row; },
    },
  };
}

test('seeding articles is idempotent and shares every article publicly', async () => {
  const prisma = fakePrisma();
  const first = await seedKnowledgeArticles(prisma);
  assert.equal(first.created, KNOWLEDGE_ARTICLES.length);
  const second = await seedKnowledgeArticles(prisma);
  assert.deepEqual(second, { created: 0, updated: KNOWLEDGE_ARTICLES.length });
  assert.equal(prisma.articles.length, KNOWLEDGE_ARTICLES.length);
  assert.equal(prisma.articles.every((row) => row.isShared === true || row.isShared === undefined), true);
});

test('catalog import stores a PDF once and rejects non-PDF files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-'));
  try {
    const pdf = path.join(dir, 'catalog.pdf');
    await fs.writeFile(pdf, Buffer.from('%PDF-1.7\nfake'));
    const txt = path.join(dir, 'x.pdf');
    await fs.writeFile(txt, 'not a pdf');
    const prisma = fakePrisma();
    const uploads: any[] = [];
    const storage = { putUpload: async (input: any) => { uploads.push(input); return { publicUrl: '/static/uploads/x/catalog.pdf' } as any; } };
    const first = await importCatalog(prisma, storage as any, pdf, 'Catalog R19');
    assert.equal(first.skipped, false);
    assert.equal(prisma.items[0].categoryId, 'PRODUCT_CATALOG');
    assert.equal(prisma.items[0].mediaType, 'DOCUMENT');
    assert.equal(prisma.items[0].mediaUrl, '/static/uploads/x/catalog.pdf');
    assert.equal(uploads[0].mime, 'application/pdf');
    const second = await importCatalog(prisma, storage as any, pdf, 'Catalog R19');
    assert.equal(second.skipped, true);
    assert.equal(uploads.length, 1);
    await assert.rejects(() => importCatalog(prisma, storage as any, txt, 'Khác'), /không phải PDF/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
