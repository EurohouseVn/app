import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERNAL_MODULES,
  allowedModuleKeysForRole,
  invalidModulesForRole,
  modulesAfterRoleChange,
  sanitizeModulesForRole,
  scopeForRole,
} from './accessScopes.js';

test('maps every user role to exactly one access scope', () => {
  assert.equal(scopeForRole('ADMIN'), 'INTERNAL');
  assert.equal(scopeForRole('STAFF'), 'INTERNAL');
  assert.equal(scopeForRole('NPP'), 'NPP');
  assert.equal(scopeForRole('FACTORY'), 'FACTORY');
  assert.equal(scopeForRole('DAILY'), 'FACTORY');
});

test('returns only module keys belonging to the role scope', () => {
  assert.ok(allowedModuleKeysForRole('STAFF').includes('users'));
  assert.ok(allowedModuleKeysForRole('NPP').includes('npp:orders'));
  assert.ok(allowedModuleKeysForRole('FACTORY').includes('factory:orders'));
  assert.equal(allowedModuleKeysForRole('NPP').includes('users'), false);
  assert.equal(allowedModuleKeysForRole('FACTORY').includes('npp:orders'), false);
});

test('Eurohouse access administration reuses the internal users permission', () => {
  const eurohouseAccess = INTERNAL_MODULES.find((module) => module.href === '/eurohouse-access');
  assert.equal(eurohouseAccess?.key, 'users');
  assert.equal(eurohouseAccess?.scope, 'INTERNAL');
});

test('sanitizes duplicates, unknown keys, and cross-scope permissions', () => {
  assert.deepEqual(
    sanitizeModulesForRole('NPP', ['npp:orders', 'users', 'npp:orders', 'unknown:key']),
    ['npp:orders'],
  );
});

test('reports every explicit permission that cannot be granted to the role', () => {
  assert.deepEqual(
    invalidModulesForRole('FACTORY', ['factory:orders', 'npp:orders', 'users', 'missing']),
    ['npp:orders', 'users', 'missing'],
  );
});

test('changing from an NPP role to staff immediately clears NPP-only selections', () => {
  assert.deepEqual(modulesAfterRoleChange(['npp:orders', 'npp:inventory'], 'STAFF'), []);
});
