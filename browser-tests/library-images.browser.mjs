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
      page.setDefaultTimeout(10000);
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

      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
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
      await page.getByRole('button', { name: 'PORTFOLIO', exact: true }).click();
      await page.getByRole('button', { name: 'All Assets', exact: true }).click();
      await page.getByRole('button', { name: 'Close Library', exact: true }).click();
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      await library.locator('.system-workflow__library-item').first().waitFor();
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
      const badgeBox = await badge.boundingBox();
      const previewBox = await badge.locator('..').locator('.lattice-browser-asset__media').first().boundingBox();
      assert.equal(badgeBox.height, 24);
      assert.ok(badgeBox.width >= 24);
      assert.equal(await badge.locator('svg').count(), 0);
      assert.ok(badgeBox.y >= previewBox.y && badgeBox.y + badgeBox.height <= previewBox.y + previewBox.height, 'number-only count overlays the cover');
      const beforeFiling = await page.evaluate(() => window.__imageTest.draft().grids[0].placements.length);
      const category = page.getByRole('button', { name: 'FIELD NOTES', exact: true });
      const dragToCategory = async source => {
        const from = await source.boundingBox(), to = await category.boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + 35); await page.mouse.down();
        await page.mouse.move(to.x + 30, to.y + to.height / 2, { steps: 10 });
        await page.mouse.up();
      };
      await dragToCategory(second);
      await page.waitForFunction(() => document.querySelector('[data-browser-category-id="field-notes"] i')?.textContent === '3');
      await category.click();
      assert.equal(await library.locator('[data-library-images-for="42:0x1111111111111111111111111111111111111111:0x01"]').count(), 0);
      assert.equal(await library.getByRole('button', { name: 'Image 1 of ABYSSAL STUDY', exact: true }).locator('img').getAttribute('src'),
        'https://images.inscape.test/transparent-fallback.webp', 'dragging files the actual decoded image');
      await page.getByRole('button', { name: 'All Assets', exact: true }).click();
      await dragToCategory(library.locator('.system-workflow__library-item > button').first());
      assert.equal(await category.locator('i').textContent(), '3', 'filing the whole NFT replaces its narrowed image selection');
      await category.click();
      assert.equal(await library.locator('[data-library-images-for="42:0x1111111111111111111111111111111111111111:0x01"]').count(), 1, 'the folder can expand the complete NFT');
      await page.getByRole('button', { name: 'All Assets', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__imageTest.draft().grids[0].placements.length), beforeFiling);
      await page.getByRole('button', { name: 'New Library item', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Section', exact: true }).click();
      await page.getByRole('textbox', { name: 'section name', exact: true }).fill('STORY');
      await page.keyboard.press('Enter');
      const section = page.locator('.system-workflow__library-section').filter({ has: page.locator('b', { hasText: 'STORY' }) });
      await category.dragTo(section.locator('.system-workflow__library-section-toggle'));
      await section.getByRole('button', { name: 'FIELD NOTES', exact: true }).waitFor();
      await page.screenshot({ path: resolve(screenshotDir, `choices-${width}.png`) });
      const card = await second.boundingBox();
      const canvas = await page.locator('[data-system-workflow-artboard]').first().boundingBox();
      await page.mouse.move(card.x + card.width / 2, card.y + 50);
      await page.mouse.down();
      // Drop onto the exposed Display, below the fixed editor header.
      const libraryBounds = await library.boundingBox();
      const dropX = Math.max(libraryBounds.x + libraryBounds.width + 8, canvas.x + canvas.width * .2);
      const top = Math.max(80, canvas.y), bottom = Math.min(700, canvas.y + canvas.height);
      assert.ok(bottom > top, 'the Display has an exposed drop surface');
      const dropY = (top + bottom) / 2;
      assert.ok(dropX > canvas.x && dropX < canvas.x + canvas.width, 'drop leaves the Library before targeting the canvas');
      await page.mouse.move(dropX, dropY, { steps: 12 });
      assert.equal(await library.getAttribute('data-placing'), 'true');
      await page.waitForFunction(() => { let node = document.querySelector('.system-workflow__library'), opacity = 1;
        for (; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity); return opacity < .2; });
      await page.mouse.move(dropX + 1, dropY);
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
        await page.getByRole('button', { name: 'Resize Layers and Library panel from right', exact: true }).focus();
        await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
        await page.screenshot({ path: resolve(screenshotDir, 'expanded-wide.png') });
      }
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      await library.locator('.system-workflow__library-item').first().waitFor();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 7, 'reload starts with one tile per NFT');
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      const restored = await page.evaluate((selected) => window.__imageTest.draft().grids[0].placements.find(({ id }) => id === selected.id), selected);
      assert.deepEqual(restored.selectedMedia, selected.selectedMedia);
      assert.equal(await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"] img`).getAttribute('src'), selected.selectedMedia.url);
      const published = await page.evaluate((id) => window.__imageTest.preview().grids[0].placements.find((placement) => placement.id === id), selected.id);
      assert.equal(published.asset.media.url, selected.selectedMedia.url);
      assert.equal(published.asset.stableAssetId, selected.stableAssetId);
      await page.locator(`.system-workflow__placement[data-system-workflow-placement-id="${selected.id}"]`).focus();
      const pan = () => page.locator('main.system-workflow').evaluate(node => ({
        x: Number(node.dataset.workbenchCameraX) || 0,
        y: Number(node.dataset.workbenchCameraY) || 0,
      }));
      const beforePan = await pan();
      const beforeNavigation = await page.evaluate(() => JSON.stringify(window.__imageTest.draft().grids));
      const stage = await page.locator('.system-workflow__canvas').boundingBox();
      await page.keyboard.down('Space');
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2); await page.mouse.down();
      await page.mouse.move(stage.x + stage.width / 2 + 32, stage.y + stage.height / 2 + 18, { steps: 4 }); await page.mouse.up();
      await page.keyboard.up('Space');
      assert.deepEqual(await pan(), { x: beforePan.x + 32, y: beforePan.y + 18 }, 'Space pans the Workbench with artwork focused');
      assert.equal(await page.evaluate(() => JSON.stringify(window.__imageTest.draft().grids)), beforeNavigation, 'navigation preserves the artwork composition');
      await page.screenshot({ path: resolve(screenshotDir, `reopened-${width}.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});


test('small previews place original media immediately and upgrade without changing authored geometry', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  let release;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(10000);
    const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
    const original = 'https://api.universalprofile.cloud/ipfs/QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs/full.webp';
    const wait = new Promise(resolve => { release = resolve; });
    await page.route('https://images.inscape.test/**', route => route.abort());
    await page.route('https://api.universalprofile.cloud/**', async route => {
      const url = route.request().url(); requests.push(url);
      if (url.endsWith('notes.txt')) return route.fulfill({ contentType: 'text/plain', body: 'Artist notes' });
      if (url.endsWith('animated.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="green"><animate attributeName="opacity" values="1;.5;1" dur="2s" repeatCount="indefinite"/></rect></svg>' });
      if (url === original) await wait;
      return route.fulfill({ contentType: 'image/webp', path: resolve('public/assets/actors/abyssal_eye/full.webp') });
    });
    await page.goto(root + '/browser-tests/library-images-fixture.html?empty');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    await page.evaluate(() => window.__imageTest.replaceMetadata({ images: [[{ url: 'ipfs://QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs/full.webp', width: 2000, height: 2000, fileType: 'image/webp' }]],
      assets: [{ url: 'ipfs://QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs/animated.svg', fileType: 'image/svg+xml' }, { url: 'ipfs://QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs/notes.txt', fileType: 'text/plain' }] }));
    const cover = page.locator('.system-workflow__library-item > button').first();
    await page.waitForFunction(() => document.querySelector('.system-workflow__library-item img')?.src.includes('/image/QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs/full.webp?width='));
    assert.ok(!requests.includes(original), 'browsing the cover does not download its original');
    await page.getByRole('button', { name: 'Show 2 images of ABYSSAL STUDY', exact: true }).click();
    const svg = page.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
    await svg.waitFor(); assert.ok((await svg.innerText()).includes('SVG'));
    assert.equal(await page.locator('.library-file-card').getAttribute('href'), 'https://api.universalprofile.cloud/ipfs/QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs/notes.txt');
    assert.ok(!requests.some(url => url.includes('/image/') && url.includes('animated.svg')), 'SVG retains its vector URL');
    await cover.scrollIntoViewIfNeeded();
    const from = await cover.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + 35); await page.mouse.down();
    await page.mouse.move(820, 550, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(() => window.__imageTest.draft().imageModules?.length === 1);
    const draft = await page.evaluate(() => window.__imageTest.draft());
    assert.equal(draft.imageModules[0].artwork.asset.media.url, original);
    assert.equal(draft.imageModules[0].artwork.asset.media.width, 2000);
    const image = page.locator('.image-module__artwork image').first();
    assert.match(await image.getAttribute('href'), /\/image\/QmThDT2vRApPycwwZt89SUSzfcxkaS8opgJi8uPH67hqQs\/full.webp\?width=/);
    const rectangle = await image.evaluate(node => ['x','y','width','height','transform'].map(name => node.getAttribute(name)));
    release();
    await page.waitForFunction(url => document.querySelector('.image-module__artwork image')?.getAttribute('href') === url, original);
    assert.deepEqual(await image.evaluate(node => ['x','y','width','height','transform'].map(name => node.getAttribute(name))), rectangle);
    assert.deepEqual(await page.evaluate(() => window.__imageTest.draft()), draft, 'loading the original does not rewrite geometry or media');
    assert.deepEqual(errors, []);
  } finally { release?.(); await browser.close(); }
});
