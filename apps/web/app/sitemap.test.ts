import test from 'node:test';
import assert from 'node:assert/strict';
import sitemap from './sitemap';

test('sitemap publishes unique production URLs without artificial freshness', () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.every((url) => url.startsWith('https://nhomeurohouse.com/')), true);
  assert.equal(urls.some((url) => url.includes('[slug]') || url.includes('?') || url.includes('localhost')), false);
  assert.equal(entries.every((entry) => entry.lastModified === undefined), true);
});
