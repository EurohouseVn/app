import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(name) && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

test('site never references the AI-rendered v5 images', () => {
  const files = ['app', 'components', 'lib'].flatMap((d) => walk(path.join(root, d)));
  const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('/images/v5/'));
  assert.deepEqual(offenders.map((f) => path.relative(root, f)), []);
});

test('every local /images path used in source exists in public/', () => {
  const files = ['app', 'components', 'lib'].flatMap((d) => walk(path.join(root, d)));
  const missing: string[] = [];
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/['"`](\/images\/[A-Za-z0-9_\-./]+\.(?:webp|png|jpg|jpeg))['"`]/g)) {
      if (!existsSync(path.join(root, 'public', m[1]))) missing.push(`${path.relative(root, f)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
