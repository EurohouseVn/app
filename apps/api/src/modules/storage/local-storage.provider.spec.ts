import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageProvider } from './local-storage.provider';

test('local storage provider persists and reads object content', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eurohouse-storage-'));
  const previous = process.env.STORAGE_LOCAL_ROOT;
  process.env.STORAGE_LOCAL_ROOT = root;
  try {
    const provider = new LocalStorageProvider();
    const body = Buffer.from('workshop-os-storage');
    const saved = await provider.put({ objectKey: 'tenant/test/object.txt', body, mime: 'text/plain', sha256: 'test' });
    assert.equal(saved.publicUrl, '/static/uploads/tenant/test/object.txt');
    assert.deepEqual(await provider.get(saved.objectKey), body);
    await provider.delete(saved.objectKey);
    await assert.rejects(provider.get(saved.objectKey));
  } finally {
    if (previous === undefined) delete process.env.STORAGE_LOCAL_ROOT; else process.env.STORAGE_LOCAL_ROOT = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});
