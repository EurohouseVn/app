import assert from 'node:assert/strict';
import test from 'node:test';
import { getInstallationIdentity } from './installationIdentity.ts';

test('installation identity is generated once and persists locally', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  };
  let generated = 0;
  const createId = () => `install-${++generated}`;
  assert.equal(await getInstallationIdentity(storage, createId), 'install-1');
  assert.equal(await getInstallationIdentity(storage, createId), 'install-1');
  assert.equal(generated, 1);
});
