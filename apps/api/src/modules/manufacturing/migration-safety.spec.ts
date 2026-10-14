import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import * as path from 'path';

test('phase 0 engine migration is additive', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../prisma/migrations/20260930090000_phase0_engine_foundation/migration.sql'), 'utf8');
  for (const destructive of [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i, /ALTER\s+COLUMN/i]) {
    assert.doesNotMatch(sql, destructive);
  }
  assert.match(sql, /CREATE TABLE "DoorDesign"/);
  assert.match(sql, /CREATE TABLE "InventoryCommand"/);
  assert.match(sql, /CREATE TABLE "StorageObject"/);
});

test('phase 1 verified core migration is additive', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../prisma/migrations/20260930103000_phase1_verified_manufacturing_core/migration.sql'), 'utf8');
  for (const destructive of [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i, /ALTER\s+COLUMN/i]) {
    assert.doesNotMatch(sql, destructive);
  }
  assert.match(sql, /CREATE TABLE "TechnicalSource"/);
  assert.match(sql, /CREATE TABLE "GoldenFixture"/);
  assert.match(sql, /CREATE TABLE "CalculationComparison"/);
  assert.match(sql, /CREATE TABLE "TechnicalReviewEvent"/);
});

test('phase 1.1 technical truth migration is additive', () => {
  const enumSql = readFileSync(path.resolve(__dirname, '../../../prisma/migrations/20260930145900_phase1_1_enum_extensions/migration.sql'), 'utf8');
  const sql = readFileSync(path.resolve(__dirname, '../../../prisma/migrations/20260930150000_phase1_1_technical_truth/migration.sql'), 'utf8');
  for (const destructive of [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i, /ALTER\s+COLUMN\s+[^;]+\s+TYPE\s/i]) {
    assert.doesNotMatch(enumSql, destructive);
    assert.doesNotMatch(sql, destructive);
  }
  assert.match(enumSql, /ADD VALUE IF NOT EXISTS 'DRAFT'/);
  assert.match(sql, /CREATE TABLE "ExpectedOutputRevision"/);
  assert.match(sql, /CREATE TABLE "GoldenFixtureRuleUsage"/);
  assert.match(sql, /CREATE TABLE "ManufacturingTechnicalIssue"/);
});
