import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function moveWindow(page, header, dx, dy) {
  await header.focus();
  const b = await header.boundingBox(), x = b.x + 30, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.keyboard.down('Alt'); await page.mouse.down();
  // Exercise the actual captured drag handler beyond the browser viewport.
  await header.dispatchEvent('pointermove', { pointerId: 1, button: 0, buttons: 1, clientX: x + dx, clientY: y + dy, altKey: true });
  await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
}
async function pan(page, dx, dy) {
  await page.locator('main.system-workflow').first().focus();
  const point = await page.evaluate(() => {
    for (let y = 350; y < innerHeight - 100; y += 20) for (let x = 30; x < innerWidth - 30; x += 20) {
      if (document.elementFromPoint(x, y)?.matches('.system-workflow, .system-workflow__workbench, .system-workflow__display-instance')) return { x, y };
    }
    throw Error('No empty space');
  });
  await page.mouse.move(point.x, point.y); await page.keyboard.down('Space'); await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Space');
  await settle(page);
}
const layout = page => page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:layout:v1:'))))?.layout);

test('modules move beyond the screen, remain editable after panning, and restore their saved positions', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: 600 });
      const board = page.locator('.system-workflow__presentation-board').first();
      const image = page.locator('[data-workbench-view-id="image:motion-4"]');
      await image.waitFor(); await page.waitForTimeout(600);
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench position' }).isVisible(), true);
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      const initialBoard = await board.boundingBox(), initialImage = await image.boundingBox();
      await moveWindow(page, board.locator('header').first(), 1800, 1000);
      assert.equal((await board.boundingBox()).x, initialBoard.x + 1800);
      assert.equal((await board.boundingBox()).y, initialBoard.y + 1000);
      await moveWindow(page, image.locator('header').first(), 2200, 800);
      assert.equal((await image.boundingBox()).x, initialImage.x + 2200);
      await pan(page, -1800, -1000);
      assert.equal((await board.boundingBox()).x, initialBoard.x);
      assert.equal((await board.boundingBox()).y, initialBoard.y);
      // Moving while panned still belongs to the module's saved window position.
      await moveWindow(page, board.locator('header').first(), 40, 24);
      assert.equal((await board.boundingBox()).x, initialBoard.x + 40);
      await page.waitForTimeout(200);
      const moved = await layout(page);
      if (!visitor) {
        assert.equal(moved.display.window.left, initialBoard.x + 1840);
        assert.equal(moved.display.window.top, initialBoard.y + 1024);
        assert.equal(moved.imageModules.find(item => item.id === 'image:motion-4').position.left, initialImage.x + 2200);
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'moving windows does not edit module content');
      const pannedBoard = await board.boundingBox();
      await board.dispatchEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }); await settle(page);
      assert.deepEqual(await board.boundingBox(), { ...pannedBoard, y: pannedBoard.y + 120 }, 'ordinary wheel pans over outlying modules without changing their world position');
      await page.screenshot({ path: `.browser-test-runtime/workbench-space-${visitor}.png` });
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      assert.equal((await board.boundingBox()).x, initialBoard.x + 1840);
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench position' }).isVisible(), true);
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: 600 });
      await page.locator('[data-workbench-view-id="image:motion-6"]').waitFor(); await page.waitForTimeout(300);
      assert.equal((await board.boundingBox()).x, initialBoard.x + (visitor ? 0 : 1840));
      if (!visitor) {
        await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
        assert.equal((await board.boundingBox()).x, moved.display.window.left, 'viewport changes do not pull the window back');
        await pan(page, -moved.display.window.left + 20, -moved.display.window.top + 40);
        assert.equal((await board.boundingBox()).x, 20);
        await page.screenshot({ path: '.browser-test-runtime/workbench-space-narrow.png' });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
