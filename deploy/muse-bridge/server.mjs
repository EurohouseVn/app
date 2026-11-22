import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';

const TOKEN = (process.env.BRIDGE_TOKEN ?? (process.env.BRIDGE_TOKEN_FILE ? fs.readFileSync(process.env.BRIDGE_TOKEN_FILE, 'utf8') : '')).trim();
const PROFILE_DIR = process.env.PROFILE_DIR ?? '/data/profile';
const STATE_FILE = process.env.STATE_FILE ?? '/data/bridge-state.json';
const START_URL = process.env.START_URL ?? 'https://muse.ai/';
const PORT = Number(process.env.PORT ?? 8080);
const POOL_TARGET = Number(process.env.POOL_TARGET ?? 2);
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
const BUSY = 'button[aria-label="Stop"], button[aria-label="Stop task"]';
const THREAD_URL = /^https:\/\/muse\.ai\/thread\/[0-9a-f-]{36}$/;
const THREAD_ID = /^[0-9a-f-]{36}$/;

// ── Trạng thái bền: mồi (primer) hiện hành và các phiên chat đã "làm nóng" ──────────────────────────
let state = { primer: { text: '', version: '' }, pool: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* lần chạy đầu */ }
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (error) { console.error('không lưu được trạng thái', error.message); } };

// ── Hàng đợi hai mức: việc của người dùng luôn đi trước việc làm nóng ─────────────────────────────
const high = [];
const low = [];
let running = false;
function pump() {
  if (running) return;
  const item = high.shift() ?? low.shift();
  if (!item) return;
  running = true;
  item.job().then(item.resolve, item.reject).finally(() => { running = false; pump(); });
}
function enqueue(job, { background = false } = {}) {
  return new Promise((resolve, reject) => { (background ? low : high).push({ job, resolve, reject }); pump(); });
}
const idle = () => !running && high.length === 0 && low.length === 0;

async function status() {
  const url = page.url();
  const loggedIn = await page.locator(INPUT).count().then((n) => n > 0).catch(() => false);
  return { url, loggedIn, title: await page.title().catch(() => ''), pool: poolFor(state.primer.version).length, primerVersion: state.primer.version };
}

/** Số bong bóng chat hiện có; chờ ngắn cho trang ổn định để không đếm nhầm lịch sử cũ là tin mới. */
async function settledBubbles() {
  const count = () => page.evaluate(() => document.querySelectorAll('.hatch-chat-groupable-bubble').length);
  let previous = await count();
  let calm = 0;
  for (let attempt = 0; attempt < 12 && calm < 2; attempt += 1) {
    await page.waitForTimeout(300);
    const current = await count();
    calm = current === previous ? calm + 1 : 0;
    previous = current;
  }
  return previous;
}

const agentTextAfter = (base) => page.evaluate((from) => [...document.querySelectorAll('.hatch-chat-groupable-bubble')].slice(from)
  .filter((bubble) => /agent-bubble/.test(bubble.className))
  .map((bubble) => (bubble.innerText || '').trim()).filter(Boolean), base);

async function runAsk({ threadId, prompt, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Object.assign(new Error('PROMPT_REQUIRED'), { status: 400 });
  if (threadId && !THREAD_ID.test(threadId)) throw Object.assign(new Error('THREAD_ID_INVALID'), { status: 400 });
  const target = threadId ? `https://muse.ai/thread/${threadId}` : 'https://muse.ai/thread/new';
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
  const before = await settledBubbles();
  await page.locator(INPUT).fill(prompt);
  await page.keyboard.press('Enter');

  const deadline = Date.now() + timeoutMs;
  let lastSignature = '';
  let stableSince = Date.now();
  let diagnostic = '';
  while (Date.now() < deadline) {
    await page.waitForTimeout(350);
    const busy = await page.locator(BUSY).count();
    const now = await page.evaluate(() => {
      const bubbles = [...document.querySelectorAll('.hatch-chat-groupable-bubble')];
      return {
        bubbles: bubbles.length,
        chars: bubbles.filter((bubble) => /agent-bubble/.test(bubble.className)).reduce((sum, bubble) => sum + (bubble.innerText || '').length, 0),
      };
    });
    const progressed = now.bubbles > before + 1;
    const signature = `${now.bubbles}:${now.chars}`;
    diagnostic = `busy=${busy} bubbles=${before}->${now.bubbles} chars=${now.chars}`;
    if (signature !== lastSignature) { lastSignature = signature; stableSince = Date.now(); }
    if (!busy && progressed && Date.now() - stableSince >= 1200) {
      const texts = await agentTextAfter(before);
      const url = page.url();
      return { threadId: THREAD_URL.test(url) ? url.split('/').pop() : threadId ?? null, text: texts.join('\n\n'), images: [] };
    }
  }
  throw Object.assign(new Error(`TIMEOUT ${diagnostic}`), { status: 504 });
}

// ── Làm nóng: tạo sẵn phiên chat đã nạp kiến thức nền, để câu hỏi đầu tiên của người dùng không chờ ~30 giây ──
const poolFor = (version) => state.pool.filter((entry) => entry.version === version).map((entry) => entry.threadId);

async function primeOne() {
  const { text, version } = state.primer;
  if (!text || !version) return;
  const result = await runAsk({ prompt: text, timeoutMs: 120_000 });
  if (result.threadId && state.primer.version === version) {
    state.pool.push({ threadId: result.threadId, version, at: Date.now() });
    saveState();
    console.log(`đã làm nóng phiên ${result.threadId} (primer ${version})`);
  }
}

function takePooled() {
  const index = state.pool.findIndex((entry) => entry.version === state.primer.version);
  if (index < 0) return null;
  const [entry] = state.pool.splice(index, 1);
  saveState();
  return entry.threadId;
}

setInterval(() => {
  if (!idle() || !state.primer.text) return;
  if (poolFor(state.primer.version).length >= POOL_TARGET) return;
  enqueue(primeOne, { background: true }).catch((error) => console.error('làm nóng lỗi', String(error?.message ?? error)));
}, 5000).unref?.();

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
    if (req.method === 'GET' && req.url === '/v1/screenshot') {
      const png = await enqueue(() => page.screenshot());
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(png);
    }
    if (req.method === 'POST' && req.url === '/v1/primer') {
      const { text, version } = await readBody(req);
      if (typeof text !== 'string' || !text.trim() || typeof version !== 'string' || !version) return send(400, { error: 'PRIMER_INVALID' });
      if (state.primer.version !== version) {
        state.primer = { text, version };
        saveState();
      }
      return send(200, { ok: true, version: state.primer.version, pooled: poolFor(version).length });
    }
    if (req.method === 'POST' && req.url === '/v1/ask') {
      const body = await readBody(req);
      return send(200, await enqueue(async () => {
        // Chưa có phiên thì dùng phiên đã làm nóng (nếu có) để bỏ ~20 giây tạo phiên mới.
        const pooled = body.threadId ? null : takePooled();
        try {
          return await runAsk({ ...body, threadId: body.threadId ?? pooled ?? undefined });
        } catch (error) {
          if (pooled && error?.message === 'THREAD_LOST') return runAsk({ ...body, threadId: undefined });
          throw error;
        }
      }));
    }
    return send(404, { error: 'NOT_FOUND' });
  } catch (error) {
    const statusCode = error?.status ?? 500;
    return send(statusCode, { error: String(error?.message ?? error) });
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`muse-bridge sẵn sàng trên :${PORT}`));
