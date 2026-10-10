import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settled = async page => {
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const camera = page => page.locator('main.system-workflow').first().evaluate(node => ({
  scale: Number(node.dataset.workbenchCameraScale || 1), x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) }));
const saved = page => page.evaluate(() => ({ draft: localStorage.getItem(window.__motionKey), layouts: Object.fromEntries(Object.keys(localStorage)
  .filter(key => key.startsWith('inscape:workbench:layout:')).map(key => [key, JSON.parse(localStorage.getItem(key)).layout])) }));

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Focus and explicit Lift have independent return paths (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
    try {
      await mkdir('.browser-test-runtime', { recursive: true });
      const page = await browser.newPage({ viewport: { width, height: 1100 }, hasTouch: width === 390, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 2, displayWidth: 320, inspectionMode: 'IN_PLACE' });
      const image = page.locator('[data-workbench-view-id="image:motion-0"]');
      const source = image.locator('.image-module__canvas');
      await image.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      await page.evaluate(() => document.fonts.ready); await settled(page);
      const initial = await camera(page), before = await saved(page);
      if (width === 390) { await source.press('Shift+Enter'); await page.keyboard.press('f'); }
      else await source.click();
      await settled(page);
      const focused = await camera(page), imageRect = await source.boundingBox();
      assert.notDeepEqual(focused, initial);
      assert.equal(await page.locator('.image-lift').count(), 0, 'click remains camera Focus');
      await page.mouse.move(imageRect.x + imageRect.width / 2, imageRect.y + imageRect.height / 2);
      await page.mouse.down(); await page.mouse.move(imageRect.x + imageRect.width / 2 + 20, imageRect.y + imageRect.height / 2 + 12);
      await page.keyboard.press('i');
      assert.equal(await page.locator('.image-lift').count(), 0, 'I cannot interrupt a captured module drag');
      await page.keyboard.press('Escape'); await page.mouse.up(); await settled(page);
      assert.deepEqual(await camera(page), focused, 'cancelling the drag cannot also consume Focus history');
      await source.focus();
      await page.screenshot({ path: `.browser-test-runtime/inspect-image-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      await page.keyboard.press('i');
      await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('.image-module__canvas[data-lift-source]'));
      assert.deepEqual(await camera(page), focused, 'Lift leaves the focused camera alone');
      await page.keyboard.press('i');
      assert.equal(await page.locator('.image-lift').count(), 1, 'I cannot stack inspectors');
      await page.keyboard.press('Escape');
      await page.locator('.image-lift').waitFor({ state: 'detached' }); await settled(page);
      assert.deepEqual(await camera(page), focused);
      assert.deepEqual(await source.boundingBox(), imageRect, 'return restores the source crop rectangle');
      assert.equal(await source.evaluate(node => node === document.activeElement), true, 'return restores source focus');
      // Both the owner contextual dock and the shared quiet Image controls call
      // the same action; narrow/Visitor use the in-module control.
      const inspect = !visitor && width === 1440
        ? page.locator('[data-context-tools]').getByRole('button', { name: 'Inspect Image', exact: true })
        : image.getByRole('button', { name: 'Inspect Image', exact: true });
      await inspect.click();
      await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
      await page.keyboard.press('Escape'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'a second Escape consumes Focus history only after Lift closes');
      const back = page.getByRole('button', { name: 'Back to previous Workbench view', exact: true });
      assert.equal(await back.isDisabled(), true, 'Lift added no camera-history entry');
      await page.keyboard.press('Escape'); // Back may restore the selection used by F.

      // Typing and modified/composed/repeated keys are never inspection actions.
      await page.evaluate(() => {
        const field = document.createElement('input'); field.id = 'inspect-test-field';
        document.querySelector('main.system-workflow').append(field); field.focus();
      });
      await page.keyboard.press('i');
      assert.equal(await page.locator('#inspect-test-field').inputValue(), 'i');
      await source.focus();
      for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }, { repeat: true }]) {
        await source.dispatchEvent('keydown', { key: 'i', bubbles: true, ...extra });
        assert.equal(await page.locator('.image-lift').count(), 0);
      }
      await page.evaluate(() => document.getElementById('inspect-test-field').remove());
      for (const role of ['menu', 'dialog']) {
        await page.evaluate(role => {
          const node = document.createElement('div'); node.id = 'inspect-test-popup'; node.role = role; node.tabIndex = 0;
          document.querySelector('main.system-workflow').append(node); node.focus();
        }, role);
        await page.keyboard.press('i');
        assert.equal(await page.locator('.image-lift').count(), 0, `${role} retains its keyboard input`);
        await page.evaluate(() => document.getElementById('inspect-test-popup').remove());
      }
      // A real multi-module selection must not arbitrarily choose an artwork.
      await source.press('Shift+Enter');
      await page.locator('[data-workbench-view-id="image:motion-1"] .image-module__canvas').press('Shift+Enter');
      await page.keyboard.press('i');
      assert.equal(await page.locator('.image-lift').count(), 0);
      await page.keyboard.press('Escape');

      const placement = page.locator(visitor ? '.lattice-production-placement[tabindex="0"]' : '.system-workflow__placement[tabindex="0"]').first();
      await placement.focus(); await placement.press('Enter'); await settled(page);
      const displayFocus = await camera(page);
      assert.equal(await page.locator('.display-focus-viewer').count(), 0);
      await page.keyboard.press('i');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('[data-inspection-context="selected"][data-lift-source]'));
      assert.deepEqual(await camera(page), displayFocus, 'explicit Inspect lifts even an authored In-place placement without moving the camera');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor({ state: 'detached' }); await settled(page);
      assert.deepEqual(await camera(page), displayFocus);
      const board = page.locator('[data-workbench-view-id="display:primary"]');
      if (width === 390) await board.getByRole('button', { name: 'Show Display controls', exact: true }).tap();
      else await board.locator(':scope > header').hover({ position: { x: 150, y: 2 } });
      await page.screenshot({ path: `.browser-test-runtime/inspect-controls-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      if (width === 390) await board.getByRole('button', { name: 'Inspect artwork', exact: true }).tap();
      else await board.getByRole('button', { name: 'Inspect artwork', exact: true }).click();
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor({ state: 'detached' });
      await back.click(); await settled(page);
      assert.deepEqual(await camera(page), initial);
      assert.deepEqual(await saved(page), before, 'inspection mode, content, crop and authored geometry stay unchanged');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('explicit Image Inspect retains its live SVG document and returns to the focused camera', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1100 }, deviceScaleFactor: 1.25 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 2, displayWidth: 320,
        inspectionArtwork: { target: 'image', url: 'https://motion.invalid/inspect.svg', width: 640, height: 480,
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#593887"/><circle cx="320" cy="240" r="110" fill="#f54789"/></svg>' } });
      const source = page.locator('[data-workbench-view-id="image:motion-0"] .image-module__canvas');
      await source.locator('iframe').waitFor({ state: 'attached' });
      await source.locator('.artwork-svg-status').waitFor({ state: 'detached' });
      await source.press('Enter'); await settled(page);
      const iframe = await source.locator('iframe').elementHandle(), host = await iframe.contentFrame();
      const runtime = host.childFrames()[0];
      await runtime.waitForFunction(() => innerWidth > 0 && innerHeight > 0);
      const identity = await runtime.evaluate(() => window.inspectIdentity = Math.random());
      const focused = await camera(page);
      await page.keyboard.press('i');
      await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
      await page.waitForFunction(() => Number(document.querySelector('.image-lift').style.getPropertyValue('--inspection-lift-progress')) > .99);
      assert.equal(await runtime.evaluate(() => window.inspectIdentity), identity);
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' }); await settled(page);
      assert.equal(await runtime.evaluate(() => window.inspectIdentity), identity, 'Lift does not remount the live SVG');
      assert.deepEqual(await camera(page), focused);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
