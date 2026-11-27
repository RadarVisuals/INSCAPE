import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { aggregateVerification } from './aggregateVerification.mjs';
import { fileInventory, passingTap } from './releaseEvidence.mjs';
import { verificationIdentity } from './verificationIdentity.mjs';
import { verificationPlan } from './verificationPlan.mjs';
import { browserSelection } from './browserSuiteCatalog.mjs';
import { assertIdentity } from './verificationEvidence.mjs';

const tap = 'TAP version 13\nok 1 - behavior\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
const success = { code: 0, signal: null, cleanup: { status: 'verified', checkpoints: { start: true, complete: true },
  coverage: 'observed-process-identities', remainingPids: [], errors: [] } };
const jobs = { source: { result: 'success' }, production: { result: 'success' }, browser: { result: 'success' } };
const writeJson = (path, value) => writeFile(path, JSON.stringify(value));
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('Windows evidence requires the same complete process inventory executable identity', () => {
  const identity = { sourceSha256: 'a'.repeat(64), lockfileSha256: 'b'.repeat(64), publicConfigurationSha256: 'c'.repeat(64),
    git: { commit: 'd'.repeat(40), dirty: false }, ci: null,
    runtime: { node: process.version, platform: 'win32', arch: 'x64', osRelease: '10.0', runnerImage: null, runnerImageVersion: null,
      processInventory: { executable: 'C:\\PowerShell\\pwsh.exe', version: '7.6.5', sha256: 'e'.repeat(64) } } };
  assert.doesNotThrow(() => assertIdentity(structuredClone(identity), identity));
  for (const version of ['5.1.26100.7705', '7.6.0-preview.2', '7.6.5+build.1']) {
    const supported = structuredClone(identity); supported.runtime.processInventory.version = version;
    assert.doesNotThrow(() => assertIdentity(structuredClone(supported), supported));
  }
  for (const field of ['executable', 'version', 'sha256']) {
    const missing = structuredClone(identity); delete missing.runtime.processInventory[field];
    assert.throws(() => assertIdentity(missing, identity));
    const different = structuredClone(identity);
    different.runtime.processInventory[field] = { executable: 'C:\\Other\\pwsh.exe', version: '7.6.6', sha256: 'f'.repeat(64) }[field];
    assert.throws(() => assertIdentity(different, identity), /Mismatched process inventory runtime/u);
  }
  const absent = structuredClone(identity); delete absent.runtime.processInventory;
  assert.throws(() => assertIdentity(absent, absent), /Missing resolved Windows inventory executable/u);
});

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'inscape-aggregate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'browser-tests', '.verification/incoming', '.verification/build']) await mkdir(resolve(root, dir), { recursive: true });
  await writeFile(resolve(root, '.node-version'), process.versions.node);
  await writeFile(resolve(root, 'package-lock.json'), '{}');
  const catalog = { schemaVersion: 1, suites: ['one', 'two', 'three', 'four'].map(name => ({ name, category: 'release', rationale: 'Behavior' })) };
  await writeJson(resolve(root, 'scripts/browserSuites.json'), catalog);
  for (const { name } of catalog.suites) await writeFile(resolve(root, `browser-tests/${name}.browser.mjs`), '');
  const { identity, source } = await verificationIdentity(root, {});
  const browserIdentity = { ...identity, runtime: { ...identity.runtime, browser: { version: '149.0.7827.55', playwright: '1.61.1', variant: 'full-chromium', executable: 'chrome' } } };
  const input = resolve(root, '.verification/incoming'), build = resolve(root, '.verification/build');
  await writeFile(resolve(build, 'index.html'), '<title>built</title>');
  await writeJson(resolve(build, 'release-identity.json'), { version: 2, validation: 'candidate', ...identity.git, ci: identity.ci,
    sourceSha256: identity.sourceSha256, lockfileSha256: identity.lockfileSha256, publicConfigurationSha256: identity.publicConfigurationSha256 });
  const artifact = await fileInventory(build, await readdir(build));
  const part = (scope, shard) => resolve(input, `verification-${scope}${shard ? `-${shard}` : ''}-local`);
  for (const [scope, shard] of [['source'], ['production'], ...[1, 2, 3, 4].map(index => ['browser', index])]) {
    const folder = part(scope, shard); await mkdir(folder);
    const steps = verificationPlan(scope, shard).map(step => ({ name: step.name, status: 'passed', ...success, ...(step.tap ? { counts: passingTap(tap) } : {}) }));
    for (const step of steps) await writeFile(resolve(folder, `${step.name}.log`), tap);
    await writeJson(resolve(folder, 'verification.json'), { version: 2, scope, shard, status: 'passed', releaseValidated: false, ...browserIdentity, steps,
      ...(scope === 'production' ? { artifactSha256: artifact.sha256, candidateArtifactSha256: artifact.sha256 } : {}) });
    await writeJson(resolve(folder, 'source-manifest.json'), source);
    if (scope === 'production') {
      await writeJson(resolve(folder, 'artifact-manifest.json'), artifact);
      await writeJson(resolve(folder, 'candidate-artifact-manifest.json'), artifact);
    }
    if (scope === 'browser') {
      const browser = resolve(folder, 'browser'); await mkdir(browser);
      const selection = browserSelection(catalog, [`--shard=${shard}/4`]);
      await writeJson(resolve(browser, 'browser.json'), { version: 2, status: 'passed', selection, identity: browserIdentity,
        results: selection.suites.map(name => ({ name, status: 'passed', ...success, ...passingTap(tap) })) });
      await writeJson(resolve(browser, 'source-manifest.json'), source);
      for (const name of selection.suites) await writeFile(resolve(browser, `${name}.log`), tap);
    }
  }
  return { root, input, build, output: resolve(root, '.verification/aggregate'), environment: {}, jobs: structuredClone(jobs), part };
}

