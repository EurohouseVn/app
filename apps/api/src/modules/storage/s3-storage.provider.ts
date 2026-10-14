import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { StorageProvider, StoragePutInput } from './storage-provider';

@Injectable()
export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly bucket = process.env.S3_BUCKET ?? '';
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });

  async put(input: StoragePutInput) {
    const bucket = this.bucket || this.required('S3_BUCKET');
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: input.objectKey, Body: input.body, ContentType: input.mime, Metadata: { ...input.metadata, sha256: input.sha256 } }));
    const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
    return { provider: this.name, objectKey: input.objectKey, publicUrl: base ? `${base}/${input.objectKey}` : undefined };
  }

  async get(objectKey: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket || this.required('S3_BUCKET'), Key: objectKey }));
    if (!result.Body) throw new Error(`Storage object ${objectKey} has no body.`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async delete(objectKey: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket || this.required('S3_BUCKET'), Key: objectKey })); }

  private required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required when STORAGE_PROVIDER=s3.`);
    return value;
  }
}
