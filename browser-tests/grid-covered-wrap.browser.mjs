import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('fully covered raster Grids never expose the Stage during fast wrapping', { timeout: 90000 }, async () => {
  const origin = 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    // This small landscape fixture is cropped from the supplied bug recording.
    // Expand it to the full raster workload; no production media is modified.
    let raster;
    if (process.env.INSCAPE_COVERED_WRAP_RASTER) raster = readFileSync(process.env.INSCAPE_COVERED_WRAP_RASTER);
    else {
      const artwork = readFileSync(new URL('./fixtures/grid-landscape.jpg', import.meta.url));
      const preparation = await browser.newPage();
      const data = await preparation.evaluate(async source => {
        const image = new Image(); image.src = 'data:image/jpeg;base64,' + source; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 4096; canvas.height = 2304;
        const context = canvas.getContext('2d'); context.fillStyle = '#101010'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png').split(',')[1];
      }, artwork.toString('base64'));
      raster = Buffer.from(data, 'base64');
      await preparation.close();
    }
    for (const width of [2044, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1034 } });
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/covered-raster/5.png') return route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' });
        if (url.pathname.startsWith('/covered-raster/')) return route.fulfill({ contentType: 'image/png', body: raster });
        if (url.pathname.endsWith('/ownerSystemWorkflowDevelopmentFixture.js')) {
          const response = await route.fetch();
          let body = await response.text();
          body = body.replace('creators: [', `src: '/covered-raster/' + token + '.png', thumbnailUrl: '/covered-raster/' + token + '.png', previewSrc: '/covered-raster/' + token + '.png', originalImageUrl: '/covered-raster/' + token + '.png', imageUrl: '/covered-raster/' + token + '.png', width: token === 5 ? 2000 : 4096, height: token === 5 ? 2000 : 2304, imageWidth: token === 5 ? 2000 : 4096, imageHeight: token === 5 ? 2000 : 2304, creators: [`);
          body = body.replace('const values = new Map', `draft.grids = Array.from({length:4}, (_, i) => ({...draft.grids[0], id: 'grid:' + (i ? i + 1 : 'home'), title: i ? 'GRID 0' + (i + 1) : 'HOME', placements: [basePlacement('covered-' + i, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[i].id, 0, 0, 32, 18, 0), basePlacement('alpha-' + i, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[4].id, 8 + i, 2, 12, 4 + i * 4, 1)]})); const values = new Map`);
          return route.fulfill({ response, body });
        }
        return url.origin === origin ? route.continue() : route.abort();
      });
      await page.goto(`${origin}/development/owner/system-workflow`);
      await page.waitForFunction(() => document.querySelectorAll('.system-workflow__grid-plane img').length >= 3
        && [...document.querySelectorAll('.system-workflow__grid-plane img')].every(img => img.complete && img.naturalWidth > 0));
      // Only the underlying Stage is marked; coverage comes from real raster artwork.
      await page.addStyleTag({ content: '.system-workflow__canvas { background-color: #00ff00 !important; }' });
      const box = await page.locator('.system-workflow__canvas').boundingBox();
      const client = await page.context().newCDPSession(page);
      const frames = [];
      client.on('Page.screencastFrame', event => {
        frames.push(event.data);
        void client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
      });
      await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
      const swipe = async (direction) => {
        await page.keyboard.down('Space');
        await page.mouse.move(box.x + box.width * (direction < 0 ? .8 : .2), box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * (direction < 0 ? .2 : .8), box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
        await page.keyboard.up('Space');
        await page.waitForTimeout(330);
      };
      for (const direction of [1, -1, -1, 1, 1, -1, 1, -1]) await swipe(direction);
      await page.waitForTimeout(400);
      for (let attempts = 0; attempts < 4 && await page.locator('[data-system-workflow-stage]').getAttribute('aria-label') !== 'HOME Grid'; attempts++) {
        await swipe(-1); await page.waitForTimeout(100);
      }
      assert.equal(await page.locator('[data-system-workflow-stage]').getAttribute('aria-label'), 'HOME Grid');
      await swipe(1); await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-system-workflow-stage]').getAttribute('aria-label'), 'GRID 04 Grid');
      await page.getByRole('button', { name: 'Play Grids', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') === 'HOME Grid');
      await page.getByRole('button', { name: 'Pause Grids', exact: true }).click();
      await client.send('Page.stopScreencast');
      const leaks = [];
      for (let index = 0; index < frames.length; index++) {
        const count = await page.evaluate(async ({ data, box }) => {
          const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(Math.ceil(box.x + 3), Math.ceil(box.y + box.height / 2), Math.floor(box.width - 6), 4).data;
          let exposed = 0;
          for (let p = 0; p < pixels.length; p += 4) if (pixels[p + 1] > 190 && pixels[p] < 70 && pixels[p + 2] < 70) exposed++;
          return exposed;
        }, { data: frames[index], box });
        if (count) { leaks.push({ index, count }); writeFileSync(`.browser-test-runtime/covered-leak-${width}-${index}.png`, Buffer.from(frames[index], 'base64')); }
      }
      console.log({ width, frames: frames.length, leaks });
      assert.ok(frames.length > 20);
      assert.deepEqual(leaks, []);
      await page.screenshot({ path: `.browser-test-runtime/covered-wrap-${width}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});
