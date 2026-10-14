const path = require('path');
const { apiRoot, loadLocalEnv, prisma } = require('./migration-utils.cjs');

loadLocalEnv();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const schemaArg = process.argv.find((arg) => arg.startsWith('--schema='));
const schema = schemaArg ? path.resolve(apiRoot, schemaArg.slice('--schema='.length)) : path.join(apiRoot, 'prisma', 'schema.prisma');
const result = prisma(['migrate', 'diff', '--from-url', databaseUrl, '--to-schema-datamodel', schema, '--exit-code'], { capture: true });
if (result.status === 0) {
  console.log(`Migration parity verified against ${schema}.`);
  process.exit(0);
}
process.stderr.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.status === 2) console.error('Database schema drift detected. No baseline markers were changed.');
process.exit(result.status ?? 1);
