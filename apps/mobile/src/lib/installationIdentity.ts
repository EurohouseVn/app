export const INSTALLATION_ID_KEY = '@eurohouse_installation_id_v1';

export type InstallationStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function createInstallationId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return randomUuid ? `install-${randomUuid}` : `install-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

async function defaultStorage(): Promise<InstallationStorage> {
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
}

export async function getInstallationIdentity(
  storage?: InstallationStorage,
  createId: () => string = createInstallationId,
): Promise<string> {
  const target = storage ?? await defaultStorage();
  const existing = await target.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const generated = createId();
  await target.setItem(INSTALLATION_ID_KEY, generated);
  return generated;
}
