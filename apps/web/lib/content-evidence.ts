export type PublishableClaim<T> =
  | { status: 'VERIFIED'; value: T; source: string }
  | { status: 'PENDING' | 'REJECTED'; value: T; source?: string };

export function getVerifiedValue<T>(claim: PublishableClaim<T>): T | undefined {
  return claim.status === 'VERIFIED' ? claim.value : undefined;
}
