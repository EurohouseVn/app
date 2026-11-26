import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpOcrProvider, NullOcrProvider, resolveOcrProvider } from './ocr-provider';

const ok = (body: unknown, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });

test('the null provider says it is not configured and refuses to extract', async () => {
  const provider = new NullOcrProvider();
  assert.equal(provider.configured, false);
  await assert.rejects(provider.extract(), /Chưa cài/);
});

test('the environment decides which provider is used', () => {
  assert.equal(resolveOcrProvider({}).configured, false);
  assert.equal(resolveOcrProvider({ OCR_SERVICE_URL: '  ' }).configured, false);
  const http = resolveOcrProvider({ OCR_SERVICE_URL: 'http://ocr.local:9000', OCR_SERVICE_TOKEN: 't' });
  assert.equal(http.configured, true);
  assert.ok(http instanceof HttpOcrProvider);
});

test('the HTTP provider posts the image with the bearer token and returns cleaned groups', async () => {
  const seen: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const provider = new HttpOcrProvider('http://ocr.local:9000/', 'secret', async (url, init) => {
    seen.push({ url, headers: init.headers, body: init.body });
    return { ok: true, status: 200, json: async () => ({ engine: 'qwen3-vl-8b', groups: [{ heading: 'Xám Ngọc Trai', lines: [{ text: 'Nối khung ECS03', quantity: 2, unit: 'bó' }, { text: '   ', quantity: 1 }, { text: 'Cánh số 76', quantity: 'abc' }] }] }) };
  });
  const result = await provider.extract({ imageBase64: 'AAAA', mime: 'image/jpeg', kind: 'ORDER' });
  assert.equal(seen[0].url, 'http://ocr.local:9000/v1/extract');
  assert.equal(seen[0].headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(seen[0].body), { imageBase64: 'AAAA', mime: 'image/jpeg', kind: 'ORDER' });
  assert.equal(result.engine, 'qwen3-vl-8b');
  assert.deepEqual(result.groups[0].lines, [{ text: 'Nối khung ECS03', quantity: 2, unit: 'bó' }, { text: 'Cánh số 76', quantity: null, unit: null }]);
  assert.equal(provider.engine, 'qwen3-vl-8b');
});

test('the HTTP provider reports service errors and malformed answers instead of guessing', async () => {
  const input = { imageBase64: 'AAAA', mime: 'image/png', kind: 'RECEIPT' as const };
  await assert.rejects(new HttpOcrProvider('http://x', '', ok({}, 503)).extract(input), /lỗi 503/);
  await assert.rejects(new HttpOcrProvider('http://x', '', ok({ engine: 'a' })).extract(input), /thiếu groups/);
  await assert.rejects(new HttpOcrProvider('http://x', '', ok({ groups: [{ heading: 'h' }] })).extract(input), /không có dòng/);
  await assert.rejects(new HttpOcrProvider('', '').extract(input), /Chưa cài/);
});

test('a slow reading service is cut off with a readable message', async () => {
  const slow = (_url: string, init: { signal?: AbortSignal }) => new Promise<never>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const provider = new HttpOcrProvider('http://x', '', slow as never, 20);
  await assert.rejects(provider.extract({ imageBase64: 'AAAA', mime: 'image/png', kind: 'ORDER' }), /quá chậm/);
});
