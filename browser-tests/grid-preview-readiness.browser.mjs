import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('HOME media is already mounted and decoded before either swipe direction', { timeout: 60000 }, async () => {
  const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().resourceType() === 'image'
        ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#806050"/></svg>' })
        : new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/development/owner/system-workflow`);
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.waitForTimeout(500);
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('[data-preview-grid-id] img')];
        return images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0);
      });
      await page.evaluate(async () => {
        window.__neighborImages = [...document.querySelectorAll('[data-preview-grid-id] img')];
        await Promise.all(window.__neighborImages.map(img => img.decode()));
      });
      // Plain dragging navigates a locked composition. Space belongs to the
      // Workbench camera and must not be used to simulate a Display swipe.
      const lock = page.getByRole('button', { name: 'Lock Display Module composition', exact: true });
      await lock.focus(); await page.keyboard.press('Enter');
      const focusDisplay = async () => {
        await page.locator('[data-workbench-view-id="display:primary"]').evaluate(node => {
          const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
          target.focus({ preventScroll: true }); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
        });
        await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      };
      await focusDisplay();
      const commitSwipe = async (direction) => {
        const lock = page.getByRole('button', { name: 'Lock Display Module composition', exact: true });
        if (await lock.isVisible()) { await lock.focus(); await page.keyboard.press('Enter'); }
        await focusDisplay();
        const slot = Number(await page.locator('.system-workflow__grid-plane--current').getAttribute('data-rail-slot')) - direction;
        await page.evaluate(async slot => {
          window.__incomingImages = [...document.querySelector('[data-rail-slot="' + slot + '"]').querySelectorAll('img')];
          await Promise.all(window.__incomingImages.map(image => image.decode()));
        }, slot);
        const area = await page.locator('.system-workflow__canvas').boundingBox();
        await page.mouse.move(area.x + area.width * (direction < 0 ? .8 : .2), area.y + area.height / 2);
        await page.mouse.down();
        await page.mouse.move(area.x + area.width * (direction < 0 ? .2 : .8), area.y + area.height / 2, { steps: 12 });
        assert.equal(await page.evaluate(() => window.__incomingImages.every(image => image.isConnected && image.complete && image.naturalWidth > 0)), true, 'incoming images remain ready during movement');
        await page.mouse.up();
        await page.waitForFunction(slot => Number(document.querySelector('.system-workflow__grid-plane--current')?.dataset.railSlot) === slot, slot);
        await page.waitForTimeout(400);
      };
      // The current five-slot rail intentionally releases old slots. Only the
      // incoming HOME slot must preserve its prepared elements on arrival.
      const assertSameHomeImages = async () => {
        assert.match(await page.locator('[data-system-workflow-stage]').getAttribute('aria-label'), /HOME/);
        assert.equal(await page.evaluate(() => window.__incomingImages.length > 0 && window.__incomingImages.every(img => img.isConnected
          && img.closest('.system-workflow__grid-plane--current') && img.complete)), true,
        'the incoming HOME slot must retain its prepared image elements on arrival');
      };
      await commitSwipe(-1);
      await assertSameHomeImages();
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'New Grid', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.waitForTimeout(500);
      await commitSwipe(-1); // GRID 04 -> HOME
      await assertSameHomeImages();
      await commitSwipe(1); // HOME -> GRID 04
      await commitSwipe(-1);
      await assertSameHomeImages();
      await page.screenshot({ path: `.browser-test-runtime/home-wrap-persistent-${width}.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
