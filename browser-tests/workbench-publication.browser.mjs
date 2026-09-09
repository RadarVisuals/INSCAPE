import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
test('published Workbench restores new Identity content, module layout and session-only interaction', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        if (new URL(request.url()).origin === origin) return route.continue();
        if (request.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#602bc3" d="M800 0 1600 900H0Z"/><circle fill="#121313" cx="800" cy="500" r="160"/></svg>' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
      });
      await page.goto(`${origin}/browser-tests/fixture.html?workbench=1`);
      const identity = page.locator('.identity-module');
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Edit Identity', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Layers', exact: true }).count(), 0);
      assert.equal(await page.locator('[aria-label="Display Module"]').count(), 0);
      await identity.locator('.identity-module__expand').click();
      await page.getByText('The Underneath', { exact: true }).waitFor();
      await page.screenshot({ path: `.browser-test-runtime/published-workbench-identity-${width}.png` });
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).click();
      await page.getByRole('button', { name: 'Open Lunar Desert', exact: true }).dblclick();
      const display = page.locator('[aria-label="Display Module"]');
      await display.waitFor();
      const bounds = await display.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, JSON.stringify(bounds));
      await page.screenshot({ path: `.browser-test-runtime/published-workbench-display-${width}.png` });
      await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-active-grid-id]')?.dataset.activeGridId === 'grid:alpha-archive');
      await page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).waitFor();
      const writes = await page.evaluate(() => window.__visitorStorageOps.filter(({ method }) => ['setItem', 'removeItem', 'clear'].includes(method)));
      assert.deepEqual(writes, []);
      await page.reload();
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).waitFor();
      assert.equal(await page.locator('[aria-label="Display Module"]').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
