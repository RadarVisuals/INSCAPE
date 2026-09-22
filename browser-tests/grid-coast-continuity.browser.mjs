import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5189';

test('released and playing layered scenes cross seams while the editor thread is blocked', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const results = [];
  try {
    for (const count of [2, 6]) for (const visitor of [false, true]) for (const width of [1440, 390]) for (const kind of ['coast', 'play']) {
      const label = `${count}-${visitor ? 'visitor' : 'owner'}-${width}-${kind}`;
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count });
      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
      await stage.waitFor();
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('.system-workflow__grid-plane img,.visitor-grid-world__grid-plane img')];
        return images.length >= 25 && images.every(image => image.complete && image.naturalWidth);
      });
      await page.waitForTimeout(500);
      const box = await stage.boundingBox();
      await page.evaluate(() => {
        for (const plane of document.querySelectorAll('.system-workflow__grid-plane,.visitor-grid-world__grid-plane')) {
          // A pixel marker travels with real, fully populated scene content.
          const marker = document.createElement('i');
          marker.style.cssText = 'position:absolute;left:70%;top:40%;width:5px;height:60px;background:rgb(249,1,247);z-index:99999;pointer-events:none';
          plane.append(marker);
        }
      });
      const cdp = await page.context().newCDPSession(page), frames = [];
      cdp.on('Page.screencastFrame', event => {
        frames.push({ data: event.data, time: event.metadata.timestamp * 1000 });
        void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
      if (kind === 'play') {
        await page.locator('.system-workflow__presentation-board').dispatchEvent('contextmenu', { clientX: 80, clientY: 100 });
        await page.getByText('PLAY GRIDS', { exact: true }).click();
        await page.evaluate(() => {
          document.querySelector('.system-workflow__grid-track,.visitor-grid-world__grid-track').getAnimations()[0].currentTime = 11700;
        });
      } else {
        const x = box.x + box.width * .8, y = box.y + box.height * .6;
        if (!visitor) await page.keyboard.down('Space');
        await page.mouse.move(x, y); await page.mouse.down();
        await page.evaluate(async ({ x, y, visitor }) => {
          const node = document.querySelector(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
          const span = node.getBoundingClientRect().width;
          const move = distance => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, clientX: x - distance * span, clientY: y }));
          const start = performance.now();
          move(.35); await new Promise(resolve => setTimeout(resolve, 20));
          const distance = .35 + .001 * (performance.now() - start);
          move(distance);
          window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true, clientX: x - distance * span, clientY: y }));
        }, { x, y, visitor });
      }
      await page.evaluate(async kind => {
        const animation = document.querySelector('.system-workflow__grid-track,.visitor-grid-world__grid-track').getAnimations()[0];
        if (!animation) throw new Error('Expected an active camera animation before blocking');
        await animation.ready;
        setTimeout(() => {
          const start = performance.now();
          window.__blocked = { start: performance.timeOrigin + start, animationTime: animation.currentTime, duration: animation.effect.getTiming().duration, state: animation.playState };
          while (performance.now() - start < 300) { /* Deliberately deny the editor a frame across the seam. */ }
          window.__blocked.end = performance.timeOrigin + performance.now();
        }, kind === 'coast' ? Math.max(0, animation.effect.getTiming().duration - 220) : 100);
      }, kind);
      await page.waitForTimeout(1300);
      await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
      await cdp.send('Page.stopScreencast');
      const blocked = await page.evaluate(() => window.__blocked), inspected = [];
      for (const frame of frames) {
        if (frame.time < blocked.start + 30 || frame.time > blocked.end - 30) continue;
        const observation = await page.evaluate(async ({ data, box }) => {
          const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(Math.ceil(box.x), Math.floor(box.y + box.height * .4 + 20), Math.floor(box.width), 1).data;
          const xs = [];
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 240 && pixels[i + 1] < 10 && pixels[i + 2] > 240) xs.push(i / 4);
          // All five-layer fixtures share the opaque purple landscape backing.
          // This unobstructed row must stay covered even just after the seam.
          const backing = context.getImageData(Math.ceil(box.x + 2), Math.floor(box.y + box.height * .2), Math.floor(box.width - 4), 1).data;
          let uncovered = 0;
          for (let i = 0; i < backing.length; i += 4) if (backing[i + 1] > 30 || backing[i + 2] < 220) uncovered++;
          return { position: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, uncovered };
        }, { data: frame.data, box });
        inspected.push({ time: frame.time - blocked.start, ...observation });
      }
      const positions = inspected.filter(frame => frame.position !== null).map(frame => frame.position);
      const result = { label, blocked, totalFrames: frames.length, presentedFrames: positions.length, distinctPositions: new Set(positions).size, inspected };
      results.push(result);
      writeFileSync('.browser-test-runtime/grid-coast-continuity.json', JSON.stringify(results, null, 2));
      const middle = frames.find(frame => frame.time > blocked.start + 150 && frame.time < blocked.end);
      if (middle) writeFileSync(`.browser-test-runtime/grid-continuity-${label}.png`, Buffer.from(middle.data, 'base64'));
      assert.ok(positions.length >= 4, `${label}: browser must present frames during the blockage`);
      assert.ok(new Set(positions).size >= 3, `${label}: rendered artwork must keep moving during the blockage`);
      // The identical marker in the next Grid enters from the right when the
      // previous marker leaves the viewport. Unwrap that periodic coordinate.
      const travel = positions.slice(1).reduce((sum, position, index) => {
        const delta = position - positions[index];
        return sum + (delta > box.width / 2 ? delta - box.width : delta);
      }, 0);
      assert.ok(travel < 0, `${label}: motion continues in the same direction`);
      assert.ok(inspected.every(frame => frame.uncovered === 0), `${label}: prepared artwork covers the viewport throughout the blocked crossing`);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
      console.log(JSON.stringify({ label, presentedFrames: positions.length, distinctPositions: new Set(positions).size }));
      await page.close();
    }
  } finally { await browser.close(); }
});
