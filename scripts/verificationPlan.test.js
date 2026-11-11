import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { verificationPlan, verificationSteps, parseVerificationArgs, BROWSER_SHARDS, UNIT_TEST_PATTERNS } from './verificationPlan.mjs';
import { readFileSync } from 'node:fs';
import { browserShards, browserSelection, loadBrowserSuiteCatalog, selectBrowserSuites } from './browserSuiteCatalog.mjs';

test('release unit discovery matches npm test source roots instead of discovering audit outputs', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual([...pkg.scripts.test.matchAll(/"([^"]+)"/gu)].map(match => match[1]), UNIT_TEST_PATTERNS);
  assert.deepEqual(verificationSteps.find(step => step.name === 'unit').args.slice(3), UNIT_TEST_PATTERNS);
});

test('local full verification and CI groups share exactly the same mandatory definitions', () => {
  assert.deepEqual(verificationPlan(), verificationSteps);
  const grouped = [...verificationPlan('source'), ...verificationPlan('browser', 1), ...verificationPlan('production')];
  assert.deepEqual(grouped.map(step => step.name), verificationSteps.map(step => step.name));
  for (const scope of ['full', 'source', 'production']) assert.throws(() => verificationPlan(scope, 1));
  for (const args of [['--scope=browser'], ['--scope=source', '--shard=1'], ['--scope=browser', '--shard=0'], ['--skip=unit']]) assert.throws(() => parseVerificationArgs(args));
  assert.deepEqual(parseVerificationArgs(['--scope=browser', '--shard=4']), { scope: 'browser', shard: 4 });
});

test('four deterministic weighted shards cover every current release suite exactly once', async () => {
  const catalog = await loadBrowserSuiteCatalog(resolve(import.meta.dirname, '..')), shards = browserShards(catalog);
  assert.equal(shards.length, BROWSER_SHARDS);
  const suites = shards.flatMap(shard => shard.suites);
  assert.equal(new Set(suites).size, suites.length);
  assert.deepEqual([...suites].sort(), selectBrowserSuites(catalog).sort());
  assert.deepEqual(shards, browserShards({ ...catalog, suites: [...catalog.suites].reverse() }));
  for (const shard of shards) assert.deepEqual(browserSelection(catalog, [`--shard=${shard.index}/${BROWSER_SHARDS}`]).suites, shard.suites);
  for (const args of [['--shard=0/4'], ['--shard=1/3'], ['--shard=1/4', suites[0]], ['--skip=slow']]) assert.throws(() => browserSelection(catalog, args));
  assert.ok(Math.max(...shards.map(shard => shard.estimatedSeconds)) - Math.min(...shards.map(shard => shard.estimatedSeconds)) < 30);
});
