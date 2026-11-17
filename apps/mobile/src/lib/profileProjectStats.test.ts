import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProfileProjects } from './profileProjectStats.ts';

test('summarizes the same active project data shown by the projects module', () => {
  const result = summarizeProfileProjects([
    { finalAmount: 455_000_000, estimatedAmount: 450_000_000, expectedProfit: 72_000_000 },
    { finalAmount: 0, estimatedAmount: 60_000_000, expectedProfit: 19_500_000 },
  ]);

  assert.deepEqual(result, {
    projectCount: 2,
    totalRevenue: 515_000_000,
    totalProfit: 91_500_000,
    margin: 17.8,
  });
});

test('returns zero metrics after the shared project list becomes empty', () => {
  assert.deepEqual(summarizeProfileProjects([]), {
    projectCount: 0,
    totalRevenue: 0,
    totalProfit: 0,
    margin: 0,
  });
});
