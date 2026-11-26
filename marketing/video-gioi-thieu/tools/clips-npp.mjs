// Clip quay luồng NPP (dữ liệu giả, API tạm 3061). Dùng: node clips-npp.mjs <tên-clip>...
import { record } from './rec.mjs';
import path from 'node:path';
const T = process.env.TEMP;
const OUT = 'E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/marketing/video-gioi-thieu/assets/clips-npp';
const MOBILE = { state: path.join(T, 'eh-state-hungphat.json'), base: 'http://localhost:8095', out: OUT };
const WEB = { state: path.join(T, 'eh-npp-state.json'), base: 'http://localhost:3072', w: 1366, h: 768, scale: 1.5, cursor: true, out: OUT };
const only = process.argv.slice(2);

async function plus(p, code, n) {
  const t = p.getByText(code, { exact: true }).first(); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(350);
  const tb = await t.boundingBox(); const btns = p.locator('[aria-label="Tăng"]'); const c = await btns.count(); let best = null, bd = 1e9;
  for (let i = 0; i < c; i++) { const bb = await btns.nth(i).boundingBox(); if (!bb) continue; const d = Math.abs(bb.y + bb.height / 2 - (tb.y + tb.height / 2)); if (d < bd) { bd = d; best = bb; } }
  await p.mouse.move(best.x + best.width / 2, best.y + best.height / 2, { steps: 10 });
  for (let i = 0; i < n; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(55); }
  await p.waitForTimeout(250);
}
const defs = {
  'n01-tho-order': { opts: MOBILE, route: '/orders', run: async (p, h) => {
    await h.wait(900);
    await h.tap('Hệ 70 Ecento'); await h.wait(900);
    await plus(p, 'E70D110', 20); await plus(p, 'E70D150', 14); await plus(p, 'E701A', 30); await plus(p, 'E705', 30);
    await h.wait(500); await h.tap('Xem lại đơn', { exact: false }); await h.wait(1300);
    const ta = p.locator('textarea');
    await h.type(ta.nth(0), 'Giao trước 10h sáng mai, công trình biệt thự anh Thành Q.9', 32); await h.wait(300);
    await h.type(ta.nth(1), '- Ron EPDM 8mm = 120m', 36); await h.wait(500);
    await h.scroll(420, 800); await h.wait(500);
    await h.tap('Xác nhận gửi đơn', { exact: false }); await h.wait(2600);
  } },
  'n02-orders': { opts: WEB, route: '/orders', run: async (p, h) => {
    await h.wait(1500); await h.tap('XUONG-HUNGPHAT-261126-01'); await h.wait(1800);
    await h.scroll(260, 900); await h.wait(900); await h.scroll(-260, 600); await h.wait(500);
    await h.tap(p.getByRole('button', { name: 'Tiếp nhận', exact: true })); await h.wait(2800);
  } },
  'n03-inventory': { opts: WEB, route: '/', run: async (p, h) => {
    await h.wait(900); await h.tap('Kho hàng'); await h.wait(2200);
    for (const c of ['Màu Café thường', 'Màu Xám Ngọc Trai', 'Màu Vân gỗ Cẩm Lai', 'Màu vân gỗ Olak', 'Màu Xám Rita (dự án)']) { await h.tap(c, { exact: false }); await h.wait(260); }
    await h.wait(700); await h.tap('EU-70', { exact: false }); await h.wait(1200);
    await h.scroll(640, 1200); await h.wait(3200); await h.scroll(160, 600); await h.wait(2600);
  } },
  'n04-weigh': { opts: WEB, route: '/', run: async (p, h) => {
    await h.wait(700); await h.tap('Đơn hàng'); await h.wait(2000);
    await h.tap('XUONG-HUNGPHAT-261126-01'); await h.wait(1500);
    await h.scroll(700, 1200); await h.wait(900);
    const nums = p.locator('input[type=number]');
    await h.type(nums.nth(0), '699.6', 90); await h.wait(500);
    await h.type(nums.nth(1), '87500', 90); await h.wait(1500);
    await h.tap('Xác nhận giá và tạo đơn giao', { exact: false }); await h.wait(2600);
    await h.scroll(-200, 500); await h.wait(600);
    await h.tap('Hoàn thành đơn', { exact: false }); await h.wait(2400);
  } },
  'n05-debts': { opts: WEB, route: '/', run: async (p, h) => {
    await h.wait(700); await h.tap('Công nợ'); await h.wait(2200); await h.scroll(250, 800); await h.wait(1200);
    await h.tap('XUONG-HUNGPHAT-261126-01'); await h.wait(1800);
  } },
  'n06-tho-debt': { opts: MOBILE, route: '/debts', run: async (p, h) => {
    await h.wait(1800); await h.scroll(260, 900); await h.wait(1200);
  } },
  'n10-dashboard': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(2500); await h.scroll(300, 1000); await h.wait(1200); } },
  'n11-glass': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Kính', { nth: 0 }); await h.wait(2500); await h.scroll(520, 1400); await h.wait(1500); await h.scroll(520, 1400); await h.wait(1500); } },
  'n12-scan': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Quét mã'); await h.wait(2000); await h.tap('Xuất', { exact: true }); await h.wait(1000); await h.tap('Kiểm kê', { nth: 1 }); await h.wait(1200); await h.scroll(300, 900); await h.wait(1000); } },
  'n14-documents': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Đọc phiếu'); await h.wait(2300); await h.scroll(300, 900); await h.wait(1200); } },
  'n15-print': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Trạm in'); await h.wait(2300); await h.wait(1200); } },
  'n16-recon': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Đối chiếu'); await h.wait(2300); await h.tap('Tháng 11/2026', { exact: false }); await h.wait(1500); await h.tap('Toàn thời gian'); await h.wait(1500); } },
  'n17-factories': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Cơ sở SX'); await h.wait(2000); await h.type(p.locator('input').first(), 'hungphat@eurohouse.vn', 60); await h.wait(300); await h.tap(p.getByRole('button', { name: 'Tìm', exact: true })); await h.wait(3500); await h.scroll(250, 700); await h.wait(1500); } },
  'n18-profile': { opts: WEB, route: '/', run: async (p, h) => { await h.wait(500); await h.tap('Tài khoản'); await h.wait(2000); await h.scroll(450, 1200); await h.wait(1800); } },
};
for (const [name, d] of Object.entries(defs)) {
  if (only.length && !only.includes(name)) continue;
  const fn = d.run; if (d.warm) fn.warm = d.warm; else fn.warm = async (page, h) => { await h.go(d.route); await h.wait(5000); };
  await record(name, fn, d.opts);
}
