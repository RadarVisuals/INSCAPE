import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1.1, `${label}: ${a} != ${b}`);
test('cursor camera and grid stay aligned after pan, reverse smoothly, and ignore selection scope', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: Math.min(600, width - 40) });
      const board = page.locator('.system-workflow__presentation-board').first();
      await board.waitFor(); await page.waitForTimeout(700);
      const host = page.locator('main.system-workflow').first();
      const initial = await board.boundingBox();
      const toolWindow = page.locator('[data-context-tools] [data-detached-window]').first();
      const toolFrame = await toolWindow.count() ? await toolWindow.boundingBox() : null;
      for (const modifiers of [{}, { metaKey: true }]) {
        await host.dispatchEvent('wheel', { deltaY: 80, ...modifiers, bubbles: true, cancelable: true }); await settle(page);
        const scrolled = await board.boundingBox();
        near(scrolled.width, initial.width, 'wheel without Ctrl never zooms');
        near(scrolled.y, initial.y - (modifiers.metaKey ? 0 : 80), 'ordinary wheel scrolls vertically');
        await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      }
      for (const delta of [{ deltaX: 90, deltaY: 0 }, { deltaX: -90, deltaY: 0 }]) {
        await host.dispatchEvent('wheel', { ...delta, bubbles: true, cancelable: true }); await settle(page);
        near((await board.boundingBox()).x, initial.x + (delta.deltaX > 0 ? -90 : 0), 'wheel tilt scrolls horizontally');
        near((await board.boundingBox()).y, initial.y, 'wheel tilt preserves vertical position');
      }
      assert.equal(await page.getByRole('button', { name: /Zoom (in|out) Workbench/ }).count(), 0);
      for (const delta of [{ deltaY: 80 }, { deltaX: -80, deltaY: 0 }]) {
        await host.dispatchEvent('wheel', { ...delta, shiftKey: true, bubbles: true, cancelable: true }); await settle(page);
      }
      near((await board.boundingBox()).x, initial.x, 'horizontal Shift-wheel reverses');
      await host.dispatchEvent('wheel', { deltaY: 64, shiftKey: true, bubbles: true, cancelable: true }); await settle(page);
      near((await board.boundingBox()).x, initial.x - 64, 'Shift-wheel moves left/right');
      near((await board.boundingBox()).y, initial.y, 'Shift-wheel keeps vertical position');
      near((await board.boundingBox()).width, initial.width, 'Shift-wheel does not zoom');
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      await host.focus(); await page.mouse.move(width - 30, 600); await page.keyboard.down('Space');
      assert.equal(await host.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'camera focus does not outline the entire viewport');
      await page.mouse.down(); await page.mouse.move(width - 85, 630); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
      const before = await board.boundingBox(); near(before.x, initial.x - 55, 'pan x');
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      const cursor = { clientX: width * .4, clientY: 320 };
      const wheel = async deltaY => { await board.dispatchEvent('wheel', { ...cursor, deltaY, ctrlKey: true, bubbles: true, cancelable: true }); await settle(page); };
      await wheel(-8);
      const larger = await board.boundingBox(), factor = Math.exp(.024);
      if (toolFrame) assert.deepEqual(await toolWindow.boundingBox(), toolFrame, 'Artwork tools retain their screen frame through pan and cursor zoom');
      near(larger.width, before.width * factor, 'small wheel input changes scale immediately');
      near(larger.x, cursor.clientX + (before.x - cursor.clientX) * factor, 'cursor anchor x');
      near(larger.y, cursor.clientY + (before.y - cursor.clientY) * factor, 'cursor anchor y');
      const grid = host.locator(':scope > .lattice-pixel-grid');
      if (await grid.count()) near(Number(await grid.getAttribute('data-guide-spacing')), 24 * factor, 'grid scales with camera');
      await wheel(8); const reversed = await board.boundingBox();
      for (const key of ['x', 'y', 'width', 'height']) near(reversed[key], before[key], `reverse ${key}`);
      await board.locator('header[data-workbench-selectable]').focus(); await page.keyboard.press('Shift+Enter');
      const image = page.locator('[data-workbench-view-id]').last(), otherBefore = await image.boundingBox();
      await wheel(70); const otherAfter = await image.boundingBox();
      near(otherAfter.width, otherBefore.width * Math.exp(-.21), 'unselected module follows camera');
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'camera never saves document changes');
      await page.keyboard.press('Escape');
      if (!visitor) {
        await board.locator('header[data-workbench-selectable]').focus();
        await page.keyboard.press('ArrowRight'); await settle(page);
        const aligned = await board.evaluate(el => {
          const host = el.closest('main'), css = getComputedStyle(host);
          return { x: el.getBoundingClientRect().left, offset: parseFloat(css.getPropertyValue('--workbench-pan-x')),
            scale: Number(el.dataset.workbenchScale) };
        });
        const cell = 24 * aligned.scale, coordinate = (aligned.x - aligned.offset) / cell;
        near(aligned.x, aligned.offset + Math.round(coordinate) * cell, 'snapping follows panned and zoomed grid');
      }
      await page.screenshot({ path: `.browser-test-runtime/workbench-camera-${visitor}-${width}.png` });
      const expectedReset = await board.evaluate(el => {
        const rect = el.getBoundingClientRect(), css = getComputedStyle(el.closest('main'));
        const scale = Number(el.dataset.workbenchScale);
        return { x: (rect.x - parseFloat(css.getPropertyValue('--workbench-pan-x'))) / scale,
          y: (rect.y - parseFloat(css.getPropertyValue('--workbench-pan-y'))) / scale,
          width: rect.width / scale, height: rect.height / scale };
      });
      await host.focus(); await page.keyboard.press('Control+0'); await settle(page);
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      const reset = await board.boundingBox();
      for (const key of ['x', 'y']) near(reset[key], expectedReset[key], `reset preserves current module ${key}`);
      for (const key of ['width', 'height']) near(reset[key], initial[key], `reset restores native ${key}`);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
