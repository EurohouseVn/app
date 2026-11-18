import { Module } from '@nestjs/common';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { TaxInvoiceController } from './tax-invoice.controller';
import { TaxInvoiceService } from './tax-invoice.service';

@Module({
  controllers: [TaxInvoiceController],
  providers: [TaxInvoiceService, InvoiceDocumentsService],
})
export class TaxInvoiceModule {}
