import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

test('adjoining WebP artwork stays opaque at vertical and horizontal seams across Workbench zooms', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    // Load real raster artwork through the normal asset path. Replacing an
    // already-rendered img.src with SVG bypasses the SVG document renderer.
    const generator = await browser.newPage();
    const encoded = await generator.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2000;
      const context = canvas.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 2000, 2000);
      return canvas.toDataURL('image/webp', 1).split(',')[1];
    });
    await generator.close();
    const artwork = { url: 'https://motion.invalid/seam-red.webp', contentType: 'image/webp',
      body: Buffer.from(encoded, 'base64'), width: 2000, height: 2000 };
    for (const visitor of [false, true]) for (const [displayWidth, density] of [[601.3, 1.25], [987.3, 1], [1305.7, 2]]) for (const horizontal of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: density });
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194', visitor, heavy: true, displayWidth, seamReview: horizontal ? 'horizontal' : true, artwork });
      const selector = visitor ? '.lattice-production-placement[tabindex="0"]' : '.system-workflow__placement[tabindex="0"]';
      await page.locator(selector).first().waitFor();
      await page.waitForFunction(selector => {
        const images = [...document.querySelectorAll(`${selector} img`)];
        return images.length === 2 && images.every(image => image.complete && image.naturalWidth === 2000);
      }, selector);
      for (const zoom of [.25, .41, .73, .9, 1, 1.37, 2]) {
        await setWorkbenchZoom(page, zoom);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const png = await page.screenshot();
        const result = await page.evaluate(async ({png, selector, horizontal}) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
          const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0);
          const boxes=[...document.querySelectorAll(selector)].map(el=>el.getBoundingClientRect());
          const x=(horizontal ? boxes[0].left + boxes[0].width / 3 : boxes[1].left)*devicePixelRatio;
          const y=(horizontal ? boxes[1].top : boxes[0].top+boxes[0].height/3)*devicePixelRatio;
          return [...ctx.getImageData(Math.floor(x)-(horizontal ? 0 : 2), Math.floor(y)-(horizontal ? 2 : 0), horizontal ? 1 : 5, horizontal ? 5 : 1).data];
        }, { png: png.toString('base64'), selector, horizontal });
        if (result.some((value, index) => index % 4 === 0 && (value <= 250 || result[index + 1] >= 5 || result[index + 2] >= 5))) {
          await page.screenshot({ path: '.browser-test-runtime/display-static-seam-failure.png' });
          console.log(JSON.stringify(await page.locator(selector).evaluateAll(nodes => nodes.map(node => ({
            rectangle: node.getBoundingClientRect().toJSON(),
            images: [...node.querySelectorAll('img')].map(image => ({ rectangle: image.getBoundingClientRect().toJSON(),
              viewBox: getComputedStyle(image).objectViewBox, source: image.currentSrc.slice(0, 40) })),
          }))), null, 2));
        }
        for(let i=0;i<result.length;i+=4) assert.ok(result[i]>250 && result[i+1]<5 && result[i+2]<5,
          `${visitor ? 'Visitor' : 'Owner'} ${displayWidth}px DPR ${density} zoom ${zoom} ${horizontal ? 'horizontal' : 'vertical'} seam: ${result}`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
