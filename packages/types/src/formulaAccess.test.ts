import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMULA_ACCESS_COPY,
  FORMULA_ACCESS_STATUSES,
  PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS,
  formulaCapabilityFromStatus,
  type RegisterWorkshopInput,
} from './formulaAccess.js';

test('new registered workshops keep management tools but receive no Eurohouse mutations', () => {
  assert.deepEqual(PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS, [
    'factory:quotations',
    'factory:projects',
    'factory:debts',
    'factory:workforce',
    'factory:payroll',
    'factory:cashflow',
  ]);
  assert.equal(PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS.includes('factory:orders'), false);
  assert.equal(PUBLIC_WORKSHOP_DEFAULT_MODULE_KEYS.includes('factory:formulas'), false);
});

test('registration requires an email (the verification code goes there); phone is optional', () => {
  const registrations: RegisterWorkshopInput[] = [
    { displayName: 'An', organizationName: 'Xưởng An', password: 'secret123', email: 'an@example.com' },
    {
      displayName: 'Cường',
      organizationName: 'Xưởng Cường',
      password: 'secret123',
      email: 'cuong@example.com',
      phone: '0912345678',
    },
  ];
  // @ts-expect-error phone-only registration has no way to receive the verification code
  const phoneOnly: RegisterWorkshopInput = { displayName: 'Bình', organizationName: 'Xưởng Bình', password: 'secret123', phone: '0912345678' };
  // @ts-expect-error the channel is no longer selectable
  const withChannel: RegisterWorkshopInput = { ...registrations[0], verificationChannel: 'PHONE' };
  assert.equal(registrations.every((registration) => registration.email.includes('@')), true);
  assert.ok(phoneOnly && withChannel);
});

test('formula capability exposes the approved locked customer copy', () => {
  assert.deepEqual(FORMULA_ACCESS_STATUSES, ['LOCKED', 'ACTIVE', 'REVOKED']);
  assert.deepEqual(formulaCapabilityFromStatus('LOCKED'), {
    status: 'LOCKED',
    enabled: false,
    message: 'Module đang xây dựng',
  });
  assert.equal(FORMULA_ACCESS_COPY.LOCKED, 'Module đang xây dựng');
});
