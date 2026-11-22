/**
 * Nạp bài kiến thức ngành nhôm vào màn "Kiến thức" và (tuỳ chọn) đưa catalog PDF mới nhất vào thư viện.
 *
 *   node -r ts-node/register scripts/seed-knowledge-library.ts [--catalog=/đường/dẫn/catalog.pdf] [--title="Catalog Eurohouse R19"]
 *
 * Chạy lặp lại an toàn: bài viết cập nhật theo tiêu đề, catalog cùng tiêu đề không nạp lại.
 */
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalStorageProvider } from '../src/modules/storage/local-storage.provider';
import { StorageService } from '../src/modules/storage/storage.service';
import { KNOWLEDGE_ARTICLES } from './knowledge-articles';

type PrismaLike = {
  knowledgeArticle: { findFirst: (args: any) => Promise<any>; create: (args: any) => Promise<any>; update: (args: any) => Promise<any> };
  libraryItem: { findFirst: (args: any) => Promise<any>; create: (args: any) => Promise<any> };
};

export async function seedKnowledgeArticles(prisma: PrismaLike) {
  let created = 0;
  let updated = 0;
  for (const article of KNOWLEDGE_ARTICLES) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { title: article.title } });
    if (existing) {
      await prisma.knowledgeArticle.update({ where: { id: existing.id }, data: { content: article.content, categoryId: article.categoryId, isShared: true } });
      updated += 1;
    } else {
      await prisma.knowledgeArticle.create({ data: { title: article.title, content: article.content, categoryId: article.categoryId, isShared: true } });
      created += 1;
    }
  }
  return { created, updated };
}

export async function importCatalog(prisma: PrismaLike, storage: Pick<StorageService, 'putUpload'>, filePath: string, title: string) {
  const existing = await prisma.libraryItem.findFirst({ where: { title, categoryId: 'PRODUCT_CATALOG' } });
  if (existing) return { skipped: true, id: existing.id as string };
  const buffer = await fs.readFile(filePath);
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Tệp không phải PDF.');
  const stored = await storage.putUpload({
    buffer,
    originalName: path.basename(filePath),
    mime: 'application/pdf',
    purpose: 'product-catalog',
    extension: '.pdf',
    metadata: { title },
  });
  if (!stored.publicUrl) throw new Error('Kho tệp chưa cung cấp đường dẫn công khai.');
  const item = await prisma.libraryItem.create({
    data: {
      title,
      description: 'Catalog sản phẩm Eurohouse bản mới nhất: các hệ nhôm, mã thanh, hình mặt cắt và ứng dụng.',
      mediaUrl: stored.publicUrl,
      mediaType: 'DOCUMENT',
      categoryId: 'PRODUCT_CATALOG',
    },
  });
  return { skipped: false, id: item.id as string, url: stored.publicUrl };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const args = process.argv.slice(2);
    const catalogPath = args.find((arg) => arg.startsWith('--catalog='))?.slice('--catalog='.length);
    const title = args.find((arg) => arg.startsWith('--title='))?.slice('--title='.length) ?? 'Catalog Eurohouse R19 (tháng 10/2026)';
    console.log('Bài kiến thức:', await seedKnowledgeArticles(prisma as unknown as PrismaLike));
    if (catalogPath) {
      const storage = new StorageService(new LocalStorageProvider(), prisma as never);
      console.log('Catalog:', await importCatalog(prisma as unknown as PrismaLike, storage, catalogPath, title));
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
