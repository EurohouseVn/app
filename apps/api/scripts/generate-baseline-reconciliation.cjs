const fs = require('fs');
const path = require('path');
const { apiRoot, executeSql, loadLocalEnv, prisma, schemaUrl } = require('./migration-utils.cjs');

loadLocalEnv();
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required.');
const migrations = path.join(apiRoot, 'prisma', 'migrations');
const v2 = path.join(migrations, '20260930090000_phase0_engine_foundation');
const parked = path.join(apiRoot, '..', '..', 'scratch', 'v2_1', 'parked_phase0_engine_foundation');
const target = path.join(migrations, '20260929093000_pre_v2_schema_reconciliation');
const schema = `phase0_reconcile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
if (fs.existsSync(target)) throw new Error(`Target migration already exists: ${target}`);
if (!fs.existsSync(v2)) throw new Error(`V2 migration is missing: ${v2}`);
if (fs.existsSync(parked)) throw new Error(`Parking directory already exists: ${parked}`);

try {
  fs.renameSync(v2, parked);
  executeSql(baseUrl, `CREATE SCHEMA "${schema}";`);
  const url = schemaUrl(baseUrl, schema);
  prisma(['migrate', 'deploy'], { env: { DATABASE_URL: url } });
  const result = prisma([
    'migrate', 'diff',
    '--from-url', url,
    '--to-schema-datamodel', 'prisma/baselines/20260929_pre_v2_1.prisma',
    '--script',
  ], { capture: true, env: { DATABASE_URL: url } });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error('Could not generate baseline reconciliation SQL.');
  }
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'migration.sql'), result.stdout, 'utf8');
  console.log(`Generated ${path.join(target, 'migration.sql')}`);
} finally {
  if (fs.existsSync(parked) && !fs.existsSync(v2)) fs.renameSync(parked, v2);
  try { executeSql(baseUrl, `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`); } catch (error) { console.error(error); }
}
