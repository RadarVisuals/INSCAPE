import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileInventory, passingTap, sourceInventory } from './releaseEvidence.mjs';
import { verificationPlan, parseVerificationArgs, SUITE_TIMEOUT_MS, STEP_TIMEOUT_MS } from './verificationPlan.mjs';
import { assertEvidencePath, verificationIdentity, probeBrowser } from './verificationIdentity.mjs';
import { loadBrowserSuiteCatalog, browserSelection } from './browserSuiteCatalog.mjs';
import { validateBrowserEvidence } from './verificationEvidence.mjs';
import { runOwnedCommand, requireSuccessfulCommand } from './verificationProcess.mjs';
export { verificationSteps } from './verificationPlan.mjs';

export async function verifyRelease({ root, output, scope = 'full', shard, steps, environment = process.env }) {
  assertEvidencePath(root, output);
  const custom = steps !== undefined;
  steps ??= verificationPlan(scope, shard);
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  const summary = { version: 2, scope: custom ? 'custom' : scope, shard, releaseValidated: false,
    startedAt: new Date().toISOString(), status: 'running', steps: steps.map(({ name }) => ({ name, status: 'pending' })) };
  const save = () => writeFile(resolve(output, 'verification.json'), JSON.stringify(summary, null, 2));
  const controller = new AbortController(), stop = () => controller.abort();
  let builtArtifacts;
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    await save();
    if (new Set(steps.map(step => step.name)).size !== steps.length) throw Error('Duplicate verification step names');
    const { identity, source } = await verificationIdentity(root, environment);
    Object.assign(summary, identity);
    await writeFile(resolve(output, 'source-manifest.json'), JSON.stringify(source, null, 2));
    const env = { ...environment, NO_COLOR: '1', NODE_TEST_REPORTER: 'tap',
      INSCAPE_BROWSER_REPORT: resolve(output, 'browser'), INSCAPE_BROWSER_OUTPUT: resolve(output, 'production-startup'),
      COMMIT_REF: summary.git.commit && !summary.git.dirty ? summary.git.commit : 'development' };
    for (const [index, step] of steps.entries()) {
      if (controller.signal.aborted) throw Error('Verification interrupted');
      const result = summary.steps[index]; result.status = 'running'; result.startedAt = new Date().toISOString();
      await save();
      const logPath = resolve(output, `${step.name}.log`), fd = openSync(logPath, 'wx'), started = Date.now();
      console.log(`Verifying ${step.name}; log: ${logPath}`);
      try {
        let selection;
        if (step.name === 'browser') selection = browserSelection(await loadBrowserSuiteCatalog(root), step.args.slice(1));
        if (step.name === 'production-startup' && !summary.runtime.browser)
          summary.runtime.browser = await probeBrowser({ root, output, environment: env, signal: controller.signal });
        Object.assign(result, await runOwnedCommand({ args: step.args, cwd: root, env, stdio: ['ignore', fd, fd],
          timeoutMs: selection ? selection.suites.length * SUITE_TIMEOUT_MS + 60_000 : STEP_TIMEOUT_MS, signal: controller.signal }));
        requireSuccessfulCommand(result, step.name);
        if (step.tap) result.counts = passingTap(await readFile(logPath, 'utf8'));
        if (selection) {
          const browser = JSON.parse(await readFile(resolve(output, 'browser/browser.json'), 'utf8'));
          await validateBrowserEvidence(browser, { output: resolve(output, 'browser'), selection, identity: summary });
          summary.runtime.browser = browser.identity.runtime.browser;
        }
        if (step.name === 'build') {
          await writeFile(resolve(root, 'dist/release-identity.json'), JSON.stringify({ version: 2, validation: 'candidate',
            sourceSha256: summary.sourceSha256, lockfileSha256: summary.lockfileSha256, publicConfigurationSha256: summary.publicConfigurationSha256,
            ...summary.git, ci: summary.ci }, null, 2));
          builtArtifacts = await fileInventory(resolve(root, 'dist'), await readdir(resolve(root, 'dist')));
          if (!builtArtifacts.files.some(file => file.path === 'index.html')) throw Error('Production entry missing after build');
          summary.candidateArtifactSha256 = builtArtifacts.sha256;
          await writeFile(resolve(output, 'candidate-artifact-manifest.json'), JSON.stringify(builtArtifacts, null, 2));
        }
        result.status = 'passed';
      } catch (error) { result.status = 'failed'; result.error = error.message; throw error; }
      finally { closeSync(fd); result.seconds = (Date.now() - started) / 1000; result.finishedAt = new Date().toISOString(); await save(); }
    }
    if (controller.signal.aborted) throw Error('Verification interrupted');
    if ((await sourceInventory(root)).sha256 !== summary.sourceSha256) throw Error('Source changed during verification; run again on a stable checkout');
    if (steps.some(step => step.name === 'build')) {
      const artifacts = await fileInventory(resolve(root, 'dist'), await readdir(resolve(root, 'dist')));
      if (artifacts.sha256 !== builtArtifacts?.sha256) throw Error('Production artifact changed after build; checks must use exactly the built bytes');
      if (!artifacts.files.some(file => file.path === 'index.html') || !artifacts.files.some(file => file.path === 'release-identity.json')) throw Error('Production output or release identity missing');
      await writeFile(resolve(output, 'artifact-manifest.json'), JSON.stringify(artifacts, null, 2));
      summary.artifactSha256 = artifacts.sha256;
    }
    summary.status = 'passed'; summary.releaseValidated = !custom && scope === 'full';
  } catch (error) { summary.status = 'failed'; summary.error = error.message; console.error(error.message); }
  finally {
    summary.finishedAt = new Date().toISOString(); await save();
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
  console.log(`Verification ${summary.scope} ${summary.status}: ${resolve(output, 'verification.json')}`);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  try {
    const options = parseVerificationArgs(process.argv.slice(2));
    const output = resolve(process.env.INSCAPE_VERIFY_REPORT || resolve(root, '.verification', `run-${Date.now()}`));
    if ((await verifyRelease({ root, output, ...options })).status !== 'passed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
