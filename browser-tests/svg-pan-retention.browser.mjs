import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { resetCameraTestView } from './fixtures/workbench-camera-test.mjs';
import { svgStudy } from './fixtures/animation-study.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_RETENTION_REPORT || '.browser-test-runtime/svg-pan-retention';
// The real layered raster/vector SVG plus a cooperative animation clock. A
// document identity and ticks prove preservation independently of a static image.
function probe() {
  window.retentionStudy = { id: Math.random().toString(36), visible: true, ticks: 0, uploads: 0, draws: 0, contextLosses: 0 };
  document.addEventListener('webglcontextlost', () => { window.retentionStudy.contextLosses++; }, true);
  const request = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => request(time => { window.retentionStudy.ticks++; callback(time); });
  for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!type) continue;
    for (const [method, counter] of [['texImage2D', 'uploads'], ['drawElements', 'draws'], ['drawArrays', 'draws']]) {
      const native = type.prototype[method];
      type.prototype[method] = function (...args) { window.retentionStudy[counter]++; return native.apply(this, args); };
    }
  }
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'inscape:html-artwork-visibility') return;
    window.retentionStudy.visible = event.data.visible;
    window.perfControl?.(event.data.visible ? 'resume' : 'pause');
  });
}
const external = process.env.INSCAPE_RETENTION_ARTWORK;
const original = external ? await readFile(external, 'utf8') : svgStudy(await readFile('browser-tests/fixtures/keeper-layered.svg', 'utf8'));
// Optional local Nomad uses its original animation/visibility logic. Only the
// measurement counters are inserted; no source artwork is changed on disk.
const source = original.replace(/<svg\b[^>]*>/, opening => `${opening}<script><![CDATA[(${probe.toString()})();]]></script>`);
const frames = async page => (await Promise.all(page.frames().map(frame => frame.evaluate(() => window.retentionStudy && ({
  ...window.retentionStudy,
})).catch(() => null)))).filter(Boolean);
async function until(check, timeout = 20000) {
  const started = Date.now();
  while (!await check()) {
    if (Date.now() - started > timeout) throw Error('Artwork condition timed out');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
async function pan(page, width, direction) {
  const host = page.locator('main.system-workflow').first(), distance = Math.min(300, width - 60);
  for (let i = 0; i < (external && width > 900 ? 4 : 2); i++) {
    await host.focus(); await page.keyboard.down('Space');
    const x = direction < 0 ? width - 30 : 30;
    await page.mouse.move(x, 650); await page.mouse.down();
    await page.mouse.move(x + direction * distance, 650, { steps: 10 });
    await page.mouse.up(); await page.keyboard.up('Space');
  }
}
for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`twelve animated SVGs retain their documents across repeated camera pans (${visitor ? 'Visitor' : 'Owner'}, ${width}px)`, { timeout: 120000 }, async () => {
    const browser = await chromium.launch({ headless: true, ...(external ? { args: ['--enable-gpu', '--use-angle=d3d11'] } : {}) });
    const large = external && width > 900;
    const report = { visitor, width, moduleSize: large ? [240, 240] : [72, 90], artwork: external || 'layered Keeper with animation clock', stage: 'starting', cycles: [], errors: [] };
    const label = `${visitor ? 'visitor' : 'owner'}-${width}`;
    try {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: width === 390 ? 3 : 1 });
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => report.errors.push(error.message));
      let sourceRequests = 0;
      page.on('request', request => { if (request.url().includes('/retained-motion.svg')) sourceRequests++; });
      await mountGridMotionFixture(page, { origin, visitor, retentionStudy: large ? 'large' : true, count: 1,
        artwork: { url: 'https://motion.invalid/retained-motion.svg', body: source, contentType: 'image/svg+xml', width: external ? 720 : 2048, height: external ? 800 : 2048 } });
      await resetCameraTestView(page);
      await until(async () => { const values = await frames(page); return values.length === 12 && values.every(f => f.ticks > 2 && f.visible && (!external || f.draws > 2)); }, external ? 60000 : 20000);
      const initial = await frames(page), saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      report.stage = 'panning';
      report.initial = initial;
      const requests = sourceRequests;
      await page.evaluate(() => {
        window.retentionLongTasks = []; window.retentionLoadingShown = 0;
        new PerformanceObserver(list => window.retentionLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration })))).observe({ type: 'longtask' });
        const visibleLabels = () => {
          for (const node of document.querySelectorAll('[role="status"]')) {
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            if (node.textContent.includes('Loading artwork') && rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && style.clipPath === 'none') window.retentionLoadingShown++;
          }
        };
        window.retentionObserver = new MutationObserver(visibleLabels);
        window.retentionObserver.observe(document.body, { subtree: true, childList: true, attributes: true });
      });
      for (let cycle = 0; cycle < 3; cycle++) {
        await pan(page, width, -1);
        await until(async () => (await frames(page)).every(f => !f.visible));
        await page.waitForTimeout(200);
        const hidden = await frames(page); await page.waitForTimeout(200);
        const idle = await frames(page);
        const start = await page.evaluate(() => performance.now());
        await pan(page, width, 1);
        await until(async () => { const values = await frames(page); return values.length === 12 && values.every(f => f.visible && f.ticks > 2); });
        await page.waitForTimeout(200);
        const returned = await frames(page);
        report.cycles.push({ hidden: hidden.length, retained: returned.filter(f => initial.some(b => b.id === f.id)).length,
          paused: idle.every(f => hidden.some(h => h.id === f.id && h.ticks === f.ticks && h.draws === f.draws)),
          resumed: returned.every(f => idle.some(h => h.id === f.id && f.ticks > h.ticks)),
          texturesPreserved: returned.every(f => initial.some(h => h.id === f.id && f.uploads === h.uploads)),
          contextLosses: returned.reduce((sum, f) => sum + f.contextLosses, 0),
          newRequests: sourceRequests - requests, ...await page.evaluate(start => ({ returnMs: performance.now() - start,
            loadingShown: window.retentionLoadingShown, longTasks: window.retentionLongTasks.filter(t => t.start >= start) }), start) });
      }
      await mkdir(output, { recursive: true });
      report.stage = 'screenshot';
      await page.screenshot({ path: join(output, `${label}.png`), timeout: 15000 });
      report.stage = 'assertions';
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'camera never changes the authored composition');
      for (const cycle of report.cycles) {
        assert.equal(cycle.hidden, 12, 'all twelve documents remain mounted outside the viewport');
        assert.equal(cycle.retained, 12, 'return uses the same twelve live documents');
        assert.equal(cycle.paused, true, 'cooperative SVG clocks stop while offscreen');
        assert.equal(cycle.resumed, true, 'each retained clock resumes');
        assert.equal(cycle.texturesPreserved, true, 'warm return does not re-upload WebGL textures');
        assert.equal(cycle.contextLosses, 0, 'no WebGL context is lost');
        assert.equal(cycle.newRequests, 0, 'return never fetches artwork again');
        assert.equal(cycle.loadingShown, 0, 'return never flashes a Loading artwork label');
      }
      assert.deepEqual(report.errors, []);
      await page.evaluate(() => { window.retentionObserver.disconnect(); window.__motionRoot.unmount(); });
      assert.equal(await page.locator('.artwork-svg-document').count(), 0, 'leaving the canvas releases retained documents');
      report.stage = 'complete';
    } finally {
      await mkdir(output, { recursive: true });
      await writeFile(join(output, `${label}.json`), JSON.stringify(report, null, 2));
      await browser.close();
    }
  });
}
