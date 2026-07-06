// Gán mã + căn lề đồng đều cho các ô đã cắt.
// Dùng:
//   node tools/profile-crop/name-cells.mjs <cellsDir> <outDir> <code1,code2,...> [targetW] [targetH]
// Xuất: <outDir>/<code>.png (đồng đều kích thước, nền trắng, hình ở giữa)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pnpmDir = path.resolve('node_modules/.pnpm');
const sharpPkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('sharp@'));
const sharp = require(path.join(pnpmDir, sharpPkg, 'node_modules/sharp'));

const cellsDir = process.argv[2];
const outDir = process.argv[3];
const codes = process.argv[4].split(',');
const TW = Number(process.argv[5] || 400);
const TH = Number(process.argv[6] || 340);

fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(cellsDir).filter((f) => f.endsWith('.png')).sort();
if (files.length !== codes.length) {
  console.error(`Số file (${files.length}) khác số mã (${codes.length})!`);
  process.exit(1);
}

(async () => {
  for (let i = 0; i < files.length; i++) {
    await sharp(path.join(cellsDir, files[i]))
      .resize({ width: TW, height: TH, fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .png()
      .toFile(path.join(outDir, codes[i] + '.png'));
  }
  console.log(`Đã gán tên + căn lề ${codes.length} ảnh (${TW}x${TH}) -> ${outDir}`);
})().catch((e) => { console.error(e); process.exit(1); });
