import assert from 'node:assert/strict';
import test from 'node:test';
import { storeLinks } from './store-links';

test('store links point to the official stores over https', () => {
  const ios = storeLinks.find((s) => s.id === 'ios')!;
  const android = storeLinks.find((s) => s.id === 'android')!;
  assert.match(ios.href, /^https:\/\/apps\.apple\.com\/vn\/app\/id\d+$/);
  assert.equal(android.href, 'https://play.google.com/store/apps/details?id=com.nhomeurohouse.app');
});
