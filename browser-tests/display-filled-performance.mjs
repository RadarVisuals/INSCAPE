import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountFilledDisplay } from './fixtures/display-filled-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const label = process.env.INSCAPE_PERF_LABEL || 'baseline';
const runs = Number(process.env.INSCAPE_PERF_RUNS || 3);
const svg = process.env.INSCAPE_PERF_SVG === '1';
const directory = 'output/display-filled-audit';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const results = [];
try {
  for (let run = 0; run < runs; run++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(20000);
    await mountFilledDisplay(page, origin, { profile: true, svg });
    const lock = page.getByRole('button', { name: 'Lock Display Module composition', exact: true });
    if (await lock.count()) { await lock.focus(); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
    await page.evaluate(() => {
      window.bench = { frames: [], tasks: [], start: 0, frameId: null };
      new PerformanceObserver(list => { if (bench.active) bench.tasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration }))); }).observe({ type: 'longtask', buffered: false });
    });
    const measure = async (name, action) => {
      const before = await metrics();
      await page.evaluate(() => {
        bench.frames = []; bench.tasks = []; bench.active = true; bench.start = performance.now(); filledDisplay.commits = []; filledDisplay.recording = true;
        let previous;
        const tick = now => { if (previous !== undefined) bench.frames.push(now - previous); previous = now; bench.frameId = requestAnimationFrame(tick); };
        bench.frameId = requestAnimationFrame(tick);
      });
      await action();
      const data = await page.evaluate(() => {
        bench.active = false; filledDisplay.recording = false; cancelAnimationFrame(bench.frameId);
        const sorted = bench.frames.slice().sort((a, b) => a - b);
        const quantile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
        const images = [...document.querySelectorAll('.system-workflow__canvas img')];
        return { durationMs: performance.now() - bench.start, frames: sorted.length, frameP50: quantile(.5), frameP95: quantile(.95), frameP99: quantile(.99), frameMax: sorted.at(-1),
          framesOver25: sorted.filter(x => x > 25).length, framesOver50: sorted.filter(x => x > 50).length,
          longTasks: bench.tasks, reactCommits: filledDisplay.commits.length, reactDurationMs: filledDisplay.commits.reduce((sum, entry) => sum + entry.duration, 0),
          reactMaxCommitMs: Math.max(0, ...filledDisplay.commits.map(entry => entry.duration)),
          domNodes: document.querySelectorAll('*').length, railSlots: document.querySelectorAll('[data-rail-slot]').length,
          mountedPlacements: document.querySelectorAll('.system-workflow__canvas .system-workflow__placement').length,
          images: images.length, imagesReady: images.filter(image => image.complete && image.naturalWidth > 0).length,
          uniqueMedia: [...new Set(images.map(image => image.currentSrc || image.src))].length,
          liveSvgDocuments: document.querySelectorAll('.artwork-svg-document').length,
          svgHosts: document.querySelectorAll('[data-svg-artwork-host]').length,
          stage: (() => { const rect = document.querySelector('.system-workflow__canvas').getBoundingClientRect(); return { width: rect.width, height: rect.height }; })(),
          draftUnchanged: JSON.stringify(filledDisplay.draft()) === JSON.stringify(filledDisplay.initialDraft), draftWrites: filledDisplay.writes,
        };
      });
      const after = await metrics();
      data.cpuMs = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(key => [key, (after[key] - before[key]) * 1000]));
      data.heapUsedMiB = after.JSHeapUsedSize / 1024 ** 2;
      assert.ok(data.draftUnchanged, `${name} must not mutate authored data`);
      console.log(JSON.stringify({ run: run + 1, phase: name, ...data }));
      return { name, ...data };
    };
    const phases = [];
    phases.push(await measure('warm idle', () => page.waitForTimeout(2000)));
    if (run === 0) await page.screenshot({ path: `${directory}/filled-display-${label}.png` });
    phases.push(await measure('four filled Grid swipes', async () => {
      for (let index = 0; index < 4; index++) {
        const rect = await page.locator('.system-workflow__canvas').boundingBox();
        await page.mouse.move(rect.x + rect.width * .8, rect.y + rect.height * .55); await page.mouse.down();
        await page.mouse.move(rect.x + rect.width * .2, rect.y + rect.height * .55, { steps: 24 }); await page.mouse.up();
        await page.waitForTimeout(700);
      }
    }));
    phases.push(await measure('Workbench zoom .67 to 1.25 and back', async () => {
      for (const zoom of [.67, 1.25, 1, .67, 1.25, 1]) { await setWorkbenchZoom(page, zoom); await page.waitForTimeout(150); }
    }));
    phases.push(await measure('three Lift inspections and return', async () => {
      for (let index = 0; index < 3; index++) {
        const artwork = page.locator('.system-workflow__grid-plane--current [data-system-workflow-placement-id]').last();
        await artwork.focus(); await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor();
        await page.waitForTimeout(500); await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor({ state: 'hidden' });
        await page.waitForTimeout(500);
      }
    }));
    assert.deepEqual(errors, []);
    results.push({ run: run + 1, phases });
    await cdp.detach(); await page.close();
  }
  await writeFile(`${directory}/performance-${label}.json`, JSON.stringify({ label, workload: { gridCount: 3, placementsPerGrid: 32, authoredPlacements: 96, distinctMedia: 7, animatedSvgPlacementsPerGrid: svg ? 6 : 0, viewport: '1440×1000', deviceScaleFactor: 1, runtime: 'Vite development React profiler + headless Edge', browserVersion: browser.version() }, results }, null, 2));
} finally { await browser.close(); }
