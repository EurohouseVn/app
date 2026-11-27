import { chromium } from 'playwright';
import { rewriteApi } from './route-api.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ storageState: process.env.TEMP + '/eh-npp-state.json', viewport: { width: 1366, height: 768 }, locale: 'vi-VN' });
await rewriteApi(ctx);
const p = await ctx.newPage(); await p.goto('http://localhost:3072/orders'); await p.getByText('Đơn hàng từ xưởng').first().waitFor({ timeout: 90000 }).catch(() => {}); await p.waitForTimeout(1500);
console.log(await p.locator('text=/261127/').evaluateAll(l => l.map(e => e.tagName + ':' + JSON.stringify(e.textContent))));
await p.screenshot({ path: process.env.TEMP + '/eh-ord.png' }); await b.close();
