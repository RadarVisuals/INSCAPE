import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('released swipe keeps adjacent edges sealed at fractional sizes and pixel densities', { timeout: 60_000 }, async () => {
  const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const [width, deviceScaleFactor] of [[1441, 1.25], [391, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor, reducedMotion: 'no-preference' });
      await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      await page.goto(`${origin}/development/owner/system-workflow`);
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
      await page.getByRole('button', { name: 'Make GRID 02 public', exact: true }).click();
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.waitForTimeout(500);
      // High-contrast paint isolates a real compositor seam from artwork and guide lines.
      await page.addStyleTag({ content: `
        .system-workflow__canvas, .visitor-grid-world__viewport { background: magenta !important; }
        .system-workflow__grid-plane, .visitor-grid-world__grid-plane { background: #101010 !important; }
        .system-workflow__grid-plane > *, .visitor-grid-world__grid-plane > * { visibility: hidden !important; }
      ` });
      for (const mode of ['editor', 'preview']) {
        if (mode === 'preview') {
          await page.getByRole('button', { name: 'Preview', exact: true }).click();
          await page.getByRole('group', { name: 'Published Grid navigation' }).waitFor();
        }
        const selector = mode === 'editor' ? '.system-workflow__canvas' : '.visitor-grid-world__viewport';
        const box = await page.locator(selector).boundingBox();
        await page.keyboard.down('Space');
        await page.mouse.move(box.x + box.width * .8, box.y + box.height * .5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * .55, box.y + box.height * .5, { steps: 5 });
        await page.mouse.up();
        await page.keyboard.up('Space');
        const track = mode === 'editor' ? '.system-workflow__grid-track' : '.visitor-grid-world__grid-track';
        await page.locator(track).evaluate(node => node.getAnimations().forEach(animation => animation.pause()));
        for (const time of [35, 110, 210]) {
          await page.locator(track).evaluate((node, ms) => node.getAnimations().forEach(animation => { animation.currentTime = ms; }), time);
          const screenshot = await page.screenshot({ clip: { x: Math.ceil(box.x + 10), y: Math.ceil(box.y + box.height * .5), width: Math.floor(box.width - 20), height: 8 } });
          const leaks = await page.evaluate(async (base64) => {
            const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
            const pixels = context.getImageData(0, 0, img.width, img.height).data;
            const columns = new Set();
            for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 20 || pixels[i + 1] > 20 || pixels[i + 2] > 20) columns.add((i / 4) % img.width);
            return [...columns];
          }, screenshot.toString('base64'));
          assert.deepEqual(leaks, [], `${mode}, width ${width}, DPR ${deviceScaleFactor}, release ${time}ms`);
        }
        await page.waitForTimeout(400);
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
