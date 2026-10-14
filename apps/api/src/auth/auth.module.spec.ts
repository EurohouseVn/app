import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveJwtSecret } from './auth.module';

test('production JWT secret fails closed when missing or weak', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), /JWT_SECRET/);
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'change-me' } as NodeJS.ProcessEnv), /JWT_SECRET/);
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' } as NodeJS.ProcessEnv), /JWT_SECRET/);
});

test('production JWT secret accepts a sufficiently strong configured value', () => {
  const secret = 'v2-test-only-0123456789-abcdefghijklmnopqrstuvwxyz';
  assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret } as NodeJS.ProcessEnv), secret);
});
