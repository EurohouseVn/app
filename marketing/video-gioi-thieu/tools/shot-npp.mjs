import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.TEMP + '/eh-npp-shots'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, locale: 'vi-VN' });
const p = await ctx.newPage();
await p.goto('http://localhost:3072/'); await p.waitForTimeout(2500);
await p.locator('input').nth(0).fill('npp@eurohouse.vn'); await p.locator('input').nth(1).fill('Eurohouse@2026');
await p.keyboard.press('Enter'); await p.waitForTimeout(4000);
for (const r of ['', 'orders', 'factories', 'inventory', 'accessories', 'glass', 'scan', 'stocktake', 'documents', 'print-station', 'quotations', 'projects', 'reconciliation', 'debts', 'reports', 'profile']) {
  await p.goto('http://localhost:3072/' + r); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${r || 'home'}.png` });
}
await ctx.storageState({ path: process.env.TEMP + '/eh-npp-state.json' });
await b.close();
