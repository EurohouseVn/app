import { Global, Module } from '@nestjs/common';
import { EurohouseAccessService } from './eurohouse-access.service';

@Global()
@Module({
  providers: [EurohouseAccessService],
  exports: [EurohouseAccessService],
})
export class EurohouseAccessModule {}
