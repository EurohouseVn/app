import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGuestMode, persistGuestMode, sessionTierFor } from './sessionTier.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

test('guest selection persists and session tier follows authentication and NPP linkage', async () => {
  const storage = memoryStorage();
  assert.equal(await loadGuestMode(storage), false);
  await persistGuestMode(storage, true);
  assert.equal(await loadGuestMode(storage), true);
  assert.equal(sessionTierFor(null, true), 'GUEST');
  assert.equal(sessionTierFor({ id: 'u1', capabilities: {} } as any, false), 'REGISTERED');
  assert.equal(sessionTierFor({ id: 'u1', capabilities: { eurohouse: { nppOrganizationId: 'npp-1' } } } as any, false), 'EUROHOUSE_LINKED');
  await persistGuestMode(storage, false);
  assert.equal(await loadGuestMode(storage), false);
});
