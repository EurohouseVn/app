import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ storageState: process.env.TEMP + '/eh-npp-state.json', viewport: { width: 1366, height: 768 }, locale: 'vi-VN' });
const p = await ctx.newPage(); await p.goto('http://localhost:3072/inventory'); await p.waitForTimeout(3500);
await p.getByText('EU-70', { exact: false }).first().click(); await p.waitForTimeout(1500);
await p.screenshot({ path: process.env.TEMP + '/eh-inv.png', fullPage: true });
console.log(await p.evaluate(() => document.body.scrollHeight));
await b.close();
