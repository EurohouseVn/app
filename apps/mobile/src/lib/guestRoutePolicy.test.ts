import assert from 'node:assert/strict';
import test from 'node:test';
import { guestRouteDecision } from './guestRoutePolicy.ts';

test('guest routes distinguish local tools, public reads, account modules, and Eurohouse features', () => {
  for (const route of ['/weather', '/workforce', '/quote']) assert.equal(guestRouteDecision(route), 'ALLOW_LOCAL');
  for (const route of ['/catalog', '/library', '/knowledge', '/promo']) assert.equal(guestRouteDecision(route), 'ALLOW_PUBLIC_READ');
  for (const route of ['/projects', '/debts', '/payroll']) assert.equal(guestRouteDecision(route), 'REQUIRE_ACCOUNT');
  for (const route of ['/orders', '/formulas']) assert.equal(guestRouteDecision(route), 'REQUIRE_EUROHOUSE_FEATURE');
});
