import type { RegisterWorkshopInput } from '@eurohouse/types';

export type RegistrationStatus = 'FORM' | 'VERIFY' | 'SUBMITTING' | 'ERROR';

export type RegistrationDraft = RegisterWorkshopInput & {
  displayName: string;
  organizationName: string;
  email: string;
  phone: string;
  password: string;
};

export interface RegistrationState {
  status: RegistrationStatus;
  draft: RegistrationDraft;
  code: string;
  pendingVerificationId?: string;
  maskedTarget?: string;
  resendAvailableAt: number;
  error?: string;
  recoverTo: 'FORM' | 'VERIFY';
}

export type RegistrationAction =
  | { type: 'UPDATE_DRAFT'; value: RegistrationDraft }
  | { type: 'SET_CODE'; code: string }
  | { type: 'SUBMIT_REGISTRATION' }
  | { type: 'REGISTRATION_ACCEPTED'; pendingVerificationId: string; maskedTarget: string; now: number }
  | { type: 'CONFIRM_STARTED' }
  | { type: 'RESEND_STARTED'; now: number }
  | { type: 'RESEND_SUCCEEDED'; now: number }
  | { type: 'FAILED'; message: string; recoverTo: 'FORM' | 'VERIFY' }
  | { type: 'RECOVER' }
  | { type: 'BACK_TO_FORM' };

const EMPTY_DRAFT: RegistrationDraft = {
  displayName: '',
  organizationName: '',
  email: '',
  phone: '',
  password: '',
};

export function createRegistrationState(): RegistrationState {
  return {
    status: 'FORM',
    draft: { ...EMPTY_DRAFT },
    code: '',
    resendAvailableAt: 0,
    recoverTo: 'FORM',
  };
}

export function validateRegistrationDraft(draft: RegistrationDraft): string | null {
  if (!draft.displayName.trim()) return 'Vui lòng nhập họ tên.';
  if (!draft.organizationName.trim()) return 'Vui lòng nhập tên cơ sở.';
  const email = draft.email.trim();
  if (!email) return 'Vui lòng nhập email để nhận mã xác minh.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email chưa đúng định dạng.';
  if (draft.password.length < 6) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  return null;
}

export function registrationReducer(state: RegistrationState, action: RegistrationAction): RegistrationState {
  switch (action.type) {
    case 'UPDATE_DRAFT':
      return { ...state, draft: action.value };
    case 'SET_CODE':
      return { ...state, code: action.code.replace(/\D/g, '').slice(0, 6) };
    case 'SUBMIT_REGISTRATION':
    case 'CONFIRM_STARTED':
      return { ...state, status: 'SUBMITTING', error: undefined };
    case 'REGISTRATION_ACCEPTED':
      return {
        ...state,
        status: 'VERIFY',
        pendingVerificationId: action.pendingVerificationId,
        maskedTarget: action.maskedTarget,
        resendAvailableAt: action.now + 60_000,
        recoverTo: 'VERIFY',
        error: undefined,
      };
    case 'RESEND_STARTED':
      return action.now < state.resendAvailableAt
        ? state
        : { ...state, status: 'SUBMITTING', error: undefined };
    case 'RESEND_SUCCEEDED':
      return { ...state, status: 'VERIFY', resendAvailableAt: action.now + 60_000, error: undefined };
    case 'FAILED':
      return { ...state, status: 'ERROR', error: action.message, recoverTo: action.recoverTo };
    case 'RECOVER':
      return { ...state, status: state.recoverTo, error: undefined };
    case 'BACK_TO_FORM':
      return { ...state, status: 'FORM', error: undefined };
  }
}
