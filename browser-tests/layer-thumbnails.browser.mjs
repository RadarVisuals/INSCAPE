import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5173';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 80 80"><script>parent.thumbnailScriptExecuted = true;</script><circle cx="40" cy="40" r="35" fill="purple"/></svg>';

test('Image layer thumbnails display SVG and raster without starting artwork documents', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://thumbs.invalid/__layer_svg*', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: route.request().url().endsWith('.svg') ? 'application/xml' : 'image/svg+xml', body: svg }));
    await page.route('https://thumbs.invalid/__layer_raster.jpg', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.goto(origin + '/browser-tests/layer-thumbnails-fixture.html');
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('.workbench-layer-thumb img')];
      return images.length === 3 && images.every(image => image.complete && image.naturalWidth > 0);
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.locator('.workbench-layer-thumb img').evaluateAll(images =>
        images.every(image => image.naturalWidth > 0 && image.getBoundingClientRect().width > 0)), true);
    }
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.evaluate(() => window.thumbnailScriptExecuted), undefined);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
