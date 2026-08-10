import { Module } from '@nestjs/common';
import { AdminIamController } from './admin-iam.controller';
import { AdminIamService } from './admin-iam.service';

@Module({
  controllers: [AdminIamController],
  providers: [AdminIamService]
})
export class AdminIamModule {}
