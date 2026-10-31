import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterIndustrialServices,
  normalizeIndustrialQuery,
  serializeIndustrialQuery,
  type IndustrialSearchItem,
} from './industrial-query';

const items: IndustrialSearchItem[] = [
  { slug: 'chi-tiet-may', title: 'Chi tiết máy', summary: 'Profile cho cụm máy và thiết bị.', applications: ['Cơ khí', 'Máy móc'] },
  { slug: 'nang-luong-mat-troi', title: 'Nhôm năng lượng mặt trời', summary: 'Profile cho hệ giá đỡ.', applications: ['Năng lượng'] },
];

test('search matches Vietnamese text with or without diacritics', () => {
  assert.deepEqual(filterIndustrialServices(items, normalizeIndustrialQuery(new URLSearchParams('q=chi+tiet'))).map((item) => item.slug), ['chi-tiet-may']);
  assert.deepEqual(filterIndustrialServices(items, normalizeIndustrialQuery(new URLSearchParams('q=năng+lượng'))).map((item) => item.slug), ['nang-luong-mat-troi']);
});

test('normalizes repeated parameters and rejects invalid service values', () => {
  const query = normalizeIndustrialQuery(new URLSearchParams('service=chi-tiet-may&service=chi-tiet-may&service=khong-hop-le&application=C%C6%A1+kh%C3%AD'));
  assert.deepEqual(query.services, ['chi-tiet-may']);
  assert.deepEqual(query.applications, ['Cơ khí']);
});

test('returns an explicit zero-result collection and serializes stable URL state', () => {
  const query = normalizeIndustrialQuery(new URLSearchParams('q=khong-co&service=chi-tiet-may'));
  assert.deepEqual(filterIndustrialServices(items, query), []);
  assert.equal(serializeIndustrialQuery({ q: '  profile máy  ', services: ['chi-tiet-may'], applications: [] }), 'q=profile+m%C3%A1y&service=chi-tiet-may');
});
