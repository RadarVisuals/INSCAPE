import { openSync, closeSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { release } from 'node:os';
import { SOURCE_INPUTS, gitIdentity, sha256, sourceInventory } from './releaseEvidence.mjs';
import { runOwnedCommand, requireSuccessfulCommand } from './verificationProcess.mjs';
import { resolveWindowsProcessRuntime } from '../browser-tests/browser-test-lifecycle.mjs';

export function assertEvidencePath(root, output) {
  const local = relative(resolve(root), resolve(output)).replaceAll('\\', '/');
  if (!local || SOURCE_INPUTS.some(input => local === input || local.startsWith(`${input}/`)))
    throw Error('Evidence must remain outside the source inventory');
  if (isAbsolute(local)) throw Error('Evidence must use a resolved local path');
}

export async function verificationIdentity(root, environment = process.env) {
  const required = (await readFile(resolve(root, '.node-version'), 'utf8')).trim().replace(/^v/u, '');
  if (process.versions.node !== required) throw Error(`Node ${required} required; found ${process.versions.node}`);
  const git = gitIdentity(root);
  if (environment.GITHUB_ACTIONS === 'true' && (git.dirty || git.commit !== environment.GITHUB_SHA)) throw Error('CI requires a clean checkout of GITHUB_SHA');
  const source = await sourceInventory(root);
  const lock = source.files.find(file => file.path === 'package-lock.json');
  if (!lock) throw Error('Lockfile missing from verification source');
  const publicConfig = Object.fromEntries(Object.entries(environment).filter(([key]) => key.startsWith('VITE_')).sort(([a], [b]) => a.localeCompare(b, 'en')));
  const ci = environment.GITHUB_ACTIONS === 'true' ? {
    provider: 'github', event: environment.GITHUB_EVENT_NAME, runId: environment.GITHUB_RUN_ID, attempt: environment.GITHUB_RUN_ATTEMPT,
    testedCommit: environment.GITHUB_SHA, prHead: environment.INSCAPE_PR_HEAD_SHA || null,
    mergeCommit: environment.GITHUB_EVENT_NAME === 'pull_request' ? environment.GITHUB_SHA : null,
  } : null;
  if (ci && (!ci.event || !ci.runId || !ci.attempt || !/^[a-f0-9]{40}$/u.test(ci.testedCommit || '')
    || ci.event === 'pull_request' && !/^[a-f0-9]{40}$/u.test(ci.prHead || ''))) throw Error('Incomplete CI source/run identity');
  const processInventory = await resolveWindowsProcessRuntime(environment);
  return { source, identity: { git, ci, sourceSha256: source.sha256, lockfileSha256: lock.sha256,
    publicConfigurationSha256: sha256(JSON.stringify(publicConfig)), runtime: { node: process.version, platform: process.platform, arch: process.arch,
      osRelease: release(), runnerImage: environment.ImageOS || null, runnerImageVersion: environment.ImageVersion || null, processInventory } } };
}

export async function probeBrowser({ root, output, environment, signal }) {
  const log = resolve(output, 'browser-environment.log'), fd = openSync(log, 'wx');
  try {
    const result = await runOwnedCommand({ args: ['scripts/browserProbe.mjs'], cwd: root, env: environment,
      stdio: ['ignore', fd, fd], timeoutMs: 60_000, signal });
    requireSuccessfulCommand(result, 'Browser environment probe');
    const browser = JSON.parse((await readFile(log, 'utf8')).trim());
    if (!/^\d+\.\d+\.\d+\.\d+$/u.test(browser.version) || !browser.playwright || !browser.variant || !browser.executable) throw Error('Incomplete browser identity');
    await writeFile(resolve(output, 'browser-environment.json'), JSON.stringify(browser, null, 2));
    return browser;
  } finally { closeSync(fd); }
}
