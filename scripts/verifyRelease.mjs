import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileInventory, gitIdentity, passingTap, sha256, sourceInventory } from './releaseEvidence.mjs';

export const verificationSteps = Object.freeze([
  { name: 'unit', args: ['--test', '--test-reporter=tap'], tap: true },
  { name: 'browser', args: ['scripts/runBrowserTests.mjs'] },
  { name: 'standards', args: ['--test', '--test-reporter=tap', 'scripts/luksoStandards.audit.test.js'], tap: true },
  { name: 'design-system', args: ['scripts/designSystemInventory.js', '--check'] },
  { name: 'build', args: ['node_modules/vite/bin/vite.js', 'build'] },
  { name: 'build-budget', args: ['scripts/checkProductionBuild.js'] },
  { name: 'production-startup', args: ['--import', './scripts/browserEnvironment.mjs', '--test', '--test-reporter=tap', 'browser-tests/production-startup.browser.mjs'], tap: true },
]);

export async function verifyRelease({ root, output, steps = verificationSteps, environment = process.env }) {
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output); // Existing evidence must never be overwritten by another run.
  const summary = { version: 1, startedAt: new Date().toISOString(), status: 'running',
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    steps: steps.map(({ name }) => ({ name, status: 'pending' })) };
  const save = () => writeFile(resolve(output, 'verification.json'), JSON.stringify(summary, null, 2));
  let child;
  let interrupted = false;
  const stop = () => { interrupted = true; child?.kill(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await save();
    const requiredNode = (await readFile(resolve(root, '.node-version'), 'utf8')).trim().replace(/^v/u, '');
    if (process.versions.node !== requiredNode) throw Error(`Node ${requiredNode} required; found ${process.versions.node}`);
    summary.git = gitIdentity(root);
    if (environment.GITHUB_ACTIONS === 'true' && (summary.git.dirty || summary.git.commit !== environment.GITHUB_SHA))
      throw Error('CI requires a clean checkout of GITHUB_SHA');
    const source = await sourceInventory(root);
    summary.sourceSha256 = source.sha256;
    const lock = source.files.find(file => file.path === 'package-lock.json');
    if (!lock) throw Error('Lockfile missing from verification source');
    summary.lockfileSha256 = lock.sha256;
    const publicConfig = Object.fromEntries(Object.entries(environment).filter(([key]) => key.startsWith('VITE_')).sort(([a], [b]) => a.localeCompare(b)));
    summary.publicConfigurationSha256 = sha256(JSON.stringify(publicConfig));
    await writeFile(resolve(output, 'source-manifest.json'), JSON.stringify(source, null, 2));
    const env = { ...environment, NO_COLOR: '1', NODE_TEST_REPORTER: 'tap',
      INSCAPE_BROWSER_REPORT: resolve(output, 'browser'), INSCAPE_BROWSER_OUTPUT: resolve(output, 'production-startup'),
      // A dirty tree must not masquerade as its clean HEAD in the support UI.
      COMMIT_REF: summary.git.commit && !summary.git.dirty ? summary.git.commit : 'development' };
    for (const [index, step] of steps.entries()) {
      if (interrupted) throw Error('Verification interrupted');
      const result = summary.steps[index];
      result.status = 'running';
      await save();
      const logPath = resolve(output, `${step.name}.log`);
      const fd = openSync(logPath, 'wx');
      const started = Date.now();
      console.log(`Verifying ${step.name}; log: ${logPath}`);
      try {
        child = spawn(process.execPath, step.args, { cwd: root, env, windowsHide: true, stdio: ['ignore', fd, fd] });
        const outcome = await new Promise((done, reject) => {
          child.once('error', reject);
          child.once('close', (code, signal) => done({ code, signal }));
        });
        Object.assign(result, outcome, { seconds: (Date.now() - started) / 1000 });
        if (interrupted || outcome.code !== 0 || outcome.signal) throw Error(`${step.name} failed (${outcome.signal || outcome.code})`);
        if (step.tap) result.counts = passingTap(await readFile(logPath, 'utf8'));
        result.status = 'passed';
        if (step.name === 'build') {
          await writeFile(resolve(root, 'dist/release-identity.json'), JSON.stringify({ version: 1,
            sourceSha256: summary.sourceSha256, lockfileSha256: summary.lockfileSha256,
            publicConfigurationSha256: summary.publicConfigurationSha256, ...summary.git }, null, 2));
        }
      } catch (error) {
        result.status = 'failed';
        throw error;
      } finally { closeSync(fd); child = null; await save(); }
    }
    if (interrupted) throw Error('Verification interrupted');
    if ((await sourceInventory(root)).sha256 !== source.sha256) throw Error('Source changed during verification; run again on a stable checkout');
    const artifacts = await fileInventory(resolve(root, 'dist'), await readdir(resolve(root, 'dist')));
    if (!artifacts.files.some(file => file.path === 'index.html') || !artifacts.files.some(file => file.path === 'release-identity.json'))
      throw Error('Production output or release identity missing');
    await writeFile(resolve(output, 'artifact-manifest.json'), JSON.stringify(artifacts, null, 2));
    summary.artifactSha256 = artifacts.sha256;
    summary.status = 'passed';
  } catch (error) {
    summary.status = 'failed';
    summary.error = error.message;
    console.error(error.message);
  } finally {
    summary.finishedAt = new Date().toISOString();
    await save();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
  console.log(`Verification ${summary.status}: ${resolve(output, 'verification.json')}`);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const output = resolve(process.env.INSCAPE_VERIFY_REPORT || resolve(root, '.verification', `run-${Date.now()}`));
  try { if ((await verifyRelease({ root, output })).status !== 'passed') process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
