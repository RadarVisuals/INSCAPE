import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { activate, openDisplayMenu } from './fixtures/display-controls.mjs';

test('Grid playback loops without dwell, retains its paused pose, and stays local', { timeout: 65000 }, async () => {
  const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/development/owner/system-workflow`);
      const board = page.getByRole('article', { name: 'Display Module', exact: true });
      await openDisplayMenu(page, board);
      assert.equal(await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).count(), 0, 'one Grid has nothing to play');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.getByRole('button', { name: 'New Grid', exact: true }).click();
      await page.getByRole('button', { name: 'Grids', exact: true }).click();
      await page.evaluate(() => { window.__playWrites = 0; addEventListener('inscape:review-storage-write', event => {
        if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__playWrites++;
      }); });
      const track = page.locator('.system-workflow__grid-track');
      const offset = () => track.evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41);
      const play = async () => {
        await openDisplayMenu(page, board);
        await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).click();
      };
      const pause = () => activate(page, board.getByRole('button', { name: 'Pause Grids', exact: true }));
      await play();
      await page.waitForFunction(() => document.querySelector('.system-workflow__grid-track').getAnimations().length > 0);
      await page.waitForTimeout(300);
      assert.ok(await offset() < -1);
      await pause();
      const paused = await offset();
      await page.waitForTimeout(200); assert.equal(await offset(), paused);
      await play();
      const initial = await page.locator('[data-system-workflow-stage]').getAttribute('aria-label');
      await track.evaluate(async node => { const animation = node.getAnimations()[0]; await animation.ready; animation.currentTime = 13000; });
      await page.waitForFunction(label => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') !== label, initial);
      const moving = await offset(); await page.waitForTimeout(120);
      assert.ok(await offset() < moving, 'the camera continues moving through the Grid boundary');
      await pause();
      const stopped = await offset(); await page.waitForTimeout(200);
      assert.equal(await offset(), stopped);
      assert.equal(await board.getByRole('button', { name: 'Pause Grids', exact: true }).count(), 0);
      await page.screenshot({ path: `.browser-test-runtime/grid-playback-${width}.png` });
      if (width === 390) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const label = await page.locator('[data-system-workflow-stage]').getAttribute('aria-label');
        await play(); await page.waitForTimeout(300);
        assert.equal(await offset(), 0, 'reduced motion changes Grids without sliding');
        await page.waitForFunction(label => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') !== label, label);
        assert.equal(await offset(), 0); await pause();
      }
      assert.equal(await page.evaluate(() => window.__playWrites), 0);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
