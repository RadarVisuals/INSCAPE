import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { ARTWORK_DOCUMENT_PATH, ARTWORK_DOCUMENT_HEADERS, ARTWORK_DOCUMENT_HTML } from '../scripts/artworkDocumentHost.js';

test('hidden SVG fallback layers skip resampling and keep original pixels available', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const origin = 'http://127.0.0.1:5173';
    await page.route(`${origin}/test`, route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.route(origin + ARTWORK_DOCUMENT_PATH, route => route.fulfill({ headers: ARTWORK_DOCUMENT_HEADERS, body: ARTWORK_DOCUMENT_HTML }));
    await page.addInitScript(() => {
      window.rasterPaints = 0; window.rasterUrls = new Set();
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) { window.rasterPaints++; return draw.apply(this, args); };
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.rasterUrls.add(url); return url; };
      URL.revokeObjectURL = url => { window.rasterUrls.delete(url); revoke(url); };
    });
    await page.goto(origin + '/test');
    await page.evaluate(async hostPath => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      canvas.getContext('2d').fillRect(0, 0, 512, 512);
      const source = canvas.toDataURL();
      const frame = document.createElement('iframe'); frame.sandbox = 'allow-scripts'; frame.src = hostPath;
      frame.style.cssText = 'width:100px;height:60px;border:0';
      const loaded = new Promise(resolve => frame.onload = resolve); document.body.append(frame); await loaded;
      frame.contentWindow.postMessage({ type: 'inscape:artwork-source', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60">
        <image id="visible" width="50" height="50" href="${source}"/>
        <g id="poster" style="display:none"><image id="fallback" x="50" width="50" height="50" href="${source}"/></g>
      </svg>` }, '*');
    }, ARTWORK_DOCUMENT_PATH);
    const host = page.frames().find(frame => frame.url().endsWith(ARTWORK_DOCUMENT_PATH));
    await host.waitForSelector('iframe');
    const artwork = await (await host.locator('iframe').elementHandle()).contentFrame();
    await artwork.waitForFunction(() => document.querySelector('#visible')?.href.baseVal.startsWith('blob:'));
    assert.equal(await artwork.locator('#fallback').evaluate(n => n.href.baseVal.startsWith('data:')), true);
    const density = scale => host.evaluate(scale => document.querySelector('iframe').contentWindow.postMessage({ type: 'inscape:artwork-density', scale }, '*'), scale);
    for (const scale of [.5, 1, .25]) {
      const before = await artwork.locator('#visible').getAttribute('href');
      await artwork.evaluate(() => { window.rasterPaints = 0; });
      await density(scale);
      await artwork.waitForFunction(before => document.querySelector('#visible').href.baseVal !== before, before);
      assert.equal(await artwork.evaluate(() => window.rasterPaints), 1, 'only the displayed image is resampled');
      assert.equal(await artwork.locator('#fallback').evaluate(n => n.href.baseVal.startsWith('data:')), true);
    }
    // Revealing a scripted fallback can paint the original immediately, even
    // before the next density/size update has prepared a smaller paint source.
    await artwork.locator('#poster').evaluate(n => n.style.removeProperty('display'));
    assert.equal(await artwork.locator('#fallback').evaluate(n => n.getClientRects().length > 0 && n.href.baseVal.startsWith('data:')), true);
    await density(.5);
    await artwork.waitForFunction(() => [...document.querySelectorAll('image')].every(n => n.href.baseVal.startsWith('blob:')));
    await host.evaluate(() => document.querySelector('iframe').contentWindow.postMessage({ type: 'inscape:inspect-artwork' }, '*'));
    await artwork.waitForFunction(() => [...document.querySelectorAll('image')].every(n => n.href.baseVal.startsWith('data:')));
    assert.equal(await artwork.evaluate(() => window.rasterUrls.size), 0, 'inspection releases prepared sources');
    await host.evaluate(() => document.querySelector('iframe').contentWindow.postMessage({ type: 'inscape:release-artwork' }, '*'));
    await artwork.waitForFunction(() => [...document.querySelectorAll('image')].every(n => n.href.baseVal.startsWith('blob:')));
    await artwork.evaluate(() => { document.getElementById('poster').style.display = 'none'; window.rasterPaints = 0; });
    const visibleBefore = await artwork.locator('#visible').getAttribute('href');
    await density(.25);
    await artwork.waitForFunction(before => document.querySelector('#visible').href.baseVal !== before
      && document.querySelector('#fallback').href.baseVal.startsWith('data:') && window.rasterUrls.size === 1, visibleBefore);
    assert.equal(await artwork.evaluate(() => window.rasterPaints), 1, 'the newly hidden fallback releases its thumbnail without decoding a replacement');
    await page.locator('iframe').evaluate(n => n.remove());
    await page.waitForFunction(() => !document.querySelector('iframe'));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
