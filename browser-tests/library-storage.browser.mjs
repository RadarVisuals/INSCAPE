import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('Library reports failed storage, preserves the form, saves before reload and rejects an external overwrite', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173'}/browser-tests/library-storage-fixture.html`);
      await page.getByRole('button', { name: 'Create Category', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'category name', exact: true });
      await input.fill('Keep my category');
      await page.evaluate(() => { window.storageTest.denied = true; });
      await input.press('Enter');
      await page.getByRole('alert').waitFor();
      assert.equal(await page.evaluate(() => window.storageTest.saved()), null);
      assert.equal(await page.evaluate(() => window.storageTest.store.getState().workspace.folders.length), 0);
      await page.screenshot({ path: `.browser-test-runtime/library-storage-error-${width}.png` });
      await page.evaluate(() => { window.storageTest.denied = false; });
      // A rejected save must keep the user's entered name, ready for retry.
      assert.equal(await input.inputValue(), 'Keep my category');
      await input.press('Enter');
      await page.waitForFunction(() => window.storageTest.store.getState().workspace.folders.length === 1);
      await page.reload();
      await page.waitForFunction(() => window.storageTest?.store.getState().workspace.folders.length === 1);
      await page.evaluate(() => window.storageTest.externalChange());
      await page.getByRole('button', { name: 'Create Category', exact: true }).click();
      await input.fill('Must not overwrite'); await input.press('Enter');
      await page.getByRole('alert').waitFor();
      assert.match(await page.getByRole('alert').innerText(), /another tab/);
      assert.deepEqual(await page.evaluate(() => JSON.parse(window.storageTest.saved()).favorites), ['external']);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
