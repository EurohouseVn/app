import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentity, normalizeOptionalIdentities } from './identity-normalization';

test('normalizes email with trim and lowercase', () => {
  assert.deepEqual(normalizeIdentity('  User.Name@Example.COM  '), {
    kind: 'EMAIL',
    normalized: 'user.name@example.com',
  });
});

test('normalizes equivalent Vietnamese phone spellings to E.164', () => {
  for (const value of ['0912345678', '84912345678', '+84912345678', '0912 345 678']) {
    assert.deepEqual(normalizeIdentity(value), {
      kind: 'PHONE',
      normalized: '+84912345678',
    });
  }
});

test('rejects malformed and ambiguous identifiers', () => {
  for (const value of ['', 'not-an-identity', '09123', '+841234567890', 'user@']) {
    assert.throws(() => normalizeIdentity(value), /INVALID_IDENTIFIER/);
  }
});

test('requires at least one identity and returns both normalized identities when supplied', () => {
  assert.throws(() => normalizeOptionalIdentities(), /IDENTIFIER_REQUIRED/);
  assert.deepEqual(normalizeOptionalIdentities(' USER@example.com ', '0912345678'), {
    emailNormalized: 'user@example.com',
    phoneNormalized: '+84912345678',
  });
  assert.deepEqual(normalizeOptionalIdentities(undefined, '0912345678'), {
    phoneNormalized: '+84912345678',
  });
});
