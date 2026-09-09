import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('HOME media is already mounted and decoded before either swipe direction', { timeout: 30000 }, async () => {
  const origin = 'http://127.0.0.1:5173';
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
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
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
      const box = await page.locator('.system-workflow__canvas').boundingBox();
      for (const direction of [-1, 1]) {
        await page.keyboard.down('Space');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + direction * 20, box.y + box.height / 2);
        assert.equal(await page.evaluate(() => window.__neighborImages.every(img => img.isConnected
          && getComputedStyle(img).visibility === 'visible' && img.complete && img.naturalWidth > 0)), true);
        await page.screenshot({ path: `.browser-test-runtime/home-ready-${width}-${direction}.png` });
        await page.mouse.up();
        await page.keyboard.up('Space');
        await page.waitForTimeout(400);
      }
      const commitSwipe = async (direction) => {
        const area = await page.locator('.system-workflow__canvas').boundingBox();
        await page.keyboard.down('Space');
        await page.mouse.move(area.x + area.width * (direction < 0 ? .8 : .2), area.y + area.height / 2);
        await page.mouse.down();
        await page.mouse.move(area.x + area.width * (direction < 0 ? .2 : .8), area.y + area.height / 2, { steps: 6 });
        await page.mouse.up();
        await page.keyboard.up('Space');
        await page.waitForTimeout(400);
      };
      const assertSameHomeImages = async () => {
        assert.match(await page.locator('[data-system-workflow-stage]').getAttribute('aria-label'), /HOME/);
        assert.equal(await page.evaluate(() => window.__neighborImages.every(img => img.isConnected
          && img.closest('[data-system-workflow-placement-id]') && img.complete)), true,
        'the incoming image elements must become editable without being replaced');
      };
      await commitSwipe(-1);
      await assertSameHomeImages();
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
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
