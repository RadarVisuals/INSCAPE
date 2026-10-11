import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { activate, openDisplayTool } from './fixtures/display-controls.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
for (const workbench of [false, true]) for (const width of [1440, 390]) {
  test(`visitor inspection uses the shared Display (${workbench ? 'saved layout' : 'old document'}, ${width}px)`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        return route.fulfill({ contentType: route.request().resourceType() === 'image' ? 'image/svg+xml' : 'application/json',
          body: route.request().resourceType() === 'image'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect fill="#602bc3" width="1600" height="900"/></svg>' : '{"data":{}}' });
      });
      await page.goto(`${origin}/browser-tests/fixture.html${workbench ? '?workbench=1' : ''}`);
      if (workbench) {
        await page.getByRole('button', { name: 'Close Identity', exact: true }).click();
        await activate(page, page.getByRole('button', { name: 'Open Display', exact: true }));
      }
      const board = page.getByRole('article', { name: 'Display Module', exact: true });
      await board.waitFor();
      const source = board.locator('.visitor-grid-world__grid-plane--current [data-placement-id="art:Alpha:https"]');
      await page.waitForFunction(() => document.querySelector('.visitor-grid-world__grid-plane--current [data-placement-id="art:Alpha:https"]')?.dataset.mediaState === 'ready');
      await source.focus(); await page.keyboard.press('Enter');
      const viewer = board.getByRole('group', { name: 'Artwork inspection', exact: true });
      await viewer.waitFor();
      await page.waitForFunction(() => document.querySelector('[data-inspection-phase="active"]'));
      assert.equal(await page.locator('.lattice-focus-viewer__rack, [data-shared-tool="layers"], [data-shared-tool="metadata"]').count(), 0);
      assert.equal(await board.getByRole('button', { name: 'Lock Display Module composition', exact: true }).count(), 0);
      await page.keyboard.press('ArrowRight');
      assert.equal(await viewer.count(), 1, 'keyboard artwork navigation retains the shared viewer');
      await page.screenshot({ path: `.browser-test-runtime/visitor-inspection-${workbench ? 'saved' : 'old'}-${width}.png` });
      await activate(page, board.getByRole('button', { name: 'Close artwork viewer', exact: true }));
      await viewer.waitFor({ state: 'detached' });
      await openDisplayTool(page, board, 'METADATA');
      const metadata = page.locator('[data-shared-tool="metadata"]');
      await activate(page, board.getByRole('button', { name: 'Read metadata for Alpha Artwork 1', exact: true }));
      assert.match(await metadata.innerText(), /Alpha Artwork 1 public fixture description/);
      assert.equal(await viewer.count(), 0);
      await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
      await source.focus(); await page.keyboard.press('Enter'); await viewer.waitFor();
      await page.keyboard.press('Escape'); await viewer.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.dataset.placementId === 'art:Alpha:https');
      assert.equal(await source.evaluate(node => node === document.activeElement), true);
      // Navigation remains available after inspecting and reading metadata.
      const grid = () => page.locator('[data-active-grid-id]').first().getAttribute('data-active-grid-id');
      const initial = await grid();
      await activate(page, page.getByRole('button', { name: 'Next Grid', exact: true }));
      assert.notEqual(await grid(), initial);
      await activate(page, page.getByRole('button', { name: 'Previous Grid', exact: true }));
      assert.equal(await grid(), initial);
      await source.focus(); await page.keyboard.press('Enter'); await viewer.waitFor();
      await page.evaluate(() => window.__fixture.visit('0x2222222222222222222222222222222222222222'));
      await page.waitForFunction(() => window.__fixture.address.startsWith('0x2222'));
      await viewer.waitFor({ state: 'detached' });
      assert.deepEqual(await page.evaluate(() => window.__visitorStorageOps.filter(item => ['setItem', 'removeItem', 'clear'].includes(item.method))), []);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
