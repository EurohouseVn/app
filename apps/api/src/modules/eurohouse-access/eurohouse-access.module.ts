import { Global, Module } from '@nestjs/common';
import { EurohouseAccessService } from './eurohouse-access.service';
import {
  EurohouseAccessController,
  NppEurohouseAccessController,
} from './eurohouse-access.controller';
import { EurohouseAccessAdminController } from './eurohouse-access-admin.controller';

@Global()
@Module({
  controllers: [
    EurohouseAccessController,
    NppEurohouseAccessController,
    EurohouseAccessAdminController,
  ],
  providers: [EurohouseAccessService],
  exports: [EurohouseAccessService],
})
export class EurohouseAccessModule {}
