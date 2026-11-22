import { record } from './rec.mjs';
const only = process.argv.slice(2);
const defs = {
  'c03-quote': { route: '/quote', run: async (p, h) => {
    await h.wait(900); const i = p.locator('input');
    await h.type(i.nth(0), 'Anh Nguyễn Văn Thành', 50); await h.type(i.nth(1), '0903111222', 50); await h.type(i.nth(2), '45 Đường số 7, Thủ Đức', 40);
    await h.wait(500); await h.scroll(420, 1100); await h.wait(500); await h.scroll(520, 1200); await h.wait(600); await h.scroll(520, 1200); await h.wait(900); } },
  'c04-orders': { route: '/orders', run: async (p, h) => {
    await h.wait(900); await h.tap('Xám Ngọc Trai'); await h.wait(700); await h.tap('Hệ 70 Ecento'); await h.wait(900); await h.scroll(420, 1100); await h.wait(700); await h.scroll(420, 1100); await h.wait(900); } },
  'c05-formulas': { route: '/formulas', run: async (p, h) => {
    await h.wait(900); await h.scroll(300, 900); await h.wait(500); await h.scroll(-300, 700); await h.tap('Hệ trượt Châu Âu'); await h.wait(1500);
    await h.tap('Cửa đi lùa Ecento Châu Âu'); await h.wait(1800); await h.scroll(300, 900); await h.wait(800); } },
  'c06-projects': { route: '/projects', run: async (p, h) => {
    await h.wait(1200); await h.scroll(250, 800); await h.wait(500); await h.tap('Nhà phố chị Mai - Bình Tân'); await h.wait(2200); await h.scroll(500, 1200); await h.wait(900); await h.scroll(600, 1300); await h.wait(1000); await h.scroll(600, 1300); await h.wait(1000); } },
  'c07-workforce': { route: '/workforce', run: async (p, h) => {
    await h.wait(1200); await h.tap('Việc khoán'); await h.wait(1500); await h.scroll(300, 800); await h.wait(500); await h.tap('Thợ'); await h.wait(1500); await h.scroll(300, 800); await h.wait(400); await h.tap('Lương'); await h.wait(1800); await h.scroll(450, 1000); await h.wait(1000); } },
  'c08-debts': { route: '/debts', run: async (p, h) => { await h.wait(1200); await h.tap('NPP Miền Nam'); await h.wait(1800); await h.scroll(300, 900); await h.wait(1200); } },
  'c09-invoices': { route: '/invoices', run: async (p, h) => { await h.wait(1200); await h.scroll(350, 1000); await h.wait(600); await h.tap('Hoá đơn', { nth: 0 }); await h.wait(1500); await h.tap('Báo cáo'); await h.wait(1800); } },
  'c10-reminders': { route: '/reminders', run: async (p, h) => { await h.wait(1200); await h.tap('Mua silicone và vít'); await h.wait(900); await h.tap('Giao cửa cho nhà chị Mai'); await h.wait(1600); } },
  'c11-shopfloor': { route: '/shop-floor', run: async (p, h) => { await h.wait(1200); await h.scroll(380, 1000); await h.wait(700); await h.scroll(380, 1000); await h.wait(1000); } },
  'c12-qc': { route: '/qc', run: async (p, h) => { await h.wait(1200); await h.tap('Kiểm tra cửa đi chính'); await h.wait(2000); await h.scroll(300, 900); await h.wait(1200); } },
  'c13-install': { route: '/installations', run: async (p, h) => { await h.wait(1200); await h.tap('Biệt thự anh Thành - Q.9'); await h.wait(2000); await h.scroll(380, 1000); await h.wait(1200); } },
  'c14-warranty': { route: '/service-warranty', run: async (p, h) => { await h.wait(1200); await h.tap('Quán cà phê Gió - Tân Phú'); await h.wait(2000); await h.scroll(380, 1000); await h.wait(1200); } },
  'c15-weather': { route: '/weather', run: async (p, h) => { await h.wait(1500); await h.scroll(420, 1200); await h.wait(700); await h.scroll(420, 1200); await h.wait(1000); } },
  'c16-catalog': { route: '/catalog', run: async (p, h) => { await h.wait(1200); await h.scroll(500, 1300); await h.wait(500); await h.scroll(600, 1400); await h.wait(500); await h.scroll(600, 1400); await h.wait(800); } },
  'c17-library': { route: '/library', run: async (p, h) => { await h.wait(1200); await h.tap('Mẫu cửa'); await h.wait(1300); await h.tap('Video'); await h.wait(1300); await h.tap('Catalog'); await h.wait(1500); } },
  'c18-assistant': { route: '/assistant', run: async (p, h) => {
    const send = async () => { const bx = await p.locator('input, textarea').first().boundingBox(); await p.mouse.move(bx.x + bx.width + 30, bx.y + bx.height / 2, { steps: 8 }); await p.mouse.down(); await p.mouse.up(); };
    await h.wait(1200); const box = p.locator('input, textarea').first();
    await h.type(box, 'Viết lời chào gửi khách kèm báo giá cửa nhôm Ecento 70', 38); await h.wait(500); await send(); await h.wait(4500);
    await h.tap('Tạo ảnh'); await h.wait(1300);
    const b2 = p.locator('input, textarea').first(); await h.type(b2, 'Phối cảnh cửa đi nhôm Ecento 70 màu xám ghi cho biệt thự', 36); await h.wait(400);
    await p.getByText('Tạo ảnh', { exact: true }).last().scrollIntoViewIfNeeded().catch(() => {}); await h.tap(p.getByText('Tạo ảnh', { exact: true }).last()); await h.wait(6500);
    await h.tap('Xưởng'); await h.wait(2200); } },
};
for (const [name, d] of Object.entries(defs)) {
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  const fn = (p, h) => d.run(p, h); fn.warm = async (p, h) => { await h.go(d.route); await h.wait(4500); };
  try { await record(name, fn); } catch (e) { console.log('LỖI', name, String(e).slice(0, 200)); }
}
