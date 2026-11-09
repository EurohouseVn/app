import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FormulaAccessGuard } from './formula-access.guard';

export const FORMULA_ACCESS_REQUIRED_KEY = 'formulaAccessRequired';

export const RequireFormulaAccess = () => applyDecorators(
  SetMetadata(FORMULA_ACCESS_REQUIRED_KEY, true),
  UseGuards(JwtAuthGuard, FormulaAccessGuard),
);

