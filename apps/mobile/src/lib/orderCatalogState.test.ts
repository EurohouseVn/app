import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileOpenCatalogSystem, shouldShowOrderSummary } from './orderCatalogState.js';

test('keeps every aluminum system collapsed until the user opens one', () => {
  assert.equal(reconcileOpenCatalogSystem(null, ['system-55', 'system-70']), null);
});

test('keeps an opened system only while it remains visible', () => {
  assert.equal(reconcileOpenCatalogSystem('system-70', ['system-55', 'system-70']), 'system-70');
  assert.equal(reconcileOpenCatalogSystem('system-70', ['system-55']), null);
});

test('shows the floating order summary only after an item is selected', () => {
  assert.equal(shouldShowOrderSummary(0), false);
  assert.equal(shouldShowOrderSummary(1), true);
});
