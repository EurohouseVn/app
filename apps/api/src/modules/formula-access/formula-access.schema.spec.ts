import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeWorkshopIdentities } from '../../../scripts/preflight-workshop-identities';

const apiRoot = resolve(__dirname, '../../..');
const schema = readFileSync(resolve(apiRoot, 'prisma/schema.prisma'), 'utf8');
const migrationPath = resolve(
  apiRoot,
  'prisma/migrations/20261108_public_workshop_formula_access/migration.sql',
);

test('schema models one organization grant and target-bound one-time invitations', () => {
  assert.match(schema, /model VerificationChallenge\s*{/);
  assert.match(schema, /model FormulaAccessGrant\s*{/);
  assert.match(schema, /organizationId\s+String\s+@unique/);
  assert.match(schema, /model FormulaInvite\s*{/);
  assert.match(schema, /codeHash\s+String\s+@unique/);
  assert.match(schema, /targetOrganizationId\s+String/);
  assert.match(
    schema,
    /targetOrganization\s+Organization\s+@relation\("FormulaInviteTarget", fields: \[targetOrganizationId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(schema, /model FormulaAccessAudit\s*{/);
  assert.match(schema, /emailNormalized\s+String\?\s+@unique/);
  assert.match(schema, /phoneNormalized\s+String\?\s+@unique/);
  assert.match(schema, /verifiedAt\s+DateTime\?/);
  assert.match(schema, /verificationChannel\s+VerificationChannel\?/);
});

test('additive migration stores hashes and creates all entitlement audit constraints', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/);
  assert.match(migration, /CREATE TABLE "VerificationChallenge"/);
  assert.match(migration, /CREATE TABLE "FormulaAccessGrant"/);
  assert.match(migration, /CREATE TABLE "FormulaInvite"/);
  assert.match(migration, /CREATE TABLE "FormulaAccessAudit"/);
  assert.match(migration, /CREATE UNIQUE INDEX "FormulaAccessGrant_organizationId_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "FormulaInvite_codeHash_key"/);
});

test('preflight reports normalized duplicates without mutating its input', () => {
  const rows = [
    { id: 'u1', email: 'User@Example.com', phone: '0912 345 678' },
    { id: 'u2', email: ' user@example.com ', phone: '+84912345678' },
    { id: 'u3', email: 'other@example.com', phone: null },
  ];
  const snapshot = structuredClone(rows);

  assert.deepEqual(analyzeWorkshopIdentities(rows), {
    duplicateEmails: ['user@example.com'],
    duplicatePhones: ['+84912345678'],
    safe: false,
  });
  assert.deepEqual(rows, snapshot);
});
