import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

test('Image and Display inspection retain their source and camera through return, then release input', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    await mkdir('.browser-test-runtime', { recursive: true });
    for (const visitor of [false, true]) for (const width of [1600, 390]) for (const kind of ['display', 'image']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25 });
      const label = `${visitor ? 'Visitor' : 'Owner'} ${width} ${kind}`;
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5207', visitor, count: 3, displayWidth: 600, seamReview: true });
      const board = page.locator('.system-workflow__presentation-board');
      await board.waitFor(); await setWorkbenchZoom(page, .56);
      const source = kind === 'image' ? page.locator('.image-module__canvas').first()
        : board.locator('.system-workflow__placement[tabindex="0"], .lattice-production-placement[tabindex="0"]').first();
      await source.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.system-workflow__presentation-board img')].every(i => i.complete && i.naturalWidth));
      const state = () => page.evaluate(() => {
        const board = document.querySelector('.system-workflow__presentation-board');
        const host = board.closest('.system-workflow');
        return { scale: board.dataset.workbenchScale, pan: [host.style.getPropertyValue('--workbench-pan-x'), host.style.getPropertyValue('--workbench-pan-y')],
          frames: [board, document.querySelector('.image-module__window')].map(n => n.getBoundingClientRect().toJSON()) };
      });
      const before = await state();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      if (kind === 'image') { await source.focus(); await page.keyboard.press('Enter'); }
      else await source.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).isDisabled(), true, label);
      const inputs = async phase => {
        await page.mouse.move(width - 25, 700);
        await page.mouse.wheel(0, 71);
        await page.keyboard.down('Shift'); await page.mouse.wheel(0, 51); await page.keyboard.up('Shift');
        await page.keyboard.down('Control'); await page.mouse.wheel(0, -64); await page.keyboard.up('Control');
        await page.keyboard.press('Control+0');
        const header = (kind === 'image' ? page.locator('.image-module__window').first() : board).locator('header[data-workbench-selectable]').first();
        await header.dispatchEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        assert.deepEqual(await state(), before, `${label} ${phase} camera input`);
        assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, `${label} ${phase} persisted data`);
      };
      await inputs('opening');
      await page.clock.runFor(1000);
      assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 1, `${label} is inspecting`);
      assert.equal(await page.locator('.system-workflow__lift-artwork').evaluate(n => Number(n.parentElement.style.getPropertyValue('--inspection-lift-progress'))), 1, `${label} fully open`);
      await inputs('open');
      await page.screenshot({ path: `.browser-test-runtime/inspection-lock-${visitor}-${width}-${kind}-open.png` });
      if (kind === 'image') await page.getByRole('button', { name: 'Return to Image', exact: true }).click();
      else await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).click();
      await page.clock.runFor(240);
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).isDisabled(), true, `${label} closing lock`);
      await inputs('returning');
      const header = (kind === 'image' ? page.locator('.image-module__window').first() : board).locator('header[data-workbench-selectable]').first();
      const rect = await header.boundingBox();
      await page.mouse.move(rect.x + 25, rect.y + 8); await page.mouse.down();
      await page.mouse.move(rect.x + 55, rect.y + 48, { steps: 3 });
      assert.deepEqual(await state(), before, `${label} return source drag`); await page.mouse.up();
      // A background Space drag must not change the camera during return.
      await board.locator('..').evaluate(n => n.closest('.system-workflow').focus());
      await page.keyboard.down('Space'); await page.mouse.move(width - 20, 710); await page.mouse.down();
      await page.mouse.move(width - 50, 735, { steps: 3 }); await page.mouse.up(); await page.keyboard.up('Space');
      assert.deepEqual(await state(), before, `${label} returning Space drag`);
      await page.clock.runFor(560);
      await page.clock.resume();
      await page.waitForFunction(() => !document.querySelector('.image-lift, .system-workflow__lift-artwork'));
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).isDisabled(), false, `${label} releases lock`);
      assert.deepEqual(await state(), before, `${label} final source`);
      await page.screenshot({ path: `.browser-test-runtime/inspection-lock-${visitor}-${width}-${kind}-returned.png` });
      await page.mouse.move(width - 20, 700); await page.mouse.wheel(0, 31);
      await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board').closest('.system-workflow').style.getPropertyValue('--workbench-pan-y') !== '0px');
      assert.notDeepEqual(await state(), before, `${label} camera resumes`);
      assert.deepEqual(errors, [], label);
      console.log(`${label}: passed`);
      await page.close();
    }
  } finally { await browser.close(); }
});
