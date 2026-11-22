import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';

const TOKEN = (process.env.BRIDGE_TOKEN ?? (process.env.BRIDGE_TOKEN_FILE ? fs.readFileSync(process.env.BRIDGE_TOKEN_FILE, 'utf8') : '')).trim();
const PROFILE_DIR = process.env.PROFILE_DIR ?? '/data/profile';
const START_URL = process.env.START_URL ?? 'https://muse.ai/';
const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
if (!TOKEN) { console.error('BRIDGE_TOKEN là bắt buộc'); process.exit(1); }

const proxy = process.env.BRIDGE_PROXY ? { server: process.env.BRIDGE_PROXY } : undefined;
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 820 },
  locale: process.env.BRIDGE_LOCALE ?? 'en-US',
  proxy,
  args: ['--no-first-run', '--disable-dev-shm-usage', '--no-sandbox'],
});
const page = context.pages()[0] ?? await context.newPage();
await page.goto(START_URL, { waitUntil: 'domcontentloaded' }).catch((error) => console.error('goto lỗi', error.message));

const INPUT = 'textarea[placeholder="Message"]';
const THREAD_URL = /^https:\/\/muse\.ai\/thread\/[0-9a-f-]{36}$/;

// Một yêu cầu một lúc: cả tài khoản chỉ có một trình duyệt.
let queue = Promise.resolve();
const enqueue = (job) => { const run = queue.then(job, job); queue = run.catch(() => undefined); return run; };

async function status() {
  const url = page.url();
  const loggedIn = await page.locator(INPUT).count().then((n) => n > 0).catch(() => false);
  return { url, loggedIn, title: await page.title().catch(() => '') };
}

/** Chụp trạng thái hiện tại: số bong bóng và danh sách ảnh (theo src) đang có trên trang. */
const snapshotState = () => page.evaluate(() => ({
  bubbles: document.querySelectorAll('.hatch-chat-groupable-bubble').length,
  imageSrcs: [...document.querySelectorAll('img[src^="blob:"]')].map((img) => img.src),
}));

/** Chờ trang ổn định (chuyển phiên chat, tải lịch sử) rồi mới lấy mốc, tránh đếm nhầm nội dung cũ là mới. */
async function settledState() {
  let previous = JSON.stringify(await snapshotState());
  let calm = 0;
  for (let attempt = 0; attempt < 16 && calm < 3; attempt += 1) {
    await page.waitForTimeout(500);
    const current = JSON.stringify(await snapshotState());
    calm = current === previous ? calm + 1 : 0;
    previous = current;
  }
  return JSON.parse(previous);
}

async function collectNew(before) {
  return page.evaluate(async (base) => {
    const bubbles = [...document.querySelectorAll('.hatch-chat-groupable-bubble')].slice(base.bubbles);
    const texts = bubbles
      .filter((bubble) => /agent-bubble/.test(bubble.className))
      .map((bubble) => (bubble.innerText || '').trim())
      .filter(Boolean);
    const known = new Set(base.imageSrcs);
    const imgs = [...document.querySelectorAll('img[src^="blob:"]')].filter((img) => !known.has(img.src));
    const images = [];
    for (const img of imgs) {
      try {
        const blob = await (await fetch(img.src)).blob();
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        images.push({ mime: blob.type || 'image/png', base64: data, width: img.naturalWidth, height: img.naturalHeight });
      } catch { /* bỏ qua ảnh không đọc được */ }
    }
    return { texts, images };
  }, before);
}

