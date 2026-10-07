import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { openDisplayMenu } from './fixtures/display-controls.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime/color-seams';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

for (const separate of [false, true]) for (const visitor of [false, true]) for (const width of [2560, 1440, 390]) {
  const label = `${separate ? 'separate-pngs' : 'source-crops'}-${visitor ? 'visitor' : 'owner'}-${width}`;
  test(`opaque, correctly cropped color fields have no exposed seam: ${label}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      await mkdir(output, { recursive: true });
      const page = await browser.newPage({ viewport: { width, height: width === 2560 ? 1305 : 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      // Two opaque 16:9 halves in a 32:9 PNG. Cropping to either end fills
      // one entire 16:9 Grid. Both source colors have zero green, so a green
      // scanline pixel can only come from the exposed Stage background.
      const sources = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 2560; canvas.height = 720;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(240,0,64)'; ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = 'rgb(40,0,240)'; ctx.fillRect(1280, 0, 1280, 720);
        const halves = [0, 1280].map(x => {
          const cropped = document.createElement('canvas'); cropped.width = 1280; cropped.height = 720;
          cropped.getContext('2d').drawImage(canvas, x, 0, 1280, 720, 0, 0, 1280, 720);
          return cropped.toDataURL('image/png').split(',')[1];
        });
        return { full: canvas.toDataURL('image/png').split(',')[1], red: halves[0], blue: halves[1] };
      });
      const png = name => Buffer.from(sources[name], 'base64');
      for (const name of ['full', 'red', 'blue']) await writeFile(`${output}/color-source-${name}.png`, png(name));
      await mountGridMotionFixture(page, { origin, visitor, count: 2, displayWidth: width === 2560 ? 1632 : Math.min(1001.3, width - 40), grain: 0,
        artwork: { url: 'https://colors.invalid/halves.png', contentType: 'image/png', width: separate ? 1280 : 2560, height: 720, body: png(separate ? 'blue' : 'full') },
        inspectionArtwork: separate ? { url: 'https://colors.invalid/red.png', contentType: 'image/png', width: 1280, height: 720, body: png('red'), target: 'display' } : undefined });
      await page.evaluate(async ({ visitor, separate }) => {
        const update = grids => grids.map((grid, index) => !grid.id.startsWith('grid:motion-') ? grid : ({ ...grid,
          placements: [{ ...grid.placements[0], column: 0, row: 0, columnSpan: 32, rowSpan: 18,
            crop: { x: separate ? .5 : index % 2, y: .5, zoom: 1 }, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }));
        if (visitor) {
          const React = (await import('/@id/react')).default;
          const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
          window.__motionRoot.render(React.createElement(Visitor, { document: { ...window.__motionDocument, grids: update(window.__motionDocument.grids) } }));
        } else {
          const draft = JSON.parse(localStorage.getItem(window.__motionKey)); draft.grids = update(draft.grids);
          localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(window.__motionKey);
          window.__motionRemount();
        }
      }, { visitor, separate });
      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
      await stage.waitFor();
      await page.waitForFunction(sourceWidth => {
        const images = [...document.querySelectorAll('.system-workflow__grid-plane img,.visitor-grid-world__grid-plane img')];
        return images.length >= 4 && images.every(img => img.complete && img.naturalWidth === sourceWidth);
      }, separate ? 1280 : 2560);
      await page.addStyleTag({ content: '.system-workflow__canvas,.visitor-grid-world__viewport{background:#00ff00!important}' });
      const box = await stage.boundingBox();
      const inspect = async suffix => {
        const screenshot = await page.screenshot({ path: `${output}/color-seam-${label}-${suffix}.png` });
        return page.evaluate(async ({ data, box }) => {
          const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
          const start = Math.ceil(box.x + 3), y = Math.floor(box.y + box.height / 2);
          const pixels = ctx.getImageData(start, y, Math.floor(box.width - 6), 1).data;
          const leaks = []; let red = 0, blue = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 1] > 1) leaks.push({ x: start + i / 4, rgb: [...pixels.slice(i, i + 3)] });
            if (pixels[i] > 230 && pixels[i + 2] < 70) red++;
            if (pixels[i] < 50 && pixels[i + 2] > 230) blue++;
          }
          return { leaks, red, blue };
        }, { data: screenshot.toString('base64'), box });
      };
      const resting = await inspect('rest');
      assert.equal(resting.leaks.length, 0, 'the initial crop fills the Stage');
      assert.ok(resting.red > box.width - 10 && resting.blue === 0, 'the source is cropped to the red half, without a blue stripe or transparent margin');
      await openDisplayMenu(page, page.getByRole('article', { name: 'Display Module', exact: true }));
      await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).click();
      const samples = [];
      // Cross both source halves and the wrap, which puts the source image's
      // outer edges together instead of its interior crop boundaries.
      for (const fraction of [.213, .5037, .819, 1.213, 1.5037, 1.819]) {
        await page.evaluate(async fraction => {
          const animation = document.querySelector('.system-workflow__grid-track,.visitor-grid-world__grid-track').getAnimations()[0];
          animation.play(); await animation.ready; animation.currentTime = 12000 * fraction;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, fraction);
        const sample = await inspect(String(fraction));
        assert.ok(sample.red > 10 && sample.blue > 10, 'the crossing displays both fully opaque source crops');
        samples.push({ fraction, ...sample });
      }
      const pause = page.getByRole('button', { name: 'Pause Grids', exact: true });
      await pause.focus(); await page.keyboard.press('Enter');
      samples.push({ paused: true, ...await inspect('paused') });
      await writeFile(`${output}/color-seam-${label}.json`, JSON.stringify({ label, source: separate ? 'two opaque PNGs, physically cropped to 1280x720 each' : 'opaque PNG 2560x720, two 1280x720 halves', box, resting, samples }, null, 2));
      assert.deepEqual(errors, []);
      if (!visitor) assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
      assert.deepEqual(samples.flatMap(sample => sample.leaks), [], 'no green background is exposed between the cropped color fields');
    } finally { await browser.close(); }
  });
}
