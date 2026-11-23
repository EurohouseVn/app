import { record } from './rec.mjs';
const only = process.argv.slice(2);
const defs = {
  'c20-inventory': { route: '/inventory', run: async (p, h) => {
    await h.wait(1300); await h.scroll(380, 1100); await h.wait(500); await h.scroll(380, 1100); await h.wait(500); await h.scroll(-760, 800); await h.wait(300);
    await h.tap('Đoạn đề-xê'); await h.wait(1500); await h.scroll(400, 1100); await h.wait(600);
    await h.tap('E70D110', { nth: 0 }); await h.wait(1800); await h.wait(900); } },
  'c21-cutplan': { route: '/formulas', run: async (p, h) => {
    await h.wait(700); await h.tap('Hệ trượt Châu Âu'); await h.wait(1100); await h.tap('Cửa đi lùa Ecento Châu Âu'); await h.wait(1100);
    await h.tap('Lùa Ecento Châu Âu 2 cánh - 2 ray', { exact: false }); await h.wait(1400);
    const i = p.locator('input'); await h.type(i.nth(0), 'Cửa lùa phòng khách', 45); await h.type(i.nth(1), '2400', 70); await h.type(i.nth(2), '2200', 70); await h.type(i.nth(3), '4', 90);
    await h.wait(500); await h.tap('Tính công thức cắt'); await h.wait(2600);
    await h.scroll(420, 1100); await h.wait(900); await h.scroll(520, 1200); await h.wait(900); await h.scroll(520, 1200); await h.wait(1000); } },
  'c18-assistant': { route: '/assistant', init: `setInterval(() => { document.querySelectorAll('div,span').forEach((e) => { if (e.childElementCount === 0 && e.textContent === 'Tạo ảnh') { let n = e; for (let i = 0; i < 4 && n; i++) { if (n.getAttribute && (n.getAttribute('tabindex') !== null || n.getAttribute('role') === 'button')) { n.style.display = 'none'; break; } n = n.parentElement; } } }); }, 50);`, run: async (p, h) => {
    const send = async () => { const bx = await p.locator('input, textarea').first().boundingBox(); await p.mouse.move(bx.x + bx.width + 30, bx.y + bx.height / 2, { steps: 8 }); await p.mouse.down(); await p.mouse.up(); };
    await h.wait(1500); const box = p.locator('input, textarea').first();
    await h.type(box, 'Viết lời chào gửi khách kèm báo giá cửa nhôm Ecento 70', 38); await h.wait(500); await send(); await h.wait(5000);
    await h.tap('Xưởng'); await h.wait(1400);
    await h.type(p.locator('textarea').first(), 'Luôn xưng em, gọi khách là anh chị. Báo giá nhớ ghi bảo hành 5 năm và giao hàng trong 7 ngày.', 34); await h.wait(700);
    await h.tap('Lưu'); await h.wait(2200); } },
  'c22-inventory-after': { route: '/inventory', run: async (p, h) => {
    await h.wait(1300); await h.tap('Đoạn đề-xê'); await h.wait(1200); await h.scroll(300, 900); await h.wait(500); await h.scroll(-300, 700); await h.wait(300); await h.tap('Cây nguyên'); await h.wait(1200); } },
};
for (const [name, d] of Object.entries(defs)) {
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  const fn = (p, h) => d.run(p, h); fn.warm = async (p, h) => { await h.go(d.route); await h.wait(4500); };
  try { await record(name, fn, { init: d.init || '' }); } catch (e) { console.log('LỖI', name, String(e).slice(0, 200)); }
}
