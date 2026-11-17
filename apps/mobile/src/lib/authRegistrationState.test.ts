import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRegistrationState,
  registrationReducer,
  validateRegistrationDraft,
} from './authRegistrationState.ts';

const completeDraft = {
  displayName: 'Nguyễn An',
  organizationName: 'Xưởng Nhôm An',
  email: 'an@example.com',
  phone: '0912345678',
  password: 'secret123',
  verificationChannel: 'EMAIL' as const,
};

test('accepts email-only, phone-only, and both identities but rejects neither', () => {
  assert.equal(validateRegistrationDraft({ ...completeDraft, phone: '' }), null);
  assert.equal(validateRegistrationDraft({ ...completeDraft, email: '' }), null);
  assert.equal(validateRegistrationDraft(completeDraft), null);
  assert.equal(
    validateRegistrationDraft({ ...completeDraft, email: '', phone: '' }),
    'Vui lòng nhập email hoặc số điện thoại.',
  );
});

test('moves from form to verification without discarding the registration draft', () => {
  let state = createRegistrationState();
  state = registrationReducer(state, { type: 'UPDATE_DRAFT', value: completeDraft });
  state = registrationReducer(state, { type: 'SUBMIT_REGISTRATION' });
  assert.equal(state.status, 'SUBMITTING');

  state = registrationReducer(state, {
    type: 'REGISTRATION_ACCEPTED',
    pendingVerificationId: 'pending-1',
    maskedTarget: 'a***@example.com',
    now: 1_000,
  });
  assert.equal(state.status, 'VERIFY');
  assert.equal(state.draft.organizationName, 'Xưởng Nhôm An');
  assert.equal(state.pendingVerificationId, 'pending-1');
  assert.equal(state.resendAvailableAt, 61_000);
});

test('enforces resend cooldown and restarts it after a successful resend', () => {
  let state = registrationReducer(createRegistrationState(), {
    type: 'REGISTRATION_ACCEPTED',
    pendingVerificationId: 'pending-1',
    maskedTarget: '***5678',
    now: 5_000,
  });
  assert.equal(state.resendAvailableAt, 65_000);

  state = registrationReducer(state, { type: 'RESEND_STARTED', now: 64_999 });
  assert.equal(state.status, 'VERIFY');
  state = registrationReducer(state, { type: 'RESEND_STARTED', now: 65_000 });
  assert.equal(state.status, 'SUBMITTING');
  state = registrationReducer(state, { type: 'RESEND_SUCCEEDED', now: 70_000 });
  assert.equal(state.status, 'VERIFY');
  assert.equal(state.resendAvailableAt, 130_000);
});

test('recoverable errors preserve form and verification input', () => {
  let state = registrationReducer(createRegistrationState(), {
    type: 'UPDATE_DRAFT',
    value: completeDraft,
  });
  state = registrationReducer(state, { type: 'SET_CODE', code: '123456' });
  state = registrationReducer(state, { type: 'SUBMIT_REGISTRATION' });
  state = registrationReducer(state, { type: 'FAILED', message: 'Mạng không ổn định.', recoverTo: 'FORM' });
  assert.equal(state.status, 'ERROR');
  assert.equal(state.draft.email, 'an@example.com');
  assert.equal(state.code, '123456');
  state = registrationReducer(state, { type: 'RECOVER' });
  assert.equal(state.status, 'FORM');
  assert.equal(state.draft.email, 'an@example.com');
});
