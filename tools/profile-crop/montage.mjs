// Ghép các ô đã cắt thành 1 ảnh contact-sheet (phóng to) để đọc mã dễ.
// Dùng: node tools/profile-crop/montage.mjs <cellsDir> <outFile> [cols] [scale]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pnpmDir = path.resolve('node_modules/.pnpm');
const sharpPkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('sharp@'));
const sharp = require(path.join(pnpmDir, sharpPkg, 'node_modules/sharp'));

const cellsDir = process.argv[2];
const outFile = process.argv[3] || 'tools/profile-crop/out/montage.png';
const COLS = Number(process.argv[4] || 4);
const SCALE = Number(process.argv[5] || 2);
const CELL_W = 200 * SCALE;
const CELL_H = 170 * SCALE;
const GAP = 6;
const LABEL = 22;

const files = fs.readdirSync(cellsDir).filter((f) => f.endsWith('.png')).sort();

const main = async () => {
  const rows = Math.ceil(files.length / COLS);
  const cw = CELL_W + GAP;
  const ch = CELL_H + LABEL + GAP;
  const W = COLS * cw + GAP;
  const H = rows * ch + GAP;
  const composites = [];
  for (let i = 0; i < files.length; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const left = GAP + c * cw;
    const top = GAP + r * ch;
    const buf = await sharp(path.join(cellsDir, files[i]))
      .resize({ width: CELL_W, height: CELL_H, fit: 'contain', background: '#ffffff' })
      .png()
      .toBuffer();
    const idx = files[i].replace(/\.png$/i, '');
    const label = Buffer.from(
      `<svg width="${CELL_W}" height="${LABEL}"><rect width="100%" height="100%" fill="#151110"/><text x="6" y="16" font-size="16" fill="#FDA720" font-family="sans-serif" font-weight="bold">#${idx}</text></svg>`,
    );
    composites.push({ input: label, left, top });
    composites.push({ input: buf, left, top: top + LABEL });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#888888' } })
    .composite(composites)
    .png()
    .toFile(outFile);
  console.log(`Montage: ${outFile} (${files.length} ô, ${W}x${H})`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