test('all partitions, raw TAP, current source and exact downloaded build are required for acceptance', async t => {
  const args = await fixture(t), result = await aggregateVerification(args);
  assert.equal(result.status, 'passed'); assert.equal(result.releaseValidated, true); assert.equal(result.browserSuites, 4);
});

const mutations = [
  ['missing shard', async a => rm(a.part('browser', 3), { recursive: true })],
  ['extra artifact', async a => mkdir(resolve(a.input, 'verification-browser-5-local'))],
  ['failed setup job', async a => { a.jobs.source.result = 'failure'; }],
  ['cancelled job', async a => { a.jobs.browser.result = 'cancelled'; }],
  ['missing job', async a => { delete a.jobs.production; }],
  ['changed current source', async a => writeFile(resolve(a.root, 'browser-tests/one.browser.mjs'), '// changed')],
  ['changed downloaded build', async a => writeFile(resolve(a.build, 'index.html'), '<title>changed</title>')],
  ['different build checkpoint', async a => { const p = resolve(a.part('production'), 'verification.json'), r = await readJson(p); r.candidateArtifactSha256 = 'b'.repeat(64); await writeJson(p, r); }],
  ['wrong source hash', async a => { const p = resolve(a.part('browser', 1), 'verification.json'), r = await readJson(p); r.sourceSha256 = 'a'.repeat(64); await writeJson(p, r); }],
  ['wrong PR identity', async a => { const p = resolve(a.part('browser', 1), 'verification.json'), r = await readJson(p); r.ci = { prHead: 'a'.repeat(40) }; await writeJson(p, r); }],
  ['wrong browser', async a => { const p = resolve(a.part('production'), 'verification.json'), r = await readJson(p); r.runtime.browser.version = '156.0.0.0'; await writeJson(p, r); }],
  ['incomplete ordinary check', async a => { const p = resolve(a.part('source'), 'verification.json'), r = await readJson(p); r.steps[0].status = 'pending'; await writeJson(p, r); }],
  ['subset claims release', async a => { const p = resolve(a.part('source'), 'verification.json'), r = await readJson(p); r.releaseValidated = true; await writeJson(p, r); }],
  ['duplicate suite', async a => { const p = resolve(a.part('browser', 1), 'browser/browser.json'), r = await readJson(p); r.results.push(r.results[0]); await writeJson(p, r); }],
  ['skipped test', async a => { const p = resolve(a.part('browser', 1), 'browser/browser.json'), r = await readJson(p); await writeFile(resolve(a.part('browser', 1), `browser/${r.results[0].name}.log`), tap.replace('# skipped 0', '# skipped 1')); }],
  ['truncated TAP', async a => writeFile(resolve(a.part('source'), 'unit.log'), tap.replace('1..1\n', ''))],
  ['cleanup unknown', async a => { const p = resolve(a.part('browser', 1), 'browser/browser.json'), r = await readJson(p); r.results[0].cleanup.status = 'unknown'; await writeJson(p, r); }],
  ['missing completion checkpoint', async a => { const p = resolve(a.part('browser', 1), 'browser/browser.json'), r = await readJson(p); delete r.results[0].cleanup.checkpoints.complete; await writeJson(p, r); }],
];
for (const [name, mutate] of mutations) test(`${name} never produces green acceptance`, async t => {
  const args = await fixture(t); await mutate(args);
  const result = await aggregateVerification(args);
  assert.equal(result.status, 'failed'); assert.equal(result.releaseValidated, false);
  assert.equal((await readJson(resolve(args.output, 'verification.json'))).status, 'failed');
});
