import test from 'node:test';
import assert from 'node:assert/strict';
import { assertInventoryMutationAllowed } from './inventory-mutation-policy';

test('factory and NPP actors cannot mutate company stock', () => {
  assert.throws(() => assertInventoryMutationAllowed({ actorId: 'factory-user', role: 'FACTORY', organizationId: 'factory-1' }, 'COMPANY_STOCK', 'GLOBAL'));
  assert.throws(() => assertInventoryMutationAllowed({ actorId: 'npp-user', role: 'NPP', organizationId: 'npp-1' }, 'COMPANY_STOCK', 'GLOBAL'));
});

test('NPP actor cannot mutate another distributor inventory', () => {
  assert.throws(() => assertInventoryMutationAllowed({ actorId: 'npp-user', role: 'NPP', organizationId: 'npp-1' }, 'NPP_STOCK', 'npp-2'));
  assert.doesNotThrow(() => assertInventoryMutationAllowed({ actorId: 'npp-user', role: 'NPP', organizationId: 'npp-1' }, 'NPP_STOCK', 'npp-1'));
});

test('company staff can mutate company stock', () => {
  assert.doesNotThrow(() => assertInventoryMutationAllowed({ actorId: 'staff', role: 'STAFF' }, 'COMPANY_STOCK', 'GLOBAL'));
});

test('workshop inventory is organization scoped', () => {
  assert.doesNotThrow(() => assertInventoryMutationAllowed({ actorId: 'factory-user', role: 'FACTORY', organizationId: 'factory-1' }, 'WORKSHOP_STOCK', 'factory-1'));
  assert.throws(() => assertInventoryMutationAllowed({ actorId: 'factory-user', role: 'FACTORY', organizationId: 'factory-1' }, 'WORKSHOP_STOCK', 'factory-2'));
  assert.doesNotThrow(() => assertInventoryMutationAllowed({ actorId: 'admin', role: 'ADMIN' }, 'WORKSHOP_STOCK', 'factory-2'));
});
