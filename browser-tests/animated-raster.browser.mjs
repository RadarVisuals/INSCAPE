import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { handler } from '../netlify/functions/artwork-document.mjs';

// Two lossless 256px red/blue frames, 160ms each. No generated study media needed.
const animated = 'data:image/webp;base64,UklGRoQAAABXRUJQVlA4WAoAAAACAAAA/wAA/wAAQU5JTQYAAAAAAAAAAABBTk1GKAAAAAAAAAAAAP8AAP8AAKAAAAJWUDhMDwAAAC//wD8ABxD9j/4HIqL/AQBBTk1GKAAAAAAAAAAAAP8AAP8AAKAAAABWUDhMDwAAAC//wD8ABxDR//4HIqL/AQA=';
const origin = 'http://127.0.0.1:5173';

test('SVG raster preparation preserves animated WebP playback through density and inspection changes', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/test`, route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' }));
    await page.route(`${origin}/.netlify/functions/artwork-document`, async route => {
      const response = await handler();
      return route.fulfill({ status: response.statusCode, headers: response.headers, body: response.body });
    });
    await page.goto(`${origin}/test`);
    await page.evaluate(async animated => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      canvas.getContext('2d').fillRect(0, 0, 256, 256);
      const frame = document.createElement('iframe'); frame.style.cssText = 'width:100px;height:60px;border:0';
      frame.sandbox = 'allow-scripts'; frame.src = '/.netlify/functions/artwork-document';
      const loaded = new Promise(resolve => frame.onload = resolve); document.body.append(frame); await loaded;
      frame.contentWindow.postMessage({ type: 'inscape:artwork-source', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><image id="animated" width="50" height="50" href="${animated}"/><image id="still" x="50" width="50" height="50" href="${canvas.toDataURL()}"/></svg>` }, '*');
    }, animated);
    const host = page.frames().find(frame => frame.url().endsWith('/artwork-document'));
    await page.waitForFunction(() => document.querySelector('iframe'));
    for (let i = 0; i < 100 && !host.childFrames().length; i++) await page.waitForTimeout(20);
    const artwork = host.childFrames()[0];
    await artwork.waitForFunction(() => document.querySelector('#still')?.href.baseVal.startsWith('blob:'));
    assert.equal(await artwork.locator('#animated').getAttribute('href'), animated, 'optional thumbnail generation must not turn animation into a static PNG');
    for (const message of [{ type: 'inscape:artwork-density', scale: .5 }, { type: 'inscape:inspect-artwork' }, { type: 'inscape:release-artwork' }]) {
      await host.evaluate(message => document.querySelector('iframe').contentWindow.postMessage(message, '*'), message);
      await page.waitForTimeout(100);
      assert.equal(await artwork.locator('#animated').getAttribute('href'), animated);
    }
    const screenshots = new Set();
    for (let i = 0; i < 8; i++) {
      screenshots.add((await page.screenshot({ clip: { x: 5, y: 5, width: 30, height: 30 } })).toString('base64'));
      await page.waitForTimeout(70);
    }
    assert.ok(screenshots.size >= 2, 'visible animated pixels must change');
    await Promise.all([
      page.waitForEvent('framedetached', frame => frame === host),
      page.waitForEvent('framedetached', frame => frame === artwork),
      page.locator('iframe').evaluate(frame => frame.remove()),
    ]);
    assert.equal(page.frames().length, 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
