import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const width of [1440, 390]) test(`Image activation preserves pointer/keyboard focus, cancellation and empty-space clearing at ${width}px`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320, seamReview: 'single' });
    await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem(window.__motionKey)), original = draft.imageModules[0];
      draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
      draft.imageModules = [0, 1].map(index => ({ ...original, id: `image:activation-${index}`, name: `Activation ${index}`,
        width: 200, height: 180 }));
      draft.workbench.imageModules = draft.imageModules.map((image, index) => ({ id: image.id, open: true, position: { left: 32, top: 64 + index * 250 } }));
      localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
    });
    const windows = page.locator('.image-module__window'), first = windows.first(), second = windows.nth(1);
    await first.waitFor(); await settle(page);
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    const geometry = await first.boundingBox();
    await page.mouse.move(geometry.x + 50, geometry.y + 70); await page.mouse.down();
    assert.equal(await first.evaluate(node => node === document.activeElement), true, 'pointer focus remains on the Image window');
    assert.equal(await first.getAttribute('data-active'), 'true');
    await page.mouse.move(geometry.x + 90, geometry.y + 100, { steps: 5 });
    assert.notDeepEqual(await first.boundingBox(), geometry, 'drag previews movement');
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await first.boundingBox(), geometry, 'Escape restores the original rectangle');
    assert.equal(await first.evaluate(node => node === document.activeElement), true);
    await second.locator('.image-module__canvas').focus(); await settle(page);
    assert.equal(await second.getAttribute('data-active'), 'true', 'keyboard focus activates the other Image');
    assert.equal(await first.getAttribute('data-active'), null);
    assert.equal(await page.locator('[data-context-tools] [data-workbench-inspection-target]').getAttribute('data-workbench-inspection-target'), 'image:activation-1');
    await page.mouse.click(4, 4); await settle(page);
    assert.equal(await first.getAttribute('data-active'), null);
    assert.equal(await second.getAttribute('data-active'), null);
    assert.equal(await page.locator('[data-context-tools]').isVisible(), false, 'empty Workbench space clears tools');
    const canvas = first.locator('.image-module__canvas');
    await canvas.focus(); await settle(page);
    assert.equal(await canvas.evaluate(node => node === document.activeElement), true, 'keyboard keeps focus on its original control');
    assert.equal(await first.getAttribute('data-active'), 'true');
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'activation and cancellation never save content or layout');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/image-activation-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
