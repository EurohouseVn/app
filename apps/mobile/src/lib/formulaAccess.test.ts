import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canCallFormulaApi, formulaUiState } from './formulaAccess.ts';

const capability = (status: 'LOCKED' | 'ACTIVE' | 'REVOKED') => ({
  status,
  enabled: status === 'ACTIVE',
  message: status === 'LOCKED' ? 'Module đang xây dựng' : status,
});

test('only ACTIVE grants may call formula APIs', () => {
  assert.equal(canCallFormulaApi(capability('LOCKED')), false);
  assert.equal(canCallFormulaApi(capability('REVOKED')), false);
  assert.equal(canCallFormulaApi(capability('ACTIVE')), true);
});

test('manual quotation and ordering stay available while formulas are locked', () => {
  const state = formulaUiState(capability('LOCKED'));
  assert.equal(state.showLockedScreen, true);
  assert.equal(state.message, 'Module đang xây dựng');
  assert.equal(state.manualQuotationEnabled, true);
  assert.equal(state.manualOrderEnabled, true);
});

test('every mobile formula endpoint call is guarded by the shared helper', () => {
  for (const file of ['formulas.tsx', 'quote.tsx', 'orders.tsx']) {
    const source = readFileSync(resolve(process.cwd(), 'app', file), 'utf8');
    const endpointLines = source.split(/\r?\n/).filter((line) =>
      /system-formulas|\/formulas\/templates|optimize-cut/.test(line) && /(api\.|fetch\()/.test(line),
    );
    assert.ok(endpointLines.length > 0, `${file} must contain the expected formula call sites`);
    for (const line of endpointLines) {
      assert.match(line, /guardFormulaCall\(/, `${file} has an unguarded formula call: ${line.trim()}`);
    }
  }
});
