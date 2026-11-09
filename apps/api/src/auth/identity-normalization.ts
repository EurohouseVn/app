export type NormalizedIdentity = {
  kind: 'EMAIL' | 'PHONE';
  normalized: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIETNAM_MOBILE_PATTERN = /^[35789]\d{8}$/;

function invalidIdentifier(): never {
  throw new Error('INVALID_IDENTIFIER');
}

export function normalizeIdentity(value: string): NormalizedIdentity {
  const trimmed = value.trim();
  if (!trimmed) invalidIdentifier();

  if (trimmed.includes('@')) {
    const normalized = trimmed.toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) invalidIdentifier();
    return { kind: 'EMAIL', normalized };
  }

  const compact = trimmed.replace(/[\s.()-]/g, '');
  let subscriber: string;
  if (compact.startsWith('+84')) subscriber = compact.slice(3);
  else if (compact.startsWith('84')) subscriber = compact.slice(2);
  else if (compact.startsWith('0')) subscriber = compact.slice(1);
  else invalidIdentifier();

  if (!VIETNAM_MOBILE_PATTERN.test(subscriber!)) invalidIdentifier();
  return { kind: 'PHONE', normalized: `+84${subscriber!}` };
}

export function normalizeOptionalIdentities(email?: string, phone?: string): {
  emailNormalized?: string;
  phoneNormalized?: string;
} {
  const result: { emailNormalized?: string; phoneNormalized?: string } = {};

  if (email?.trim()) {
    const identity = normalizeIdentity(email);
    if (identity.kind !== 'EMAIL') invalidIdentifier();
    result.emailNormalized = identity.normalized;
  }
  if (phone?.trim()) {
    const identity = normalizeIdentity(phone);
    if (identity.kind !== 'PHONE') invalidIdentifier();
    result.phoneNormalized = identity.normalized;
  }
  if (!result.emailNormalized && !result.phoneNormalized) {
    throw new Error('IDENTIFIER_REQUIRED');
  }
  return result;
}
