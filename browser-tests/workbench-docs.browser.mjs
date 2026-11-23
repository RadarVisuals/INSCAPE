import { openEditorMenu, editorMenu } from './fixtures/editor-menu.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

test('Docs tabs explain the current modules and remain usable at wide and narrow widths', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === (process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173') ? route.continue() : route.abort());
    await page.goto(`${process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173'}/browser-tests/workbench-storage-fixture.html?seed=1&legacyDisplay=1`);
    await page.locator('.text-window').waitFor();
    assert.ok((await page.evaluate(() => window.savedDraft())).grids.length > 0);
    assert.equal(await page.locator('[data-display-instance]').count(), 0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 780 });
      await openEditorMenu(page, 'Docs');
      const docs = page.getByRole('dialog', { name: 'Docs' });
      assert.equal(await docs.getByRole('tab', { name: /Display/ }).count(), 0);
      await docs.getByRole('tab', { name: 'Studio', exact: true }).click();
      await page.keyboard.press('ArrowRight');
      assert.equal(await docs.getByRole('tab', { name: 'Identity', exact: true }).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('End');
      assert.match(await docs.getByRole('tabpanel').innerText(), /Preparing does not upload/);
      const bounds = await docs.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0);
      await page.screenshot({ path: `.browser-test-runtime/workbench-docs-${width}.png` });
      await docs.getByRole('tabpanel').evaluate(node => { node.scrollTop = node.scrollHeight; });
      await docs.getByRole('tab', { name: 'Identity', exact: true }).click();
      assert.equal(await docs.getByRole('tabpanel').evaluate(node => node.scrollTop), 0);
      assert.match(await docs.getByRole('tabpanel').innerText(), /does not rename your Universal Profile/);
      await page.keyboard.press('Escape');
      await docs.waitFor({ state: 'detached' });
      assert.equal(await editorMenu(page, 'Docs').evaluate(node => node === document.activeElement), true);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
