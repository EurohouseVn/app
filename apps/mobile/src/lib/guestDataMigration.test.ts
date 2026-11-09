import assert from 'node:assert/strict';
import test from 'node:test';
import {
  guestScopeForInstallation,
  importGuestStoragePayload,
  migrateGuestData,
  readGuestStoragePayload,
} from './guestDataMigration.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  };
}

test('guest projects, quotes and attendance import once across logout and login', async () => {
  const storage = memoryStorage();
  const payload = { projects: [{ id: 'p1' }], quotes: [{ id: 'q1' }], attendance: [{ id: 'a1' }] };
  const imports: string[] = [];
  const input = {
    installationId: 'install-1', targetUserId: 'user-1', payload, storage,
    importData: async (_payload: typeof payload, idempotencyKey: string) => { imports.push(idempotencyKey); },
  };
  const first = await migrateGuestData(input);
  const second = await migrateGuestData(input);
  assert.equal(first.imported, true);
  assert.equal(second.imported, false);
  assert.equal(imports.length, 1);
});

test('interrupted migration retries with the same idempotency key and never marks incomplete data done', async () => {
  const storage = memoryStorage();
  const keys: string[] = [];
  let fail = true;
  const input = {
    installationId: 'install-2', targetUserId: 'user-2',
    payload: { projects: [{ id: 'p2' }], quotes: [], attendance: [] }, storage,
    importData: async (_payload: unknown, idempotencyKey: string) => {
      keys.push(idempotencyKey);
      if (fail) throw new Error('network interrupted');
    },
  };
  await assert.rejects(() => migrateGuestData(input), /network interrupted/);
  fail = false;
  assert.equal((await migrateGuestData(input)).imported, true);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test('guest storage copy retains its source and merges into the user namespace', async () => {
  const storage = memoryStorage();
  const installationId = 'install-stable';
  const sourceScope = guestScopeForInstallation(installationId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseKey = '@eurohouse_project_replica_v2';
  const sourceKey = `${baseKey}:${sourceScope}`;
  await storage.setItem(sourceKey, JSON.stringify([{ id: 'guest-project' }]));
  await storage.setItem(`${baseKey}:user-1`, JSON.stringify([{ id: 'server-project' }]));

  const payload = await readGuestStoragePayload(storage, installationId);
  await importGuestStoragePayload(storage, 'user-1', payload);

  assert.deepEqual(JSON.parse((await storage.getItem(sourceKey))!), [{ id: 'guest-project' }]);
  assert.deepEqual(JSON.parse((await storage.getItem(`${baseKey}:user-1`))!), [
    { id: 'server-project' },
    { id: 'guest-project' },
  ]);
});
