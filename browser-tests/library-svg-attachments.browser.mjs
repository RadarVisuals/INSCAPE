import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 240 360"><rect width="240" height="360" fill="#ef6a21"/><circle cx="120" cy="180" r="70" fill="#5904d8"/><script>document.documentElement.setAttribute("data-script-ran", "true");</script></svg>';
const metadata = { images: [[{ url: 'https://images.inscape.test/main.webp', width: 1200, height: 1200 }]], assets: [
  ...Array.from({ length: 4 }, (_, i) => ({ url: `https://images.inscape.test/creature-${i}.svg`, fileType: 'application/xml; charset=UTF-8' })),
  ...Array.from({ length: 3 }, (_, i) => ({ url: `https://images.inscape.test/pose-${i}.webp`, fileType: 'image/webp' })),
] };

test('XML-labelled SVG attachments count, decode, place and persist with their source URLs', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://images.inscape.test/**', route => {
        const url = route.request().url(); requests.push(url);
        return url.endsWith('.svg') ? route.fulfill({ contentType: 'application/xml; charset=UTF-8', body: svg })
          : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' });
      });
      await page.goto(`${origin}/browser-tests/library-images-fixture.html`, { waitUntil: 'networkidle' });
      // A previously loaded four-image record can refresh in place, including
      // while its attachments are expanded, without changing existing placements.
      await page.evaluate(data => window.__imageTest.replaceMetadata({ ...data, assets: data.assets.slice(4) }), metadata);
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      const library = page.getByRole('region', { name: 'Library workspace' });
      await library.getByRole('button', { name: 'Show 4 images of ABYSSAL STUDY', exact: true }).click();
      const draftBefore = await page.evaluate(() => JSON.stringify(window.__imageTest.draft()));
      await page.evaluate(data => window.__imageTest.replaceMetadata(data), metadata);
      await library.getByRole('button', { name: 'Fold 8 images of ABYSSAL STUDY', exact: true }).waitFor();
      assert.equal(await library.locator('.system-workflow__library-item').count(), 14);
      assert.equal(await page.evaluate(() => JSON.stringify(window.__imageTest.draft())), draftBefore);
      for (let number = 2; number <= 5; number++) {
        const tile = library.getByRole('button', { name: `Image ${number} of ABYSSAL STUDY`, exact: true });
        await tile.scrollIntoViewIfNeeded();
        await page.waitForFunction(number => document.querySelector(`[aria-label="Image ${number} of ABYSSAL STUDY"]`)?.getAttribute('aria-disabled') === 'false', number);
        const image = await tile.locator('img').evaluate(node => ({ src: node.src, width: node.naturalWidth, height: node.naturalHeight }));
        assert.match(image.src, /^blob:/, 'generic XML gets a validated inert SVG preview');
        assert.deepEqual([image.width, image.height], [240, 360], 'viewBox supplies dimensions for percentage-sized SVGs');
      }
      assert.equal(await library.locator('iframe').count(), 0, 'Library previews never mount executable artwork documents');
      const firstSvg = library.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
      await firstSvg.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.browser-test-runtime/library-svg-${width}.png` });
      await firstSvg.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(url => window.__imageTest.draft().grids[0].placements.some(item => item.selectedMedia?.url === url), metadata.assets[0].url);
      const placement = await page.evaluate(url => window.__imageTest.draft().grids[0].placements.find(item => item.selectedMedia?.url === url), metadata.assets[0].url);
      assert.deepEqual(placement.selectedMedia, { url: metadata.assets[0].url, width: 240, height: 360 });
      const published = await page.evaluate(id => window.__imageTest.preview().grids[0].placements.find(item => item.id === id), placement.id);
      assert.equal(published.asset.media.url, metadata.assets[0].url, 'publication retains the source rather than its blob preview');
      assert.equal(published.asset.stableAssetId, placement.stableAssetId);
      await page.reload({ waitUntil: 'networkidle' });
      const restored = await page.evaluate(id => window.__imageTest.draft().grids[0].placements.find(item => item.id === id), placement.id);
      assert.deepEqual(restored.selectedMedia, placement.selectedMedia);
      assert.ok(requests.filter(url => url.endsWith('.svg')).length >= 4);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
