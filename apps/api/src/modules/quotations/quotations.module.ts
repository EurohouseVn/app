import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { QuotationsController } from './quotations.controller';
import { SystemFormulasController } from './system-formulas.controller';
import { QuotationsService } from './quotations.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { CuttingOptimizerService } from './cutting-optimizer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotationBomService } from './quotation-bom.service';
import { ManagedCuttingPlanService } from './managed-cutting-plan.service';
import { CuttingPlanPdfService } from './cutting-plan-pdf.service';
import { InventoryModule } from '../inventory/inventory.module';
import { QuotationContractPdfService } from './quotation-contract-pdf.service';

@Module({
  imports: [PrismaModule, InventoryModule, MulterModule.register({ dest: './uploads' })],
  controllers: [QuotationsController, SystemFormulasController],
  providers: [QuotationsService, QuotationPdfService, QuotationContractPdfService, FormulaEvaluatorService, CuttingOptimizerService, QuotationBomService, ManagedCuttingPlanService, CuttingPlanPdfService],
  exports: [QuotationsService, QuotationBomService, FormulaEvaluatorService, CuttingOptimizerService],
})
export class QuotationsModule {}
