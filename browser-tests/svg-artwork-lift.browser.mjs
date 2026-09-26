import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const artwork = { url: 'https://motion.invalid/lift.svg', width: 640, height: 480 };
// Native pixel artwork deliberately has no viewBox. Reflowing its viewport
// moves the drawing independently of the animated frame. Its script also
// observes viewport changes, like responsive/animated NFT artwork can do.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
  <rect width="640" height="480" fill="#b23c49"/>
  <circle cx="320" cy="240" r="100" fill="#e9d799"/>
  <script><![CDATA[
    const id = Math.random();
    new ResizeObserver(() => top.postMessage({type:'svg-lift-test', id,
      width:innerWidth, height:innerHeight}, '*')).observe(document.documentElement);
  ]]></script>
</svg>`;

async function sameDrawing(page, before, after) {
  if (before.equals(after)) return true;
  return page.evaluate(async images => {
    const pixels = await Promise.all(images.map(async src => {
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    }));
    // Rebuilding a rotated compositing layer can round an antialiased edge by
    // one color level. Pixel positions and all other colors must still match.
    return pixels[0].width === pixels[1].width && pixels[0].height === pixels[1].height
      && pixels[0].data.every((value, index) => Math.abs(value - pixels[1].data[index]) <= 1);
  }, [before, after].map(buffer => `data:image/png;base64,${buffer.toString('base64')}`));
}

test('SVG Lift scales a stable document in Image and owner/Visitor Display', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  await mkdir('output/svg-lift-review', { recursive: true });
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      page.setDefaultTimeout(15000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.svgSizes = [];
        addEventListener('message', event => { if (event.data?.type === 'svg-lift-test' && event.data.width > 0) window.svgSizes.push(event.data); });
      });
      await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 600, seamReview: 'single',
        artwork: { ...artwork, body: svg, transform: width === 390 ? { quarterTurns: 1, mirrorX: true, mirrorY: false } : undefined } });
      const image = page.locator('.image-module__canvas').first();
      const display = page.locator('.system-workflow__presentation-board').locator('.system-workflow__placement[tabindex="0"], .lattice-production-placement[tabindex="0"]').first();
      await page.waitForFunction(() => window.svgSizes.length > 0);
      for (const [kind, source] of [['image', image], ['display', display]]) {
        await source.locator('.artwork-svg-document').waitFor();
        await source.locator('.artwork-svg-status').waitFor({ state: 'detached' });
        const documentElement = await source.locator('iframe').elementHandle();
        const paintParent = await source.locator('.artwork-svg-paint').evaluateHandle(node => node.parentElement);
        const documentHost = await documentElement.contentFrame();
        const runtime = documentHost.childFrames()[0];
        await runtime.evaluate(() => { window.__liftContinuity = 'retained'; });
        await source.focus();
        const sourceMatrix = await source.locator('foreignObject').evaluate(node => {
          const matrix = node.getScreenCTM(); return ['a', 'b', 'c', 'd', 'e', 'f'].map(key => matrix[key]);
        });
        const before = await source.screenshot({ path: `output/svg-lift-review/${kind}-${visitor}-${width}-before.png` });
        await page.evaluate(() => { window.svgSizes = []; });
        if (kind === 'image') { await source.focus(); await page.keyboard.press('Enter'); }
        else await source.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        await page.locator('.system-workflow__lift-artwork').waitFor();
        const samples = await page.evaluate(async frame => {
          const samples = [];
          const lift = document.querySelector('.system-workflow__lift-artwork');
          const sample = () => {
            if (frame) {
              const matrix = frame.closest('foreignObject').getScreenCTM();
              samples.push({ progress: Number(lift.parentElement.style.getPropertyValue('--inspection-lift-progress')),
                width: frame.clientWidth, height: frame.clientHeight,
                matrix: ['a', 'b', 'c', 'd', 'e', 'f'].map(key => matrix[key]) });
            }
          };
          // Browser animations advance before RAF callbacks. Observe the
          // backdrop update so both are sampled after Lift reads that clock.
          const observer = new MutationObserver(sample);
          observer.observe(lift.parentElement, { attributes: true, attributeFilter: ['style'] });
          for (let i = 0; i < 50; i++) await new Promise(requestAnimationFrame);
          observer.disconnect();
          return samples;
        }, documentElement);
        assert.ok(samples.some(sample => sample.progress > 0 && sample.progress < 1), `${kind}: animated opening`);
        assert.ok(samples.every(sample => sample.width === 640 && sample.height === 480), `${kind}: document stays at native size during Lift`);
        await page.waitForFunction(() => document.querySelector('.system-workflow__lift-artwork')?.parentElement.style.getPropertyValue('--inspection-lift-progress') === '1');
        const targetMatrix = await source.locator('foreignObject').evaluate(node => {
          const matrix = node.getScreenCTM(); return ['a', 'b', 'c', 'd', 'e', 'f'].map(key => matrix[key]);
        });
        for (const sample of samples) for (const [x, y] of [[0, 0], [320, 240], [640, 480]]) {
          const expected = sourceMatrix.map((value, index) => value + (targetMatrix[index] - value) * sample.progress);
          const point = matrix => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
          const actualPoint = point(sample.matrix), expectedPoint = point(expected);
          assert.ok(Math.hypot(actualPoint[0] - expectedPoint[0], actualPoint[1] - expectedPoint[1]) < .8,
            `${kind}/${visitor}/${width}: artwork stays on the same path as the opening ${JSON.stringify({ sample, expected, actualPoint, expectedPoint })}`);
        }
        assert.equal(await source.locator('iframe').evaluate((frame, original) => frame === original, documentElement), true, `${kind}: Lift keeps the original document element in its source`);
        assert.equal(await source.locator('.artwork-svg-paint').evaluate((node, parent) => node.parentElement === parent, paintParent), true, `${kind}: Lift does not relocate the live paint host`);
        assert.equal(await runtime.evaluate(() => window.__liftContinuity), 'retained', `${kind}: Lift does not reload the SVG runtime`);
        assert.ok((await page.evaluate(() => window.svgSizes)).every(size => size.width === 640 && size.height === 480), `${kind}: embedded artwork never reflows`);
        await page.screenshot({ path: `output/svg-lift-review/${kind}-${visitor}-${width}.png` });
        await page.keyboard.press('Escape');
        await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
        const after = await source.screenshot({ path: `output/svg-lift-review/${kind}-${visitor}-${width}-after.png` });
        assert.ok(await sameDrawing(page, before, after), `${kind}: Return restores the source drawing without shifting pixels`);
        const returnedMatrix = await source.locator('foreignObject').evaluate(node => {
          const matrix = node.getScreenCTM(); return ['a', 'b', 'c', 'd', 'e', 'f'].map(key => matrix[key]);
        });
        assert.deepEqual(returnedMatrix, sourceMatrix, `${kind}: Return restores the exact source geometry`);
        assert.equal(await source.locator('.artwork-svg-paint').evaluate(node => node.getAnimations({ subtree: true }).length), 0, `${kind}: Return disposes the opening and crop animations`);
        assert.equal(await source.locator('iframe').evaluate((frame, original) => frame === original, documentElement), true, `${kind}: Return keeps the original document element`);
        assert.equal(await runtime.evaluate(() => window.__liftContinuity), 'retained', `${kind}: Return does not reload the SVG runtime`);
        assert.equal(await source.getAttribute('data-lift-source'), null);
      }
      // Closing while the SVG is loading or opening must restore the source.
      await image.focus(); await page.keyboard.press('Enter');
      await page.locator('.image-lift').waitFor(); await page.keyboard.press('Escape');
      await page.locator('.image-lift').waitFor({ state: 'detached' });
      await image.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => {
        const progress = Number(document.querySelector('.image-lift')?.style.getPropertyValue('--inspection-lift-progress'));
        return progress > .2 && progress < .8;
      });
      const interruptedProgress = await page.evaluate(async () => {
        document.querySelector('.image-lift-return').click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return Number(document.querySelector('.image-lift')?.style.getPropertyValue('--inspection-lift-progress'));
      });
      assert.ok(interruptedProgress < .8, 'Return during opening does not jump to full size');
      await page.locator('.image-lift').waitFor({ state: 'detached' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await image.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.image-lift')?.style.getPropertyValue('--inspection-lift-progress') === '1');
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), await page.evaluate(() => window.__motionSaved), 'Inspection does not save layout changes');
      await image.focus(); await page.keyboard.press('Enter');
      await page.locator('.system-workflow__lift-artwork').waitFor();
      const borrowedDocument = await image.locator('iframe').elementHandle();
      await page.evaluate(() => window.__motionRoot.unmount());
      assert.equal(await borrowedDocument.evaluate(frame => frame.isConnected), false, 'Removing the owner disposes the borrowed document');
      assert.equal(await page.locator('.artwork-svg-document, .artwork-svg-paint, .system-workflow__lift-artwork').count(), 0, 'No live artwork is left behind after disposal');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
