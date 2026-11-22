import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { certificateGroups, certificates } from './certificates';

test('every certificate has a unique id, a known group and an existing image', () => {
  const ids = new Set<string>();
  const groups = new Set(certificateGroups.map((g) => g.id));
  for (const item of certificates) {
    assert.equal(ids.has(item.id), false, `duplicate ${item.id}`);
    ids.add(item.id);
    assert.equal(groups.has(item.group), true, item.group);
    assert.equal(existsSync(fileURLToPath(new URL(`../public${item.image}`, import.meta.url))), true, `missing ${item.image}`);
    assert.ok(item.facts.length >= 2 && item.title.length > 10);
  }
});

test('the dossier covers all 26 certificate pages', () => {
  assert.equal(certificates.length, 26);
  for (const g of certificateGroups) assert.ok(certificates.some((c) => c.group === g.id), g.id);
  assert.equal(certificates.filter((c) => c.group === 'doc-quyen').length, 7);
  assert.equal(certificates.filter((c) => c.group === 'nhan-hieu').length, 5);
});
