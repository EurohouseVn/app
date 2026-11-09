import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMULA_ACCESS_REQUIRED_KEY } from './formula-access.decorator';
import { SystemFormulasController } from '../quotations/system-formulas.controller';
import { QuotationsController } from '../quotations/quotations.controller';

function guarded(controller: any, method: string) {
  return Reflect.getMetadata(FORMULA_ACCESS_REQUIRED_KEY, controller.prototype[method]) === true
    || Reflect.getMetadata(FORMULA_ACCESS_REQUIRED_KEY, controller) === true;
}

test('every formula discovery, calculation, cutting, PDF and remnant route requires entitlement', () => {
  const systemMethods = [
    'getManagedSystems', 'getManagedTypes', 'getManagedTemplates', 'getManagedTemplate',
    'calculateManagedTemplate', 'calculateCuttingPlan', 'commitCuttingPlanRemnants',
    'exportCuttingPlanPdf', 'getSystems', 'getTemplateSystems', 'getTemplateTypes',
    'getTemplates', 'getSystemFormulas', 'getFormulaDetails', 'calcSystemFormula',
  ];
  const quotationMethods = ['listTemplates', 'getTemplate', 'calcTemplate', 'optimizeCut', 'optimizeQuotation'];
  const missing = [
    ...systemMethods.filter((method) => !guarded(SystemFormulasController, method)).map((method) => `System.${method}`),
    ...quotationMethods.filter((method) => !guarded(QuotationsController, method)).map((method) => `Quotation.${method}`),
  ];
  assert.deepEqual(missing, []);
});

