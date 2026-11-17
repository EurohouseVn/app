import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCuttingFormulaSystems, isCuttingFormulaSystemVisible } from './formulaSystemVisibility.js';

test('cutting formulas hide Preco by system code or display name', () => {
  assert.equal(isCuttingFormulaSystemVisible({ code: 'EU-PRECO', name: 'Dòng khác' }), false);
  assert.equal(isCuttingFormulaSystemVisible({ code: 'legacy', name: 'Hệ Preco' }), false);
  assert.equal(isCuttingFormulaSystemVisible({ code: 'EU-TQ', name: 'Hệ trượt quay' }), true);
});

test('cutting formula system filtering preserves every non-Preco system', () => {
  const systems = [
    { id: '55', code: 'EU-55', name: 'Hệ 55 Vát Cạnh' },
    { id: 'preco', code: 'EU-PRECO', name: 'Hệ Preco' },
    { id: 'tq', code: 'EU-TQ', name: 'Hệ trượt quay' },
  ];

  assert.deepEqual(filterCuttingFormulaSystems(systems), [systems[0], systems[2]]);
});
