import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const revealSource = readFileSync(fileURLToPath(new URL('../components/Reveal.tsx', import.meta.url)), 'utf8');

test('homepage reveal is progressive, one-time and safe when motion is unavailable', () => {
  assert.match(revealSource, /IntersectionObserver/);
  assert.match(revealSource, /prefers-reduced-motion/);
  assert.match(revealSource, /data-reveal-item/);
  assert.match(revealSource, /observer\.unobserve/);
  assert.match(revealSource, /--reveal-delay/);
});

test('reveal controller leaves transition values to CSS', () => {
  assert.equal(revealSource.includes('transition: all'), false);
  assert.equal(revealSource.includes("style.transition"), false);
});
