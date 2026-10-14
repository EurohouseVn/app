import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function mapType(windowType: string): string {
  const typeStr = windowType.toLowerCase();
  if (typeStr.includes('cửa sổ mở quay') || typeStr.includes('cửa sổ mở hất')) return 'WINDOW_OPEN';
  if (typeStr.includes('cửa sổ mở trượt') || typeStr.includes('cửa sổ lùa'))
    return 'WINDOW_SLIDING';
  if (typeStr.includes('cửa đi mở ngoài') || typeStr.includes('cửa đi mở trong'))
    return 'DOOR_OPEN';
  if (typeStr.includes('cửa đi mở trượt') || typeStr.includes('cửa đi lùa')) return 'DOOR_SLIDING';
  if (typeStr.includes('vách')) return 'COMBINED';
  if (typeStr.includes('trượt quay')) return 'SLIDE_TURN';
  return 'FIXED';
}

async function main() {
  console.log('Seeding 500+ door models from CSV...');

  const csvPath =
    'E:/LELOIGLOBAL_CODEX/SOCIAL_PROJECTS/downloads/phanmemcua-system/canonical_template_images_manifest.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter((l) => l.trim().length > 0);

  // Skip header
  lines.shift();

  let count = 0;
  for (const line of lines) {
    const cols = line.split(',');
    if (cols.length < 8) continue;

    // template_id,numeric_id,system_name,window_type_name,template_name,image_path,local_name,status
    const windowTypeName = cols[3].trim();
    const templateName = cols[4].trim();
    const localName = cols[6].trim();

    const doorName = `${windowTypeName} (${templateName}) - ${cols[0].substring(0, 5)}`;
    const type = mapType(windowTypeName);
    const imageUrl = `/images/doors/${localName}`;

    // Check if exists
    const existing = await prisma.doorModel.findFirst({
      where: { imageUrl },
    });

    if (!existing) {
      await prisma.doorModel.create({
        data: {
          name: doorName,
          type,
          imageUrl,
        },
      });
      count++;
    }
  }

  console.log(`Inserted ${count} new door models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
