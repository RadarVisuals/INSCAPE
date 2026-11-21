import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const root = process.cwd(), out = resolve('.browser-test-runtime/styling-baseline');
await mkdir(out, { recursive: true });
const before = new Map();
const put = (file, content) => before.set(resolve(file).replaceAll('\\', '/'), content);
// These files were clean before this styling pass; serve their HEAD content in memory.
for (const file of ['src/colour/ColourControls.jsx', 'src/colour/colourControls.css', 'src/public/identity/IdentityCardSettings.jsx', 'src/public/identity/identityModule.css', 'src/public/ownerSystemWorkflow/workbenchSharedTools.css', 'src/text/textTools.css']) {
  put(file, execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }));
}
// Preserve earlier uncommitted changes in the three already-dirty stylesheets.
const panel = 'src/public/ownerSystemWorkflow/workbenchToolPanel.css';
put(panel, (await readFile(panel, 'utf8')).replace("@import '../../ui/toolControlSizing.css';\n", ''));
const reception = 'src/reception/reception.css';
put(reception, (await readFile(reception, 'utf8')).split('\n').map(line => line.startsWith('.reception-editor-window[data-editing] {') ? line.replace('overflow: hidden; }', 'overflow: hidden; font: var(--workflow-type-control); }') : line.startsWith('.reception-editor-header {') ? line.replace(' font: var(--workflow-type-control);', '') : line).join('\n'));
const chrome = 'src/public/ownerSystemWorkflow/workbenchToolChrome.css';
let css = (await readFile(chrome, 'utf8')).replace("@import '../../ui/toolControlSizing.css';\n", '').replaceAll(':where(input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea)', ':is(input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea)');
const start = css.indexOf('/* Flat windows keep'), end = css.indexOf('.workbench-tool-controls [data-icon-only]', start);
css = css.slice(0, start) + `
.workbench-tool-window, .keeper-dock-window, .workbench-tool-controls { --tool-control-height:32px; --tool-icon-target:32px; --tool-action-target:40px; }
.workbench-tool-window > .system-workflow__detached-window-surface { scrollbar-gutter:stable; }
@media (pointer:coarse), (max-width:520px) {
 .system-workflow__detached-window[data-window-chrome="flat"] { --tool-control-height:44px; --tool-icon-target:44px; }
 .workbench-tool-window, .keeper-dock-window, .workbench-tool-controls { --tool-control-height:44px; --tool-icon-target:44px; --tool-action-target:44px; --tool-titlebar-height:52px; }
 .workbench-tool-window summary { box-sizing:border-box; min-height:44px; padding-block:13px; }
 :is(.workbench-tool-window, .workbench-tool-controls) :is(input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea) { font-size:16px; }
}
` + css.slice(end);
put(chrome, css);
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, watch: null }, plugins: [{ name: 'before-styling-in-memory', enforce: 'pre', load(id) { return before.get(id.split('?')[0]) ?? null; } }] });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
try {
  for (const name of ['identity-module', 'owner-lattice-identity']) {
    const args = ['--import', './scripts/browserEnvironment.mjs', '--test', '--test-reporter=tap'];
    if (name === 'identity-module') args.push('--test-name-pattern=owner opens Identity');
    args.push(`browser-tests/${name}.browser.mjs`);
    const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, env: { ...process.env, INSCAPE_SYSTEM_WORKFLOW_ROOT: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
    const code = await new Promise(resolve => child.once('exit', resolve));
    await writeFile(resolve(out, name + '.log'), log);
    console.log(JSON.stringify({ name, code, failures: log.split('\n').filter(line => /not ok|waiting for|error:/.test(line)) }));
  }
} finally { await server.close(); }
