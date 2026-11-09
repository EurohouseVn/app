import { Global, Module } from '@nestjs/common';
import { EurohouseAccessService } from './eurohouse-access.service';
import {
  EurohouseAccessController,
  NppEurohouseAccessController,
} from './eurohouse-access.controller';
import { EurohouseAccessAdminController } from './eurohouse-access-admin.controller';
import { EurohouseFeatureGuard } from './eurohouse-feature.guard';

@Global()
@Module({
  controllers: [
    EurohouseAccessController,
    NppEurohouseAccessController,
    EurohouseAccessAdminController,
  ],
  providers: [EurohouseAccessService, EurohouseFeatureGuard],
  exports: [EurohouseAccessService, EurohouseFeatureGuard],
})
export class EurohouseAccessModule {}
