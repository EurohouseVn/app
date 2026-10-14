import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function ensureInside(parent: string, child: string) {
  const parentResolved = path.resolve(parent);
  const childResolved = path.resolve(child);
  const rel = path.relative(parentResolved, childResolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing to touch path outside ${parentResolved}: ${childResolved}`);
  }
  return childResolved;
}

function removeIfExists(baseDir: string, fileName: string | undefined) {
  if (!fileName) return false;
  const target = ensureInside(baseDir, path.join(baseDir, fileName));
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { force: true });
  return true;
}

async function main() {
  const all = await prisma.formulaTemplate.findMany({
    orderBy: [{ isPopular: 'desc' }, { windowTypeName: 'asc' }, { templateName: 'asc' }],
  });
  const doorModels = await prisma.doorModel.findMany({ select: { imageUrl: true } });
  const keep = all.filter((template) => template.isPopular);
  const remove = all.filter((template) => !template.isPopular);

  const backupsDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupsDir, `formula-templates-before-prune-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), kept: keep.length, removed: remove.length, templates: all }, null, 2), 'utf8');

  if (keep.length === 0) {
    throw new Error('No popular FormulaTemplate rows found. Nothing was deleted.');
  }

  const templatesDir = path.resolve(process.cwd(), 'public', 'templates');
  const imagesDir = path.resolve(process.cwd(), 'public', 'images', 'doors');
  const templateFiles = fs.existsSync(templatesDir) ? fs.readdirSync(templatesDir) : [];
  const imageFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];

  let deletedTemplateFiles = 0;
  let deletedImageFiles = 0;

  for (const template of remove) {
    const leaf = path.basename(template.filePath || '');
    const numericId = String(template.numericId || '');
    const xlsxMatches = templateFiles.filter((file) => file === leaf || file.includes(`__${numericId}__${leaf}`));
    for (const file of xlsxMatches) {
      if (removeIfExists(templatesDir, file)) deletedTemplateFiles += 1;
    }

    const imageMatches = imageFiles.filter((file) => file.startsWith(`${template.templateId}__`));
    for (const file of imageMatches) {
      if (removeIfExists(imagesDir, file)) deletedImageFiles += 1;
    }
  }

  const deleteResult = await prisma.formulaTemplate.deleteMany({
    where: { isPopular: false },
  });

  const remainingTemplates = await prisma.formulaTemplate.findMany();
  const allowedTemplateFiles = new Set<string>();
  const allowedImageFiles = new Set<string>();

  for (const template of remainingTemplates) {
    const leaf = path.basename(template.filePath || '');
    const numericId = String(template.numericId || '');
    for (const file of fs.existsSync(templatesDir) ? fs.readdirSync(templatesDir) : []) {
      if (file === leaf || file.includes(`__${numericId}__${leaf}`)) {
        allowedTemplateFiles.add(file);
      }
    }
    for (const file of fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : []) {
      if (file.startsWith(`${template.templateId}__`)) {
        allowedImageFiles.add(file);
      }
    }
  }

  for (const model of doorModels) {
    const imageName = model.imageUrl ? path.basename(model.imageUrl) : '';
    if (imageName) allowedImageFiles.add(imageName);
  }

  let deletedOrphanTemplateFiles = 0;
  for (const file of fs.existsSync(templatesDir) ? fs.readdirSync(templatesDir) : []) {
    if (!allowedTemplateFiles.has(file) && removeIfExists(templatesDir, file)) {
      deletedOrphanTemplateFiles += 1;
    }
  }

  let deletedOrphanImageFiles = 0;
  for (const file of fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : []) {
    if (!allowedImageFiles.has(file) && removeIfExists(imagesDir, file)) {
      deletedOrphanImageFiles += 1;
    }
  }

  const remaining = await prisma.formulaTemplate.count();
  console.log(JSON.stringify({
    backupPath,
    before: all.length,
    keptPopular: keep.length,
    deletedRows: deleteResult.count,
    remaining,
    deletedTemplateFiles,
    deletedImageFiles,
    deletedOrphanTemplateFiles,
    deletedOrphanImageFiles,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
