import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const arrived = async page => { await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]')); await settle(page); };
const camera = page => page.locator('main.system-workflow').first().evaluate(node => ({
  scale: Number(node.dataset.workbenchCameraScale ?? node.querySelector('[data-workbench-scale]')?.dataset.workbenchScale ?? 1),
  x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) }));
const select = async (page, ids) => {
  for (const id of ids) await page.locator(`[data-workbench-view-id="${id}"]`).evaluate(node => {
    const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
    target.focus({ preventScroll: true });
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  });
  await settle(page);
};
async function centered(page, ids) {
  const result = await page.evaluate(ids => {
    const host = document.querySelector('main.system-workflow'), viewport = host.getBoundingClientRect();
    const controls = host.querySelector('.workbench-view-controls').getBoundingClientRect();
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    const availableHeight = Math.min(host.clientHeight - dock, controls.top - viewport.top - 8);
    const rectangles = ids.map(id => host.querySelector(`[data-workbench-view-id="${id}"]`).getBoundingClientRect());
    const left = Math.min(...rectangles.map(rect => rect.left)), right = Math.max(...rectangles.map(rect => rect.right));
    const top = Math.min(...rectangles.map(rect => rect.top)), bottom = Math.max(...rectangles.map(rect => rect.bottom));
    return { actual: [(left + right) / 2, (top + bottom) / 2],
      expected: [viewport.left + host.clientWidth / 2, viewport.top + availableHeight / 2] };
  }, ids);
  for (let axis = 0; axis < 2; axis++) assert.ok(Math.abs(result.actual[axis] - result.expected[axis]) <= 1,
    `selected content is centred: ${JSON.stringify(result)}`);
}

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`focus is centred, shared by F/click, and view-only (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 90000 }, async () => {
    await mkdir('.browser-test-runtime', { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 2, textModes: true, displayWidth: 320 });
      await page.locator('[data-workbench-view-id="image:motion-0"] .image-module__artwork[data-media-state="ready"]').waitFor();
      await page.evaluate(() => document.fonts.ready); await settle(page);
      const saved = await page.evaluate(() => ({ draft: localStorage.getItem(window.__motionKey), layouts: Object.fromEntries(Object.keys(localStorage)
        .filter(key => key.startsWith('inscape:workbench:layout:')).map(key => [key, JSON.parse(localStorage.getItem(key)).layout])) }));
      const original = await camera(page);
      // A floating instrument must not choose a different side of the screen.
      await page.evaluate(() => {
        const instrument = document.createElement('aside'); instrument.id = 'focus-test-instrument';
        instrument.setAttribute('data-detached-window', '');
        instrument.style.cssText = 'position:fixed;left:0;top:0;width:45vw;height:70vh;pointer-events:none';
        document.querySelector('main.system-workflow').append(instrument);
      });
      await select(page, ['image:motion-0']);
      const railBefore = await page.locator('.workbench-view-controls').boundingBox();
      await page.keyboard.press('f');
      await page.locator('main.system-workflow').first().dispatchEvent('keydown', { key: 'f', repeat: true, bubbles: true });
      await arrived(page); await centered(page, ['image:motion-0']);
      assert.deepEqual(await page.locator('.workbench-view-controls').boundingBox(), railBefore, 'clearing selection cannot reflow the rail');
      const focused = await camera(page);
      const source = page.locator('[data-workbench-view-id="image:motion-0"] .image-module__canvas');
      await source.click(); await arrived(page);
      assert.deepEqual(await camera(page), focused, 'click and F have the same destination without drift');
      assert.equal(await page.locator('.image-lift').count(), 0);
      await page.screenshot({ path: `.browser-test-runtime/focus-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      const back = page.getByRole('button', { name: 'Back to previous Workbench view', exact: true });
      await back.click(); await arrived(page);
      assert.deepEqual(await camera(page), original);
      assert.equal(await back.isDisabled(), true, 'repeating focus adds no duplicate return context');
      await page.evaluate(() => { const instrument = document.getElementById('focus-test-instrument'); instrument.style.left = '55vw'; });
      await page.keyboard.press('f'); await arrived(page); await centered(page, ['image:motion-0']);
      assert.deepEqual(await camera(page), focused, 'moving an instrument leaves the destination unchanged');
      await page.keyboard.press('Escape'); await arrived(page);
      assert.deepEqual(await camera(page), original, 'Escape restores the previous camera');

      // Text editing, modifiers and composition must never trigger the shortcut.
      await page.evaluate(() => {
        const field = document.createElement('input'); field.id = 'focus-test-input';
        document.querySelector('main.system-workflow').append(field); field.focus();
      });
      await page.keyboard.press('f'); await settle(page);
      assert.equal(await page.locator('#focus-test-input').inputValue(), 'f');
      assert.deepEqual(await camera(page), original);
      await page.locator('main.system-workflow').first().focus();
      for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
        await page.locator('main.system-workflow').first().dispatchEvent('keydown', { key: 'f', bubbles: true, ...extra });
        await settle(page); assert.deepEqual(await camera(page), original);
      }
      await page.evaluate(() => document.getElementById('focus-test-input').remove());
      // Back restored the first selection. Add another module and frame their union.
      await select(page, ['image:motion-1']);
      await page.keyboard.press('f'); await arrived(page); await centered(page, ['image:motion-0', 'image:motion-1']);
      await back.click(); await arrived(page);
      assert.deepEqual(await camera(page), original);
      await page.keyboard.press('Escape');
      const placement = page.locator(visitor ? '.lattice-production-placement[tabindex="0"]' : '.system-workflow__placement[tabindex="0"]').first();
      await placement.focus(); await placement.press('Enter'); await arrived(page);
      await centered(page, ['display:primary']);
      assert.equal(await page.locator('.display-focus-viewer').count(), 0, 'ordinary Display activation focuses the module');
      await back.click(); await arrived(page);
      assert.deepEqual(await camera(page), original);
      const restored = await page.evaluate(() => ({ draft: localStorage.getItem(window.__motionKey), layouts: Object.fromEntries(Object.keys(localStorage)
        .filter(key => key.startsWith('inscape:workbench:layout:')).map(key => [key, JSON.parse(localStorage.getItem(key)).layout])) }));
      assert.deepEqual(restored, saved, 'focus and return never rewrite the draft or module positions');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
