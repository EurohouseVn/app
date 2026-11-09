import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateGuestQuote, listGuestQuotes, saveGuestQuote } from './localGuestQuotes.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
}

test('guest manual quotes calculate and persist locally by installation identity', async () => {
  const storage = memoryStorage();
  const calculation = calculateGuestQuote([{ description: 'Cửa đi', quantity: 2, unitPrice: 3_500_000 }]);
  assert.equal(calculation.total, 7_000_000);
  await saveGuestQuote(storage, 'install-a', { customerName: 'Khách A', items: calculation.items, total: calculation.total }, () => 'quote-1');
  assert.equal((await listGuestQuotes(storage, 'install-a'))[0].id, 'quote-1');
  assert.deepEqual(await listGuestQuotes(storage, 'install-b'), []);
});
