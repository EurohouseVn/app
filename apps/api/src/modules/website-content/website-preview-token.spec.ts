import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWebsitePreviewToken,
  verifyWebsitePreviewToken,
} from './website-preview-token';

const secret = 'eurohouse-preview-secret-at-least-32-characters';
const nowSeconds = 1_793_404_800;

test('preview token is short-lived and scoped to exactly one revision', () => {
  const token = createWebsitePreviewToken('revision-7', secret, nowSeconds, 600);
  assert.deepEqual(verifyWebsitePreviewToken(token, secret, nowSeconds + 599), {
    purpose: 'website-preview',
    revisionId: 'revision-7',
    exp: nowSeconds + 600,
  });
});

test('preview token rejects expiry and signature tampering', () => {
  const token = createWebsitePreviewToken('revision-7', secret, nowSeconds, 600);
  assert.throws(() => verifyWebsitePreviewToken(token, secret, nowSeconds + 600), /expired/i);
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.throws(() => verifyWebsitePreviewToken(tampered, secret, nowSeconds), /invalid/i);
});
