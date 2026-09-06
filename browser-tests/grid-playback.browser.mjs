import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('Grid playback loops without dwell, pauses, and stays local', { timeout: 65000 }, async () => {
  const origin = 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/development/owner/system-workflow`);
      assert.equal(await page.getByRole('button', { name: 'Play Grids', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.waitForTimeout(500);
      await page.evaluate(() => { window.__playWrites = 0; addEventListener('inscape:review-storage-write', () => window.__playWrites++); });
      const offset = () => page.locator('.system-workflow__grid-track').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41);
      await page.getByRole('button', { name: 'Play Grids', exact: true }).click();
      await page.waitForTimeout(600);
      assert.ok(await offset() < -1);
      await page.getByRole('button', { name: 'Pause Grids', exact: true }).click();
      const paused = await offset();
      await page.waitForTimeout(250);
      assert.equal(await offset(), paused);
      await page.screenshot({ path: `.browser-test-runtime/grid-playback-${width}.png` });
      await page.getByRole('button', { name: 'Play Grids', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') === 'HOME Grid');
      await page.waitForTimeout(150);
      assert.ok(await offset() < -1, 'next slide starts immediately at the wrap');
      await page.waitForFunction(() => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') === 'GRID 02 Grid');
      await page.waitForTimeout(150);
      assert.ok(await offset() < -1, 'next slide starts immediately at each boundary');
      await page.locator('.system-workflow__canvas').click({ position: { x: 30, y: 30 } });
      assert.equal(await page.getByRole('button', { name: 'Play Grids', exact: true }).count(), 1);
      assert.equal(await offset(), 0);
      if (width === 390) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const initial = await page.locator('[data-system-workflow-stage]').getAttribute('aria-label');
        await page.getByRole('button', { name: 'Play Grids', exact: true }).click();
        await page.waitForTimeout(300);
        assert.equal(await offset(), 0, 'reduced motion does not slide');
        await page.waitForFunction(label => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') !== label, initial);
        assert.equal(await offset(), 0);
        await page.getByRole('button', { name: 'Pause Grids', exact: true }).click();
      }
      assert.equal(await page.evaluate(() => window.__playWrites), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
