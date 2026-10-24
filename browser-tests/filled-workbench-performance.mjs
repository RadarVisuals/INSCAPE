// Explicit, local benchmark. Not part of the fast functional test suite.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { excludeUnsupportedWalletConnectorsPlugin } from '../scripts/unsupportedWalletConnectors.js';
import { pathToFileURL } from 'node:url';
import { svgStudy } from './fixtures/animation-study.mjs';
import { nomadStudy } from './fixtures/nomad-study.mjs';
import { nomadExport } from './fixtures/nomad-exports.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const output = path.resolve(process.env.INSCAPE_PERF_OUTPUT || '.browser-test-runtime/filled-workbench-performance');
const runs = Number(process.env.INSCAPE_PERF_RUNS || 3);
const dist = path.join(output, 'dist');
// A saved source map permits repeatable before/after builds without replacing
// anyone's working files. Both builds use this identical workload and sampler.
const baseline = process.env.INSCAPE_PERF_BASELINE ? JSON.parse(await readFile(process.env.INSCAPE_PERF_BASELINE, 'utf8')) : {};
const { ARTWORK_DOCUMENT_PATH, ARTWORK_DOCUMENT_HEADERS, ARTWORK_DOCUMENT_HTML } = await import(
  baseline['scripts/artworkDocumentHost.js'] ? pathToFileURL(path.resolve(baseline['scripts/artworkDocumentHost.js'])).href : '../scripts/artworkDocumentHost.js');
await mkdir(output, { recursive: true });
await build({ configFile: false, logLevel: 'error', publicDir: false,
  plugins: [{ name: 'saved-performance-baseline', enforce: 'pre', async load(id) {
    const file = baseline[path.relative(process.cwd(), id).replaceAll('\\', '/')];
    return file ? readFile(file, 'utf8') : null;
  } }, react(), excludeUnsupportedWalletConnectorsPlugin()],
  define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify('local-performance-study') },
  build: { outDir: dist, emptyOutDir: true, sourcemap: true, rollupOptions: { input: 'browser-tests/filled-workbench-performance-fixture.html' } } });
