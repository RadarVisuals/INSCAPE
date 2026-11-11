import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const results = [];
try {
  for (const fps of [60, 30]) {
    const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(`output/nomad-performance-study-2026-10-21/NOMAD-${fps}fps-trial.svg`)).href);
    await page.waitForFunction(() => document.getElementById('stage')?.dataset.ready === 'true');
    await page.evaluate(() => { window.paintCount = 0;
      new MutationObserver(records => paintCount += records.filter(r => r.attributeName === 'data-time').length)
        .observe(document.getElementById('stage'), { attributes: true }); });
    const before = await page.evaluate(() => ({ time: Number(document.getElementById('stage').dataset.time), now: performance.now() }));
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => ({ time: Number(document.getElementById('stage').dataset.time), now: performance.now(),
      paints: paintCount, uploads: document.getElementById('stage').dataset.uploads, probe: Boolean(window.nomadPerf) }));
    const hz = after.paints * 1000 / (after.now - before.now), clock = (after.time - before.time) * 1000 / (after.now - before.now);
    assert.ok(Math.abs(hz - fps) < 3); assert.ok(clock > .94 && clock < 1.06);
    assert.equal(after.uploads, '39'); assert.equal(after.probe, false); assert.deepEqual(errors, []);
    await page.locator('#pause').evaluate(button => button.click());
    const time = await page.locator('#stage').getAttribute('data-time'); await page.waitForTimeout(120);
    assert.equal(await page.locator('#stage').getAttribute('data-time'), time);
    results.push({ fps, hz, clock, uploads: 39, probe: false, pause: true, errors }); await page.close();
  }
  await writeFile('.browser-test-runtime/nomad-study/export-check.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