async function ask({ threadId, prompt, timeoutMs = DEFAULT_TIMEOUT_MS, expectImage = false }) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Object.assign(new Error('PROMPT_REQUIRED'), { status: 400 });
  const target = threadId ? `https://muse.ai/thread/${threadId}` : 'https://muse.ai/thread/new';
  if (threadId && !/^[0-9a-f-]{36}$/.test(threadId)) throw Object.assign(new Error('THREAD_ID_INVALID'), { status: 400 });
  if (page.url() !== target) await page.goto(target, { waitUntil: 'domcontentloaded' });
  try { await page.locator(INPUT).waitFor({ state: 'visible', timeout: 20_000 }); }
  catch {
    // Có threadId mà không mở được: phiên không còn (đổi tài khoản Muse, đã xoá) → để API dựng lại ngữ cảnh từ CSDL.
    if (threadId && !(await status()).loggedIn) {
      await page.goto('https://muse.ai/thread/new', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      if (await page.locator(INPUT).count()) throw Object.assign(new Error('THREAD_LOST'), { status: 409 });
    }
    throw Object.assign(new Error('NOT_LOGGED_IN_OR_UI_CHANGED'), { status: 503 });
  }
  if (threadId && page.url() !== target) throw Object.assign(new Error('THREAD_LOST'), { status: 409 });
  const before = await settledState();
  await page.locator(INPUT).fill(prompt);
  await page.keyboard.press('Enter');

  const deadline = Date.now() + timeoutMs;
  let lastSignature = '';
  let stableSince = Date.now();
  let diagnostic = '';
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const busy = await page.locator('button[aria-label="Stop"], button[aria-label="Stop task"]').count();
    const state = await snapshotState();
    const agentChars = await page.evaluate(() => [...document.querySelectorAll('.hatch-chat-groupable-bubble')]
      .filter((bubble) => /agent-bubble/.test(bubble.className)).reduce((sum, bubble) => sum + (bubble.innerText || '').length, 0));
    const known = new Set(before.imageSrcs);
    const now = { bubbles: state.bubbles, images: state.imageSrcs.filter((src) => !known.has(src)).length, agentChars };
    const progressed = now.bubbles > before.bubbles + 1;
    const imageReady = !expectImage || now.images > 0;
    const signature = `${now.bubbles}:${now.images}:${now.agentChars}`;
    diagnostic = `busy=${busy} bubbles=${before.bubbles}->${now.bubbles} newImages=${now.images} chars=${now.agentChars}`;
    if (signature !== lastSignature) { lastSignature = signature; stableSince = Date.now(); }
    if (!busy && progressed && imageReady && Date.now() - stableSince >= 3000) {
      const result = await collectNew(before);
      const url = page.url();
      return { threadId: THREAD_URL.test(url) ? url.split('/').pop() : threadId ?? null, text: result.texts.join('\n\n'), images: result.images };
    }
  }
  throw Object.assign(new Error(`TIMEOUT ${diagnostic}`), { status: 504 });
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 }); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const server = http.createServer(async (req, res) => {
  const send = (statusCode, body) => { res.writeHead(statusCode, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'UNAUTHORIZED' });
  try {
    if (req.method === 'GET' && req.url === '/v1/status') return send(200, await enqueue(status));
    if (req.method === 'GET' && req.url === '/v1/debug') {
      return send(200, await enqueue(() => page.evaluate(() => ({
        url: location.href,
        bubbles: document.querySelectorAll('.hatch-chat-groupable-bubble').length,
        stopButtons: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || '').filter((x) => /stop|cancel/i.test(x)),
        images: [...document.querySelectorAll('img')].map((i) => (i.currentSrc || i.src || '').slice(0, 60) + ' ' + i.naturalWidth + 'x' + i.naturalHeight).slice(-6),
      }))));
    }
    if (req.method === 'GET' && req.url === '/v1/screenshot') {
      const png = await enqueue(() => page.screenshot());
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(png);
    }
    if (req.method === 'POST' && req.url === '/v1/ask') {
      const body = await readBody(req);
      return send(200, await enqueue(() => ask(body)));
    }
    return send(404, { error: 'NOT_FOUND' });
  } catch (error) {
    const statusCode = error?.status ?? 500;
    return send(statusCode, { error: String(error?.message ?? error) });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`muse-bridge sẵn sàng trên :${PORT}`));
