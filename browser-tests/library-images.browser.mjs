import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5297';
const screenshotDir = await mkdtemp(resolve(tmpdir(), 'inscape-library-images-'));
test('NFTs expand independently and retain chosen images through drag, reload and Preview', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    console.log('Library screenshots:', screenshotDir);
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      const imageRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('https://images.inscape.test/**', (route) => {
        const url = route.request().url();
        imageRequests.push(url);
        if (url.endsWith('/transparent.webp') || url.includes('unavailable')) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ contentType: 'image/webp', path: resolve(url.includes('fallback')
          ? 'public/assets/actors/skull_reaper/full.webp' : 'public/assets/actors/abyssal_eye/full.webp') });
      });
      await page.goto(`${root}/browser-tests/library-images-fixture.html`, { waitUntil: 'networkidle' });

      await page.getByRole('button', { name: 'Library', exact: true }).click();
      const library = page.getByRole('region', { name: 'Library workspace' });
      await page.waitForFunction(() => document.querySelectorAll('.system-workflow__library-item').length === 7);
      const beforeExpansion = await page.evaluate(() => JSON.stringify(window.__imageTest.draft()));
      const open = library.locator('[data-library-images-for="42:0x1111111111111111111111111111111111111111:0x01"]');
      const poses = library.getByRole('button', { name: 'Show 6 images of SKULL REAPER', exact: true });
      await poses.click();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 12);
      assert.equal(await library.getByRole('button', { name: 'Image 2 of MOUNTAIN SIGNAL I', exact: true }).count(), 0);
      assert.ok(!imageRequests.some(url => url.includes('/layer-')), 'folded layers make no image requests');
      await page.screenshot({ path: resolve(screenshotDir, `poses-expanded-${width}.png`) });
      await library.getByRole('button', { name: 'Show 41 images of MOUNTAIN SIGNAL I', exact: true }).click();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 52);
      await library.getByRole('button', { name: 'Fold 41 images of MOUNTAIN SIGNAL I', exact: true }).click();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 12, 'folding layers keeps poses expanded');
      // Navigation and closing the drawer preserve independent browsing choices.
      await library.getByRole('button', { name: 'PORTFOLIO', exact: true }).click();
      await library.getByRole('button', { name: 'All Assets', exact: true }).click();
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 12);
      await library.getByRole('button', { name: 'Fold 6 images of SKULL REAPER', exact: true }).click();
      await open.focus(); await page.keyboard.press('Enter');
      assert.equal(await open.getAttribute('aria-expanded'), 'true');
      assert.equal(await library.locator('.system-workflow__library-item').count(), 9);
      assert.equal(await page.evaluate(() => JSON.stringify(window.__imageTest.draft())), beforeExpansion, 'browsing does not author a scene');
      // Expanded images retain the same placement and category behavior.
      const second = library.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 2 of ABYSSAL STUDY"]')?.getAttribute('aria-disabled') === 'false');
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 3 of ABYSSAL STUDY"]')?.textContent.includes('Image unavailable'));
      assert.equal(await library.getByRole('button', { name: 'Image 3 of ABYSSAL STUDY' }).getAttribute('aria-disabled'), 'true');
      const badge = open;
      assert.equal((await badge.textContent()).trim(), '3');
      assert.deepEqual(await badge.evaluate(node => {
        const style = getComputedStyle(node); return [parseFloat(style.width), parseFloat(style.height), style.borderRadius];
      }), [26, 26, '50%']);
      const beforeFiling = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.length);
      const category = library.getByRole('button', { name: 'FIELD NOTES', exact: true });
      const dragToCategory = async source => {
        const from = await source.boundingBox(), to = await category.boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + 35); await page.mouse.down();
        await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 10 });
        await page.mouse.up();
      };
      await dragToCategory(second);
      await page.waitForFunction(() => document.querySelector('[data-browser-category-id="field-notes"] i')?.textContent === '3');
      await dragToCategory(library.locator('.system-workflow__library-item > button').first());
      assert.equal(await category.locator('i').textContent(), '3', 'cover and attachment file the same NFT once');
      assert.equal(await page.evaluate(() => window.__imageTest.draft().grids[0].placements.length), beforeFiling);
      await library.getByRole('button', { name: 'Create Section', exact: true }).click();
      await library.getByRole('textbox', { name: 'section name', exact: true }).fill('STORY');
      await page.keyboard.press('Enter');
      const section = library.locator('.system-workflow__library-section').filter({ has: page.locator('b', { hasText: 'STORY' }) });
      await category.dragTo(section.locator('header button'));
      await section.getByRole('button', { name: 'FIELD NOTES', exact: true }).waitFor();
      await page.screenshot({ path: resolve(screenshotDir, `choices-${width}.png`) });
      const card = await second.boundingBox();
      const canvas = await page.locator('.system-workflow__canvas').boundingBox();
      await page.mouse.move(card.x + card.width / 2, card.y + 50);
      await page.mouse.down();
      // Drop through the Library onto the covered part of the Display.
      const libraryBounds = await library.boundingBox();
      const dropX = Math.min(libraryBounds.x + libraryBounds.width - 20, canvas.x + canvas.width * .2);
      assert.ok(dropX > canvas.x && dropX < libraryBounds.x + libraryBounds.width);
      await page.mouse.move(dropX, canvas.y + canvas.height * .4, { steps: 12 });
      assert.equal(await library.getAttribute('data-placing'), 'true');
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.system-workflow__library')).opacity) < .2);
      await page.locator('.system-workflow__placement-preview').waitFor();
      await page.getByText('Release to add layer', { exact: true }).waitFor();
      await page.screenshot({ path: resolve(screenshotDir, `drop-feedback-${width}.png`) });
      await page.mouse.up();
      await page.waitForFunction(() => window.__imageTest.draft().grids[0].placements.some(({ selectedMedia }) => selectedMedia));
      const selected = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.find(({ selectedMedia }) => selectedMedia));
      assert.equal(selected.selectedMedia.url, 'https://images.inscape.test/transparent-fallback.webp');
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(selected.stableAssetId, '42:0x1111111111111111111111111111111111111111:0x01');

      const previousIds = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.map(({ id }) => id));
      await second.dblclick();
      await page.waitForFunction((ids) => window.__imageTest.draft().grids[0].placements.some(({ id }) => !ids.includes(id)), previousIds);
      const addedId = await page.evaluate((ids) => window.__imageTest.draft().grids[0].placements.find(({ id }) => !ids.includes(id)).id, previousIds);
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${addedId}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"]`).getAttribute('aria-pressed'), 'false');
      await open.click();
      assert.equal(await open.getAttribute('aria-expanded'), 'false');
      assert.equal(await library.locator('.system-workflow__library-item').count(), 7);
      assert.equal(await open.evaluate(node => node === document.activeElement), true, 'folding retains keyboard focus');
      await page.keyboard.press('Space');
      assert.equal(await library.locator('.system-workflow__library-item').count(), 9, 'expanding does not duplicate source records');
      // A refreshed cover replaces the decoded preview already cached for this NFT.
      await page.evaluate(() => window.__imageTest.replaceCover('https://images.inscape.test/refreshed.webp'));
      await page.waitForFunction(() => document.querySelector('.system-workflow__library-item img')?.getAttribute('src') === 'https://images.inscape.test/refreshed.webp');
      // A failed cover must not remove its usable attachments or fold control.
      await page.evaluate(() => window.__imageTest.replaceCover('https://images.inscape.test/unavailable-cover.webp'));
      await page.waitForFunction(() => document.querySelector('.system-workflow__library-item')?.textContent.includes('Media unavailable'));
      assert.equal(await second.count(), 1);
      const beforeKeyboard = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.length);
      await second.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(count => window.__imageTest.draft().grids[0].placements.length === count + 1, beforeKeyboard);
      if (width === 1440) {
        await library.getByRole('button', { name: 'Resize Library', exact: true }).focus();
        await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
        await page.screenshot({ path: resolve(screenshotDir, 'expanded-wide.png') });
      }
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 7, 'reload starts with one tile per NFT');
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      const restored = await page.evaluate((selected) => window.__imageTest.draft().grids[0].placements.find(({ id }) => id === selected.id), selected);
      assert.deepEqual(restored.selectedMedia, selected.selectedMedia);
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"] img`).getAttribute('src'), selected.selectedMedia.url);
      const published = await page.evaluate((id) => window.__imageTest.preview().grids[0].placements.find((placement) => placement.id === id), selected.id);
      assert.equal(published.asset.media.url, selected.selectedMedia.url);
      assert.equal(published.asset.stableAssetId, selected.stableAssetId);
      await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"]`).focus();
      await page.keyboard.down('Space');
      assert.equal(await page.locator('.system-workflow__canvas').getAttribute('data-space-navigation'), 'true', 'Space navigation still works with artwork focused');
      await page.keyboard.up('Space');
      await page.screenshot({ path: resolve(screenshotDir, `reopened-${width}.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
