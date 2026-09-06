import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('editor and Preview swipe continuously through the ordered Grids', { timeout: 60_000 }, async () => {
  const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/development/owner/system-workflow`);
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
      await page.getByRole('button', { name: 'Make GRID 02 public', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
      await page.getByRole('button', { name: 'Make GRID 03 public', exact: true }).click();
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.evaluate(() => { window.__wrapWrites = 0; addEventListener('inscape:review-storage-write', () => window.__wrapWrites++); });
      await page.waitForTimeout(500);
      const swipe = async (selector, direction, settle = true) => {
        const box = await page.locator(selector).boundingBox();
        const startX = box.x + box.width * (direction === 'next' ? .8 : .2);
        const endX = box.x + box.width * (direction === 'next' ? .2 : .8);
        await page.keyboard.down('Space');
        await page.mouse.move(startX, box.y + box.height * .5);
        await page.mouse.down();
        await page.mouse.move(endX, box.y + box.height * .5, { steps: 6 });
        await page.mouse.up();
        await page.keyboard.up('Space');
        if (settle) await page.waitForTimeout(400);
      };
      const editor = '[data-system-workflow-stage]';
      await swipe('.system-workflow__canvas', 'next', width === 390);
      if (width !== 390) {
        await swipe('.system-workflow__canvas', 'previous', false);
        assert.equal(await page.locator('.system-workflow__canvas').getAttribute('data-swipe-direction'), 'next',
          'a rapid reverse gesture must not replace the wrapping planes during settlement');
        await page.screenshot({ path: '.browser-test-runtime/grid-wrap-rapid.png' });
        await page.waitForTimeout(400);
      }
      assert.match(await page.locator(editor).getAttribute('aria-label'), /HOME/);
      await swipe('.system-workflow__canvas', 'previous');
      assert.match(await page.locator(editor).getAttribute('aria-label'), /GRID 03/);
      await page.screenshot({ path: `.browser-test-runtime/grid-wrap-editor-${width}.png` });
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      const nav = page.getByRole('group', { name: 'Published Grid navigation' });
      await nav.waitFor();
      const viewport = '.visitor-grid-world__viewport';
      await swipe(viewport, 'previous', width === 390);
      if (width !== 390) {
        await swipe(viewport, 'next', false);
        await page.waitForTimeout(400);
      }
      assert.match(await nav.innerText(), /GRID 03/);
      await swipe(viewport, 'next');
      assert.match(await nav.innerText(), /HOME/);
      await page.getByRole('button', { name: 'Previous Grid', exact: true }).click();
      assert.match(await nav.innerText(), /GRID 03/);
      await page.screenshot({ path: `.browser-test-runtime/grid-wrap-preview-${width}.png` });
      assert.equal(await page.evaluate(() => window.__wrapWrites), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
