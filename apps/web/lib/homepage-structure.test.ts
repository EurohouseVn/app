import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { homepageCopy } from './homepage-presentation';

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

test('product, capability and project chapters expose the approved structure', () => {
  const familySource = source('../components/home/ProductFamilyChooser.tsx');
  const featuredSystemsSource = source('../components/home/FeaturedSystems.tsx');
  const capabilitySource = source('../components/home/CapabilityStrip.tsx');
  const projectsSource = source('../components/home/FeaturedProjects.tsx');
  const homeSources = [familySource, featuredSystemsSource, capabilitySource, projectsSource].join('\n');

  for (const chapter of ['families', 'systems', 'industry', 'proof', 'projects']) {
    assert.match(homeSources, new RegExp(`data-home-chapter=["']${chapter}["']`));
  }
  assert.match(featuredSystemsSource, /homepageCopy\.industrial\.services\.map/);
  assert.equal(homepageCopy.industrial.services.length, 5);
  assert.match(projectsSource, /project-section-heading/);
  assert.match(projectsSource, /project-heading-aside/);
});

test('video and conversion chapters preserve accessible actions', () => {
  const videoSource = source('../components/home/PrimaryVideo.tsx');
  const conversionSource = source('../components/home/ConversionPanel.tsx');

  assert.match(videoSource, /data-home-chapter="video"/);
  assert.match(videoSource, /video-transcript/);
  assert.match(videoSource, /controls/);
  assert.match(conversionSource, /data-home-chapter="conversion"/);
  assert.match(conversionSource, /\/lien-he/);
  assert.match(conversionSource, /\/yeu-cau-bao-gia-cong-nghiep/);
});
