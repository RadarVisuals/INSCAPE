import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileInventory, passingTap, sourceInventory, SOURCE_INPUTS } from './releaseEvidence.mjs';
import { verifyRelease, verificationSteps } from './verifyRelease.mjs';

const green = 'TAP version 13\nok 1 - fixture\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'inscape-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src'));
  await writeFile(resolve(root, 'src/app.js'), 'export const value = 1;');
  await writeFile(resolve(root, 'package-lock.json'), '{"lockfileVersion":3}');
  await writeFile(resolve(root, 'package.json'), '{"type":"module"}');
  await writeFile(resolve(root, '.node-version'), process.versions.node);
  return root;
}
const build = { name: 'build', args: ['--input-type=module', '-e',
  "import fs from 'node:fs'; fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/index.html','<title>fixture</title>');"] };
const pass = { name: 'test', tap: true, args: ['-e', `console.log(${JSON.stringify(green)})`] };

test('the normal verification steps and source inputs are unique', () => {
  assert.equal(new Set(verificationSteps.map(step => step.name)).size, verificationSteps.length);
  assert.equal(new Set(SOURCE_INPUTS).size, SOURCE_INPUTS.length);
  assert.ok(SOURCE_INPUTS.includes('tsconfig.contracts.json') && SOURCE_INPUTS.includes('typechecks'));
  assert.deepEqual(verificationSteps.find(step => step.name === 'typecheck')?.args, ['typechecks/verify-workbench-contracts.mjs']);
});

test('duplicate step names fail before any child or artifact is produced', async t => {
  const root = await fixture(t);
  const result = await verifyRelease({ root, output: resolve(root, '.verification/duplicates'), steps: [build, build], environment: {} });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /Duplicate verification step names/);
  assert.ok(result.steps.every(step => step.status === 'pending'));
  await assert.rejects(readFile(resolve(root, 'dist/index.html')), { code: 'ENOENT' });
});

test('evidence detects changed bytes and new files, independent of generated output', async t => {
  const root = await fixture(t);
  const before = await sourceInventory(root);
  await mkdir(resolve(root, 'dist'));
  await writeFile(resolve(root, 'dist/result.js'), 'generated');
  assert.equal((await sourceInventory(root)).sha256, before.sha256);
  await writeFile(resolve(root, 'src/app.js'), 'export const value = 2;');
  assert.notEqual((await sourceInventory(root)).sha256, before.sha256);
  const changed = await sourceInventory(root);
  await writeFile(resolve(root, 'src/new.js'), 'new input');
  assert.notEqual((await sourceInventory(root)).sha256, changed.sha256);
});

test('verification rejects unrecorded local environment configuration', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, '.env.local'), 'VITE_EXAMPLE=private-fixture');
  await assert.rejects(sourceInventory(root), /without local .env/);
});

