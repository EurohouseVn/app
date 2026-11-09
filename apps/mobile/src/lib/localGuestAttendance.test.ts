import assert from 'node:assert/strict';
import test from 'node:test';
import { listGuestAttendance, recordGuestAttendance } from './localGuestAttendance.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
}

test('guest attendance persists by installation and never shares records across devices', async () => {
  const storage = memoryStorage();
  await recordGuestAttendance(storage, 'install-a', '2026-11-09', 'CHECK_IN', new Date('2026-11-09T01:00:00Z'));
  await recordGuestAttendance(storage, 'install-a', '2026-11-09', 'CHECK_OUT', new Date('2026-11-09T09:00:00Z'));
  const records = await listGuestAttendance(storage, 'install-a');
  assert.equal(records.length, 1);
  assert.equal(records[0].checkIn, '2026-11-09T01:00:00.000Z');
  assert.equal(records[0].checkOut, '2026-11-09T09:00:00.000Z');
  assert.deepEqual(await listGuestAttendance(storage, 'install-b'), []);
});
