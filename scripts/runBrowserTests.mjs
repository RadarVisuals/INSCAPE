import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createServer as createSocket } from 'node:net';
import { browserExecutable } from './browserEnvironment.mjs';
import { passingTap } from './releaseEvidence.mjs';
import { loadBrowserSuiteCatalog, selectBrowserSuites } from './browserSuiteCatalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = await loadBrowserSuiteCatalog(root);
const args = process.argv.slice(2);
const names = selectBrowserSuites(catalog, args);
const output = path.resolve(process.env.INSCAPE_BROWSER_REPORT || path.join(root, '.browser-test-runtime', `run-${Date.now()}`));
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'selection.json'), JSON.stringify({ mode: args.length ? 'explicit' : 'release', suites: names }, null, 2), { flag: 'wx' });
const port = await new Promise((resolve, reject) => {
  const socket = createSocket(); socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
});
const server = await createServer({ root, server: { host: '127.0.0.1', port, strictPort: true, open: false } });
let child;
const stop = () => child?.kill();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const results = [];
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log(`Browser: ${browserExecutable}\nFixtures: ${origin}\nEvidence: ${output}`);
  const env = { ...process.env, NO_COLOR: '1' };
  for (const key of ['INSCAPE_TEXT_ROOT', 'INSCAPE_SYSTEM_WORKFLOW_ROOT', 'INSCAPE_IMAGE_ROOT', 'INSCAPE_GRID_ROOT',
    'INSCAPE_TEST_ORIGIN', 'INSCAPE_TEST_ROOT', 'INSCAPE_MINT_ROOT']) env[key] = origin;
  env.INSCAPE_SYSTEM_WORKFLOW_URL = `${origin}/development/owner/system-workflow`;
  for (const name of names) {
    const screenshots = path.join(output, name); fs.mkdirSync(screenshots, { recursive: true });
    const fd = fs.openSync(path.join(output, `${name}.log`), 'w');
    const start = Date.now();
    try {
      child = spawn(process.execPath, ['--import', './scripts/browserEnvironment.mjs', '--test', '--test-reporter=tap',
        '--test-concurrency=1', `browser-tests/${name}.browser.mjs`], { cwd: root, windowsHide: true, stdio: ['ignore', fd, fd],
        env: { ...env, INSCAPE_BROWSER_OUTPUT: screenshots, INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR: screenshots,
          INSCAPE_RECEPTION_CAPTURE_DIR: screenshots, INSCAPE_SCREENSHOT_DIR: screenshots } });
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
      const log = fs.readFileSync(path.join(output, `${name}.log`), 'utf8');
      const counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key =>
        [key, Number(log.match(new RegExp(`^# ${key} (\\d+)`, 'm'))?.[1] || 0)]));
      let evidenceError;
      try { passingTap(log); } catch (error) { evidenceError = error.message; }
      const result = { name, code, seconds: (Date.now() - start) / 1000, ...counts, ...(evidenceError ? { error: evidenceError } : {}) };
      results.push(result); console.log(JSON.stringify(result));
      fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      if (code !== 0 || evidenceError) process.exitCode = 1;
      if (code === null) break;
    } finally { fs.closeSync(fd); child = null; }
  }
} finally { stop(); await server.close(); }
