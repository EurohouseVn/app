import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { galleryCategories, galleryPhotos } from './project-gallery';

test('every gallery photo exists, has a unique id and a known category', () => {
  const ids = new Set<string>();
  const known = new Set(galleryCategories.map((c) => c.id));
  for (const photo of galleryPhotos) {
    assert.equal(ids.has(photo.id), false, `duplicate id ${photo.id}`);
    ids.add(photo.id);
    assert.equal(known.has(photo.category), true, `unknown category ${photo.category}`);
    assert.equal(existsSync(fileURLToPath(new URL(`../public${photo.src}`, import.meta.url))), true, `missing ${photo.src}`);
    assert.ok(photo.title.length > 8 && photo.width > 0 && photo.height > 0);
  }
});

test('every category except "all" has at least three photos', () => {
  for (const cat of galleryCategories.filter((c) => c.id !== 'all')) {
    assert.ok(galleryPhotos.filter((p) => p.category === cat.id).length >= 3, cat.id);
  }
});
