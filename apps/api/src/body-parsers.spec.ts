import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { configureBodyParsers } from './body-parsers';

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  configureBodyParsers(app);
  const echo = (req: express.Request, res: express.Response) => res.json({ keys: Object.keys(req.body ?? {}), size: JSON.stringify(req.body ?? {}).length });
  app.post('/api/auth/login', echo);
  app.post('/api/npp/documents', echo);
  app.post('/api/npp/documents/:id/lines', echo);
  app.post('/api/npp/accessories/read-photo', echo);
  app.post('/api/npp/accessories', echo);
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status ?? 500).json({ error: 'failed' }));
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('ordinary routes still receive their JSON body (login must not lose it)', async () => {
  await withServer(async (base) => {
    const response = await post(`${base}/api/auth/login`, { identifier: 'a@b.c', password: 'secret' });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { keys: string[] }).keys, ['identifier', 'password']);
  });
});

test('ordinary routes keep the small 100 KB limit', async () => {
  await withServer(async (base) => {
    const response = await post(`${base}/api/auth/login`, { identifier: 'x'.repeat(200 * 1024), password: 'y' });
    assert.equal(response.status, 413);
  });
});

test('the document upload path accepts a photo-sized body, and so do its sub-routes', async () => {
  await withServer(async (base) => {
    const big = 'A'.repeat(3 * 1024 * 1024);
    const created = await post(`${base}/api/npp/documents`, { kind: 'ORDER', imageBase64: big, mime: 'image/jpeg' });
    assert.equal(created.status, 200);
    assert.deepEqual((await created.json() as { keys: string[] }).keys, ['kind', 'imageBase64', 'mime']);
    const lines = await post(`${base}/api/npp/documents/abc/lines`, { lines: [], note: 'x'.repeat(300 * 1024) });
    assert.equal(lines.status, 200);
  });
});

test('even the upload path has an upper bound', async () => {
  await withServer(async (base) => {
    const response = await post(`${base}/api/npp/documents`, { imageBase64: 'A'.repeat(16 * 1024 * 1024) });
    assert.equal(response.status, 413);
  });
});

test('the accessory photo path accepts a photo-sized body but the other accessory routes keep 100 KB', async () => {
  await withServer(async (base) => {
    const photo = await post(`${base}/api/npp/accessories/read-photo`, { imageBase64: 'A'.repeat(3 * 1024 * 1024), mime: 'image/png' });
    assert.equal(photo.status, 200);
    const plain = await post(`${base}/api/npp/accessories`, { name: 'x'.repeat(200 * 1024) });
    assert.equal(plain.status, 413);
  });
});
