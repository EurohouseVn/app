// Cắt lưới ĐỀU rows x cols từ ảnh nguồn, xuất cells + overlay đánh số.
// Dùng cho trang có lưới profile đều nhau (thủy lực, ecento...).
//   node tools/profile-crop/grid-cut.mjs <src.png> <outDir> <cols> <rows> [--margin l,t,r,b] [TW] [TH]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pnpmDir = path.resolve('node_modules/.pnpm');
const sharpPkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('sharp@'));
const sharp = require(path.join(pnpmDir, sharpPkg, 'node_modules/sharp'));

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const src = process.argv[2];
const outDir = process.argv[3];
const COLS = Number(process.argv[4]);
const ROWS = Number(process.argv[5]);
const margin = arg('--margin', '0,0,0,0').split(',').map(Number);
const TW = Number(arg('--tw', 400));
const TH = Number(arg('--th', 340));

(async () => {
  fs.mkdirSync(path.join(outDir, 'cells'), { recursive: true });
  const meta = await sharp(src).metadata();
  const [ml, mt, mr, mb] = margin;
  const gx = ml, gy = mt;
  const gw = meta.width - ml - mr;
  const gh = meta.height - mt - mb;
  const cw = gw / COLS, ch = gh / ROWS;

  const boxes = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      boxes.push({ i: r * COLS + c, x: Math.round(gx + c * cw), y: Math.round(gy + r * ch), w: Math.round(cw), h: Math.round(ch) });

  for (const b of boxes) {
    await sharp(src).extract({ left: b.x, top: b.y, width: b.w, height: b.h })
      .resize({ width: TW, height: TH, fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' }).png()
      .toFile(path.join(outDir, 'cells', `cell_${String(b.i).padStart(2, '0')}.png`));
  }

  const rects = boxes.map((b) =>
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="red" stroke-width="3"/>` +
    `<text x="${b.x + 8}" y="${b.y + 34}" font-size="34" fill="red" font-weight="bold">${b.i}</text>`).join('');
  await sharp(src).composite([{ input: Buffer.from(`<svg width="${meta.width}" height="${meta.height}">${rects}</svg>`), top: 0, left: 0 }])
    .png().toFile(path.join(outDir, 'grid-overlay.png'));
  console.log(`Cắt ${boxes.length} ô (${COLS}x${ROWS}) -> ${outDir}/cells + grid-overlay.png`);
})().catch((e) => { console.error(e); process.exit(1); });
