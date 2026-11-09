import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = fileURLToPath(new URL('.', import.meta.url));

const contentScreens = [
  'contract.tsx',
  'estimate.tsx',
  'knowledge.tsx',
  'loyalty.tsx',
  'orders.tsx',
  'profile.tsx',
  'promo.tsx',
  'quote.tsx',
  'reminders.tsx',
  'project/[id].tsx',
];

test('content cards and actions do not use black backgrounds', () => {
  for (const file of contentScreens) {
    const source = readFileSync(resolve(testDirectory, '../../app', file), 'utf8');
    assert.doesNotMatch(
      source,
      /backgroundColor:\s*(?:colors\.brandBlack\.main(?:\s*\|\|\s*'#[^']+')?|['"]#(?:0f172a|1e293b|172033|334155)['"])/i,
      `${file} still contains a black content background`,
    );
  }
});

test('knowledge categories use a wrapped grid instead of an overflowing horizontal strip', () => {
  const source = readFileSync(resolve(testDirectory, '../../app/knowledge.tsx'), 'utf8');
  assert.doesNotMatch(source, /<ScrollView\s+horizontal[^>]*>\s*\{categories\.map/s);
  assert.match(source, /style=\{styles\.categoryGrid\}/);
});

test('guest home follows approved layout A and onboarding offers immediate use', () => {
  const home = readFileSync(resolve(testDirectory, '../../app/index.tsx'), 'utf8');
  const free = home.indexOf('Dùng miễn phí');
  const discovery = home.indexOf('Khám phá Eurohouse');
  const upgrade = home.indexOf('Mở thêm tính năng quản lý');
  assert.ok(free >= 0 && discovery > free && upgrade > discovery, 'approved Home A section order is missing');

  const auth = readFileSync(resolve(testDirectory, '../../app/auth.tsx'), 'utf8');
  assert.match(auth, /Dùng ngay/);
  assert.match(auth, /continueAsGuest/);
});

test('guest local tool branches do not call protected mutations', () => {
  const attendance = readFileSync(resolve(testDirectory, '../../app/workforce.tsx'), 'utf8');
  const quote = readFileSync(resolve(testDirectory, '../../app/quote.tsx'), 'utf8');
  assert.match(attendance, /GuestAttendanceScreen/);
  assert.match(attendance, /sessionTier\s*===\s*'GUEST'/);
  assert.match(quote, /GuestQuoteScreen/);
  assert.match(quote, /sessionTier\s*===\s*'GUEST'/);
});
