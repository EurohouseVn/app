import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPublishedContent,
  listPublishedContent,
  PublicApiError,
} from './public-api';

test('published content client uses API_URL and Next cache tags', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalApiUrl = process.env.API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  context.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnv('API_URL', originalApiUrl);
    restoreEnv('NEXT_PUBLIC_API_URL', originalPublicApiUrl);
  });

  process.env.API_URL = 'https://server-api.example/api/';
  process.env.NEXT_PUBLIC_API_URL = 'https://client-api.example/api';
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({ items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 });
  };

  await listPublishedContent({ family: 'RESIDENTIAL', q: '  cửa đi  ', page: 1 });

  assert.equal(
    requestUrl,
    'https://server-api.example/api/public/website/content?family=RESIDENTIAL&q=c%E1%BB%ADa+%C4%91i&page=1',
  );
  assert.equal(requestInit?.next?.revalidate, 300);
  assert.deepEqual(requestInit?.next?.tags, ['website-content']);
});

test('detail returns null only for a 404 response', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response(null, { status: 404 });
  assert.equal(await getPublishedContent('khong-ton-tai'), null);

  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(
    () => getPublishedContent('tam-loi'),
    (error: unknown) => error instanceof PublicApiError && error.status === 503,
  );
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
