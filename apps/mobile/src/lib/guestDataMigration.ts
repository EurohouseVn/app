export type MigrationStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type GuestMigrationResult = {
  imported: boolean;
  idempotencyKey: string;
};

export const GUEST_DATA_BASE_KEYS = [
  '@eurohouse_project_replica_v2',
  '@eurohouse_operations_mutation_queue',
  '@eurohouse_guest_quotes_v1',
  '@eurohouse_guest_attendance_v1',
] as const;

export type GuestStoragePayload = Partial<Record<(typeof GUEST_DATA_BASE_KEYS)[number], string>>;

function normalizeScope(scope: string) {
  return scope.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'anonymous';
}

function scopedKey(baseKey: string, scope: string) {
  return `${baseKey}:${normalizeScope(scope)}`;
}

export function guestScopeForInstallation(installationId: string) {
  return `guest:${installationId}`;
}

export async function readGuestStoragePayload(
  storage: MigrationStorage,
  installationId: string,
): Promise<GuestStoragePayload> {
  const scope = guestScopeForInstallation(installationId);
  const payload: GuestStoragePayload = {};
  for (const baseKey of GUEST_DATA_BASE_KEYS) {
    const value = await storage.getItem(scopedKey(baseKey, scope));
    if (value) payload[baseKey] = value;
  }
  return payload;
}

function mergeStoredArrays(current: string | null, incoming: string): string {
  if (!current) return incoming;
  try {
    const existing = JSON.parse(current);
    const added = JSON.parse(incoming);
    if (!Array.isArray(existing) || !Array.isArray(added)) return current;
    const seen = new Set(existing.map((item) => canonical(item)));
    return JSON.stringify([...existing, ...added.filter((item) => !seen.has(canonical(item)))]);
  } catch {
    return current;
  }
}

export async function importGuestStoragePayload(
  storage: MigrationStorage,
  targetUserId: string,
  payload: GuestStoragePayload,
): Promise<void> {
  for (const [baseKey, value] of Object.entries(payload)) {
    if (!value) continue;
    const targetKey = scopedKey(baseKey, targetUserId);
    const merged = mergeStoredArrays(await storage.getItem(targetKey), value);
    await storage.setItem(targetKey, merged);
  }
}

type MigrationInput<T> = {
  installationId: string;
  targetUserId: string;
  payload: T;
  storage: MigrationStorage;
  importData(payload: T, idempotencyKey: string): Promise<void>;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function migrateGuestData<T>(input: MigrationInput<T>): Promise<GuestMigrationResult> {
  const payloadFingerprint = fingerprint(input.payload);
  const idempotencyKey = `guest-upgrade:${input.installationId}:${input.targetUserId}:${payloadFingerprint}`;
  const markerKey = `@eurohouse_guest_migration:${idempotencyKey}`;
  if ((await input.storage.getItem(markerKey)) === 'DONE') return { imported: false, idempotencyKey };

  await input.storage.setItem(markerKey, 'PENDING');
  await input.importData(input.payload, idempotencyKey);
  await input.storage.setItem(markerKey, 'DONE');
  return { imported: true, idempotencyKey };
}
