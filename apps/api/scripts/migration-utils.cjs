const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const apiRoot = path.resolve(__dirname, '..');

function loadLocalEnv() {
  const file = path.join(apiRoot, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function prisma(args, options = {}) {
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [apiRoot] });
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: apiRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : ['pipe', 'inherit', 'inherit'],
  });
  if (options.capture) return result;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
}

function schemaUrl(databaseUrl, schema) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function executeSql(databaseUrl, sql) {
  const prismaCli = require.resolve('prisma/build/index.js', { paths: [apiRoot] });
  const result = spawnSync(process.execPath, [prismaCli, 'db', 'execute', '--url', databaseUrl, '--stdin'], {
    cwd: apiRoot,
    env: process.env,
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) throw result.error ?? new Error('prisma db execute failed.');
}

module.exports = { apiRoot, executeSql, loadLocalEnv, prisma, schemaUrl };
