import assert from 'node:assert/strict';
import test from 'node:test';
import { residentialContentHref, toResidentialCard } from './residential-routes';

test('maps approved residential taxonomy to canonical route prefixes', () => {
  assert.equal(residentialContentHref({ kind: 'PRODUCT', slug: 'ecento-70' }), '/nhom-dan-dung/dong-san-pham/ecento-70');
  assert.equal(residentialContentHref({ kind: 'PRODUCT', slug: 'cua-thuy-luc', specialist: true }), '/nhom-dan-dung/he-chuyen-dung/cua-thuy-luc');
  assert.equal(residentialContentHref({ kind: 'SOLUTION', slug: 'biet-thu-nha-pho' }), '/nhom-dan-dung/giai-phap/biet-thu-nha-pho');
});

test('keeps long Vietnamese names and provides a neutral missing-image state', () => {
  const title = 'Giải pháp nhôm cho trường học, bệnh viện và công trình công cộng';
  const card = toResidentialCard({ slug: 'cong-trinh-cong-cong', title, summary: 'Nội dung đã duyệt.', kind: 'SOLUTION' });
  assert.equal(card.title, title);
  assert.equal(card.image, undefined);
  assert.equal(card.imageAlt, undefined);
});
