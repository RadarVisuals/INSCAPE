import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settled = page => page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));

for (const visitor of [false, true]) test(`focus keeps painted geometry in sync without per-frame module style writes (${visitor ? 'Visitor' : 'owner'})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 3, textModes: true, displayWidth: 600 });
    await page.locator('[data-workbench-view-id="image:motion-0"] .image-module__artwork[data-media-state="ready"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const host = page.locator('main.system-workflow').first();
    for (let i = 0; i < 6; i++) await host.dispatchEvent('wheel', { ctrlKey: true, deltaY: 120, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
    await page.locator('[data-workbench-view-id="image:motion-0"]').press('Shift+Enter');
    for (const direction of ['focus', 'back']) {
      await page.evaluate(() => {
        const host = document.querySelector('main.system-workflow');
        const source = host.querySelector('[data-workbench-view-id="image:motion-0"]');
        let frames = 0, request, travelStyleWrites = 0;
        const mismatches = [];
        const observer = new MutationObserver(records => {
          // Ignore preparation and settlement: only the live journey must avoid
          // changing module CSS. Those boundaries legitimately update geometry.
          if (frames > 1) for (const { target } of records)
            if (target.hasAttribute('data-workbench-camera-projected')) travelStyleWrites++;
        });
        for (const node of host.querySelectorAll('[data-workbench-view-id]')) observer.observe(node, { attributes: true, attributeFilter: ['style'] });
        const tick = () => {
          if (source.hasAttribute('data-workbench-camera-projected')) {
            frames++;
            const scale = Number(host.dataset.workbenchCameraScale);
            const x = Number(host.dataset.workbenchCameraX), y = Number(host.dataset.workbenchCameraY);
            const rect = source.getBoundingClientRect();
            const expected = { left: 20 * scale + x, top: 780 * scale + y, width: 120 * scale, height: 96 * scale };
            for (const axis of Object.keys(expected)) if (Math.abs(rect[axis] - expected[axis]) > .8)
              mismatches.push({ axis, actual: rect[axis], expected: expected[axis], frame: frames });
          }
          request = requestAnimationFrame(tick);
        };
        request = requestAnimationFrame(tick);
        window.finishMotionCheck = () => { observer.disconnect(); cancelAnimationFrame(request);
          return { frames, mismatches, travelStyleWrites }; };
      });
      await page.getByRole('button', { name: direction === 'focus' ? 'Focus selected Workbench modules' : 'Back to previous Workbench view', exact: true }).click();
      await settled(page);
      const result = await page.evaluate(() => window.finishMotionCheck());
      assert.ok(result.frames >= 3, 'sample multiple intermediate poses');
      assert.deepEqual(result.mismatches, [], 'painted modules and the authoritative camera use the same clock');
      assert.equal(result.travelStyleWrites, 0, `intermediate frames leave module styles untouched: ${JSON.stringify(result)}`);
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
      const remaining = await page.locator('[data-workbench-view-id]').evaluateAll(nodes => nodes.flatMap(node => node.getAnimations())
        .filter(animation => animation.effect.getKeyframes().some(frame => frame.scale !== undefined && frame.translate !== undefined)).length);
      assert.equal(remaining, 0, 'settling releases all temporary transform effects');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
