import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
const settle = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const near = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, message + ': ' + a + ' versus ' + b);
for (const visitor of [false, true]) for (const density of [1.25, 1.5]) {
  test((visitor ? 'Visitor' : 'Owner') + ' physical surfaces preserve Text alpha, rotation, wrapping and input at DPR ' + density, { timeout: 90000 }, async () => {
    await mkdir('.browser-test-runtime', { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await mountGridMotionFixture(page, { origin, visitor, textModes: true, count: 3,
        adjoiningModules: { textTransform: { quarterTurns: 1, mirrorX: true, mirrorY: false },
          textAppearance: { opacity: .5, edges: { corners: [0, 16, 24, 8], shadow: false, grain: 0 } } } });
      const text = page.locator('.text-window'); await text.waitFor();
      if (!visitor) {
        await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
      }
      await page.addStyleTag({ content: '.system-workflow,.visitor-grid-world,.system-workflow__workbench{background:#00ff00!important;background-image:none!important}' });
      await page.evaluate(async () => { document.activeElement?.blur(); await document.fonts.ready; });
      await page.mouse.move(1500, 950);
      const measure = () => text.evaluate(n => {
        const paragraph = n.querySelector('.text-document p'), range = document.createRange(); range.selectNodeContents(paragraph);
        return { box: n.getBoundingClientRect().toJSON(), body: n.querySelector('.text-module-body').getBoundingClientRect().toJSON(),
          width: parseFloat(getComputedStyle(n.querySelector('.text-module-content')).width), lines: range.getClientRects().length };
      });
      const before = await measure();
      for (const zoom of [.413, .67, 1.371, 2]) {
        await setWorkbenchZoom(page, zoom); await settle(page);
        const after = await measure();
        near(after.box.width, before.box.width * zoom, 1.6, 'Text screen width');
        near(after.body.width, after.box.width, .02, 'rotated body width reaches paint frame');
        near(after.body.height, after.box.height, .02, 'rotated body height reaches paint frame');
        near(after.width, before.width, .1, 'authored wrapping width');
        assert.equal(after.lines, before.lines, 'rotation and camera zoom retain line breaks');
      }
      await setWorkbenchZoom(page, .67); await settle(page);
      const png = await page.screenshot({ path: '.browser-test-runtime/surface-' + visitor + '-' + density + '-wide.png' });
      const colors = await page.evaluate(async b64 => {
        const image = new Image(); image.src = 'data:image/png;base64,' + b64; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const r = document.querySelector('.text-window').getBoundingClientRect();
        const pixel = (x, y) => [...ctx.getImageData(Math.floor(x * devicePixelRatio), Math.floor(y * devicePixelRatio), 1, 1).data];
        return { interior: pixel(r.left + r.width * .7, r.top + r.height * .7),
          square: pixel(r.left + 1, r.top + 1), rounded: pixel(r.right - 1, r.top + 1) };
      }, png.toString('base64'));
      for (const name of ['interior', 'square']) {
        near(colors[name][0], 128, 2, name + ' retains single alpha contribution');
        near(colors[name][1], 127, 2, name + ' exposes Workbench through Text');
      }
      assert.deepEqual(colors.rounded, [0, 255, 0, 255], 'authored rounded corner stays transparent');
      if (!visitor) {
        const start = await text.boundingBox();
        const handle = await page.getByRole('separator', { name: 'Resize Text window', exact: true }).boundingBox();
        await page.keyboard.down('Alt'); await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2 + 37, handle.y + handle.height / 2 + 23, { steps: 5 });
        await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
        const resized = await text.boundingBox();
        near(resized.width - start.width, 37, 1.6, 'Text resize converts screen delta to authored width');
        near(resized.height - start.height, 23, 1.6, 'Text resize converts screen delta to authored height');
        const board = await page.locator('.system-workflow__presentation-board').boundingBox();
        const placement = page.locator('[data-system-workflow-placement-id]').nth(1);
        await placement.click({ position: { x: (await placement.boundingBox()).width / 2, y: 60 } });
        const east = page.getByRole('button', { name: 'Resize selection from e', exact: true });
        const h = await east.boundingBox(); near(h.width, 28 * .67, .5, 'selection handle retains its intended visible size');
        const readPlacement = () => page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)).grids[0].placements[1]);
        const authored = await readPlacement();
        await page.keyboard.down('Alt'); await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
        await page.mouse.move(h.x + h.width / 2 + 26, h.y + h.height / 2, { steps: 5 });
        await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
        const changed = await readPlacement();
        near(changed.columnSpan - authored.columnSpan, 26 / (board.width / 32), .12, 'artwork pointer uses physical-to-screen conversion');
        assert.equal(changed.rowSpan, authored.rowSpan, 'horizontal resize retains authored height');
        await page.keyboard.press('Escape');
      }
      await page.getByRole('button', { name: 'Tools', exact: true }).click();
      await page.getByRole('menuitem', { name: 'METADATA', exact: true }).click();
      const cue = page.getByRole('button', { name: /^Read metadata for / }).first();
      await cue.focus();
      const cueLabel = (await cue.getAttribute('aria-label')).replace('Read metadata for ', '');
      for (const zoom of [.67, 1.371]) {
        await setWorkbenchZoom(page, zoom); await settle(page);
        const c = await cue.boundingBox(), board = await page.locator('.system-workflow__presentation-board').boundingBox();
        near(c.width, 30 * zoom, .1, 'metadata control retains logical size');
        assert.ok(c.x >= board.x && c.x + c.width <= board.x + board.width + 1, 'metadata control remains inside the projected Stage');
      }
      await cue.focus(); await page.keyboard.press('Enter');
      const metadata = page.locator('[data-shared-tool="metadata"]').locator('xpath=ancestor::aside');
      assert.ok((await metadata.getAttribute('aria-label')).includes(cueLabel), 'metadata control selects its originating artwork');
      await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
      await setWorkbenchZoom(page, .67); await settle(page);
      const atWide = await text.boundingBox();
      await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
      near((await text.boundingBox()).width, atWide.width, 1, 'narrow viewport cannot reinterpret physical width as CSS width');
      await setWorkbenchZoom(page, 2); await settle(page);
      near((await text.boundingBox()).width, atWide.width * 2 / .67, 2, 'zoomed content is not capped by companion-window viewport constraints');
      await setWorkbenchZoom(page, .67); await page.mouse.move(380, 780); await settle(page);
      await page.screenshot({ path: '.browser-test-runtime/surface-' + visitor + '-' + density + '-narrow.png' });
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
