import { Global, Module } from '@nestjs/common';
import { FormulaAccessService } from './formula-access.service';
import { FormulaAccessController } from './formula-access.controller';
import { NppFormulaAccessController } from './npp-formula-access.controller';
import { AdminFormulaAccessController } from './admin-formula-access.controller';
import { FormulaAccessGuard } from './formula-access.guard';
import { EurohouseAccessModule } from '../eurohouse-access/eurohouse-access.module';

@Global()
@Module({
  imports: [EurohouseAccessModule],
  controllers: [FormulaAccessController, NppFormulaAccessController, AdminFormulaAccessController],
  providers: [FormulaAccessService, FormulaAccessGuard],
  exports: [FormulaAccessService, FormulaAccessGuard],
})
export class FormulaAccessModule {}
