// Cắt ảnh hệ nhôm thành từng ô bằng cách dò "rãnh trắng" (white gutters).
// Vì mỗi ảnh là lưới đều, rãnh trắng giữa các hàng/cột luôn rõ -> cắt nguyên ô (gồm tiêu đề + thông số + hình).
//
// Dùng:
//   node tools/profile-crop/segment.mjs "<ảnh>" "<outDir>" [--white 238] [--gut 0.985] [--rows y1,y2,..] [--cols x1,x2,..]
// --rows / --cols: override thủ công các đường cắt (nếu auto chưa chuẩn).
// Xuất: overlay.png (khung đỏ + số), boxes.json, và các ô cell_##.png (cắt thật).

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const pnpmDir = path.resolve('node_modules/.pnpm');
const sharpPkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('sharp@'));
const sharp = require(path.join(pnpmDir, sharpPkg, 'node_modules/sharp'));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const input = process.argv[2];
const outDir = process.argv[3] || 'tools/profile-crop/out';
const WHITE = Number(arg('--white', 238)); // >= WHITE coi là trắng
const GUT = Number(arg('--gut', 0.985)); // tỉ lệ trắng để coi là rãnh
const PAD = Number(arg('--pad', 6)); // chừa lề khi cắt
const rowsOverride = arg('--rows', null);
const colsOverride = arg('--cols', null);
if (!input) {
  console.error('Thiếu đường dẫn ảnh nguồn.');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

// Tìm các "dải nội dung" = đoạn giữa 2 rãnh trắng.
// whiteFrac: mảng tỉ lệ trắng theo từng dòng (hoặc cột).
// minGutRun: rãnh trắng phải dài >= minGutRun (px) mới được coi là ngăn cách
//            (tránh cắt nhầm khe nhỏ giữa tiêu đề và hình trong cùng 1 ô).
function contentBands(whiteFrac, gut, minLen, minGutRun) {
  const isGut = whiteFrac.map((f) => (f >= gut ? 1 : 0));
  const bands = [];
  let start = -1;
  let lastContent = -1;
  let gutRun = 0;
  for (let i = 0; i < isGut.length; i++) {
    if (!isGut[i]) {
      if (start < 0) start = i;
      lastContent = i;
      gutRun = 0;
    } else {
      gutRun++;
      if (start >= 0 && gutRun >= minGutRun) {
        if (lastContent - start + 1 >= minLen) bands.push([start, lastContent]);
        start = -1;
      }
    }
  }
  if (start >= 0 && lastContent - start + 1 >= minLen) bands.push([start, lastContent]);
  return bands;
}

const main = async () => {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const CH = info.channels;
  const white = (x, y) => (data[(y * W + x) * CH] >= WHITE ? 1 : 0);

  // Tỉ lệ trắng theo dòng & cột (toàn ảnh)
  const rowWhite = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++) c += white(x, y);
    rowWhite[y] = c / W;
  }
  const colWhite = new Array(W).fill(0);
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = 0; y < H; y++) c += white(x, y);
    colWhite[x] = c / H;
  }

  // 1) Dò cột (toàn ảnh)
  const colBands = colsOverride ? splitByLines(colsOverride, W) : contentBands(colWhite, GUT, 45, 8);

  // 2) Trong MỖI cột, xác định điểm bắt đầu mỗi ô = thanh TIÊU ĐỀ (dải bị tô màu, ít trắng).
  //    Mỗi ô chạy từ tiêu đề của nó đến ngay trước tiêu đề kế tiếp -> luôn gồm đủ tiêu đề + thông số + hình.
  const HDR_FILL = Number(arg('--hdrfill', 0.45)); // tỉ lệ trắng < ngưỡng => coi là thanh tiêu đề
  const HDR_MIN = 8; // tiêu đề cao tối thiểu (px)
  const boxes = [];
  colBands.forEach(([x0, x1]) => {
    const cw = x1 - x0 + 1;
    const rW = new Array(H).fill(0);
    for (let y = 0; y < H; y++) {
      let c = 0;
      for (let x = x0; x <= x1; x++) c += white(x, y);
      rW[y] = c / cw;
    }

    if (rowsOverride) {
      splitByLines(rowsOverride, H).forEach(([y0, y1]) => pushBox(x0, x1, y0, y1));
      return;
    }

    // điểm bắt đầu các thanh tiêu đề
    const isHdr = rW.map((f) => (f < HDR_FILL ? 1 : 0));
    const tops = [];
    let start = -1;
    let lastH = -1;
    let gap = 0;
    for (let i = 0; i < H; i++) {
      if (isHdr[i]) {
        if (start < 0) start = i;
        lastH = i;
        gap = 0;
      } else {
        gap++;
        if (start >= 0 && gap >= 4) {
          if (lastH - start + 1 >= HDR_MIN) tops.push(start);
          start = -1;
        }
      }
    }
    if (start >= 0 && lastH - start + 1 >= HDR_MIN) tops.push(start);

    // dòng có nội dung cuối cùng trong cột (đáy ô cuối)
    let lastContent = 0;
    for (let y = H - 1; y >= 0; y--) {
      if (rW[y] < 0.99) {
        lastContent = y;
        break;
      }
    }

    tops.forEach((t, i) => {
      const y0 = t;
      const y1 = i + 1 < tops.length ? tops[i + 1] - 4 : lastContent;
      if (y1 - y0 >= 40) pushBox(x0, x1, y0, y1);
    });
  });

  function pushBox(x0, x1, y0, y1) {
    const x = Math.max(0, x0 - PAD);
    const y = Math.max(0, y0 - PAD);
    const w = Math.min(W - x, x1 - x0 + 1 + PAD * 2);
    const h = Math.min(H - y, y1 - y0 + 1 + PAD * 2);
    boxes.push({ x, y, w, h });
  }


  // Sắp xếp trên->dưới, trái->phải để đánh số dễ đọc
  boxes.sort((a, b) => (Math.abs(a.y - b.y) > 30 ? a.y - b.y : a.x - b.x));


  fs.writeFileSync(path.join(outDir, 'boxes.json'), JSON.stringify(boxes, null, 2));

  // Overlay
  const rects = boxes
    .map(
      (b, i) =>
        `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="red" stroke-width="2"/>` +
        `<text x="${b.x + 3}" y="${b.y + 17}" font-size="16" fill="red" font-family="sans-serif" font-weight="bold">${i}</text>`,
    )
    .join('');
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  await sharp(input)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(path.join(outDir, 'overlay.png'));

  // Cắt từng ô
  const cellsDir = path.join(outDir, 'cells');
  fs.rmSync(cellsDir, { recursive: true, force: true });
  fs.mkdirSync(cellsDir, { recursive: true });
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    await sharp(input)
      .extract({ left: b.x, top: b.y, width: b.w, height: b.h })
      .png()
      .toFile(path.join(cellsDir, `cell_${String(i).padStart(2, '0')}.png`));
  }

  console.log(`Ảnh ${W}x${H}: ${colBands.length} cột -> ${boxes.length} ô.`);
  console.log(`Cột (x):  ${colBands.map((b) => b.join('-')).join('  ')}`);
};

function splitByLines(csv, max) {
  const lines = [0, ...csv.split(',').map(Number), max];
  const bands = [];
  for (let i = 0; i < lines.length - 1; i++) bands.push([lines[i], lines[i + 1] - 1]);
  return bands;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
