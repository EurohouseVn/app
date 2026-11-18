import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { PublicWebsiteController } from './public-website.controller';

@Module({
  controllers: [SalesController, PublicWebsiteController],
  providers: [SalesService],
})
export class SalesModule {}
