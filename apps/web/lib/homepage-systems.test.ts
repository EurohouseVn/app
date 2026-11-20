import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { homeIndustrialServices, homeMainSystems, homeProcessSteps, homeSpecialistSystems } from './homepage-systems';

type CatalogProfile = { systemCode: string; code: string; name: string; thicknessMm: string | null; kgPerMeter: number | null };

const snapshotUrl = new URL('../../api/prisma/catalog-r19-snapshot.json', import.meta.url);
const catalog = JSON.parse(readFileSync(fileURLToPath(snapshotUrl), 'utf8')) as { profiles: CatalogProfile[] };

function publicFileExists(path: string) {
  return existsSync(fileURLToPath(new URL(`../public${path}`, import.meta.url)));
}

function thicknessValues(systemCode: string) {
  return catalog.profiles
    .filter((profile) => profile.systemCode === systemCode && profile.thicknessMm)
    .flatMap((profile) => String(profile.thicknessMm).split('-').map(Number))
    .filter((value) => Number.isFinite(value));
}

const allSystems = [...homeMainSystems, ...homeSpecialistSystems];

test('homepage lists the four main residential lines and six specialist systems', () => {
  assert.deepEqual(homeMainSystems.map((system) => system.slug), ['ecento-70', 'ecento-plus', 'he-55-vat-canh', 'preco']);
  assert.equal(homeSpecialistSystems.length, 6);
});

test('every featured profile matches the r19 catalog code, name, thickness and weight', () => {
  for (const system of allSystems) {
    const profile = catalog.profiles.find((entry) => entry.code === system.profile.code);
    assert.ok(profile, `${system.slug}: ${system.profile.code} missing from catalog`);
    assert.equal(profile.systemCode, system.code, `${system.slug}: profile belongs to ${profile.systemCode}`);
    assert.equal(profile.name, system.profile.name, `${system.slug}: profile name`);
    assert.equal(profile.thicknessMm, system.profile.thicknessMm, `${system.slug}: thickness`);
    assert.equal(profile.kgPerMeter, system.profile.kgPerMeter, `${system.slug}: kg/m`);
  }
});

test('catalog counts and thickness ranges are computed from the r19 snapshot', () => {
  for (const system of allSystems) {
    const count = catalog.profiles.filter((profile) => profile.systemCode === system.code).length;
    assert.equal(system.catalog.profileCount, count, `${system.slug}: profile count`);
  }
  for (const system of homeMainSystems) {
    const values = thicknessValues(system.code);
    assert.equal(system.catalog.thicknessMin, Math.min(...values), `${system.slug}: min thickness`);
    assert.equal(system.catalog.thicknessMax, Math.max(...values), `${system.slug}: max thickness`);
  }
});

test('every image used on the homepage exists in public/', () => {
  const images = [
    ...homeMainSystems.flatMap((system) => [system.image, system.profile.image]),
    ...homeSpecialistSystems.map((system) => system.profile.image),
    ...homeProcessSteps.map((step) => step.image),
  ];
  for (const image of images) assert.equal(publicFileExists(image), true, `missing ${image}`);
  for (const image of images) assert.doesNotMatch(image, /\/images\/v5\/product-/, `${image}: v5 product renders redraw the profile, use real v4 photos`);
});

test('main systems carry enough reading material for an informed choice', () => {
  for (const system of homeMainSystems) {
    assert.ok(system.description.length > 80, `${system.slug}: description too short`);
    assert.ok(system.suitableFor.length >= 3, `${system.slug}: suitableFor`);
    assert.ok(system.benefits.length >= 3, `${system.slug}: benefits`);
    assert.ok(system.features.length >= 4, `${system.slug}: features`);
    assert.ok(system.colors.length >= 2, `${system.slug}: colors`);
    assert.match(system.href, /^\/nhom-dan-dung\/dong-san-pham\//);
  }
  for (const system of homeSpecialistSystems) {
    assert.ok(system.features.length >= 3, `${system.slug}: features`);
    assert.match(system.href, /^\/nhom-dan-dung\/he-chuyen-dung\//);
  }
});

test('industrial services keep the five approved routes', () => {
  assert.deepEqual(homeIndustrialServices.map((service) => service.href), [
    '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve',
    '/nhom-cong-nghiep/chi-tiet-may',
    '/nhom-cong-nghiep/nang-luong-mat-troi',
    '/nhom-cong-nghiep/dun-thue',
    '/nhom-cong-nghiep/gia-cong',
  ]);
  for (const service of homeIndustrialServices) assert.ok(service.text.length > 30, `${service.href}: text`);
});
