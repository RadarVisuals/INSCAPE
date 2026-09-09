import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const screenshotDir = resolve('.browser-test-runtime/library-images');
test('one token exposes its images and retains a chosen image through drag, reload and Preview', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    await mkdir(screenshotDir, { recursive: true });
    for (const width of [1440, 1024]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('https://images.inscape.test/**', (route) => {
        const url = route.request().url();
        if (url.endsWith('/transparent.webp') || url.includes('unavailable')) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ contentType: 'image/webp', path: resolve(url.includes('fallback')
          ? 'public/assets/actors/skull_reaper/full.webp' : 'public/assets/actors/abyssal_eye/full.webp') });
      });
      await page.goto(`${root}/browser-tests/library-images-fixture.html`, { waitUntil: 'networkidle' });
      if (width === 1024) await page.getByRole('button', { name: 'Layers', exact: true }).click();
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      const library = page.getByRole('region', { name: 'Library workspace' });
      await page.waitForFunction(() => document.querySelectorAll('.system-workflow__library-item').length === 7);
      const open = library.getByRole('button', { name: 'Open 3 images of ABYSSAL STUDY', exact: true });
      await open.click();
      const second = library.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 2 of ABYSSAL STUDY"]')?.getAttribute('aria-disabled') === 'false');
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 3 of ABYSSAL STUDY"]')?.textContent.includes('Image unavailable'));
      assert.equal(await library.getByRole('button', { name: 'Image 3 of ABYSSAL STUDY' }).getAttribute('aria-disabled'), 'true');
      await page.screenshot({ path: resolve(screenshotDir, `choices-${width}.png`) });
      const card = await second.boundingBox();
      const canvas = await page.locator('.system-workflow__canvas').boundingBox();
      await page.mouse.move(card.x + card.width / 2, card.y + 50);
      await page.mouse.down();
      // The narrow Layers overlay can cover the centre; target exposed Stage.
      await page.mouse.move(canvas.x + canvas.width * .2, canvas.y + canvas.height * .2, { steps: 8 });
      await page.locator('.system-workflow__placement-preview').waitFor();
      await page.getByText('Release to add layer', { exact: true }).waitFor();
      await page.screenshot({ path: resolve(screenshotDir, `drop-feedback-${width}.png`) });
      await page.mouse.up();
      await page.waitForFunction(() => window.__imageTest.draft().grids[0].placements.some(({ selectedMedia }) => selectedMedia));
      const selected = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.find(({ selectedMedia }) => selectedMedia));
      assert.equal(selected.selectedMedia.url, 'https://images.inscape.test/transparent-fallback.webp');
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(selected.stableAssetId, '42:0x1111111111111111111111111111111111111111:0x01');
      if (width === 1440) assert.equal(await page.locator('.system-workflow__layer-row[data-selected="true"]').count(), 1);
      const previousIds = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.map(({ id }) => id));
      await second.dblclick();
      await page.waitForFunction((ids) => window.__imageTest.draft().grids[0].placements.some(({ id }) => !ids.includes(id)), previousIds);
      const addedId = await page.evaluate((ids) => window.__imageTest.draft().grids[0].placements.find(({ id }) => !ids.includes(id)).id, previousIds);
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${addedId}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"]`).getAttribute('aria-pressed'), 'false');
      await library.getByRole('button', { name: 'Back to Library assets' }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open 3 images of ABYSSAL STUDY');
      assert.equal(await library.locator('.system-workflow__library-item').count(), 7, 'images never inflate token counts');
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.reload({ waitUntil: 'networkidle' });
      const restored = await page.evaluate((selected) => window.__imageTest.draft().grids[0].placements.find(({ id }) => id === selected.id), selected);
      assert.deepEqual(restored.selectedMedia, selected.selectedMedia);
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"] img`).getAttribute('src'), selected.selectedMedia.url);
      const published = await page.evaluate((id) => window.__imageTest.preview().grids[0].placements.find((placement) => placement.id === id), selected.id);
      assert.equal(published.asset.media.url, selected.selectedMedia.url);
      assert.equal(published.asset.stableAssetId, selected.stableAssetId);
      await page.screenshot({ path: resolve(screenshotDir, `reopened-${width}.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
