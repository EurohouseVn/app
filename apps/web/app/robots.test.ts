import test from 'node:test';
import assert from 'node:assert/strict';
import robots from './robots';

test('robots explicitly permits search and answer engines without changing GPTBot policy', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const agents = rules.map((rule) => rule.userAgent);

  for (const agent of ['*', 'Googlebot', 'Bingbot', 'OAI-SearchBot']) assert.ok(agents.includes(agent));
  assert.equal(agents.includes('GPTBot'), false);
  assert.equal(rules.every((rule) => rule.disallow?.includes('/api/')), true);
  assert.equal(result.sitemap, 'https://nhomeurohouse.com/sitemap.xml');
  assert.equal(result.host, 'https://nhomeurohouse.com');
});
