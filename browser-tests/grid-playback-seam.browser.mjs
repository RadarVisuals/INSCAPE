import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('covered Visitor Grids retain dark adjoining edges during fractional playback', async () => {
  const origin = 'http://127.0.0.1:5186';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const [width, deviceScaleFactor] of [[1415, 1], [1415, 1.25], [390, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 794 }, deviceScaleFactor });
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => console.error(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue()
        : route.request().resourceType() === 'image' ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#000" d="M0 0h1600v900H0z"/></svg>' }) : route.abort());
      await page.goto(`${origin}/browser-tests/fixture.html?covered`);
      await page.getByRole('button', { name: 'Play Grids', exact: true }).click();
      await page.waitForTimeout(1800);
      await page.getByRole('button', { name: 'Pause Grids', exact: true }).click();
      const stage = await page.locator('.visitor-grid-world__viewport').boundingBox();
      await page.waitForFunction(() => document.querySelectorAll('.visitor-grid-world__grid-plane img.is-ready').length === 2);
      for (const fraction of [.23, .471, .719]) {
        await page.locator('.visitor-grid-world__grid-track').evaluate((node, offset) => {
          node.style.transform = `translate3d(${offset}px, 0, 0)`;
        }, -(stage.width - 1) * fraction);
        const screenshot = await page.screenshot({ path: `.browser-test-runtime/playback-seam-${width}.png`, clip: {
          x: Math.ceil(stage.x + 10), y: Math.ceil(stage.y + stage.height * .15), width: Math.floor(stage.width - 20), height: 4,
        } });
        const brightest = await page.evaluate(async base64 => {
          const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
          const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
          return { max: Math.max(...pixels.filter((_, i) => i % 4 !== 3)), columns: [...pixels].flatMap((v, i) => i % 4 === 0 && v > 8 ? [i / 4 % img.width] : []) };
        }, screenshot.toString('base64'));
        assert.ok(brightest.max < 8, `width ${width}, DPR ${deviceScaleFactor}, progress ${fraction}: seam brightness ${brightest.max}`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
