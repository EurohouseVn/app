import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DevelopmentVerificationDelivery,
  ResendVerificationDelivery,
  resolveVerificationDelivery,
} from './verification-delivery.service';

test('production verification delivery fails closed without Resend configuration', () => {
  assert.throws(
    () => resolveVerificationDelivery({ NODE_ENV: 'production' }),
    /RESEND_API_KEY.*RESEND_FROM_EMAIL/,
  );
  assert.throws(
    () => new DevelopmentVerificationDelivery({ NODE_ENV: 'production' }),
    /development verification delivery is disabled in production/i,
  );
});

test('Resend delivery sends an email OTP without extra credentials', async () => {
  let request: Record<string, unknown> | undefined;
  const delivery = new ResendVerificationDelivery('EUROHOUSE <xacminh@nhomeurohouse.com>', { emails: { send: async (input: Record<string, unknown>) => { request = input; return { data: { id: 'email-1' }, error: null }; } } } as never);

  await delivery.send({
    channel: 'EMAIL',
    target: 'user@example.com',
    code: '123456',
    expiresMinutes: 10,
    password: 'must-not-leak',
    token: 'must-not-leak',
  } as never);

  assert.equal(request?.to, 'user@example.com');
  assert.equal(String(request?.subject).includes('EUROHOUSE'), true);
  assert.equal(String(request?.html).includes('123456'), true);
  assert.equal(JSON.stringify(request).includes('must-not-leak'), false);
});
