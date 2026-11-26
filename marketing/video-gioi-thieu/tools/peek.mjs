import { chromium } from 'playwright';
const [route, state, out, ...acts] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ storageState: state, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'vi-VN' });
const p = await ctx.newPage(); await p.goto('http://localhost:8095/' + route, { waitUntil: 'load' }); await p.waitForTimeout(5000);
for (const a of acts) { await p.getByText(a, { exact: true }).first().click().catch(() => console.log('no', a)); await p.waitForTimeout(1500); }
await p.screenshot({ path: out, fullPage: false }); console.log(p.url());
await b.close();
