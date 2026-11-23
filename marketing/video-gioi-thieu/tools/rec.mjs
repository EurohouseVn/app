// Bộ quay màn hình app (web, 390x844 @2x) bằng CDP screencast + Edge. Chỉ chạy với API/CSDL tạm, dữ liệu giả.
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
export const BASE = process.env.EH_BASE || 'http://localhost:8083';
export const OUT = 'E:/LELOIGLOBAL_CODEX/APP EUROHOUSE/marketing/video-gioi-thieu/assets/clips';
const STATE = process.env.EH_STATE || path.join(process.env.TEMP, 'evon-probe2', 'eh-video-state.json');
const RIPPLE = `(() => {
  const s = document.createElement('style');
  s.textContent = '@keyframes ehr{0%{transform:translate(-50%,-50%) scale(.3);opacity:.85}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}.ehr{position:fixed;width:56px;height:56px;border-radius:50%;background:rgba(244,124,32,.55);border:3px solid #F47C20;pointer-events:none;z-index:2147483647;animation:ehr .55s ease-out forwards}';
  document.documentElement.appendChild(s);
  addEventListener('pointerdown', (e) => { const d = document.createElement('div'); d.className = 'ehr'; d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; document.documentElement.appendChild(d); setTimeout(() => d.remove(), 700); }, true);
})();`;
export async function record(name, fn, { auth = true, w = 390, h = 844, init = '' } = {}) {
  const dir = path.join(process.env.TEMP, 'eh-frames', name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const ctx = await browser.newContext({ ...(auth ? { storageState: STATE } : {}), viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'vi-VN' });
  await ctx.addInitScript(RIPPLE);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = []; let n = 0; let running = false;
  const loop = async () => { while (running) { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 78, optimizeForSpeed: true, clip: { x: 0, y: 0, width: w, height: h, scale: 2 } }).catch(() => null); if (!r) break; const file = path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); frames.push({ file, t: Date.now() / 1000 }); } };
  const helpers = {
    go: async (p) => { await page.goto(BASE + p, { waitUntil: 'load' }); },
    wait: (ms) => page.waitForTimeout(ms),
    scroll: async (px, ms = 900) => { const steps = Math.max(1, Math.round(ms / 16)); const per = px / steps; await page.mouse.move(w / 2, h / 2); for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, per); await page.waitForTimeout(16); } },
    tap: async (target, opts = {}) => { const loc = typeof target === 'string' ? page.getByText(target, { exact: opts.exact ?? true }).nth(opts.nth ?? 0) : target; try { await loc.waitFor({ timeout: 3000 }); await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}); const b = await loc.boundingBox({ timeout: 2000 }); if (b) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await page.waitForTimeout(120); await page.mouse.down(); await page.mouse.up(); return true; } } catch { console.log('  (bỏ qua, không thấy)', typeof target === 'string' ? target : 'locator'); } return false; },
    type: async (loc, text, delay = 70) => { await loc.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(text, { delay }); },
  };
  // làm nóng: tải trước để app dựng xong rồi mới bắt đầu ghi
  await fn.warm?.(page, helpers);
  running = true; const looping = loop();
  const t0 = Date.now();
  await fn(page, helpers);
  await page.waitForTimeout(400);
  running = false; await looping;
  await ctx.close(); await browser.close();
  if (frames.length < 2) throw new Error('không có khung hình');
  const list = path.join(dir, 'list.txt'); const lines = [];
  const fwd = (s) => s.split(path.sep).join('/');
  for (let i = 0; i < frames.length; i++) { const dur = i < frames.length - 1 ? Math.max(0.001, frames[i + 1].t - frames[i].t) : 0.4; lines.push(`file '${fwd(frames[i].file)}'`, `duration ${dur.toFixed(4)}`); }
  lines.push(`file '${fwd(frames[frames.length - 1].file)}'`);
  fs.writeFileSync(list, lines.join('\n'));
  const out = path.join(OUT, name + '.mp4');
  const r = spawnSync('C:/ffmpeg/ffmpeg.exe', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  console.log('OK', name, frames.length, 'frames', ((Date.now() - t0) / 1000).toFixed(1) + 's', out);
}
