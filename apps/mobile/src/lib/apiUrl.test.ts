import assert from 'node:assert/strict';
import test from 'node:test';
import { DEV_FALLBACK_API_URL, resolveApiUrl } from './apiUrl.ts';

test('development falls back to the local API when no URL is configured', () => {
  assert.equal(resolveApiUrl(undefined, { requireSecure: false }), DEV_FALLBACK_API_URL);
  assert.equal(resolveApiUrl('   ', { requireSecure: false }), DEV_FALLBACK_API_URL);
});

test('development accepts a plain http LAN address', () => {
  assert.equal(resolveApiUrl('http://192.168.1.20:3001/api', { requireSecure: false }), 'http://192.168.1.20:3001/api');
});

test('release builds refuse to start without an API URL', () => {
  assert.throws(() => resolveApiUrl(undefined, { requireSecure: true }), /EXPO_PUBLIC_API_URL/);
  assert.throws(() => resolveApiUrl('', { requireSecure: true }), /EXPO_PUBLIC_API_URL/);
});

test('release builds refuse http and loopback addresses', () => {
  assert.throws(() => resolveApiUrl('http://api.nhomeurohouse.com/api', { requireSecure: true }), /https/);
  assert.throws(() => resolveApiUrl('https://localhost:3001/api', { requireSecure: true }), /localhost|127\.0\.0\.1/);
  assert.throws(() => resolveApiUrl('https://127.0.0.1/api', { requireSecure: true }), /localhost|127\.0\.0\.1/);
});

test('release builds accept the production https URL and drop a trailing slash', () => {
  assert.equal(resolveApiUrl('https://api.nhomeurohouse.com/api/', { requireSecure: true }), 'https://api.nhomeurohouse.com/api');
});
