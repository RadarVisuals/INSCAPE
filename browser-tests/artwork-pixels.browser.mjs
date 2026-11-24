import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5194';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/display-repairs';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
test('published composition images and Studio images preserve edges and transparency', { timeout: 90000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const [width, dpr] of [[800, 1], [390, 1.25], [800, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 600 }, deviceScaleFactor: dpr });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const images = await page.evaluate(() => Object.fromEntries(['red', 'green', 'alpha'].map(name => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 200;
        const context = canvas.getContext('2d'); context.fillStyle = name === 'red' ? 'red' : 'lime';
        if (name === 'alpha') { context.beginPath(); context.arc(100, 100, 40, 0, 2 * Math.PI); context.fill(); }
        else context.fillRect(0, 0, 200, 200);
        return [name, canvas.toDataURL('image/png').split(',')[1]];
      })));
      let recover = false;
      await page.route('https://repair.invalid/**', async route => {
        const name = new URL(route.request().url()).pathname;
        if (name.includes('fail') && !recover) return route.abort();
        if (name.includes('alpha')) await new Promise(resolve => setTimeout(resolve, 100));
        return route.fulfill({ contentType: 'image/png', body: Buffer.from(images[name.includes('fail') ? 'alpha' : name.slice(1, -4)], 'base64') });
      });
      await page.goto(origin + '/browser-tests/artwork-pixels-fixture.html');
      await page.waitForFunction(() => document.querySelectorAll('#visitor [data-media-state="ready"]').length === 3
        && document.querySelectorAll('#owner [data-media-state="ready"]').length === 3);
      const png = await page.screenshot({ path: `${output}/pixels-${width}-${dpr}.png` });
      const pixels = await page.evaluate(async base64 => {
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const pixel = (x, y) => [...context.getImageData(Math.floor(x * devicePixelRatio), Math.floor(y * devicePixelRatio), 1, 1).data];
        return { ownerEdge: pixel(119, 50), visitorEdge: pixel(119, 250), ownerNext: pixel(120, 50), visitorNext: pixel(120, 250), ownerAlpha: pixel(230, 30), visitorAlpha: pixel(230, 230) };
      }, png.toString('base64'));
      assert.deepEqual(pixels.ownerEdge, pixels.visitorEdge); assert.deepEqual(pixels.ownerEdge, [255, 0, 0, 255]);
      assert.deepEqual(pixels.ownerNext, [0, 255, 0, 255]); assert.deepEqual(pixels.visitorNext, pixels.ownerNext);
      assert.deepEqual(pixels.ownerAlpha, [0, 0, 255, 255]); assert.deepEqual(pixels.ownerAlpha, pixels.visitorAlpha);
      await page.getByRole('button', { name: 'Load unavailable original' }).click();
      const retry = page.getByRole('button', { name: 'Retry artwork' });
      await retry.waitFor();
      recover = true;
      await retry.click();
      await page.waitForFunction(() => document.querySelectorAll('#owner [data-media-state="ready"]').length === 3);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
