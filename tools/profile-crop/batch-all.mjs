// Batch: render + segment + name tất cả 11 hệ từ PDF R17.
// Dùng: node tools/profile-crop/batch-all.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const PDF = path.join(ROOT, 'EUROHOUSE CATALOG R17.pdf');
const PAGES = path.join(ROOT, 'tools/profile-crop/out/pages');
const OUT = path.join(ROOT, 'tools/profile-crop/out');
const FINAL = path.join(ROOT, 'apps/api/public/profiles');
const DPI = 200;
const TW = 400;
const TH = 340;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function renderPage(n) {
  const p = path.join(PAGES, `p${String(n).padStart(3, '0')}.png`);
  if (!fs.existsSync(p)) {
    run(`node tools/profile-crop/pdf-render.mjs page "${PDF}" ${n} ${DPI} "${p}"`);
  }
  return p;
}

function segment(src, outDir, region) {
  let cmd = `node tools/profile-crop/segment.mjs "${src}" "${outDir}"`;
  if (region) cmd += ` --region "${region}"`;
  run(cmd);
}

function nameCells(cellsDir, outDir, codes) {
  run(`node tools/profile-crop/name-cells.mjs "${cellsDir}" "${outDir}" "${codes.join(',')}" ${TW} ${TH}`);
}

// Cấu hình mỗi hệ: trang PDF, vùng cắt (left,top,right,bottom), mã sắp theo thứ tự trên→dưới trái→phải
const SYSTEMS = [
  {
    name: 'he55',
    page: 2,
    region: '30,175,30,30',
    codes: ['DAK55','LH5110','KHK65','LH11801','DAD91','DAS76','DATD76','DAT55','PR-DD55','DAS14','DA3002','C3326','CN55','C3300','E192','E1283A','PR2990','PR55M90','PR5512','PR5542','PR2966','PR55N','PR55M'],
  },
  {
    name: 'preco',
    page: 3,
    region: '30,100,30,830',
    codes: ['RPK50','PRD91','PRS76','C3300','DAT55','DATD76','PR-DD55','DA3002','DAS14','C3300-P','CN55','C3326'],
  },
  {
    name: 'truot-mo',
    page: 3,
    region: '30,1100,30,210',
    codes: ['PR5542','PR2966','PR55N','PR55M'],
  },
  {
    name: 'noi-that',
    page: 4,
    region: '30,140,30,530',
    codes: ['KH01','KH17','KH03','KH04','KH05','KH06','KH07','KH08','KH09','KH10','KH11','KH12','KH13','KH14','KH15','KH16'],
  },
  {
    name: 'truot-quay',
    page: 6,
    region: '30,75,30,1320',
    codes: ['KT-TQ01','KT-TQ02','KT-TQ03','KT-TQ04','KT-TQ05','KT-TQ06','KT-TQ07','KT-TQ08','KT-TQ09','KT-TQ10'],
  },
  {
    name: 'truot-chau-au',
    page: 6,
    region: '30,735,30,680',
    codes: ['KH-T9801','KH-T9802','KH-T9803','KH-T9804','KH-T9805','KH-T9806','KH-T9807','KH-T9808','KH-K9809','KH-K9810','KH-K9812','KH-T9813','KH-T9814'],
  },
  {
    name: 'thuy-luc',
    page: 6,
    region: '30,1340,30,60',
    codes: ['KTL-01','KTL-05','KTL-03','KTL-04','KTL08','KTL-06','KTL-07','KTL09','D1409','C101'],
  },
  {
    name: 'ecento70',
    page: 8,
    region: '30,110,30,530',
    codes: ['E701A','E70D110','E70S86','E70SH','T9809','E70KD','E704A','C3296','C3225','E70T98','E70D190','E70D150','KTL-04','KTL-07','KTL-03','E70NK','E705','E706','E702','E70KT'],
  },
  {
    name: 'chan-song',
    page: 9,
    region: '30,110,30,460',
    codes: ['ECS01','ECS02','ECS03','ECS04','ECS05','ECS06','ECS07','ECS08','ECS09','ECS10','ECS11','ECS12','ECS13','ECS14','ECS15','ECS17','50X150','ECS18','ECS20-30X150','ECS22-P75','ECS21-P100'],
  },
  {
    name: 'ecento-plus',
    page: 11,
    region: '30,620,30,60',
    codes: ['C3328P','C3328-1.4','EPK116','EPD98','EPS78','EPTD80','C3323-ND','C3313','C3329A','C3296','EPS78S','EPD98S','E70SH','T9809','EPD138','EPD125P','EPS20-125','EPS12-125','EPD138P','EPSV11'],
  },
  {
    name: 'phao-dai-hoi',
    page: 14,
    region: '30,610,30,120',
    codes: ['DH01','DH02','DH03','DH04','DH05','KH01CT','EPV01','ECS21-P100','KH10','ECS18','ECS18-2','KH09'],
  },
  {
    name: 'mat-dung',
    page: 15,
    region: '30,800,30,150',
    codes: ['EMD6577','EMD65100','EMD65120','EMDK46','EMDS38'],
  },
];

// Xử lý từng hệ
for (const sys of SYSTEMS) {
  console.log(`\n========= ${sys.name} (trang ${sys.page}) =========`);
  const dir = path.join(OUT, sys.name);
  try {
    const src = renderPage(sys.page);
    segment(src, dir, sys.region);
    // Đếm cells
    const cellsDir = path.join(dir, 'cells');
    const cells = fs.readdirSync(cellsDir).filter((f) => f.endsWith('.png')).sort();
    if (cells.length !== sys.codes.length) {
      console.log(`⚠ SỐ Ô (${cells.length}) ≠ SỐ MÃ (${sys.codes.length}) — cần chỉnh region/mã!`);
      // vẫn tạo named nhưng đánh dấu
    }
    const namedDir = path.join(dir, 'named');
    if (cells.length === sys.codes.length) {
      nameCells(cellsDir, namedDir, sys.codes);
    } else {
      console.log(`  -> Bỏ qua name-cells, cần sửa thủ công.`);
    }
  } catch (e) {
    console.error(`LỖI ${sys.name}:`, e.message);
  }
}

console.log('\n=== BATCH XONG ===');
console.log('Kiểm tra từng thư mục trong tools/profile-crop/out/<hệ>/named/');
console.log('Sau khi duyệt OK, copy vào apps/api/public/profiles/');
