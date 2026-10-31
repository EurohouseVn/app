import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const schema = readFileSync(path.resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
const migrationPath = path.resolve(
  __dirname,
  '../../../prisma/migrations/20261031090000_website_content_foundation/migration.sql',
);

function block(kind: 'model' | 'enum', name: string) {
  const match = schema.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `${kind} ${name} must exist`);
  return match[1];
}

test('website taxonomy and workflow enums are bounded to approved values', () => {
  assert.match(block('enum', 'WebsiteProductFamily'), /RESIDENTIAL\s+INDUSTRIAL/s);
  assert.match(block('enum', 'WebsiteChannel'), /PUBLIC\s+NPP\s+ADMIN_ONLY/s);
  assert.match(
    block('enum', 'WebsitePublicationStatus'),
    /DRAFT\s+TECHNICAL_REVIEW\s+MARKETING_REVIEW\s+PUBLISHED\s+ARCHIVED/s,
  );
});

test('website content identity links to operational records without duplicating them', () => {
  const content = block('model', 'WebsiteContent');
  assert.match(content, /slug\s+String/);
  assert.match(content, /locale\s+String\s+@default\("vi"\)/);
  assert.match(content, /aluSystemId\s+String\?/);
  assert.match(content, /operationalProjectId\s+String\?/);
  assert.match(content, /@@unique\(\[locale, slug\]\)/);

  const revision = block('model', 'WebsiteContentRevision');
  assert.match(revision, /websiteContentId\s+String/);
  assert.match(revision, /revision\s+Int/);
  assert.match(revision, /@@unique\(\[websiteContentId, revision\]\)/);
});

test('website governance models cover review SEO assets documents redirects and audit', () => {
  for (const name of [
    'WebsiteContentReview',
    'WebsiteSeoRecord',
    'WebsiteMediaAsset',
    'WebsiteContentMedia',
    'WebsiteTechnicalDocument',
    'WebsiteContentDocument',
    'WebsiteRedirect',
    'WebsitePublicationAudit',
  ]) {
    block('model', name);
  }

  assert.match(block('model', 'WebsiteMediaAsset'), /channels\s+WebsiteChannel\[\]\s+@default\(\[ADMIN_ONLY\]\)/);
  assert.match(block('model', 'WebsiteTechnicalDocument'), /channels\s+WebsiteChannel\[\]\s+@default\(\[ADMIN_ONLY\]\)/);
});

test('website presentation models never contain operational price fields', () => {
  const websiteModels = [...schema.matchAll(/model (Website\w+) \{([\s\S]*?)\n\}/g)];
  assert.ok(websiteModels.length >= 10, 'expected complete website model set');
  for (const [, name, body] of websiteModels) {
    assert.doesNotMatch(body, /pricePerKg/, `${name} must not contain pricePerKg`);
  }
});

test('lead attribution fields are additive and optional-safe', () => {
  const lead = block('model', 'Lead');
  assert.match(lead, /leadType\s+String\s+@default\("GENERAL"\)/);
  assert.match(lead, /sourceUrl\s+String\?/);
  assert.match(lead, /referrer\s+String\?/);
  assert.match(lead, /utm\s+Json\?/);
  assert.match(lead, /consentAt\s+DateTime\?/);
});

test('website foundation migration is additive', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  for (const destructive of [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i, /ALTER\s+COLUMN/i]) {
    assert.doesNotMatch(sql, destructive);
  }
  assert.match(sql, /CREATE TYPE "WebsiteProductFamily"/);
  assert.match(sql, /CREATE TABLE "WebsiteContent"/);
  assert.match(sql, /CREATE TABLE "WebsitePublicationAudit"/);
  assert.match(sql, /ADD COLUMN\s+"leadType" TEXT NOT NULL DEFAULT 'GENERAL'/);
});
