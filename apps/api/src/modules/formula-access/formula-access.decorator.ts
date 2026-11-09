import { RequiresEurohouseFeature } from '../eurohouse-access/eurohouse-feature.decorator';

export const FORMULA_ACCESS_REQUIRED_KEY = 'formulaAccessRequired';

export const RequireFormulaAccess = () => RequiresEurohouseFeature('FORMULA_CUTTING');
