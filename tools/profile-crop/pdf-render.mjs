// Render trang PDF ra ảnh PNG nét cao bằng mupdf (WASM).
// Dùng:
//   node tools/profile-crop/pdf-render.mjs info "<pdf>"                    -> số trang
//   node tools/profile-crop/pdf-render.mjs page "<pdf>" <trang> <dpi> <out.png>
//   node tools/profile-crop/pdf-render.mjs thumbs "<pdf>" <dpi> <outDir>   -> render tất cả trang (thumbnail)
import * as mupdf from 'mupdf';
import fs from 'fs';
import path from 'path';

const mode = process.argv[2];
const pdf = process.argv[3];

function open(file) {
  const buf = fs.readFileSync(file);
  return mupdf.Document.openDocument(buf, 'application/pdf');
}

function render(doc, i, dpi) {
  const page = doc.loadPage(i);
  const m = mupdf.Matrix.scale(dpi / 72, dpi / 72);
  const pix = page.toPixmap(m, mupdf.ColorSpace.DeviceRGB, false);
  const png = pix.asPNG();
  pix.destroy?.();
  page.destroy?.();
  return Buffer.from(png);
}

if (mode === 'info') {
  const doc = open(pdf);
  console.log('Số trang:', doc.countPages());
} else if (mode === 'page') {
  const i = Number(process.argv[4]) - 1;
  const dpi = Number(process.argv[5] || 200);
  const out = process.argv[6];
  const doc = open(pdf);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(doc, i, dpi));
  console.log('Đã render trang', i + 1, '@', dpi, 'dpi ->', out);
} else if (mode === 'thumbs') {
  const dpi = Number(process.argv[4] || 40);
  const outDir = process.argv[5] || 'tools/profile-crop/out/pdf-thumbs';
  fs.mkdirSync(outDir, { recursive: true });
  const doc = open(pdf);
  const n = doc.countPages();
  for (let i = 0; i < n; i++) {
    fs.writeFileSync(path.join(outDir, `p${String(i + 1).padStart(3, '0')}.png`), render(doc, i, dpi));
  }
  console.log('Đã render', n, 'trang @', dpi, 'dpi ->', outDir);
} else {
  console.error('mode: info | page | thumbs');
  process.exit(1);
}
