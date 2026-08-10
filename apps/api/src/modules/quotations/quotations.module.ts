import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { QuotationsController } from './quotations.controller';
import { SystemFormulasController } from './system-formulas.controller';
import { QuotationsService } from './quotations.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { CuttingOptimizerService } from './cutting-optimizer.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({ dest: './uploads' })],
  controllers: [QuotationsController, SystemFormulasController],
  providers: [QuotationsService, QuotationPdfService, FormulaEvaluatorService, CuttingOptimizerService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
