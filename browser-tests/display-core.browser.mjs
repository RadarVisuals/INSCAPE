import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
test('Display has corner resize and Workbench zoom without independent enlargement', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [2560, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1440 } });
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194', visitor, heavy: true, displayWidth: 320, seamReview: true });
      const board = page.locator('.system-workflow__presentation-board'); await board.waitFor();
      assert.equal(await page.getByRole('button', { name: /Maximize Display|Restore Display|Exit immersive/ }).count(), 0);
      const stage = board.locator('[data-presentation-stage]');
      const before = await board.boundingBox();
      for (const deltaY of [-120, 120, -500, -500]) await stage.dispatchEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      const scrolled = await board.boundingBox();
      assert.deepEqual([scrolled.width, scrolled.height], [before.width, before.height], 'ordinary wheel never changes Display size');
      await page.getByRole('button', { name: 'Reset Workbench position' }).click();
      await board.getByRole('button', { name: 'Resize Display Module from se', exact: true }).focus(); await page.keyboard.press('ArrowRight');
      const resized = await board.boundingBox();
      assert.ok(resized.width > before.width, 'corner keyboard resize remains available');
      await board.dispatchEvent('wheel', { deltaY: -Math.log(.9) / .003, ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
      await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.workbenchScale === '0.9');
      const zoomed = await board.boundingBox();
      assert.ok(Math.abs(zoomed.width - resized.width * .9) < 1, 'Workbench owns the viewing scale');
      assert.equal(await stage.evaluate(el => getComputedStyle(el).transform), 'none');
      await page.screenshot({ path: `.browser-test-runtime/display-core-${visitor}-${width}.png` });
      if (!visitor) {
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
        const original = await page.evaluate(() => JSON.parse(window.__motionSaved));
        assert.deepEqual(saved.grids, original.grids, 'resizing and camera zoom preserve authored compositions');
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
