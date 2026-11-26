import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ storageState: process.env.TEMP + '/eh-state-hungphat.json', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'vi-VN' });
const p = await ctx.newPage(); await p.goto('http://localhost:8095/orders', { waitUntil: 'load' }); await p.waitForTimeout(5000);
await p.getByText('Hệ 70 Ecento').first().click(); await p.waitForTimeout(1500);
async function plus(code, n) {
  const t = p.getByText(code, { exact: true }).first(); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const tb = await t.boundingBox(); const btns = p.locator('[aria-label="Tăng"]'); const c = await btns.count(); let best = null, bd = 1e9;
  for (let i = 0; i < c; i++) { const bb = await btns.nth(i).boundingBox(); if (!bb) continue; const d = Math.abs(bb.y + bb.height / 2 - (tb.y + tb.height / 2)); if (d < bd) { bd = d; best = bb; } }
  for (let i = 0; i < n; i++) { await p.mouse.click(best.x + best.width / 2, best.y + best.height / 2); await p.waitForTimeout(40); }
}
await plus('E70D110', 3); await plus('E701A', 2);
await p.screenshot({ path: process.env.TEMP + '/eh-o3.png' });
await p.getByText('Xem lại đơn').first().click(); await p.waitForTimeout(1500);
await p.screenshot({ path: process.env.TEMP + '/eh-o4.png' });
console.log(await p.locator('input,textarea').evaluateAll(l => l.map(i => i.type + ':' + (i.placeholder || i.value))));
await b.close();
