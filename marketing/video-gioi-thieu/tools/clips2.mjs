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
  'c22-inventory-after': { route: '/inventory', run: async (p, h) => {
    await h.wait(1300); await h.tap('Đoạn đề-xê'); await h.wait(1200); await h.scroll(300, 900); await h.wait(500); await h.scroll(-300, 700); await h.wait(300); await h.tap('Cây nguyên'); await h.wait(1200); } },
};
for (const [name, d] of Object.entries(defs)) {
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  const fn = (p, h) => d.run(p, h); fn.warm = async (p, h) => { await h.go(d.route); await h.wait(4500); };
  try { await record(name, fn); } catch (e) { console.log('LỖI', name, String(e).slice(0, 200)); }
}
