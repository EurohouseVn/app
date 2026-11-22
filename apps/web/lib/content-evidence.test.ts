import assert from 'node:assert/strict';
import test from 'node:test';
import { getVerifiedValue, type PublishableClaim } from './content-evidence';
import { industrialServices } from './industrial-content';
import { residentialProducts } from './residential-content';

test('evidence gate returns only verified claims', () => {
  const verified: PublishableClaim<string> = { status: 'VERIFIED', value: 'Hệ đa khoang', source: 'Catalog EUROHOUSE' };
  const pending: PublishableClaim<string> = { status: 'PENDING', value: 'Giá trị đang rà soát' };
  const rejected: PublishableClaim<string> = { status: 'REJECTED', value: 'Giá trị không sử dụng' };

  assert.equal(getVerifiedValue(verified), 'Hệ đa khoang');
  assert.equal(getVerifiedValue(pending), undefined);
  assert.equal(getVerifiedValue(rejected), undefined);
});

test('every industrial service answers what, who, value, preparation and process', () => {
  for (const service of industrialServices) {
    assert.ok(service.definition.length >= 60, `${service.slug} needs a useful definition`);
    assert.ok(service.suitableFor.length >= 2, `${service.slug} needs suitable-for guidance`);
    assert.ok(service.benefits.length >= 3, `${service.slug} needs customer benefits`);
    assert.ok(service.requiredInputs.length >= 3, `${service.slug} needs preparation guidance`);
    assert.ok(service.process.length >= 3, `${service.slug} needs a service process`);
    assert.ok(service.faq.length >= 2, `${service.slug} needs visible FAQ answers`);
    assert.ok(service.relatedLinks.length >= 2, `${service.slug} needs cluster links`);
  }
});

test('the four lead residential systems give selection guidance and verified differences', () => {
  assert.equal(residentialProducts.length, 4);
  for (const product of residentialProducts) {
    assert.ok(product.suitableFor.length >= 2, `${product.slug} needs audience guidance`);
    assert.ok(product.benefits.length >= 3, `${product.slug} needs product benefits`);
    assert.ok(product.selectionNotes.length >= 2, `${product.slug} needs selection notes`);
    assert.ok(product.relatedLinks.length >= 2, `${product.slug} needs catalog and consultation links`);
  }
});
