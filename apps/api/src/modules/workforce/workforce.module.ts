import { Module } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { PayslipPdfService } from './payslip-pdf.service';
import { WorkforceService } from './workforce.service';

@Module({
  controllers: [WorkforceController],
  providers: [WorkforceService, PayslipPdfService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
