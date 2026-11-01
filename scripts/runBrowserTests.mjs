import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createServer as createSocketServer } from 'node:net';
import { passingTap, sourceInventory } from './releaseEvidence.mjs';
import { loadBrowserSuiteCatalog, browserSelection } from './browserSuiteCatalog.mjs';
import { SUITE_TIMEOUT_MS } from './verificationPlan.mjs';
import { runOwnedCommand, requireSuccessfulCommand } from './verificationProcess.mjs';
import { assertEvidencePath, verificationIdentity, probeBrowser } from './verificationIdentity.mjs';
import { closeViteWithinDeadline } from '../browser-tests/browser-test-lifecycle.mjs';

export async function runBrowserTests({ root, output, args = [], environment = process.env }) {
  assertEvidencePath(root, output);
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  const report = { version: 2, status: 'running', startedAt: new Date().toISOString(), results: [] };
  const save = async () => {
    await writeFile(resolve(output, 'browser.json'), JSON.stringify(report, null, 2));
    await writeFile(resolve(output, 'results.json'), JSON.stringify(report.results, null, 2));
  };
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let server;
  try {
    await save();
    const selection = browserSelection(await loadBrowserSuiteCatalog(root), args);
    report.selection = selection;
    report.results = selection.suites.map(name => ({ name, status: 'pending' }));
    await writeFile(resolve(output, 'selection.json'), JSON.stringify(selection, null, 2));
    const { identity, source } = await verificationIdentity(root, environment);
    report.identity = identity;
    await writeFile(resolve(output, 'source-manifest.json'), JSON.stringify(source, null, 2));
    report.identity.runtime.browser = await probeBrowser({ root, output, environment, signal: controller.signal });
    await save();
    // Vite treats configuration port 0 as its default 5173. Ask the OS for a
    // free port explicitly; strictPort rejects a race instead of sharing or
    // silently moving onto the user's development-server port.
    const port = await new Promise((resolvePort, reject) => {
      const socket = createSocketServer(); socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolvePort(port)); });
    });
    server = await createServer({ root, server: { host: '127.0.0.1', port, strictPort: true, open: false } });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    console.log(`Browser: ${JSON.stringify(report.identity.runtime.browser)}\nFixtures: ${origin}\nEvidence: ${output}`);
    const env = { ...environment, NO_COLOR: '1' };
    for (const key of ['INSCAPE_TEXT_ROOT', 'INSCAPE_SYSTEM_WORKFLOW_ROOT', 'INSCAPE_IMAGE_ROOT', 'INSCAPE_GRID_ROOT',
      'INSCAPE_TEST_ORIGIN', 'INSCAPE_TEST_ROOT', 'INSCAPE_MINT_ROOT']) env[key] = origin;
    env.INSCAPE_SYSTEM_WORKFLOW_URL = `${origin}/development/owner/system-workflow`;
    for (const result of report.results) {
      if (controller.signal.aborted) throw Error('Browser verification interrupted');
      const { name } = result, screenshots = resolve(output, name);
      await mkdir(screenshots);
      const logPath = resolve(output, `${name}.log`), fd = openSync(logPath, 'wx');
      const started = Date.now(); result.status = 'running'; result.startedAt = new Date().toISOString();
      await save(); console.log(`Starting browser suite ${name}`);
      try {
        Object.assign(result, await runOwnedCommand({ args: ['--import', './scripts/browserEnvironment.mjs', '--test', '--test-reporter=tap',
          '--test-concurrency=1', `browser-tests/${name}.browser.mjs`], cwd: root, stdio: ['ignore', fd, fd],
          env: { ...env, INSCAPE_BROWSER_OUTPUT: screenshots, INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR: screenshots,
            INSCAPE_RECEPTION_CAPTURE_DIR: screenshots, INSCAPE_SCREENSHOT_DIR: screenshots },
          timeoutMs: SUITE_TIMEOUT_MS, signal: controller.signal }));
        requireSuccessfulCommand(result, name);
        Object.assign(result, passingTap(await readFile(logPath, 'utf8')));
        result.status = 'passed';
      } catch (error) { result.status = 'failed'; result.error = error.message; }
      finally {
        closeSync(fd); result.seconds = (Date.now() - started) / 1000;
        result.finishedAt = new Date().toISOString(); await save(); console.log(JSON.stringify(result));
      }
    }
    if ((await sourceInventory(root)).sha256 !== report.identity.sourceSha256) throw Error('Source changed during browser verification');
    if (controller.signal.aborted || report.results.some(result => result.status !== 'passed')) throw Error('Browser verification has failed or incomplete suites');
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.message; console.error(error.message); }
  finally {
    try { await closeViteWithinDeadline(server); }
    catch (error) { report.status = 'failed'; report.cleanupError = error.message; }
    report.finishedAt = new Date().toISOString(); await save();
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  try {
    const report = await runBrowserTests({ root, output: resolve(process.env.INSCAPE_BROWSER_REPORT || resolve(root, '.browser-test-runtime', `run-${Date.now()}`)), args: process.argv.slice(2) });
    if (report.status !== 'passed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
