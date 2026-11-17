import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = fileURLToPath(new URL('.', import.meta.url));
const appFile = (path: string) => readFileSync(resolve(testDirectory, '../../app', path), 'utf8');

test('authenticated home preserves the approved legacy Eurohouse interface', () => {
  const home = appFile('index.tsx');
  assert.match(home, /header-house\.jpg/);
  assert.match(home, /assets\/logo\.png/);
  assert.match(home, /Tổng quan vận hành/);
  assert.doesNotMatch(home, /function GuestHome/);
  assert.doesNotMatch(home, /header-workshop-focus-v2\.jpg|logo-mark\.png/);
});

test('login keeps the compact legacy screen instead of introducing a replacement landing page', () => {
  const auth = appFile('auth.tsx');
  assert.match(auth, /Đăng nhập bằng email hoặc số điện thoại đã đăng ký/);
  assert.match(auth, /style=\{styles\.segment\}/);
  assert.doesNotMatch(auth, /guestDivider|guestUpgrade|Dùng ngay/);
});

test('permission work does not replace the existing active feature screens', () => {
  assert.match(appFile('formulas.tsx'), /function ActiveFormulasScreen/);
  assert.match(appFile('orders.tsx'), /function ActiveOrderingScreen/);
  assert.match(appFile('profile.tsx'), /Khu làm việc/);
  assert.match(appFile('profile.tsx'), /EurohouseAccessCard/);
});

test('secondary routes never leak into the approved five-item tab bar', () => {
  const layout = appFile('_layout.tsx');
  for (const route of ['catalog', 'weather', 'contract']) {
    assert.match(layout, new RegExp(`Tabs\\.Screen name=["']${route}["'][\\s\\S]*?href: null`));
  }
});
