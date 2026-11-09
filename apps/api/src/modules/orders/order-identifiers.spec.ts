import assert from 'node:assert/strict';
import test from 'node:test';
import {
  businessDateParts,
  formatNppInvoiceNumber,
  formatNppPoNumber,
} from './order-identifiers';

test('formats the approved PO and invoice identifiers', () => {
  const now = new Date('2026-11-07T02:15:00.000Z');
  assert.equal(formatNppPoNumber('NPP-THVA02', now, 1), 'NPP-THVA02-20261107-01');
  assert.equal(formatNppPoNumber('THVA02', now, 12), 'NPP-THVA02-20261107-12');
  assert.equal(formatNppInvoiceNumber('NPP-THVA02', now, 1), 'HD-NPP-THVA02-20261107-01');
});

test('uses the Vietnam business date around UTC midnight', () => {
  assert.deepEqual(businessDateParts(new Date('2026-11-06T17:30:00.000Z')), {
    year: '2026', month: '11', day: '07', compact: '20261107',
  });
});

test('normalizes duplicated NPP prefixes and rejects invalid input', () => {
  const now = new Date('2026-11-07T02:15:00.000Z');
  assert.equal(formatNppPoNumber('npp-npp-thva 02', now, 2), 'NPP-THVA-02-20261107-02');
  assert.throws(() => formatNppPoNumber('', now, 1));
  assert.throws(() => formatNppPoNumber('THVA02', now, 0));
  assert.throws(() => formatNppPoNumber('THVA02', now, 1.5));
});
