import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiRoot = resolve(__dirname, '../../..');
const schema = readFileSync(resolve(apiRoot, 'prisma/schema.prisma'), 'utf8');
const migrationPath = resolve(
  apiRoot,
  'prisma/migrations/20261109_eurohouse_feature_access/migration.sql',
);

test('schema models independent Eurohouse feature grants and feature-selective invites', () => {
  assert.match(schema, /enum EurohouseFeatureKey\s*{\s*FORMULA_CUTTING\s*EUROHOUSE_ORDERING\s*}/);
  assert.match(schema, /enum EurohouseAccessStatus\s*{\s*LOCKED\s*ACTIVE\s*REVOKED\s*}/);
  assert.match(schema, /model EurohouseFeatureGrant\s*{/);
  assert.match(schema, /featureKey\s+EurohouseFeatureKey/);
  assert.match(schema, /@@unique\(\[organizationId, featureKey\]\)/);
  assert.match(
    schema,
    /organization\s+Organization\s+@relation\("EurohouseGrantOrganization", fields: \[organizationId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    schema,
    /nppOrganization\s+Organization\?\s+@relation\("EurohouseGrantNpp", fields: \[nppOrganizationId\], references: \[id\], onDelete: SetNull\)/,
  );
  assert.match(schema, /model EurohouseInvite\s*{/);
  assert.match(schema, /featureKeys\s+EurohouseFeatureKey\[\]/);
  assert.match(schema, /codeHash\s+String\s+@unique/);
  assert.match(
    schema,
    /targetOrganization\s+Organization\s+@relation\("EurohouseInviteTarget", fields: \[targetOrganizationId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(schema, /model EurohouseAccessAudit\s*{/);
  assert.match(schema, /featureKey\s+EurohouseFeatureKey\?/);
});

test('migration is additive and preserves formula access without activating ordering', () => {
  assert.equal(existsSync(migrationPath), true, 'Eurohouse access migration must exist');
  const migration = readFileSync(migrationPath, 'utf8');

  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|ALTER TABLE "Formula/);
  assert.match(migration, /CREATE TABLE "EurohouseFeatureGrant"/);
  assert.match(migration, /CREATE TABLE "EurohouseInvite"/);
  assert.match(migration, /CREATE TABLE "EurohouseAccessAudit"/);
  assert.match(migration, /INSERT INTO "EurohouseFeatureGrant"[\s\S]*?'FORMULA_CUTTING'/);
  assert.match(migration, /INSERT INTO "EurohouseInvite"[\s\S]*?ARRAY\['FORMULA_CUTTING'/);
  assert.match(migration, /INSERT INTO "EurohouseAccessAudit"[\s\S]*?'FORMULA_CUTTING'/);
  assert.match(migration, /ON CONFLICT DO NOTHING/g);
  assert.doesNotMatch(
    migration,
    /INSERT INTO "EurohouseFeatureGrant"[\s\S]*?'EUROHOUSE_ORDERING'/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "EurohouseFeatureGrant_organizationId_featureKey_key"/,
  );
});
