import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  DevelopmentVerificationDelivery,
  resolveVerificationDelivery,
  WebhookVerificationDelivery,
} from './verification-delivery.service';

test('production verification delivery fails closed without webhook URL and secret', () => {
  assert.throws(
    () => resolveVerificationDelivery({ NODE_ENV: 'production' }),
    /VERIFICATION_DELIVERY_WEBHOOK_URL.*VERIFICATION_DELIVERY_WEBHOOK_SECRET/,
  );
  assert.throws(
    () => new DevelopmentVerificationDelivery({ NODE_ENV: 'production' }),
    /development verification delivery is disabled in production/i,
  );
});

test('webhook delivery signs an allowlisted payload without leaking extra credentials', async () => {
  let request: { url: string; init: RequestInit } | undefined;
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init: init ?? {} };
    return new Response(null, { status: 204 });
  };
  const delivery = new WebhookVerificationDelivery(
    'https://notify.example.test/verify',
    'signed-secret',
    fetchImpl,
  );

  await delivery.send({
    channel: 'EMAIL',
    target: 'user@example.com',
    code: '123456',
    expiresMinutes: 10,
    password: 'must-not-leak',
    token: 'must-not-leak',
  } as never);

  assert.ok(request);
  const body = String(request.init.body);
  assert.deepEqual(JSON.parse(body), {
    channel: 'EMAIL',
    target: 'user@example.com',
    code: '123456',
    expiresMinutes: 10,
  });
  assert.equal(request.init.headers?.['x-eurohouse-signature' as never], createHmac('sha256', 'signed-secret').update(body).digest('hex'));
  assert.equal(body.includes('password'), false);
  assert.equal(body.includes('token'), false);
});
