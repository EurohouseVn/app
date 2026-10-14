import { Global, Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { S3CompatibleStorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    LocalStorageProvider,
    S3CompatibleStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [LocalStorageProvider, S3CompatibleStorageProvider],
      useFactory: (local: LocalStorageProvider, s3: S3CompatibleStorageProvider) => process.env.STORAGE_PROVIDER === 's3' ? s3 : local,
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
