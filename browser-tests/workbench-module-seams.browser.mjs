import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const runtime = '.browser-test-runtime';
async function checkSeams(page, label) {
  await settle(page);
  const png = await page.screenshot();
  const joins = await page.evaluate(async ({ b64 }) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + b64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const rect = selector => document.querySelector(selector).getBoundingClientRect(), p = devicePixelRatio;
    const text = rect('.text-window'), board = rect('aside.shape-window');
    const images = [...document.querySelectorAll('.image-module__window')].map(n => n.getBoundingClientRect());
    const sample = (axis, edge, start, end) => {
      let bad = 0, count = 0; const examples = [];
      for (let along = Math.ceil((start + 12) * p); along < Math.floor((end - 12) * p); along++) {
        for (let across = Math.round(edge * p) - 1; across <= Math.round(edge * p) + 1; across++) {
          const x = axis === 'x' ? across : along, y = axis === 'x' ? along : across;
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
          count++; const rgba = [...ctx.getImageData(x, y, 1, 1).data];
          if (rgba[0] < 250 || rgba[1] > 5 || rgba[2] > 5) {
            bad++; if (examples.length < 3) examples.push({ x, y, rgba });
          }
        }
      }
      return { bad, count, examples };
    };
    const result = {
      textShape: sample('x', board.left, Math.max(text.top, board.top), Math.min(text.bottom, board.bottom)),
      shapeImage: sample('x', images[0].left, Math.max(images[0].top, board.top), Math.min(images[0].bottom, board.bottom)),
      textImage: sample('y', images[1].top, Math.max(images[1].left, text.left), Math.min(images[1].right, text.right)),
    };
    return result;
  }, { b64: png.toString('base64') });
  if (Object.values(joins).some(join => join.bad || !join.count)) await writeFile(runtime + '/module-seam-' + label + '.png', png);
  for (const [name, value] of Object.entries(joins)) {
    assert.ok(value.count > 0, label + ' ' + name + ' has a visible sample band');
    assert.equal(value.bad, 0, label + ' ' + name + ': ' + JSON.stringify(value.examples));
  }
}

for (const visitor of [false, true]) for (const density of [1, 1.25, 1.5, 2]) {
  test((visitor ? 'Visitor' : 'Owner') + ' Text, Shape and Image joins at DPR ' + density, { timeout: 180000 }, async () => {
    await mkdir(runtime, { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const generator = await browser.newPage();
      const red = await generator.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 400;
        const ctx = c.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 400, 400);
        return c.toDataURL('image/png').split(',')[1];
      });
      await generator.close();
      for (const mode of ['none', 'neutral', 'mirror']) {
        const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: density });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await mountGridMotionFixture(page, { origin, visitor, count: 3, textModes: true,
          adjoiningModules: {
            textTransform: mode === 'none' ? null : { quarterTurns: 0, mirrorX: mode === 'mirror', mirrorY: false } },
          artwork: { url: 'https://motion.invalid/seam-solid.png', contentType: 'image/png', body: Buffer.from(red, 'base64'), width: 400, height: 400 } });
        await page.locator('.text-window').waitFor(); await page.locator('.image-module__window').first().waitFor();
        if (!visitor) {
          const read = page.getByRole('button', { name: 'Read', exact: true });
          if (await read.count()) { await read.focus(); await page.keyboard.press('Enter'); }
          const close = page.getByRole('button', { name: 'Close Inspector', exact: true });
          if (await close.count()) await close.click();
        }
        await page.addStyleTag({ content: '.system-workflow,.visitor-grid-world,.system-workflow__workbench{background:#00ff00!important;background-image:none!important}' });
        await page.evaluate(async () => { document.activeElement?.blur(); await document.fonts.ready; });
        await page.mouse.move(2500, 1300);
        const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
        for (const zoom of [.25, .413, .67, .997, 1, 1.371, 2]) {
          await setWorkbenchZoom(page, zoom);
          await checkSeams(page, [visitor, density, mode, zoom].join('-'));
        }
        assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'camera never edits the draft');
        await setWorkbenchZoom(page, .67);
        await page.keyboard.down('Space'); await page.mouse.move(2500, 1300); await page.mouse.down();
        await page.mouse.move(2523.37, 1317.13, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Space');
        await checkSeams(page, [visitor, density, mode, 'pan'].join('-'));
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally { await browser.close(); }
  });
}