test('TAP gate rejects missing totals, zero tests, failures, cancellations, skips and todo', () => {
  assert.equal(passingTap(green).pass, 1);
  for (const text of ['', green.slice(green.indexOf('# tests')), green.replace('1..1\n', ''), green.replace('ok 1 - fixture\n', ''),
    green.replace('1..1', '1..2').replace('# tests 1', '# tests 2').replace('# pass 1', '# pass 2'), green.replace('ok 1 -', 'ok 2 -'),
    green + '# tests 1\n', green.replace('# tests 1', '# tests 0'),
    ...['pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => green.replace(`# ${key} ${key === 'pass' ? 1 : 0}`, `# ${key} ${key === 'pass' ? 0 : 1}`))])
    assert.throws(() => passingTap(text));
});

test('nested Node TAP completes its top-level plan while test totals count nested tests', () => {
  const nested = 'TAP version 13\n# Subtest: group\n    # Subtest: first\n    ok 1 - first\n    # Subtest: second\n    ok 2 - second\n    1..2\nok 1 - group\n1..1\n# tests 2\n# suites 1\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(passingTap(nested).tests, 2);
});

test('a green check that mutates built bytes cannot issue successful artifact evidence', async t => {
  const root = await fixture(t), output = resolve(root, '.verification/artifact-changed');
  const result = await verifyRelease({ root, output, environment: {}, steps: [build,
    { name: 'mutate-output', args: ['-e', "require('node:fs').writeFileSync('dist/index.html','changed during checks')"] }] });
  assert.equal(result.status, 'failed'); assert.equal(result.releaseValidated, false);
  assert.match(result.error, /artifact changed after build/);
  await assert.rejects(readFile(resolve(output, 'artifact-manifest.json')), { code: 'ENOENT' });
  assert.ok(await readFile(resolve(output, 'candidate-artifact-manifest.json')));
});

test('successful child checks bind source, lockfile and built artifact bytes', async t => {
  const root = await fixture(t), output = resolve(root, '.verification/pass');
  const result = await verifyRelease({ root, output, steps: [pass, build], environment: {} });
  assert.equal(result.status, 'passed');
  assert.equal(result.steps[0].counts.tests, 1);
  assert.equal(result.git.commit, null);
  const artifacts = JSON.parse(await readFile(resolve(output, 'artifact-manifest.json')));
  assert.equal(artifacts.sha256, result.artifactSha256);
  const identity = JSON.parse(await readFile(resolve(root, 'dist/release-identity.json')));
  assert.equal(identity.sourceSha256, result.sourceSha256);
  await writeFile(resolve(root, 'dist/index.html'), 'changed after checks');
  assert.notEqual((await fileInventory(resolve(root, 'dist'), ['index.html', 'release-identity.json'])).sha256, artifacts.sha256);
  await assert.rejects(verifyRelease({ root, output, steps: [], environment: {} }), { code: 'EEXIST' });
});

for (const [name, step] of [
  ['failed exit', { name: 'broken', args: ['-e', 'process.exit(7)'] }],
  ['skipped test with exit zero', { name: 'skipped', tap: true, args: ['-e', `console.log(${JSON.stringify(green.replace('# skipped 0', '# skipped 1'))})`] }],
  ['missing TAP with exit zero', { name: 'missing', tap: true, args: ['-e', 'console.log("not a test result")'] }],
  ['terminated child', { name: 'terminated', args: ['-e', 'process.kill(process.pid, "SIGTERM")'] }],
]) test(`${name} blocks later steps and successful artifact evidence`, async t => {
  const root = await fixture(t), output = resolve(root, '.verification/fail');
  const result = await verifyRelease({ root, output, steps: [step, build], environment: {} });
  assert.equal(result.status, 'failed');
  assert.equal(result.steps[0].status, 'failed');
  assert.equal(result.steps[1].status, 'pending');
  await assert.rejects(readFile(resolve(output, 'artifact-manifest.json')), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(resolve(output, 'verification.json'))).status, 'failed');
});

test('source edits during otherwise green checks invalidate the final result', async t => {
  const root = await fixture(t), output = resolve(root, '.verification/changed');
  const result = await verifyRelease({ root, output, environment: {}, steps: [build,
    { name: 'mutate', args: ['-e', "require('node:fs').writeFileSync('src/app.js','changed during run')"] }] });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /Source changed/);
  await assert.rejects(readFile(resolve(output, 'artifact-manifest.json')), { code: 'ENOENT' });
});

test('CI refuses to label a source copy as the requested Git commit', async t => {
  const root = await fixture(t);
  const result = await verifyRelease({ root, output: resolve(root, '.verification/ci'), steps: [build],
    environment: { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'a'.repeat(40) } });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /clean checkout/);
  assert.equal(result.steps[0].status, 'pending');
});

test('wrong Node version fails before any verification step', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, '.node-version'), '0.0.0');
  const result = await verifyRelease({ root, output: resolve(root, '.verification/node'), steps: [build], environment: {} });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /Node 0.0.0 required/);
  assert.equal(result.steps[0].status, 'pending');
});
