export type StoragePutInput = {
  objectKey: string;
  body: Buffer;
  mime: string;
  sha256: string;
  metadata?: Record<string, string>;
};

export type StoragePutResult = { provider: string; objectKey: string; publicUrl?: string };

export interface StorageProvider {
  readonly name: string;
  put(input: StoragePutInput): Promise<StoragePutResult>;
  get(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
