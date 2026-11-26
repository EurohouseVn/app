import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'vi-VN' });
const p = await ctx.newPage();
await p.goto('http://localhost:3072/'); await p.waitForTimeout(2500);
await p.locator('input').nth(0).fill('npp@eurohouse.vn'); await p.locator('input').nth(1).fill('Eurohouse@2026');
await p.keyboard.press('Enter'); await p.waitForTimeout(4000);
await ctx.storageState({ path: process.env.TEMP + '/eh-npp-state.json' }); console.log('saved', p.url());
await b.close();
