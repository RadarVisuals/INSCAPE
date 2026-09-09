import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
for (const workbench of [false, true]) for (const width of [1440, 390]) {
  test(`visitor inspection uses the shared Display (${workbench ? 'saved layout' : 'old document'}, ${width}px)`, { timeout: 60_000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(10_000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        if (new URL(request.url()).origin === origin) return route.continue();
        if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#602bc3" d="M800 0 1600 900H0Z"/><circle fill="#121313" cx="800" cy="500" r="160"/></svg>' });
        return route.fulfill({ contentType: 'application/json', body: '{"data":{}}' });
      });
      await page.goto(`${origin}/browser-tests/fixture.html${workbench ? '?workbench=1' : ''}`);
      if (workbench) {
        await page.getByRole('button', { name: 'Close Identity', exact: true }).click();
        await page.getByRole('button', { name: 'Open Display', exact: true }).click();
      }
      const board = page.getByRole('article', { name: 'Display Module', exact: true });
      await board.waitFor();
      const source = page.locator('[data-placement-id="art:Alpha:https"]');
      await page.waitForFunction(() => document.querySelector('[data-placement-id="art:Alpha:https"]')?.dataset.mediaState === 'ready');
      await source.focus(); await page.keyboard.press('Enter');
      const viewer = board.locator('.lattice-focus-viewer[data-contained]');
      await viewer.waitFor();
      await page.waitForFunction(() => document.querySelector('.lattice-focus-viewer')?.dataset.phase === 'open');
      assert.equal(await page.locator('.lattice-focus-viewer__rack').count(), 0);
      assert.equal(await page.getByRole('tab', { name: 'Layers', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Layers', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).count(), 0);
      const bay = page.getByRole('complementary', { name: 'Display Module instruments', exact: true });
      assert.match(await bay.innerText(), /Alpha Artwork 1 public fixture description/);
      assert.match(await bay.innerText(), /Published fixture collection/);
      const frame = await board.boundingBox(); const focus = await viewer.boundingBox();
      assert.ok(focus.x >= frame.x - 1 && focus.y >= frame.y - 1 && focus.x + focus.width <= frame.x + frame.width + 1);
      const bayFrame = await bay.boundingBox();
      assert.ok(bayFrame.x >= 0 && bayFrame.x + bayFrame.width <= width + 1 && bayFrame.y + bayFrame.height <= 900, JSON.stringify(bayFrame));
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.lattice-focus-viewer__board-controls')).opacity) === 1);
      await page.screenshot({ path: `.browser-test-runtime/visitor-inspection-${workbench ? 'saved' : 'old'}-${width}.png` });
      await board.getByRole('button', { name: 'Next artwork', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.system-workflow__instrument-scope')?.textContent.includes('Alpha IPFS Artwork'));
      assert.match(await bay.innerText(), /Alpha IPFS Artwork public fixture description/);
      await bay.getByText('Source details', { exact: true }).click();
      assert.match(await bay.innerText(), /TOKEN ID \/ TOKEN/);
      await bay.getByRole('button', { name: 'Detach Metadata', exact: true }).click();
      const detached = page.locator('.system-workflow__instrument-window');
      await detached.waitFor();
      assert.equal(await page.locator('.system-workflow__metadata-module-content').count(), 1);
      await detached.getByRole('button', { name: /Attach Metadata/ }).click();
      await bay.waitFor();
      await page.waitForFunction(() => document.querySelector('.lattice-focus-viewer__board-controls')?.dataset.phase === 'open');
      await board.getByRole('button', { name: 'Close artwork viewer', exact: true }).click();
      await viewer.waitFor({ state: 'detached' });
      await page.waitForFunction(() => !document.querySelector('[data-viewer-source-hidden]'));
      await page.getByRole('button', { name: 'Metadata', exact: true }).click();
      await source.focus(); await page.keyboard.press('Enter');
      await viewer.waitFor();
      await page.waitForFunction(() => document.querySelector('.lattice-focus-viewer')?.dataset.phase === 'open');
      await page.keyboard.press('Escape');
      await viewer.waitFor({ state: 'detached' });
      assert.equal(await source.evaluate(node => node === document.activeElement), true);
      if (width === 390) {
        await page.getByRole('button', { name: 'Play Grids', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-active-grid-id]')?.dataset.activeGridId === 'grid:alpha-archive');
        await page.getByRole('button', { name: 'Pause Grids', exact: true }).click();
        await page.getByRole('button', { name: 'Previous Grid', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-active-grid-id]')?.dataset.activeGridId !== 'grid:alpha-archive');
      }
      await source.click(); await viewer.waitFor();
      await page.evaluate(() => window.__fixture.visit('0x2222222222222222222222222222222222222222'));
      await page.waitForFunction(() => window.__fixture.address.startsWith('0x2222'));
      assert.equal(await page.locator('.lattice-focus-viewer').count(), 0);
      const writes = await page.evaluate(() => window.__visitorStorageOps.filter(({ method }) => ['setItem', 'removeItem', 'clear'].includes(method)));
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
