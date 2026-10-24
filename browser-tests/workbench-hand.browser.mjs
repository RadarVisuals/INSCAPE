import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = page => page.locator('main.system-workflow').first().evaluate(node => ({
  x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) }));
const reset = async page => { await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click(); await settle(page); };

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Hand preserves module geometry and focus (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 90000 }, async () => {
    await mkdir('.browser-test-runtime', { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 2, textModes: true, displayWidth: 320 });
      const hand = page.getByRole('button', { name: 'Hand tool', exact: true });
      await hand.waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-workbench-view-id^="text:"]').length === 3);
      const firstImage = page.locator('[data-workbench-view-id="image:motion-0"]');
      await firstImage.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      await page.evaluate(() => document.fonts.ready); await settle(page);
      if (!visitor) {
        const collapse=page.getByRole('button',{name:'Collapse sidebar',exact:true});if(await collapse.count())await collapse.click();
        const savedBeforePan=await page.evaluate(()=>localStorage.getItem(window.__motionKey));
        await page.locator('main.system-workflow').first().focus();
        await page.mouse.move(width-20,1000);await page.keyboard.down('Space');await page.mouse.down();
        await page.mouse.move(width-20,1040,{steps:4});await page.mouse.up();await page.keyboard.up('Space');await settle(page);
        assert.equal(await page.evaluate(()=>localStorage.getItem(window.__motionKey)),savedBeforePan);
      }
      if (!visitor) { const read=page.locator('[data-workbench-view-id="text:fit"]').getByRole('button',{name:'Read',exact:true});await read.focus();await read.press('Enter'); }
      assert.equal(await hand.count(), 1, 'one navigation tool');
      assert.equal(await page.getByRole('button', { name: 'Explore Workbench', exact: true }).count(), 0, 'redundant Explore control removed');
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await hand.click(); await settle(page);
      await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }); await settle(page);
      assert.equal(await hand.getAttribute('aria-pressed'), 'true');
      const drag = async target => {
        const box = await target.boundingBox(); assert.ok(box, 'visible drag surface');
        const before = await camera(page);
        // Floating Properties can cover the centre on narrow screens. Exercise
        // a genuinely exposed point on the intended surface, not the panel.
        const point = await target.evaluate(node => {
          const rect = node.getBoundingClientRect();
          // Display may place its input layer beside the painted canvas.
          const surface = node.matches('.system-workflow__canvas, .visitor-grid-world__viewport')
            ? node.closest('[data-workbench-view-id]') : node;
          const hits = [];
          for (const yRatio of [.5, .1, .9]) for (const xRatio of [.5, .1, .9, .25, .75]) {
            const x = rect.x + rect.width * xRatio, y = rect.y + rect.height * yRatio;
            const hit = document.elementFromPoint(x, y);
            const childControl = hit?.closest('button, input, textarea, select, a, summary, [role="slider"]');
            if (hit && surface?.contains(hit) && (!childControl || childControl === node))
              return { x, y, hit: hit.outerHTML.slice(0, 450) };
            hits.push({ x, y, hit: hit?.outerHTML.slice(0, 180) });
          }
          return { hits };
        });
        assert.ok(Number.isFinite(point.x), `intended drag surface has an unobstructed hit target: ${JSON.stringify(point)}`);
        const hit = point.hit;
        await page.mouse.move(point.x, point.y); await page.mouse.down();
        for (let i = 1; i <= 8; i++) {
          await page.mouse.move(point.x + i * 4, point.y + i * 2);
          if (i < 8) await page.waitForTimeout(12);
        }
        await page.mouse.up();
        const released = await camera(page);
        await page.waitForTimeout(100);
        const coasting = await camera(page);
        assert.ok(released.x >= before.x + 31 && released.y >= before.y + 15, `drag pans the camera: ${JSON.stringify({ before, released, box, hit })}`);
        assert.ok(coasting.x > released.x && coasting.y > released.y, 'Hand retains momentum');
        await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
        assert.equal(await page.locator('.image-lift-return').count(), 0, 'drag does not inspect');
        assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'drag never saves geometry');
        const current = await camera(page);
        await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaX: current.x - before.x, deltaY: current.y - before.y, bubbles: true, cancelable: true }); await settle(page);
      };
      const bounds = await firstImage.boundingBox();
      await drag(firstImage.locator('.image-module__canvas'));
      const after = await firstImage.boundingBox();
      assert.deepEqual(after, bounds, 'reset restores the same Image bounds, including Visitor temporary positions');
      // Stationary Image double-clicks focus, even after a drag; Back retains Hand.
      const beforeClick = await camera(page);
      await firstImage.locator('.image-module__canvas').click(); await settle(page);
      assert.deepEqual(await camera(page), beforeClick, 'one stationary click does not zoom in Hand mode');
      await firstImage.locator('.image-module__canvas').dblclick();
      await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      assert.equal(await page.locator('.image-lift').count(), 0);
      await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      assert.equal(await hand.getAttribute('aria-pressed'), 'true');
      // Keyboard movement cannot bypass the navigation tool.
      await firstImage.focus();
      for (const key of ['ArrowRight', 'Shift+ArrowDown', 'Alt+ArrowLeft', 'Shift+Enter']) await page.keyboard.press(key);
      await settle(page);
      assert.deepEqual(await firstImage.boundingBox(), bounds);
      assert.equal(await page.locator('.workbench-selection').count(), 0);
      if (!visitor) {
        // Resize handles use the same camera gesture instead of resizing.
        const handle = firstImage.getByRole('separator', { name: 'Resize Image right', exact: true });
        await handle.focus(); await page.keyboard.press('ArrowRight');
        await drag(handle);
        assert.deepEqual(await firstImage.boundingBox(), bounds);
        // Properties exists only for a selected Display layer. Open an actual
        // floating Display instrument through its ordinary module menu.
        await page.getByLabel(/Move Display Module:/).focus();await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem',{name:'APPEARANCE',exact:true}).click();
        const instrument = page.locator('[data-shared-tool="appearance"]').locator('xpath=ancestor::aside').locator('header');
        const instrumentBounds = await instrument.boundingBox();
        await drag(instrument);
        await instrument.focus(); await page.keyboard.press('ArrowRight');
        assert.deepEqual(await instrument.boundingBox(), instrumentBounds, 'Hand keeps floating tool windows fixed too');
        await page.getByRole('button', { name: 'Close Display appearance', exact: true }).focus();
        await page.keyboard.press('Enter');
      }
      await reset(page);
      if (!visitor) {
        await page.locator('main.system-workflow').dispatchEvent('wheel', { deltaX: -96, deltaY: 0, bubbles: true, cancelable: true });
        await settle(page);
        assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'revealing the title beside the sidebar preserves geometry');
      }
      const canvas = page.locator(visitor ? '.visitor-grid-world__viewport' : '.system-workflow__canvas').first();
      await drag(canvas);
      const title = page.locator('[data-workbench-view-id="text:fit"] [data-workbench-selectable]').first();
      // The quiet title strip is pointer-inert until hover or keyboard focus.
      await title.focus(); await settle(page);
      const titleBounds = await title.boundingBox();
      await drag(title);
      assert.deepEqual(await title.boundingBox(), titleBounds, 'Text title drag never moves its window');
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
      await page.screenshot({ path: `.browser-test-runtime/hand-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      // Returning to Select restores ordinary window movement.
      if (visitor) await hand.click(); else await page.getByRole('button', { name: 'Select tool', exact: true }).click();
      assert.equal(await hand.getAttribute('aria-pressed'), 'false');
      await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }); await settle(page);
      const movable = await firstImage.boundingBox();
      await page.mouse.move(movable.x + 50, movable.y + 40); await page.mouse.down();
      await page.mouse.move(movable.x + 82, movable.y + 63, { steps: 6 }); await page.mouse.up(); await settle(page);
      assert.notDeepEqual(await firstImage.boundingBox(), movable, 'Select can move the Image again');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
