import test from 'node:test';
import assert from 'node:assert/strict';
import type { ScanGlassStockInput } from '@eurohouse/types';
import { SCAN_QUEUE_MAX, ScanQueue } from './scanQueue';

const memory = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('eurohouse-npp-scan-queue', initial);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
const scan = (key: string, over: Partial<ScanGlassStockInput> = {}): ScanGlassStockInput => ({ mode: 'RECEIVE', barcode: 'CL8-0600-0900', quantity: 1, idempotencyKey: key, ...over });

test('scans are kept in the order they were queued and survive a reload', () => {
  const store = memory();
  const queue = new ScanQueue(store);
  queue.add(scan('a'));
  queue.add(scan('b'));
  assert.deepEqual(new ScanQueue(store).list().map((q) => q.id), ['a', 'b']);
  assert.equal(new ScanQueue(store).size, 2);
});

test('the same idempotency key is queued only once', () => {
  const queue = new ScanQueue(memory());
  queue.add(scan('a'));
  queue.add(scan('a', { quantity: 5 }));
  assert.equal(queue.size, 1);
  assert.equal(queue.list()[0].input.quantity, 1);
});

test('removing a scan leaves the others', () => {
  const queue = new ScanQueue(memory());
  queue.add(scan('a'));
  queue.add(scan('b'));
  queue.remove('a');
  assert.deepEqual(queue.list().map((q) => q.id), ['b']);
  queue.remove('missing');
  assert.equal(queue.size, 1);
});

test('corrupted or foreign storage content is ignored instead of crashing', () => {
  assert.deepEqual(new ScanQueue(memory('not json')).list(), []);
  assert.deepEqual(new ScanQueue(memory('{"a":1}')).list(), []);
  assert.deepEqual(new ScanQueue(memory('[1,null,{"id":"x"},{"id":"ok","input":{"mode":"ISSUE"}}]')).list().map((q) => q.id), ['ok']);
});

test('the queue is capped, dropping the oldest scans', () => {
  const queue = new ScanQueue(memory());
  for (let i = 0; i < SCAN_QUEUE_MAX + 20; i++) queue.add(scan(`k${i}`));
  const ids = queue.list().map((q) => q.id);
  assert.equal(ids.length, SCAN_QUEUE_MAX);
  assert.equal(ids[0], 'k20');
  assert.equal(ids[ids.length - 1], `k${SCAN_QUEUE_MAX + 19}`);
});
