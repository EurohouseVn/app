import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { StorageProvider, StoragePutInput } from './storage-provider';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root = path.resolve(process.env.STORAGE_LOCAL_ROOT ?? path.join(process.cwd(), 'public', 'uploads'));

  async put(input: StoragePutInput) {
    const filePath = this.safePath(input.objectKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.body);
    return { provider: this.name, objectKey: input.objectKey, publicUrl: `/static/uploads/${input.objectKey.replace(/\\/g, '/')}` };
  }

  async get(objectKey: string) { return fs.readFile(this.safePath(objectKey)); }
  async delete(objectKey: string) { await fs.rm(this.safePath(objectKey), { force: true }); }

  private safePath(objectKey: string) {
    const resolved = path.resolve(this.root, objectKey);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) throw new Error('Invalid storage object key.');
    return resolved;
  }
}