const layered = await readFile('browser-tests/fixtures/keeper-layered.svg', 'utf8');
const study = process.env.INSCAPE_PERF_SUITE === 'svg';
const exportStudy = process.env.INSCAPE_PERF_SUITE === 'nomad-exports';
const nomad = exportStudy || process.env.INSCAPE_PERF_SUITE === 'nomad';
const nomadPath = process.env.INSCAPE_PERF_NOMAD_SOURCE || '../../nomad-webp-svg/NOMAD-animated.svg';
const nomadSource = nomad ? await readFile(nomadPath, 'utf8') : '';
const diagnostic = nomad && process.env.INSCAPE_PERF_DIAGNOSTIC === '1';
const traceNavigation = diagnostic && process.env.INSCAPE_PERF_TRACE === '1';
const profileNavigation = diagnostic && process.env.INSCAPE_PERF_PROFILE !== '0';
const webp = study ? await readFile('.browser-test-runtime/svg-animation-study/media/loop.svg', 'utf8') : '';
const panel = animated => '<!doctype html><html><style>body{margin:0;background:#273c43;color:#edd7b3;font:20px sans-serif;overflow:hidden}h1{font-size:20px;padding:24px}#shape{position:absolute;width:130px;height:130px;border-radius:50%;background:#c88863;top:120px;left:100px}</style><h1>Motion study</h1><div id="shape"></div>' +
  (animated ? '<script>window.perfTicks=0;function tick(t){window.perfTicks++;document.getElementById("shape").style.transform="translateX("+Math.sin(t/750)*75+"px)";requestAnimationFrame(tick)}requestAnimationFrame(tick)</script>' : '');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === ARTWORK_DOCUMENT_PATH) { response.writeHead(200, ARTWORK_DOCUMENT_HEADERS); response.end(ARTWORK_DOCUMENT_HTML); return; }
  if (url.pathname === '/__perf-nomad.svg') {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' });
    if (exportStudy) { response.end(await nomadExport(url.searchParams.get('variant'), { active: url.searchParams.get('active') === '1' })); return; }
    response.end(nomadStudy(nomadSource, { fps: Number(url.searchParams.get('fps') || 0),
      active: url.searchParams.get('active') === '1', oversample: Number(url.searchParams.get('oversample') || 1.5), startupProbe: diagnostic })); return;
  }
  if (url.pathname === '/__perf-layered.svg') {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' });
    const mode = url.searchParams.get('mode') || 'static';
    response.end(mode === 'webp' ? webp : svgStudy(layered, { mode, fps: Number(url.searchParams.get('fps') || 0), legacy: url.searchParams.get('legacy') === '1' })); return;
  }
  const name = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  for (const base of [dist, path.resolve('public')]) {
    const target = path.resolve(base, name);
    if (!target.startsWith(base + path.sep)) continue;
    try { const bytes = await readFile(target); response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' }); response.end(bytes); return; } catch {}
  }
  response.writeHead(404); response.end('Not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const browserCdp = await browser.newBrowserCDPSession();
const cases = (exportStudy ? ['full', 'half', 'quarter', 'vector', 'loop'].flatMap(nomadVariant => [1, 4].map(nomadActive => ({
  name: `export-${nomadVariant}-${nomadActive}`, size: 'filled', count: 8, htmlAnimated: 0, nomad: 1,
  nomadVariant, nomadActive, svgFps: 60,
}))) : nomad ? [
  { name: 'nomad-paused', nomadActive: 0 },
  ...[1, 4].flatMap(nomadActive => [0, 60, 30].map(svgFps =>
    ({ name: `nomad-${nomadActive}-${svgFps || 'uncapped'}`, nomadActive, svgFps }))),
  { name: 'nomad-4-60-native', nomadActive: 4, svgFps: 60, oversample: 1 },
].map(item => ({ size: 'filled', count: 8, htmlAnimated: 0, nomad: 1, ...item })) : study ? [
  { name: 'static', svgMode: 'static' },
  { name: 'html-only', svgMode: 'static', htmlAnimated: 1 },
  { name: 'svg-uncapped', svgMode: 'raf' },
  { name: 'svg-60', svgMode: 'raf', svgFps: 60 },
  { name: 'svg-30', svgMode: 'raf', svgFps: 30 },
  { name: 'css-30', svgMode: 'css', svgFps: 30 },
  { name: 'webp-30', svgMode: 'webp', svgFps: 30 },
  { name: 'mixed-uncapped', svgMode: 'raf', htmlAnimated: 1 },
  { name: 'mixed-30', svgMode: 'raf', svgFps: 30, htmlAnimated: 1 },
  ...(process.env.INSCAPE_PERF_CASE === 'mixed-css-30' ? [{ name: 'mixed-css-30', svgMode: 'css', svgFps: 30, htmlAnimated: 1 }] : []),
  ...(process.env.INSCAPE_PERF_CASE === 'legacy-selector' ? [{ name: 'legacy-selector', svgMode: 'raf', htmlAnimated: 1, legacy: 1 }] : []),
  ...(process.env.INSCAPE_PERF_CASE === 'css-60' ? [{ name: 'css-60', svgMode: 'css', svgFps: 60 }] : []),
  ...(process.env.INSCAPE_PERF_CASE === 'mixed-css-60' ? [{ name: 'mixed-css-60', svgMode: 'css', svgFps: 60, htmlAnimated: 1 }] : []),
].map(item => ({ size: 'filled', count: 8, htmlAnimated: 0, ...item })) : [
  { name: 'small-static-2', size: 'small', animated: 0, count: 2 },
  { name: 'filled-static-2', size: 'filled', animated: 0, count: 2 },
  { name: 'filled-animated-2', size: 'filled', animated: 1, count: 2 },
  { name: 'filled-animated-8', size: 'filled', animated: 1, count: 8 },
]).filter(item => !process.env.INSCAPE_PERF_CASE || item.name === process.env.INSCAPE_PERF_CASE);
const results = [];
const processCpu = async () => (await browserCdp.send('SystemInfo.getProcessInfo')).processInfo;
const cpuDelta = (a, b) => {
  const values = {};
  for (const item of b) {
    const before = a.find(p => p.id === item.id);
    if (before) values[item.type] = (values[item.type] || 0) + (item.cpuTime - before.cpuTime) * 1000;
  }
  return values;
};
const quantiles = values => {
  const sorted = values.toSorted((a, b) => a - b);
  const at = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
  return { n: sorted.length, p50: at(.5), p95: at(.95), max: at(1) };
};
async function zoom(page, target) {
  const host = page.locator('main.system-workflow');
  for (let i = 0; i < 24; i++) {
    const current = parseFloat(await page.locator('.navigator-zoom output').textContent()) / 100;
    if (Math.abs(current - target) < .006) return;
    await host.dispatchEvent('wheel', { deltaY: Math.max(-100, Math.min(100, -Math.log(target / current) / .003)),
      ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
    await page.waitForTimeout(75);
  }
  throw new Error('Zoom did not reach ' + target);
}
async function frameState(page) {
  const states = [];
  for (const frame of page.frames().slice(1)) {
    try { states.push(await frame.evaluate(() => ({ url: location.href, ticks: window.perfTicks || 0,
      mode: window.perfMode, targets: window.perfTargetCount, callbacks: window.perfCallbacks,
      animations: document.getAnimations().map(a => ({ time: a.currentTime, state: a.playState })),
      transforms: [...document.querySelectorAll('g[data-center-x]')].map(n => getComputedStyle(n).transform),
      blobs: [...document.querySelectorAll('svg image')].filter(n => n.href.baseVal.startsWith('blob:')).length,
      invalidTransforms: [...document.querySelectorAll('[transform]')].filter(n => /undefined|NaN/.test(n.getAttribute('transform'))).length,
      svg: document.querySelectorAll('svg image').length, ready: document.readyState,
      nomad: window.nomadPerf?.snapshot() }))); } catch {}
  }
  return states;
}
try {
  for (let run = 1; run <= runs; run++) for (const testCase of (run % 2 ? cases : cases.toReversed())) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [], failedLocalRequests = [], frameLifecycle = [];
    if (diagnostic) {
      for (const event of ['frameattached', 'framenavigated', 'framedetached']) page.on(event, frame =>
        frameLifecycle.push({ event, ms: performance.now(), url: frame.url() }));
    }
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) failedLocalRequests.push(response.url()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'workbench-perf.invalid') {
        if (url.pathname === '/panel.html') return route.fulfill({ contentType: 'text/html', body: panel(url.searchParams.get('animated') === '1') });
        const response = await route.fetch({ url: origin + url.pathname + url.search });
        return route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
      }
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.addInitScript(recordTimeline => {
      window.bench = { active: false, frames: [], tasks: [], artworkTasks: [], artworkEvents: [], longFrames: [], geometry: { calls: 0, ms: 0 } };
      // Measure only the containing page's SVG projection reads, not the
      // artwork's own drawing. Identical instrumentation in before/after runs.
      if (window === window.top) {
        if (recordTimeline && PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
          new PerformanceObserver(list => {
            if (bench.active) bench.longFrames.push(...list.getEntries().map(entry => entry.toJSON()));
          }).observe({ type: 'long-animation-frame' });
        }
        const getScreenCTM = SVGGraphicsElement.prototype.getScreenCTM;
        SVGGraphicsElement.prototype.getScreenCTM = function (...args) {
          if (!bench.active) return getScreenCTM.apply(this, args);
          const start = performance.now();
          try { return getScreenCTM.apply(this, args); }
          finally { bench.geometry.calls++; bench.geometry.ms += performance.now() - start; }
        };
        addEventListener('message', event => {
          // Descendant tasks can also be reported by their containing document.
          // Compare the maximum reported stall; do not sum/count these as unique tasks.
          if (bench.active && event.data?.type === 'inscape:perf-artwork-long-task') bench.artworkTasks.push(event.data.ms);
          if (bench.active && ['inscape:perf-artwork-long-task', 'inscape:perf-nomad-startup'].includes(event.data?.type)) bench.artworkEvents.push(event.data);
        });
      }
      new PerformanceObserver(list => {
        if (bench.active) bench.tasks.push(...list.getEntries().map(entry => entry.duration));
        if (window !== window.top) for (const entry of list.getEntries())
          top.postMessage({ type: 'inscape:perf-artwork-long-task', ms: entry.duration,
            start: performance.timeOrigin + entry.startTime, document: location.href }, '*');
      }).observe({ type: 'longtask', buffered: false });
    }, diagnostic);
    const url = origin + '/browser-tests/filled-workbench-performance-fixture.html?' + new URLSearchParams(testCase);
    const start = performance.now();
    await page.goto(url);
    const selector = page.getByRole('combobox', { name: 'Active Workbench' });
    try { await selector.waitFor(); } catch (error) {
      await writeFile(path.join(output, 'failure.txt'), JSON.stringify({ errors, failedLocalRequests, body: await page.locator('body').innerText() }, null, 2));
      throw error;
    }
    await page.locator('.text-window').first().waitFor();
    const coldReadyMs = performance.now() - start;
    const closeTools = page.getByRole('button', { name: 'Close Text tools', exact: true });
    if (await closeTools.isVisible()) await closeTools.click();
    await page.waitForTimeout(1500);
    const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const phases = [];
    async function measure(name, action) {
      const artworkBefore = nomad ? await frameState(page) : [];
      const before = await metrics(), cpuBefore = await processCpu();
      await page.evaluate(() => {
        bench.frames = []; bench.tasks = []; bench.artworkTasks = []; bench.artworkEvents = []; bench.longFrames = []; bench.geometry = { calls: 0, ms: 0 }; bench.active = true; bench.start = performance.now(); workbenchPerf.resetSamples();
        let previous;
        const tick = t => { if (previous !== undefined) bench.frames.push(t - previous); previous = t; bench.frameId = requestAnimationFrame(tick); };
        bench.frameId = requestAnimationFrame(tick);
      });
      await action();
      const samples = await page.evaluate(() => {
        bench.active = false; cancelAnimationFrame(bench.frameId);
        return { durationMs: performance.now() - bench.start, frames: bench.frames, tasks: bench.tasks, artworkTasks: bench.artworkTasks, artworkEvents: bench.artworkEvents, longFrames: bench.longFrames, geometry: bench.geometry,
          writes: workbenchPerf.writes, inputPaint: workbenchPerf.inputPaint,
          domNodes: document.querySelectorAll('*').length, textWindows: document.querySelectorAll('.text-window').length,
          iframes: document.querySelectorAll('iframe').length,
          images: [...document.images].map(i => ({ ready: i.complete && i.naturalWidth > 0, source: i.currentSrc.startsWith('blob:') ? 'blob' : i.currentSrc })),
          camera: document.querySelector('[data-workbench-camera-scale]')?.dataset.workbenchCameraScale };
      });
      const after = await metrics(), cpuAfter = await processCpu();
      const artworkAfter = nomad ? await frameState(page) : [];
      const phase = { name, durationMs: samples.durationMs, frameMs: quantiles(samples.frames), geometry: samples.geometry,
        framesOver25: samples.frames.filter(t => t > 25).length, framesOver50: samples.frames.filter(t => t > 50).length,
        longTasks: samples.tasks, artworkLongTasks: samples.artworkTasks, inputToRafMs: quantiles(samples.inputPaint), storageWriteMs: quantiles(samples.writes.map(w => w.ms)),
        ...(diagnostic ? { artworkEvents: samples.artworkEvents, longFrames: samples.longFrames } : {}),
        storageChars: samples.writes.at(-1)?.bytes, domNodes: samples.domNodes, textWindows: samples.textWindows, iframes: samples.iframes,
        images: samples.images.length, imagesReady: samples.images.filter(i => i.ready).length,
        camera: samples.camera, heapUsedMiB: after.JSHeapUsedSize / 1024 ** 2,
        mainThreadMs: Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(key => [key, (after[key] - before[key]) * 1000])),
        processCpuMs: cpuDelta(cpuBefore, cpuAfter),
        ...(nomad ? { nomads: artworkAfter.filter(s => s.nomad).map(s => {
          const previous = artworkBefore.find(p => p.url === s.url)?.nomad, next = s.nomad;
          if (!previous) return { newFrame: true, ...next };
          const seconds = (next.now - previous.now) / 1000;
          return { ...next, updatesPerSecond: (next.paints - previous.paints) / seconds,
            callbacksPerSecond: (next.callbacks - previous.callbacks) / seconds,
            clockRatio: (next.state.time - previous.state.time) / seconds,
            drawSubmitMs: next.drawMs - previous.drawMs,
            newUploads: next.uploads - previous.uploads, newAllocations: next.allocations - previous.allocations,
            paintIntervals: quantiles(next.stamps.filter(t => t >= previous.now).slice(1).map((t, i) => t - next.stamps.filter(t => t >= previous.now)[i])) };
        }) } : {}) };
      phases.push(phase);
      console.log(JSON.stringify({ run, case: testCase.name, phase: name, frameP95: phase.frameMs.p95, frameMax: phase.frameMs.max,
        longTasks: phase.longTasks.length, cpuMs: Math.round(phase.mainThreadMs.TaskDuration), dom: phase.domNodes, frames: phase.iframes }));
      return phase;
    }
    const initial = await page.evaluate(() => ({ numbers: workbenchPerf.numbers, storageChars: workbenchPerf.initialBytes, record: workbenchPerf.record() }));
    await measure('idle-100', () => page.waitForTimeout(2200));
    if (run === 1) await page.screenshot({ path: path.join(output, testCase.name + '-100.png') });
    await zoom(page, .3); await page.waitForTimeout(1400);
    const allFramesBefore = await frameState(page);
    const overviewPhase = await measure('idle-30', () => page.waitForTimeout(2200));
    const allFramesAfter = await frameState(page);
    const paintWorkers = () => page.workers().filter(worker => worker.url().includes('imagePaint.worker')).length;
    const activePaintWorkers = paintWorkers();
    assert.ok(activePaintWorkers <= 1, 'mounted Image sides share at most one paint worker');
    const mode = testCase.svgMode || (testCase.animated ? 'raf' : 'static');
    let updateRates = [];
    if (nomad) {
      const frames = allFramesAfter.filter(f => f.nomad);
      assert.equal(frames.length, 4, 'all four real Nomad documents mounted at overview');
      assert.equal(frames.filter(f => f.nomad.running).length, testCase.nomadActive);
      for (const frame of frames) {
        const paths = testCase.nomadVariant === 'vector', loop = testCase.nomadVariant === 'loop';
        assert.equal(frame.nomad.status, 'ready'); assert.equal(frame.nomad.layers, paths ? 65 : loop ? 1 : 39);
        assert.equal(frame.nomad.uploads, paths || loop ? 0 : 39); assert.equal(frame.nomad.posterVisible, false);
      }
      for (const state of overviewPhase.nomads) {
        assert.equal(state.newUploads, 0); assert.equal(state.newAllocations, 0);
        if (!state.running) { assert.equal(state.updatesPerSecond, 0); continue; }
        assert.ok(state.clockRatio > .94 && state.clockRatio < 1.06, 'flight clock must retain real-time speed');
        if (testCase.svgFps) assert.ok(exportStudy ? state.updatesPerSecond > 0 && state.updatesPerSecond < testCase.svgFps + 6
          : Math.abs(state.updatesPerSecond - testCase.svgFps) < 6, 'requested drawing cap');
      }
      updateRates = overviewPhase.nomads.filter(s => s.running).map(s => ({ updatesPerSecond: s.updatesPerSecond, callbacksPerSecond: s.callbacksPerSecond }));
    } else {
    assert.equal(allFramesAfter.filter(frame => frame.svg === (mode === 'webp' ? 1 : 8)).length, testCase.size === 'small' ? 1 : 4, 'all SVGs render at 30%');
    const expectedJs = (mode === 'raf' ? 4 : 0) + ((testCase.htmlAnimated ?? testCase.animated) ? 2 : 0);
    assert.equal(allFramesAfter.filter(frame => frame.ticks > 0).length, expectedJs, 'only the expected JavaScript animations execute');
    for (const state of allFramesAfter.filter(f => f.mode === 'raf' || f.mode === 'css')) {
      assert.equal(state.targets, testCase.legacy ? 14 : 7, 'corrected animation targets only the seven pivoted groups');
      assert.equal(state.invalidTransforms, testCase.legacy ? 7 : 0, 'the diagnostic legacy case alone has invalid transforms');
      const before = allFramesBefore.find(f => f.url === state.url);
      assert.notDeepEqual(state.transforms, before.transforms, 'visible geometry must move');
    }
    updateRates = allFramesAfter.filter(f => f.mode === 'raf').map(state => {
      const before = allFramesBefore.find(f => f.url === state.url);
      return { updatesPerSecond: (state.ticks - before.ticks) * 1000 / overviewPhase.durationMs,
        callbacksPerSecond: (state.callbacks - before.callbacks) * 1000 / overviewPhase.durationMs };
    });
    if (testCase.svgFps && mode === 'raf') for (const rate of updateRates)
      assert.ok(Math.abs(rate.updatesPerSecond - testCase.svgFps) < 5, 'the requested update cap must actually execute');
    }
    const animationEvidence = [];
    if (mode === 'webp') for (const frame of page.frames()) {
      if (!await frame.evaluate(() => window.perfMode === 'webp').catch(() => false)) continue;
      assert.equal(await frame.locator('image').getAttribute('href').then(s => s.startsWith('data:image/webp')), true);
      const outer = await frame.parentFrame().frameElement();
      const a = await outer.screenshot(); await page.waitForTimeout(230); const b = await outer.screenshot();
      const hashes = [a, b].map(bytes => createHash('sha256').update(bytes).digest('hex'));
      assert.notEqual(hashes[0], hashes[1], 'the WebP must visibly animate in the real host');
      animationEvidence.push(hashes);
    }
    const processes = await processCpu(), pids = processes.map(p => Number(p.id));
    const processMemory = (study || nomad) ? JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' })).map(p => ({ ...p, type: processes.find(item => Number(item.id) === p.Id)?.type })) : null;
    if (run === 1) await page.screenshot({ path: path.join(output, testCase.name + '-30.png') });
    if (diagnostic) {
      if (traceNavigation) await browserCdp.send('Tracing.start', {
        categories: process.env.INSCAPE_PERF_TRACE_CATEGORIES || 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline',
        transferMode: 'ReturnAsStream',
      });
      if (profileNavigation) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
    }
    const zoomStarted = performance.now();
    await measure('zoom-pan', async () => {
      for (const target of [.67, 1, .3]) {
        if (diagnostic) await page.evaluate(target => performance.mark('workbench-zoom-' + target), target);
        await zoom(page, target); await page.waitForTimeout(150);
      }
      const hand = page.getByRole('button', { name: 'Hand tool', exact: true });
      await hand.click();
      for (let i = 0; i < 2; i++) {
        if (diagnostic) await page.evaluate(i => performance.mark('workbench-pan-' + i), i);
        await page.mouse.move(1300, 700); await page.mouse.down(); await page.mouse.move(1000, 550, { steps: 16 }); await page.mouse.up();
        await page.waitForTimeout(350);
      }
      await hand.click();
    });
    const zoomEnded = performance.now();
    if (profileNavigation) {
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(path.join(output, testCase.name + '-zoom.cpuprofile'), JSON.stringify(profile));
    }
    if (traceNavigation) {
      const finished = new Promise(resolve => browserCdp.once('Tracing.tracingComplete', resolve));
      await browserCdp.send('Tracing.end');
      const { stream } = await finished;
      let trace = '';
      for (;;) {
        const part = await browserCdp.send('IO.read', { handle: stream });
        trace += part.base64Encoded ? Buffer.from(part.data, 'base64').toString('utf8') : part.data;
        if (part.eof) break;
      }
      await browserCdp.send('IO.close', { handle: stream });
      await writeFile(path.join(output, testCase.name + '-zoom.trace.json'), trace);
    }
    const panObservation = await page.locator('main.system-workflow').evaluate(node => ({
      x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0),
    }));
    assert.ok(panObservation.x < -100 && panObservation.y < -50,
      'the drag must reach the canvas, not disappear into an embedded HTML document');
    assert.deepEqual(await page.evaluate(() => workbenchPerf.record()), initial.record, 'camera must not save authored content');
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click();
    await page.waitForTimeout(500); await zoom(page, 1); await page.waitForTimeout(500);
    const editor = page.getByRole('textbox', { name: 'Article text', exact: true }).first();
    if (!await editor.isVisible()) {
      await page.locator('.text-window').first().click({ position: { x: 80, y: 90 } });
      await page.getByRole('button', { name: 'Write', exact: true }).click();
    }
    await editor.click(); await page.keyboard.press('Control+Home');
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    await measure('typing-24-characters', async () => {
      await page.keyboard.type('Measured typing sample. ', { delay: 65 });
      await selector.focus(); await page.waitForTimeout(500);
    });
    const profile = await cdp.send('Profiler.stop');
    if (run === 1) await writeFile(path.join(output, testCase.name + '-typing.cpuprofile'), JSON.stringify(profile.profile));
    const saved = await page.evaluate(() => workbenchPerf.record());
    assert.ok(JSON.stringify(saved.workbenches[0]).includes('Measured typing sample.'));
    await measure('switch-quiet', async () => {
      await selector.selectOption('workbench:perf-1'); await page.locator('.text-window').first().waitFor({ state: 'hidden' });
      await page.waitForTimeout(800);
    });
    const quietFrames = await frameState(page);
    assert.equal(quietFrames.length, 0, 'inactive Workbench executable frames must be gone');
    const inactivePaintWorkers = paintWorkers();
    assert.equal(inactivePaintWorkers, 0, 'inactive Workbench paint workers must be gone');
    await measure('quiet-idle', () => page.waitForTimeout(2200));
    await measure('switch-filled', async () => {
      await selector.selectOption('workbench:main'); await page.locator('.text-window').first().waitFor(); await page.waitForTimeout(800);
    });
    const beforeReload = await page.evaluate(() => workbenchPerf.record());
    const layoutObservation = { initiallySeeded: initial.record.workbenches[0].content.workbench.miniApps,
      savedBeforeSwitch: saved.workbenches[0].content.workbench.miniApps,
      savedAfterSwitch: beforeReload.workbenches[0].content.workbench.miniApps };
    assert.deepEqual(layoutObservation.savedAfterSwitch, layoutObservation.initiallySeeded,
      'HTML artwork retains its authored canvas position through camera changes and switching');
    for (const key of ['imageModules', 'texts', 'shapes', 'miniApps'])
      assert.ok(JSON.stringify(beforeReload.workbenches[0].content[key]) === JSON.stringify(saved.workbenches[0].content[key]), 'switch preserves module content: ' + key);
    assert.ok(JSON.stringify(beforeReload.workbenches.slice(1)) === JSON.stringify(saved.workbenches.slice(1)), 'switch preserves inactive compositions');
    await page.reload(); await selector.waitFor(); await page.locator('.text-window').first().waitFor();
    assert.ok(JSON.stringify(await page.evaluate(() => workbenchPerf.record())) === JSON.stringify(beforeReload), 'reload preserves saved record');
    const commitProbe = await page.evaluate(() => {
      const store = workbenchPerf.store(), samples = [];
      for (let i = 0; i < 12; i++) {
        const t = performance.now(), draft = store.getDraft(); const cloned = performance.now();
        draft.texts[0].article.title = 'Measured title ' + i;
        const ok = store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration(), recordHistory: false });
        samples.push({ ok, cloneMs: cloned - t, commitMs: performance.now() - cloned });
      }
      return samples;
    });
    assert.ok(commitProbe.every(s => s.ok), 'store probe saves must succeed');
    await page.evaluate(() => workbenchPerf.stop()); await page.waitForTimeout(500);
    assert.equal(page.frames().length, 1, 'unmount releases all child frames');
    assert.equal(paintWorkers(), 0, 'unmount releases the paint worker');
    assert.deepEqual(errors, []); assert.deepEqual(failedLocalRequests, []);
    results.push({ run, case: testCase, ...(nomad ? { nomadSource: { path: nomadPath, sha256: createHash('sha256').update(nomadSource).digest('hex') } } : {}), coldReadyMs, initial: { numbers: initial.numbers, storageChars: initial.storageChars },
      phases, panObservation, paintWorkerEvidence: { active: activePaintWorkers, inactive: inactivePaintWorkers, unmounted: paintWorkers() }, frameEvidence: { allFramesBefore, allFramesAfter, quietFrames, animationEvidence, updateRates }, processMemory, layoutObservation, commitProbe, errors, failedLocalRequests,
      ...(diagnostic ? { frameLifecycle, zoomStarted, zoomEnded } : {}) });
    await writeFile(path.join(output, 'results.json'), JSON.stringify({ machine: { platform: process.platform, cpus: os.cpus()[0].model,
      logicalCpus: os.cpus().length, ramGiB: os.totalmem() / 1024 ** 3, browser: await browser.version() }, runs, results }, null, 2));
    await context.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log('Evidence: ' + output);
