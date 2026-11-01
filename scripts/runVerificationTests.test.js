import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { nativeTestOptions } from './runVerificationTests.mjs';
const wrapper = resolve(import.meta.dirname, 'runVerificationTests.mjs');

function compare(cwd, args, extraEnvironment = {}) {
  const env = { ...process.env, ...extraEnvironment };
  delete env.NODE_TEST_CONTEXT; delete env.NODE_TEST_WORKER_ID;
  const run = prefix => {
    const result = spawnSync(process.execPath, [...prefix, ...args], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 20_000 });
    assert.ifError(result.error); assert.equal(result.signal, null);
    return { code: result.status, names: [...result.stdout.matchAll(/^\s*# Subtest: (.+)$/gm)].map(match => match[1]),
      counts: Object.fromEntries([...result.stdout.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)].map(match => [match[1], Number(match[2])])) };
  };
  const cli = run([]), api = run([wrapper]);
  assert.ok(cli.counts.tests > 0); assert.deepEqual(api, cli);
  console.log(JSON.stringify({ comparison: 'Node CLI / native API', ...api }));
  return api;
}

test('native options preserve CLI process isolation and concurrency, and reject unsupported flags', () => {
  const defaults = nativeTestOptions(['--test', '--test-reporter=tap']);
  assert.equal(defaults.isolation, 'process'); assert.equal(defaults.concurrency, true); assert.equal(defaults.files, undefined);
  const explicit = nativeTestOptions(['--import', './preload.mjs', '--test', '--test-reporter=tap', '--test-concurrency=1', 'one.test.mjs']);
  assert.deepEqual(explicit.execArgv, ['--import', './preload.mjs']); assert.equal(explicit.concurrency, 1);
  assert.deepEqual(explicit.files, ['one.test.mjs']);
  assert.throws(() => nativeTestOptions(['--test', '--test-reporter=tap', '--test-only']));
});

test('native API matches CLI default discovery, nested tests, worker isolation and import preloads', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'inscape-native-tests-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'nested'));
  await writeFile(resolve(root, 'package.json'), '{"type":"module"}');
  await writeFile(resolve(root, 'preload.mjs'), 'globalThis.verificationPreload = true;');
  const imports = "import test from 'node:test'; import assert from 'node:assert/strict';";
  await writeFile(resolve(root, 'one.test.mjs'), `${imports} test('first file', async t => {
    assert.equal(globalThis.workerValue,undefined); globalThis.workerValue=1; assert.equal(globalThis.verificationPreload,true);
    await t.test('nested behavior',()=>assert.equal(2,2)); });`);
  await writeFile(resolve(root, 'nested/two.test.js'), `${imports} test('second file',()=>{
    assert.equal(globalThis.workerValue,undefined); globalThis.workerValue=2; assert.equal(globalThis.verificationPreload,true); });`);
  await writeFile(resolve(root, 'ordinary-helper.mjs'), "throw Error('Default discovery included an ordinary script');");
  assert.equal(compare(root, ['--import', './preload.mjs', '--test', '--test-reporter=tap', '--test-concurrency=1']).code, 0);
  await writeFile(resolve(root, 'scenario.test.mjs'), `${imports} const mode=process.env.FIXTURE_MODE;
    test('scenario', {skip:mode==='skip',todo:mode.startsWith('todo'),signal:mode==='cancel'?AbortSignal.abort():undefined},()=>assert.ok(!['fail','todo-fail'].includes(mode)));`);
  for (const mode of ['pass', 'fail', 'skip', 'todo', 'todo-fail', 'cancel']) {
    const result = compare(root, ['--test', '--test-reporter=tap', 'scenario.test.mjs'], { FIXTURE_MODE: mode });
    assert.equal(result.code, ['fail', 'cancel'].includes(mode) ? 1 : 0);
  }
});

test('native API and CLI run the same real catalog and verification-plan tests', () => {
  const root = resolve(import.meta.dirname, '..');
  assert.equal(compare(root, ['--test', '--test-reporter=tap', '--test-concurrency=1',
    'scripts/browserSuiteCatalog.test.js', 'scripts/verificationPlan.test.js']).code, 0);
});
