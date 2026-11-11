import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, win32 } from 'node:path';
import { passingTap } from './releaseEvidence.mjs';
import { requireSuccessfulCommand } from './verificationProcess.mjs';
import { verificationPlan } from './verificationPlan.mjs';

export function assertIdentity(actual, expected, { browser = false } = {}) {
  for (const field of ['sourceSha256', 'lockfileSha256', 'publicConfigurationSha256']) {
    assert.match(actual?.[field] || '', /^[a-f0-9]{64}$/u, `Missing ${field}`);
    assert.equal(actual[field], expected[field], `Mismatched ${field}`);
  }
  assert.deepEqual(actual.git, expected.git, 'Mismatched tested Git identity');
  assert.deepEqual(actual.ci, expected.ci, 'Mismatched CI run, PR head or merge identity');
  for (const field of ['node', 'platform', 'arch', 'osRelease', 'runnerImage', 'runnerImageVersion'])
    assert.equal(actual.runtime?.[field], expected.runtime?.[field], `Mismatched runtime ${field}`);
  const processInventory = actual.runtime?.processInventory;
  if (actual.runtime?.platform === 'win32') {
    assert.ok(typeof processInventory?.executable === 'string' && win32.isAbsolute(processInventory.executable), 'Missing resolved Windows inventory executable');
    assert.match(processInventory?.version || '', /^\d+\.\d+\.\d+(?:\.\d+)?(?:[-+][\da-z.-]+)?$/iu, 'Missing Windows inventory version');
    assert.match(processInventory?.sha256 || '', /^[a-f0-9]{64}$/u, 'Missing Windows inventory executable hash');
  }
  assert.deepEqual(processInventory ?? null, expected.runtime?.processInventory ?? null, 'Mismatched process inventory runtime');
  if (browser) {
    assert.ok(actual.runtime.browser?.version && actual.runtime.browser?.playwright && actual.runtime.browser?.variant, 'Missing actual browser identity');
    assert.deepEqual(actual.runtime.browser, expected.runtime.browser, 'Mismatched browser environment');
  }
}

export async function validateBrowserEvidence(report, { output, selection, identity }) {
  assert.equal(report.version, 2, 'Unsupported browser evidence');
  assert.equal(report.status, 'passed', 'Browser report failed or incomplete');
  assertIdentity(report.identity, identity);
  assert.deepEqual(report.selection, selection, 'Browser selection differs from the current catalog/shard plan');
  assert.deepEqual(report.results.map(result => result.name), selection.suites, 'Missing, extra or duplicate browser suite');
  for (const result of report.results) {
    assert.equal(result.status, 'passed', `Incomplete browser suite ${result.name}`);
    requireSuccessfulCommand(result, result.name);
    const counts = passingTap(await readFile(resolve(output, `${result.name}.log`), 'utf8'));
    for (const field of Object.keys(counts)) assert.equal(result[field], counts[field], `TAP counts disagree for ${result.name}`);
  }
}

export async function validatePartition(report, { scope, shard, output, identity }) {
  assert.equal(report.version, 2, 'Unsupported verification evidence');
  assert.equal(report.scope, scope, 'Wrong verification scope');
  assert.equal(report.shard, shard, 'Wrong verification shard');
  assert.equal(report.status, 'passed', 'Verification partition failed or incomplete');
  assert.equal(report.releaseValidated, false, 'Partial verification must not claim release acceptance');
  assertIdentity(report, identity);
  const expected = verificationPlan(scope, shard);
  assert.deepEqual(report.steps.map(step => step.name), expected.map(step => step.name), 'Missing, extra or duplicate verification step');
  for (const [index, step] of report.steps.entries()) {
    assert.equal(step.status, 'passed', `Incomplete verification step ${step.name}`);
    requireSuccessfulCommand(step, step.name);
    if (expected[index].tap) assert.deepEqual(step.counts, passingTap(await readFile(resolve(output, `${step.name}.log`), 'utf8')), `Incomplete TAP for ${step.name}`);
  }
}
