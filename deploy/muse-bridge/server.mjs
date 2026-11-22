import http from 'node:http';
import { chromium } from 'playwright';

const TOKEN = process.env.BRIDGE_TOKEN ?? '';
const PROFILE_DIR = process.env.PROFILE_DIR ?? '/data/profile';
const START_URL = process.env.START_URL ?? 'https://muse.ai/';
const PORT = Number(process.env.PORT ?? 8080);
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

const server = http.createServer(async (req, res) => {
  const send = (status, body, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'UNAUTHORIZED' });
  try {
    if (req.url === '/health') return send(200, { ok: true, url: page.url(), title: await page.title() });
    if (req.url === '/screenshot') return send(200, await page.screenshot(), 'image/png');
    return send(404, { error: 'NOT_FOUND' });
  } catch (error) { return send(500, { error: String(error?.message ?? error) }); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`muse-bridge sẵn sàng trên :${PORT}`));
