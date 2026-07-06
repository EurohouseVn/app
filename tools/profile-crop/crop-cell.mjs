// Cắt 1 ô theo toạ độ tuyệt đối trên ảnh nguồn rồi căn về khung chuẩn (400x340, nền trắng).
// Dùng cho các ô mà auto-segment cắt lệch — đo toạ độ từ overlay/_work.png.
//   node tools/profile-crop/crop-cell.mjs <src.png> <left> <top> <w> <h> <out.png> [TW] [TH]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pnpmDir = path.resolve('node_modules/.pnpm');
const sharpPkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('sharp@'));
const sharp = require(path.join(pnpmDir, sharpPkg, 'node_modules/sharp'));

const [src, left, top, w, h, out] = process.argv.slice(2);
const TW = Number(process.argv[8] || 400);
const TH = Number(process.argv[9] || 340);

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(src)
    .extract({ left: Number(left), top: Number(top), width: Number(w), height: Number(h) })
    .resize({ width: TW, height: TH, fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(out);
  console.log(`OK -> ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
