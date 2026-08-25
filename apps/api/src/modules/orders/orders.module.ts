import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderPdfService } from './order-pdf.service';
import { CatalogModule } from '../catalog/catalog.module';
import { QuotationsModule } from '../quotations/quotations.module';

@Module({
  imports: [CatalogModule, QuotationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderPdfService],
  exports: [OrdersService],
})
export class OrdersModule {}
