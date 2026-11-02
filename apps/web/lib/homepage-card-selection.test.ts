import assert from 'node:assert/strict';
import test from 'node:test';

import { homepageFamilyLabel, mergeHomepageProjects, mergeResidentialSystems } from './homepage-card-selection';

const residentialFallbacks = [
  { slug: 'ecento-70', title: 'ECENTO 70', summary: '70', image: '/70.jpg', href: '/ecento-70' },
  { slug: 'ecento-plus', title: 'ECENTO PLUS', summary: 'plus', image: '/plus.jpg', href: '/ecento-plus' },
  { slug: 'he-55', title: 'Hệ 55', summary: '55', image: '/55.jpg', href: '/he-55' },
] as const;

test('residential CMS cards borrow media only from the matching fallback slug', () => {
  const cards = mergeResidentialSystems([
    { id: 'plus', slug: 'ecento-plus', kind: 'PRODUCT', family: 'RESIDENTIAL', title: 'ECENTO PLUS', summary: 'CMS plus' },
    { id: 'custom', slug: 'custom-profile', kind: 'PRODUCT', family: 'RESIDENTIAL', title: 'CUSTOM', summary: 'CMS custom' },
  ], residentialFallbacks);

  assert.deepEqual(cards.map((card) => card.slug), ['ecento-plus', 'custom-profile', 'ecento-70']);
  assert.equal(cards[0]?.image, '/plus.jpg');
  assert.equal(cards[1]?.image, undefined);
  assert.equal(cards.filter((card) => card.slug === 'ecento-plus').length, 1);
});

test('project cards preserve CMS family and never borrow unrelated fallback media', () => {
  const cards = mergeHomepageProjects([
    { id: 'industrial', slug: 'solar-frame', kind: 'CASE_STUDY', family: 'INDUSTRIAL', title: 'Khung pin', summary: 'Dự án công nghiệp' },
  ], [{ slug: 'villa', title: 'Biệt thự', summary: 'Nhà ở', image: '/villa.jpg', href: '/du-an', family: 'RESIDENTIAL' }]);

  assert.equal(cards[0]?.family, 'INDUSTRIAL');
  assert.equal(homepageFamilyLabel(cards[0]?.family), 'NHÔM CÔNG NGHIỆP');
  assert.equal(cards[0]?.image, undefined);
  assert.equal(cards[1]?.image, '/villa.jpg');
});
