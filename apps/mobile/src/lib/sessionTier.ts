import type { AccessTier, AuthUser } from '@eurohouse/types';

export const GUEST_MODE_KEY = '@eurohouse_guest_mode_v1';

export type LocalKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export async function loadGuestMode(storage: LocalKeyValueStorage): Promise<boolean> {
  return (await storage.getItem(GUEST_MODE_KEY)) === 'true';
}

export async function persistGuestMode(storage: LocalKeyValueStorage, enabled: boolean): Promise<void> {
  if (enabled) await storage.setItem(GUEST_MODE_KEY, 'true');
  else await storage.removeItem(GUEST_MODE_KEY);
}

export function sessionTierFor(user: AuthUser | null | undefined, guestMode: boolean): AccessTier | null {
  if (!user) return guestMode ? 'GUEST' : null;
  return user.capabilities?.eurohouse?.nppOrganizationId ? 'EUROHOUSE_LINKED' : 'REGISTERED';
}
