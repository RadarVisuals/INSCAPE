// Explicit local component benchmark, not a release assertion or deployed-route
// load test. Run with the normal project Node runtime, outside restricted shells.
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { sourceInventory, gitIdentity } from '../scripts/releaseEvidence.mjs';
import { excludeUnsupportedWalletConnectorsPlugin } from '../scripts/unsupportedWalletConnectors.js';
import { ARTWORK_DOCUMENT_PATH, ARTWORK_DOCUMENT_HEADERS, ARTWORK_DOCUMENT_HTML } from '../scripts/artworkDocumentHost.js';
import { RECEPTION_PERFORMANCE_CASES, receptionPerformanceDocument } from './fixtures/reception-performance.js';
import { distribution, installReceptionPerformanceProbe } from './fixtures/reception-performance-probe.mjs';
import { editorCommand, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const requiredNode = (await readFile(resolve(root, '.node-version'), 'utf8')).trim().replace(/^v/u, '');
if (process.versions.node !== requiredNode) throw Error(`Use project Node ${requiredNode}; found ${process.versions.node}.`);
const prepareOnly = process.argv.includes('--prepare');
const followup = process.argv.includes('--svg-editor');
if (process.argv.slice(2).some(arg => !['--prepare', '--svg-editor'].includes(arg))) throw Error('Use --prepare and/or --svg-editor.');
const selectedWorkloads = followup ? ['svg-6'] : RECEPTION_PERFORMANCE_CASES;
const runs = Number(process.env.INSCAPE_RECEPTION_PERF_RUNS || 5);
if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw Error('Use 1–5 runs.');
const output = resolve(root, 'output', `reception-performance-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const dist = resolve(output, 'dist');
await mkdir(output, { recursive: true });
const source = await sourceInventory(root);
const report = { status: 'preparing', scope: 'production-compiled-isolated-components', startedAt: new Date().toISOString(),
  sourceSha256: source.sha256, git: gitIdentity(root), runtime: { node: process.version, platform: process.platform,
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem() },
  viewport: { width: 1600, height: 1000, dpr: 1 }, runs,
  selection: { workloads: selectedWorkloads, editor: true, separateTypingProfile: true },
  readiness: 'explicit-media-and-fonts-plus-500ms-settling',
  caveats: [
    'Passed means the measurement scenarios completed; no performance budget or release approval is implied.',
    'Initial load is this isolated component entry, not the real public profile route or a CDN benchmark.',
    'Six SVG cells repeat the unchanged local animated Nomad export under six URLs; this is not six distinct artworks.',
    'Fourteen raster cells repeat two sources. Cache reuse is intentional; this is not fourteen unique downloads.',
    'Ready time includes explicit fonts/media readiness plus a fixed 500ms settling pause; it is not first paint or a network-idle guarantee.',
    'rAF and Long Tasks describe the top frame. Opaque SVG/GPU time is not completely represented by main-target CDP metrics.',
    'Automation wall times include Playwright overhead; Event Timing samples are not a field INP score.',
    'Heap/DOM snapshots and explicit worker/object-URL counters are diagnostics, not proof of a memory leak or GPU allocation.',
    'Object-URL blob bytes are compressed/encoded Blob sizes, not decoded pixel or GPU memory.',
    'Typing uses a fixed text frame; automatic text fitting is not covered by that timing.',
    'The isolated fixture follows the existing component-benchmark build; application-entry/wallet bundle optimizations are not evaluated.',
  ], workloads: [], editor: null };
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(output, 'source-manifest.json'), JSON.stringify(source, null, 2));
await save();
console.log(`Reception performance evidence: ${output}`);
const media = new Map();
for (const [name, file] of [
  ['eye.webp', 'public/assets/actors/abyssal_eye/full.webp'],
  ['reaper.webp', 'public/assets/actors/skull_reaper/full.webp'],
  ['nomad.svg', '../../nomad-webp-svg/NOMAD-animated.svg'],
]) {
  const bytes = await readFile(resolve(root, file));
  media.set(name, bytes);
  (report.media ||= []).push({ name, source: file, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const kind of RECEPTION_PERFORMANCE_CASES) receptionPerformanceDocument(kind, 'https://127.0.0.1:12345');

// Short-lived, untrusted loopback TLS identity only. Never install a certificate
// or alter OS/browser trust. Its private key is never exposed by the file server.
const keyPath = resolve(output, 'loopback.key'), certPath = resolve(output, 'loopback.pem');
const configPath = resolve(output, 'loopback.cnf');
await writeFile(configPath, '[req]\nprompt=no\ndistinguished_name=dn\n[dn]\nCN=127.0.0.1\n');
let openssl = process.env.INSCAPE_PERF_OPENSSL || 'openssl';
if (!process.env.INSCAPE_PERF_OPENSSL && process.platform === 'win32') {
  const gitCore = execFileSync('git', ['--exec-path'], { encoding: 'utf8', windowsHide: true }).trim();
  openssl = resolve(gitCore, '../../../usr/bin/openssl.exe');
}
execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-config', configPath, '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', keyPath, '-out', certPath],
{ cwd: root, windowsHide: true, stdio: 'pipe' });
await build({ configFile: false, publicDir: false, logLevel: 'error',
  plugins: [react(), excludeUnsupportedWalletConnectorsPlugin()],
  define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify(report.git.commit || 'development') },
  build: { outDir: dist, emptyOutDir: true, manifest: true, sourcemap: true, minify: 'terser', terserOptions: { maxWorkers: 4, compress: { passes: 2 } },
    rollupOptions: { input: 'browser-tests/reception-performance-fixture.html', output: {
      onlyExplicitManualChunks: true, hoistTransitiveImports: false,
      manualChunks: id => id.replaceAll('\\', '/').includes('/node_modules/lucide-react/') ? 'interface-icons' : undefined,
    } } } });
if (prepareOnly) {
  report.status = 'prepared'; report.finishedAt = new Date().toISOString(); await save();
  console.log('Validated all three workloads and compiled the production fixture. No browser measurements performed.');
} else {
  let server, browser, interrupted = false;
  const stop = () => { interrupted = true; void browser?.close().catch(() => {}); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const cache = new Map(), serverTraffic = { responses: 0, bodyBytes: 0 };
  const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const serve = async (request, response) => {
    try {
      let bodyBytes = 0;
      response.once('finish', () => { serverTraffic.responses++; serverTraffic.bodyBytes += bodyBytes; });
      if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'https://127.0.0.1').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      if (pathname === ARTWORK_DOCUMENT_PATH) { bodyBytes = Buffer.byteLength(ARTWORK_DOCUMENT_HTML); response.writeHead(200, ARTWORK_DOCUMENT_HEADERS); response.end(ARTWORK_DOCUMENT_HTML); return; }
      let entry = cache.get(pathname);
      if (!entry) {
        let bytes, extension = extname(pathname);
        if (/^\/__perf-media\/nomad-[0-5]\.svg$/u.test(pathname)) bytes = media.get('nomad.svg');
        else if (pathname === '/__perf-media/eye.webp') bytes = media.get('eye.webp');
        else if (pathname === '/__perf-media/reaper.webp') bytes = media.get('reaper.webp');
        else {
          for (const base of [dist, resolve(root, 'public')]) {
            const file = resolve(base, pathname.replace(/^\/+/, ''));
            if (!file.startsWith(base + sep)) continue;
            try { if ((await stat(file)).isFile()) { bytes = await readFile(file); break; } } catch {}
          }
        }
        if (!bytes) { response.writeHead(404); response.end('Not found'); return; }
        const compressed = ['.js', '.css', '.html', '.svg'].includes(extension);
        entry = { bytes: compressed ? gzipSync(bytes) : bytes, headers: {
          'Content-Type': types[extension] || 'application/octet-stream',
          'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
          ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
        } };
        cache.set(pathname, entry);
      }
      bodyBytes = entry.bytes.length;
      response.writeHead(200, { ...entry.headers, 'Content-Length': entry.bytes.length }); response.end(entry.bytes);
    } catch (error) { response.writeHead(500); response.end('Fixture server failed'); console.error(error.message); }
  };
  try {
    server = createServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, serve);
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
    const origin = `https://127.0.0.1:${server.address().port}`;
    const { chromium } = await import('playwright-core');
    const { browserExecutable } = await import('../scripts/browserEnvironment.mjs');
    browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    report.browser = { version: browser.version(), executable: browserExecutable, playwright: JSON.parse(await readFile(resolve(root, 'node_modules/playwright-core/package.json'))).version };
    const browserCdp = await browser.newBrowserCDPSession();
    try { report.gpu = (await browserCdp.send('SystemInfo.getInfo')).gpu; } catch (error) { report.gpuUnavailable = error.message; }
    report.status = 'running'; await save();
    const contexts = new Set();
    const newPage = async () => {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1,
        ignoreHTTPSErrors: true, reducedMotion: 'no-preference' });
      contexts.add(context);
      await context.addInitScript(installReceptionPerformanceProbe);
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = [], unexpectedRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/^https?:/u.test(request.url()) && new URL(request.url()).origin !== origin) unexpectedRequests.push(request.url()); });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable'); await cdp.send('Network.enable');
      const network = { requests: 0, encodedBytes: 0, cacheResponses: 0, failed: [], httpErrors: [] }, cached = new Set();
      cdp.on('Network.requestWillBeSent', event => { if (/^https?:/u.test(event.request.url)) network.requests++; });
      cdp.on('Network.loadingFinished', event => { network.encodedBytes += event.encodedDataLength || 0; });
      const cacheHit = id => { if (!cached.has(id)) { cached.add(id); network.cacheResponses++; } };
      cdp.on('Network.requestServedFromCache', event => cacheHit(event.requestId));
      cdp.on('Network.responseReceived', event => {
        if (event.response.fromDiskCache || event.response.fromServiceWorker) cacheHit(event.requestId);
        if (event.response.status >= 400) network.httpErrors.push({ url: event.response.url, status: event.response.status });
      });
      cdp.on('Network.loadingFailed', event => { if (!event.canceled) network.failed.push(event.errorText); });
      return { context, page, cdp, errors, unexpectedRequests, network };
    };
    const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolveFrames => requestAnimationFrame(() => requestAnimationFrame(resolveFrames))); });
    const ready = async (page, count) => {
      await page.waitForFunction(count => window.receptionPerf?.count === count && document.querySelectorAll('.reception-image').length === count, count);
      await page.waitForFunction(() => !document.querySelector('.artwork-svg-status, [data-media-state="loading"], [data-media-state="failed"]'));
      // Playwright's network-idle heuristic includes opaque/blob document work
      // and is not an application-ready signal for live SVGs. Require the real
      // media states and fonts instead, with the same settling pause in each run.
      // Do not set serviceWorkers:'block': Playwright injects an unguarded
      // navigator.serviceWorker read into opaque frames, where that getter throws.
      // The production SVG sandbox/CSP still prohibits service-worker access.
      await settle(page); await page.waitForTimeout(500);
    };
    const measure = async (entry, name, action) => {
      const before = await metrics(entry.cdp);
      const trafficBefore = { ...serverTraffic };
      await entry.page.evaluate(() => window.receptionPerformanceProbe.start());
      const result = await action(); await settle(entry.page);
      const sample = await entry.page.evaluate(() => window.receptionPerformanceProbe.stop());
      const after = await metrics(entry.cdp);
      const times = ['LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration'];
      const counts = ['LayoutCount', 'RecalcStyleCount'];
      return { name, durationMs: sample.end - sample.start, result,
        loopbackTraffic: { responses: serverTraffic.responses - trafficBefore.responses, bodyBytes: serverTraffic.bodyBytes - trafficBefore.bodyBytes },
        frameIntervalsMs: distribution(sample.intervals), gapsOver32ms: sample.intervals.filter(value => value > 32).length,
        longTaskMs: distribution(sample.longTasks.map(item => item.duration)),
        topFrameBlockingMs: sample.longTasks.reduce((sum, item) => sum + Math.max(0, item.duration - 50), 0),
        eventTimingMs: distribution(sample.events.map(item => item.duration)),
        cdpDurationsMs: Object.fromEntries(times.map(key => [key, 1000 * (after[key] - before[key])])),
        cdpCounts: Object.fromEntries(counts.map(key => [key, after[key] - before[key]])),
        heapBefore: before.JSHeapUsedSize, heapAfter: after.JSHeapUsedSize, resources: sample.resources };
    };
    const artworkClick = async page => {
      await page.locator('[data-cell-group="shape:perf-0"]').click();
      assert.equal(await page.getByRole('dialog').count(), 0, 'introductory artwork stays passive');
    };
    const memory = async entry => {
      await entry.cdp.send('HeapProfiler.collectGarbage');
      return { cdp: await metrics(entry.cdp), dom: await entry.cdp.send('Memory.getDOMCounters'),
        host: await entry.page.evaluate(() => window.receptionPerformanceProbe.resources()), frameCount: entry.page.frames().length };
    };
    const svgClocks = async page => {
      const clocks = [];
      for (const frame of page.frames()) {
        const clock = await frame.evaluate(() => {
          const stage = document.getElementById('stage');
          return stage ? { ready: stage.dataset.ready, error: stage.dataset.error, time: Number(stage.dataset.time || 0),
            canvases: [...document.querySelectorAll('canvas')].map(node => ({ width: node.width, height: node.height })) } : null;
        }).catch(() => null);
        if (clock) clocks.push({ frame: frame.url(), ...clock });
      }
      return clocks;
    };
    for (const kind of selectedWorkloads) {
      if (interrupted) throw Error('Interrupted');
      const record = { kind, status: 'running', loads: [], phases: [] }; report.workloads.push(record); await save();
      let entry;
      try {
        const count = kind === 'raster-14' ? 14 : kind === 'svg-6' ? 6 : 16;
        for (let run = 0; run < runs; run++) {
          if (entry) { await entry.context.close(); contexts.delete(entry.context); }
          entry = await newPage();
          for (const cacheState of ['cold', 'warm']) {
            const before = { ...entry.network };
            const trafficBefore = { ...serverTraffic };
            if (cacheState === 'cold') await entry.page.goto(`${origin}/browser-tests/reception-performance-fixture.html?case=${kind}`);
            else await entry.page.reload();
            await ready(entry.page, count);
            record.loads.push({ run, cache: cacheState, load: await entry.page.evaluate(() => window.receptionPerformanceProbe.loadStats()),
              loopbackTraffic: { responses: serverTraffic.responses - trafficBefore.responses, bodyBytes: serverTraffic.bodyBytes - trafficBefore.bodyBytes },
              requests: entry.network.requests - before.requests, encodedBytes: entry.network.encodedBytes - before.encodedBytes,
              cacheResponses: entry.network.cacheResponses - before.cacheResponses });
          }
          console.log(`${kind}: cold/warm ${run + 1}/${runs}`); await save();
        }
        const original = await entry.page.evaluate(() => window.receptionPerf.snapshot());
        record.observers = await entry.page.evaluate(() => window.receptionPerformanceProbe.supported);
        record.memoryMounted = await memory(entry);
        if (kind === 'svg-6') record.svgBeforeIdle = await svgClocks(entry.page);
        record.phases.push(await measure(entry, 'idle-2s', () => entry.page.waitForTimeout(2000)));
        if (kind === 'svg-6') {
          record.svgAfterIdle = await svgClocks(entry.page);
          assert.equal(record.svgBeforeIdle.length, 6, 'All six original SVG applications must be present');
          assert.equal(record.svgAfterIdle.length, 6);
          for (const clock of record.svgAfterIdle) {
            const before = record.svgBeforeIdle.find(item => item.frame === clock.frame);
            assert.equal(clock.ready, 'true', 'The embedded Nomad renderer must be ready');
            assert.equal(clock.error, undefined);
            assert.ok(before && clock.time > before.time, 'Every visible Nomad animation must advance');
          }
        }
        record.phases.push(await measure(entry, 'viewport-resize-10s', async () => {
          const start = Date.now(); let updates = 0;
          while (Date.now() - start < 10000) {
            await entry.page.setViewportSize({ width: Math.round(1000 + 600 * Math.cos((Date.now() - start) / 10000 * Math.PI * 6)), height: 1000 });
            updates++; await entry.page.waitForTimeout(80);
          }
          await entry.page.setViewportSize({ width: 1600, height: 1000 }); await ready(entry.page, count);
          return { updates };
        }));
        record.phases.push(await measure(entry, 'ten-narrow-wide-cycles', async () => {
          for (let cycle = 0; cycle < 10; cycle++) for (const width of [390, 1600]) {
            await entry.page.setViewportSize({ width, height: 1000 }); await settle(entry.page);
          }
          await ready(entry.page, count);
          return { cycles: 10 };
        }));
        await entry.page.evaluate(() => { window.perfOriginalFrames = [...document.querySelectorAll('iframe')]; });
        record.phases.push(await measure(entry, 'ten-artwork-clicks', async () => {
          for (let cycle = 0; cycle < 10; cycle++) await artworkClick(entry.page);
          return { cycles: 10 };
        }));
        record.sameOuterFrames = await entry.page.evaluate(() => {
          const now = [...document.querySelectorAll('iframe')], before = window.perfOriginalFrames;
          delete window.perfOriginalFrames;
          return before.length === now.length && before.every((node, index) => node === now[index]);
        });
        assert.ok(record.sameOuterFrames, 'Artwork clicks must retain outer SVG frame identity');
        assert.deepEqual(await entry.page.evaluate(() => window.receptionPerf.snapshot()), original, 'Reader actions cannot edit the document');
        if (kind === 'svg-6') {
          record.svgAfterInteractions = await svgClocks(entry.page);
          assert.equal(record.svgAfterInteractions.length, 6);
          for (const clock of record.svgAfterInteractions) {
            assert.equal(clock.ready, 'true'); assert.equal(clock.error, undefined);
            assert.ok(clock.time > record.svgAfterIdle.find(item => item.frame === clock.frame)?.time,
              'The same original animation must still advance after resize and artwork clicks');
          }
        }
        if (kind === 'svg-6') {
          // A separate diagnostic repeat avoids adding tracing overhead to the
          // baseline samples above. Browser tracing also includes child renderers.
          const events = []; let count = 0, tracing = false;
          const collect = chunk => { count += chunk.value.length; if (count <= 200000) events.push(...chunk.value); };
          browserCdp.on('Tracing.dataCollected', collect);
          try {
            await browserCdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReportEvents' });
            tracing = true;
            await artworkClick(entry.page);
            let timer;
            const complete = new Promise((resolveTrace, reject) => {
              timer = setTimeout(() => reject(Error('Trace completion deadline exceeded')), 15000);
              browserCdp.once('Tracing.tracingComplete', resolveTrace);
            });
            try { await browserCdp.send('Tracing.end'); tracing = false; await complete; }
            finally { clearTimeout(timer); }
            record.trace = { file: 'svg-artwork-click-trace.json.gz', events: count, truncated: count > 200000 };
            await writeFile(resolve(output, record.trace.file), gzipSync(JSON.stringify({ traceEvents: events })));
          } finally {
            if (tracing) await browserCdp.send('Tracing.end').catch(() => {});
            browserCdp.off('Tracing.dataCollected', collect);
          }
        }
        await entry.page.screenshot({ path: resolve(output, `${kind}.png`) });
        await entry.page.evaluate(() => window.receptionPerf.mount('none'));
        await entry.page.waitForFunction(() => document.documentElement.dataset.perfMode === 'none');
        await entry.page.waitForTimeout(1500);
        record.memoryUnmounted = await memory(entry);
        assert.equal(record.memoryUnmounted.host.iframes, 0);
        assert.deepEqual(entry.errors, []); assert.deepEqual(entry.unexpectedRequests, []);
        assert.deepEqual(entry.network.failed, []); assert.deepEqual(entry.network.httpErrors, []);
        record.status = 'passed';
      } catch (error) {
        record.status = 'failed'; record.error = error.stack;
        if (entry) await entry.page.screenshot({ path: resolve(output, `${kind}-failure.png`) }).catch(() => {});
      } finally {
        if (entry) { record.pageErrors = entry.errors; record.unexpectedRequests = entry.unexpectedRequests; record.network = entry.network; await entry.context.close(); contexts.delete(entry.context); }
        await save();
      }
    }
    const entry = await newPage();
    report.editor = { status: 'running', phases: [] }; await save();
    try {
      await entry.page.goto(`${origin}/browser-tests/reception-performance-fixture.html?case=mixed-16`);
      await ready(entry.page, 16);
      await entry.page.evaluate(() => window.receptionPerf.mount('editor'));
      await entry.page.locator('main[data-reception-editor]').waitFor();
      await setEditorSidebarOpen(entry.page, false);
      const cell = entry.page.getByRole('group', { name: 'Study 1 bento cell', exact: true });
      await cell.focus(); await cell.press('Enter');
      const body = entry.page.getByRole('textbox', { name: 'Article text', exact: true }).first();
      await body.focus(); await body.press('Control+Home');
      const text = 'measurement '.repeat(20).slice(0, 200);
      report.editor.phases.push(await measure(entry, 'type-200-characters', async () => {
        await entry.page.keyboard.type(text, { delay: 10 });
        await entry.page.locator('main[data-reception-editor]').focus();
        await entry.page.waitForFunction(text => window.receptionPerf.snapshot().texts[0].article.content.content[0].content.some(node => node.text?.includes(text)), text);
        return { characters: text.length, delayMs: 10 };
      }));
      await entry.page.getByRole('button', { name: 'Back to cells', exact: true }).click();
      const beforeDrag = await entry.page.evaluate(() => window.receptionPerf.snapshot());
      await entry.page.locator('[data-editor-cell-surface]').first().click();
      const divider = entry.page.getByRole('button', { name: 'Resize cell right', exact: true });
      await divider.scrollIntoViewIfNeeded(); const box = await divider.boundingBox();
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      report.editor.phases.push(await measure(entry, 'cell-resize-10s', async () => {
        await entry.page.mouse.move(point.x, point.y); await entry.page.mouse.down();
        const start = Date.now(); let updates = 0;
        try {
          while (Date.now() - start < 10000) {
            await entry.page.mouse.move(point.x + 20 * Math.sin((Date.now() - start) / 1000), point.y);
            updates++; await entry.page.waitForTimeout(16);
          }
          await entry.page.mouse.move(point.x + 20, point.y);
        } finally { await entry.page.mouse.up(); }
        return { updates };
      }));
      assert.notDeepEqual(await entry.page.evaluate(() => window.receptionPerf.snapshot()), beforeDrag);
      await editorCommand(entry.page, 'Edit', 'Undo');
      assert.deepEqual(await entry.page.evaluate(() => window.receptionPerf.snapshot()), beforeDrag, 'One Undo must restore the completed cell resize');
      report.editor.beforePreview = await entry.page.evaluate(() => window.receptionPerformanceProbe.resources());
      await editorCommand(entry.page, 'Canvas', 'Preview');
      await entry.page.getByRole('region', { name: 'Studio responsive preview', exact: true }).waitFor();
      report.editor.duringPreview = await entry.page.evaluate(() => window.receptionPerformanceProbe.resources());
      report.editor.phases.push(await measure(entry, 'editor-preview-idle-2s', () => entry.page.waitForTimeout(2000)));
      report.editor.settledPreview = await entry.page.evaluate(() => window.receptionPerformanceProbe.resources());
      await entry.page.getByRole('button', { name: 'Back to editing', exact: true }).click();
      report.editor.afterPreview = await entry.page.evaluate(() => window.receptionPerformanceProbe.resources());
      assert.deepEqual(await entry.page.evaluate(() => window.receptionPerf.snapshot()), beforeDrag, 'Preview must not edit the saved document');
      // Keep the CPU profiler out of baseline timings. This dedicated repeat
      // permits source-map attribution of the measured typing hot path.
      await cell.focus(); await cell.press('Enter');
      const profileBody = entry.page.getByRole('textbox', { name: 'Article text', exact: true }).first();
      await profileBody.focus(); await profileBody.press('Control+Home');
      await entry.cdp.send('Profiler.enable');
      await entry.cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
      await entry.cdp.send('Profiler.start');
      const profileStart = Date.now();
      try {
        await entry.page.keyboard.type(text, { delay: 10 });
        await entry.page.locator('main[data-reception-editor]').focus(); await settle(entry.page);
      } finally {
        const { profile } = await entry.cdp.send('Profiler.stop');
        await writeFile(resolve(output, 'editor-typing.cpuprofile'), JSON.stringify(profile));
        report.editor.typingProfile = { file: 'editor-typing.cpuprofile', characters: text.length,
          samplingIntervalUs: 1000, wallMs: Date.now() - profileStart, separateFromBaseline: true };
      }
      assert.deepEqual(entry.errors, []);
      report.editor.status = 'passed';
    } catch (error) {
      report.editor.status = 'failed'; report.editor.error = error.stack;
      await entry.page.screenshot({ path: resolve(output, 'editor-failure.png') }).catch(() => {});
    } finally { report.editor.pageErrors = entry.errors; await entry.context.close(); contexts.delete(entry.context); await save(); }
    for (const context of contexts) await context.close();
    assert.equal((await sourceInventory(root)).sha256, report.sourceSha256, 'Source changed during measurements');
    report.status = !interrupted && report.workloads.every(item => item.status === 'passed') && report.editor.status === 'passed' ? 'passed' : 'failed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; }
  finally {
    if (browser) await browser.close().catch(error => { report.cleanupError = error.message; report.status = 'failed'; });
    if (server) { server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose)); }
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    report.finishedAt = new Date().toISOString(); await save();
  }
  console.log(`Performance run ${report.status}. Report: ${resolve(output, 'report.json')}`);
  if (report.status !== 'passed') process.exitCode = 1;
}
