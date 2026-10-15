import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5239';
const address = '0x' + '1'.repeat(40);
const url = origin + '/browser-tests/profile-overview-fixture.html?view=' + address + '&linked=1';

test('reception reuses intact Displays and their scene-linked Text, then returns to the canvas', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url);
    await page.locator('[data-text-id="text:passages"] .text-scene-track').waitFor();
    await page.getByRole('button', { name: 'Run module checks' }).click();
    await page.waitForFunction(() => /PASS|FAIL/.test(document.querySelector('output').textContent));
    assert.match(await page.locator('output').textContent(), /— PASS$/);
    assert.equal(await page.getByRole('dialog').count(), 0);
    for (const width of [1440, 800]) {
      await page.setViewportSize({ width, height: 1000 });
      const size = await page.locator('.profile-overview').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
      assert.ok(size.scroll <= size.width + 1);
    }
    await page.getByRole('link', { name: 'Canvas', exact: true }).click();
    await page.locator('[data-workbench]').waitFor();
    await page.locator('[data-text-id="text:passages"] .text-scene-track').waitFor();
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-text-id="text:sections"]').textContent.includes('SECOND SECTION'));
    assert.match(await page.locator('[data-text-id="text:passages"]').textContent(), /SECOND PASSAGE/);
    await page.getByRole('link', { name: '← Profile overview' }).click();
    await page.locator('.profile-overview').waitFor();
    assert.equal(await page.locator('[data-workbench]').count(), 0);
    await page.goto(url + '&module=display%3Aprimary&grid=grid%3Asecond');
    await page.waitForFunction(() => document.querySelector('[data-display-instance="display:primary"] [data-active-grid-id]')?.dataset.activeGridId === 'grid:second');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
