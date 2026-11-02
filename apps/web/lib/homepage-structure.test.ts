import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function order(input: string, tokens: readonly string[]) {
  let previous = -1;
  for (const token of tokens) {
    const current = input.indexOf(token);
    if (current <= previous) return false;
    previous = current;
  }
  return true;
}

test('homepage renders the approved monumental chapter order', () => {
  const pageSource = source('../app/page.tsx');

  assert.equal(order(pageSource, [
    '<HomeHero',
    '<ProductFamilyChooser',
    '<FeaturedSystems',
    '<CapabilityStrip',
    '<FeaturedProjects',
    '<PrimaryVideo',
    '<ConversionPanel',
  ]), true);
  assert.equal(pageSource.includes('<ResourceHighlights'), false);
});

test('brand frame uses the approved logo and portal hierarchy', () => {
  const heroSource = source('../components/home/HomeHero.tsx');
  const headerSource = source('../components/Header.tsx');
  const footerSource = source('../components/Footer.tsx');

  assert.match(heroSource, /data-home-chapter="hero"/);
  assert.match(headerSource, /brandAssets\.logo/);
  assert.match(headerSource, /Cổng NPP/);
  assert.match(footerSource, /brandAssets\.logo/);
});
