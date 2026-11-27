import { Module } from '@nestjs/common';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { NppTaxInvoiceController, TaxInvoiceController } from './tax-invoice.controller';
import { TaxInvoiceService } from './tax-invoice.service';

@Module({
  controllers: [TaxInvoiceController, NppTaxInvoiceController],
  providers: [TaxInvoiceService, InvoiceDocumentsService],
})
export class TaxInvoiceModule {}
