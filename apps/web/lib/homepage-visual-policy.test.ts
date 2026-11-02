import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const stylesheet = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');
const marker = '/* Approved Monumental EUROHOUSE homepage */';
const markerIndex = stylesheet.indexOf(marker);
const nextSectionIndex = stylesheet.indexOf('/* Residential family and governed detail templates */', markerIndex);
const homepageCss = markerIndex >= 0
  ? stylesheet.slice(markerIndex, nextSectionIndex >= 0 ? nextSectionIndex : undefined)
  : '';

test('the approved homepage visual system owns one explicit token set', () => {
  assert.notEqual(markerIndex, -1, 'missing the approved Monumental homepage CSS block');

  for (const token of [
    '--home-radius-sm: 12px',
    '--home-radius-md: 18px',
    '--home-radius-lg: 26px',
    '--home-radius-pill: 999px',
    '--home-reveal-duration: 640ms',
  ]) {
    assert.equal(homepageCss.includes(token), true, `missing visual token: ${token}`);
  }
});

test('the homepage stays restrained, responsive, and motion-accessible', () => {
  assert.equal(homepageCss.includes('linear-gradient'), false, 'decorative gradients are not part of the approved direction');
  assert.equal(homepageCss.includes('transition: all'), false, 'transitions must name the properties they animate');
  assert.match(homepageCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(homepageCss, /@media\s*\(max-width:\s*600px\)/);
  assert.match(homepageCss, /translateY\(24px\)/);
  assert.match(homepageCss, /--home-orange:\s*#bd4704/);
  assert.match(homepageCss, /@media\s+print/);
  assert.match(homepageCss, /@media\s*\(max-width:\s*600px\)[\s\S]*\.home-text-link\s*\{[^}]*min-height:\s*44px/);
});

test('homepage display copy stays inside the shared frame and uses a deliberate project heading grid', () => {
  const heroInnerRule = homepageCss.match(/\.home-hero-inner\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.doesNotMatch(heroInnerRule, /width:\s*100%/, 'hero inner must not override the shared container width');
  assert.match(homepageCss, /\.home-hero-copy\s*\{[^}]*min-width:\s*0/);
  assert.match(homepageCss, /\.project-section-heading\s*\{[^}]*grid-template-columns:/);
  assert.match(homepageCss, /\.project-heading-aside\s*\{[^}]*min-width:\s*0/);
});
