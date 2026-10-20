import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createServer as createSocket } from 'node:net';
import { browserExecutable } from './browserEnvironment.mjs';
import { passingTap } from './releaseEvidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = ['artwork-document', 'svg-lifecycle', 'camera-controls', 'context-action-bars', 'image-activation', 'image-click', 'image-duplicate', 'image-interaction', 'image-flip',
  'image-load-recovery', 'image-recovery-owner', 'image-resize-focus', 'resize-mark-pixels', 'image-corner-resize', 'image-large-resize', 'image-fit', 'keeper', 'keeper-dialogue', 'keeper-selection', 'library-drop-lifecycle',
  'library-filter-keyboard', 'library-storage', 'library-recovery', 'mini-apps', 'owner-profile-routing', 'published-visitor',
  'published-workbench-groups', 'reception-card', 'shapes', 'shape-corner-resize', 'grid-resize-release', 'text-focus-writing', 'text-linked-frames',
  'text-recovery-position', 'text-window-edges', 'workbench-area-navigation', 'workbench-groups', 'workbench-index',
  'workbench-inspection-keyboard', 'workbench-inspection-lock', 'workbench-layout-reload',
  'workbench-navigation-boundary', 'workbench-focus-toggle', 'workbench-focus-motion', 'workbench-focus-start', 'workbench-recovery', 'workbench-stacks', 'workbench-toolbar', 'entry-contrast', 'wallet-lazy-startup',
  'workbench-storage', 'text-article-tools', 'text-filled-workbench', 'workbench-activation', 'publication-upload-admission', 'publication-confirmation'];
const args = process.argv.slice(2);
const names = args.length ? args : defaults;
for (const name of names) if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(path.join(root, 'browser-tests', `${name}.browser.mjs`)))
  throw new Error(`Unknown browser suite: ${name}`);
const output = path.resolve(process.env.INSCAPE_BROWSER_REPORT || path.join(root, '.browser-test-runtime', `run-${Date.now()}`));
fs.mkdirSync(output, { recursive: true });
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
  for (const name of names) {
    const screenshots = path.join(output, name); fs.mkdirSync(screenshots, { recursive: true });
    const fd = fs.openSync(path.join(output, `${name}.log`), 'w');
    const start = Date.now();
    try {
      child = spawn(process.execPath, ['--import', './scripts/browserEnvironment.mjs', '--test', '--test-reporter=tap',
        '--test-concurrency=1', `browser-tests/${name}.browser.mjs`], { cwd: root, windowsHide: true, stdio: ['ignore', fd, fd],
        env: { ...env, INSCAPE_BROWSER_OUTPUT: screenshots, INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR: screenshots,
          INSCAPE_RECEPTION_CAPTURE_DIR: screenshots } });
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
