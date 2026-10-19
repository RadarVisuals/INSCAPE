import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settled = async page => {
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
};
for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Focus keeps its gentle start after delayed preparation (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'no-preference', deviceScaleFactor: 1.25 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 2, textModes: true, displayWidth: 320 });
      await page.locator('[data-workbench-view-id="image:motion-0"] [data-media-state="ready"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const host = page.locator('main.system-workflow').first();
      for (let i = 0; i < 3; i++) await host.dispatchEvent('wheel', { ctrlKey: true, deltaY: 120, clientX: 0, clientY: 0 });
      await settled(page);
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      const first = page.locator('[data-workbench-view-id="image:motion-0"]');
      const source = first.locator('.image-module__canvas');
      const camera = () => host.evaluate(node => ({ scale: Number(node.dataset.workbenchCameraScale), x: Number(node.dataset.workbenchCameraX), y: Number(node.dataset.workbenchCameraY) }));
      const original = await camera();
      const measurements = [];
      for (const entry of ['F', 'double-click']) for (let repeat = 0; repeat < 2; repeat++) {
        await source.click(); await settled(page);
        await page.evaluate(() => {
          const host = document.querySelector('main.system-workflow');
          const native = window.requestAnimationFrame.bind(window);
          const samples = []; let delayedFrame, request;
          // A browser frame timestamp can be older than the preparation work
          // that preceded its callback. Reproduce that scheduling condition for
          // one frame; subsequent callbacks use the real browser clock.
          window.requestAnimationFrame = callback => native(time => {
            if (host.hasAttribute('data-workbench-travelling')) delayedFrame ??= time;
            callback(time === delayedFrame ? time - 100 : time);
          });
          const tick = time => {
            if (host.hasAttribute('data-workbench-travelling')) samples.push({ time, now: performance.now(), scale: Number(host.dataset.workbenchCameraScale) });
            request = native(tick);
          }; request = native(tick);
          window.finishFocusStart = () => { window.requestAnimationFrame = native; cancelAnimationFrame(request); return { samples, delayedFrame }; };
        });
        if (entry === 'F') await page.keyboard.press('f'); else await source.dblclick();
        await settled(page);
        const measurement = { entry, repeat, ...(await page.evaluate(() => window.finishFocusStart())) };
        measurements.push(measurement);
        await mkdir(output, { recursive: true });
        await writeFile(`${output}/start-${visitor ? 'visitor' : 'owner'}-${width}.json`, JSON.stringify(measurements, null, 2));
        const samples = measurement.samples;
        assert.ok(Number.isFinite(measurement.delayedFrame) && samples.length > 5, 'exercise a delayed initial frame and several visible poses');
        const end = await camera();
        assert.ok(end.scale > original.scale);
        const start = samples[0];
        const early = samples.filter(sample => sample.now - start.now < 55);
        assert.ok(early.length >= 2, 'observe the start before the middle of the journey');
        const advance = Math.max(...early.map(sample => (sample.scale - original.scale) / (end.scale - original.scale)));
        assert.ok(advance < .04, `preparation must not skip the gentle start: ${JSON.stringify({ advance, early })}`);
        for (let i = 1; i < samples.length; i++) assert.ok(samples[i].scale >= samples[i - 1].scale - 1e-7, 'Focus never reverses direction');
        if (entry === 'F' && repeat === 0) await page.screenshot({ path: `${output}/focused-${visitor ? 'visitor' : 'owner'}-${width}.png` });
        await page.keyboard.press('f'); await settled(page);
        assert.deepEqual(await camera(), original, 'F still returns exactly');
        if (entry === 'F' && repeat === 0) await page.screenshot({ path: `${output}/returned-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
