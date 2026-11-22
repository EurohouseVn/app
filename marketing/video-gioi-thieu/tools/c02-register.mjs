import { record } from './rec.mjs';
import fs from 'node:fs';
const EMAIL = 'hungphat.demo@example.com';
const clip = async (page, h) => {
  await h.wait(900);
  await h.tap('Đăng ký cơ sở'); await h.wait(900);
  const inp = page.locator('input');
  await h.type(inp.nth(0), 'Nguyễn Văn Hùng', 55);
  await h.type(inp.nth(1), 'Xưởng Nhôm Kính Hùng Phát', 45);
  await h.type(inp.nth(2), EMAIL, 45);
  await h.type(inp.nth(3), '0903123456', 60);
  await h.type(inp.nth(4), 'demo-xuong-2026', 40);
  await h.wait(500);
  const before = fs.statSync(process.env.TEMP + '/eh-api.log').size;
  await h.tap('Tạo tài khoản miễn phí'); await h.wait(2200);
  let code;
  for (let i = 0; i < 20 && !code; i++) {
    const log = fs.readFileSync(process.env.TEMP + '/eh-api.log', 'utf8').slice(before);
    const idx = log.lastIndexOf(EMAIL + ': '); if (idx >= 0) code = log.slice(idx + EMAIL.length + 2, idx + EMAIL.length + 8); else await h.wait(500);
  }
  await h.type(page.locator('input').first(), code, 170); await h.wait(700);
  if (await page.getByText('Xác minh và vào ứng dụng', { exact: true }).count()) await h.tap('Xác minh và vào ứng dụng'); await h.wait(2500); await h.tap('Trang chủ'); await h.wait(4500);
};
clip.warm = async (page, h) => { await h.go('/auth'); await h.wait(3500); };
await record('c02-register', clip, { auth: false });
