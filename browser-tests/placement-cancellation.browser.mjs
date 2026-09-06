import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('Escape and closing the Library cancel placement, including deferred image dimensions', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/OwnerSystemWorkflowRuntime.jsx*', async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace('await decodeOwnerSystemWorkflowAssetDimensions(asset)',
          'await (globalThis.__holdPlacementDimensions ? new Promise(resolve => { globalThis.__releasePlacementDimensions = () => resolve({width:2000,height:2000}); }) : decodeOwnerSystemWorkflowAssetDimensions(asset))');
        return route.fulfill({ response, body });
      });
      await page.route('https://images.inscape.test/**', route => route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' }));
      await page.goto('http://127.0.0.1:5173/browser-tests/library-images-fixture.html');
      const snapshot = () => page.evaluate(() => JSON.stringify(window.__imageTest.draft()));
      const original = await snapshot();
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.getByRole('button', { name: 'Open 3 images of ABYSSAL STUDY', exact: true }).click();
      const card = page.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 2 of ABYSSAL STUDY"]')?.getAttribute('aria-disabled') === 'false');
      const source = await card.boundingBox();
      const stage = await page.locator('.system-workflow__canvas').boundingBox();
      await page.mouse.move(source.x + source.width / 2, source.y + 40);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 8 });
      await page.locator('.system-workflow__placement-preview').waitFor();
      await page.keyboard.press('Escape');
      await page.mouse.up();
      assert.equal(await snapshot(), original);
      assert.equal(await page.locator('.system-workflow__placement-preview').count(), 0);
      assert.equal(await card.isVisible(), true, 'Escape cancels the drag while retaining the Library');
      await page.evaluate(() => { window.__holdPlacementDimensions = true; });
      await card.dblclick();
      await page.waitForFunction(() => typeof window.__releasePlacementDimensions === 'function');
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__releasePlacementDimensions());
      await page.waitForTimeout(100);
      assert.equal(await snapshot(), original, 'a delayed decode cannot place after closing the Library');
      await page.evaluate(() => { window.__releasePlacementDimensions = null; });
      const canvas = page.locator('.system-workflow__canvas');
      await canvas.evaluate(node => {
        const box = node.getBoundingClientRect();
        const transfer = new DataTransfer();
        transfer.setData('application/x-inscape-asset', '42:0x1111111111111111111111111111111111111111:0x01');
        node.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer, clientX: box.x + 40, clientY: box.y + 40 }));
      });
      await page.waitForFunction(() => typeof window.__releasePlacementDimensions === 'function');
      await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).click();
      await page.evaluate(() => window.__releasePlacementDimensions());
      await page.waitForTimeout(100);
      assert.equal(await snapshot(), original, 'a pending native drop cannot bypass a newly enabled composition lock');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
