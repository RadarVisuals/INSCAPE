import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

test('Image inspection retains its source and camera through return, then release input', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    await mkdir('.browser-test-runtime', { recursive: true });
    for (const visitor of [false, true]) for (const width of [1600, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25 });
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      const label = `${visitor ? 'Visitor' : 'Owner'} ${width} Image`;
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('https://image.fit.test/source.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
      await page.goto((process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194') + '/browser-tests/image-fit-fixture.html');
      await page.evaluate(visitor => { imageFitFixture.owner(!visitor); imageFitFixture.single(true); }, visitor);
      const source = page.locator('.image-module__canvas').first();
      await source.waitFor();
      await setWorkbenchZoom(page, .56);
      const state = () => page.evaluate(() => {
        const image = document.querySelector('.image-module__window');
        const host = image.closest('.system-workflow');
        return { scale: host.dataset.workbenchCameraScale, pan: [host.style.getPropertyValue('--workbench-pan-x'), host.style.getPropertyValue('--workbench-pan-y')],
          frame: image.getBoundingClientRect().toJSON() };
      });
      const before = await state();
      const saved = await page.evaluate(() => JSON.stringify(imageFitFixture.store.getDraft()));
      await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
      await source.focus(); await page.keyboard.press('i');
      await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).isDisabled(), true, label);
      assert.equal(await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).isDisabled(), true, label);
      const inputs = async phase => {
        await page.mouse.move(width - 25, 700);
        await page.mouse.wheel(0, 71);
        await page.keyboard.down('Shift'); await page.mouse.wheel(0, 51); await page.keyboard.up('Shift');
        await page.keyboard.down('Control'); await page.mouse.wheel(0, -64); await page.keyboard.up('Control');
        await page.keyboard.press('Control+0');
        const header = page.locator('.image-module__window').first();
        await header.dispatchEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        assert.deepEqual(await state(), before, `${label} ${phase} camera input`);
        assert.equal(await page.evaluate(() => JSON.stringify(imageFitFixture.store.getDraft())), saved, `${label} ${phase} persisted data`);
      };
      await inputs('opening');
      // Decoding completes outside the emulated animation clock. The raster
      // replacement becomes visible only when ready; the lift starts then.
      await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'visible' });
      await page.clock.runFor(1000);
      assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 1, `${label} is inspecting`);
      assert.equal(await page.locator('.system-workflow__lift-artwork').evaluate(n => Number(getComputedStyle(n.parentElement).getPropertyValue('--inspection-lift-progress'))), 1, `${label} fully open`);
      await inputs('open');
      await page.screenshot({ path: `.browser-test-runtime/inspection-lock-${visitor}-${width}-image-open.png` });
      await page.getByRole('button', { name: 'Return to Image', exact: true }).click();
      await page.clock.runFor(240);
      assert.equal(await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).isDisabled(), true, `${label} closing lock`);
      await inputs('returning');
      const header = page.locator('.image-module__window').first();
      const rect = await header.boundingBox();
      await page.mouse.move(rect.x + 25, rect.y + 8); await page.mouse.down();
      await page.mouse.move(rect.x + 55, rect.y + 48, { steps: 3 });
      assert.deepEqual(await state(), before, `${label} return source drag`); await page.mouse.up();
      // A background Space drag must not change the camera during return.
      await source.evaluate(n => n.closest('.system-workflow').focus());
      await page.keyboard.down('Space'); await page.mouse.move(width - 20, 710); await page.mouse.down();
      await page.mouse.move(width - 50, 735, { steps: 3 }); await page.mouse.up(); await page.keyboard.up('Space');
      assert.deepEqual(await state(), before, `${label} returning Space drag`);
      await page.clock.runFor(560);
      await page.clock.resume();
      await page.waitForFunction(() => !document.querySelector('.image-lift, .system-workflow__lift-artwork'));
      assert.equal(await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).isDisabled(), false, `${label} releases lock`);
      assert.deepEqual(await state(), before, `${label} final source`);
      await page.screenshot({ path: `.browser-test-runtime/inspection-lock-${visitor}-${width}-image-returned.png` });
      // The old coordinate now falls inside Navigator. Exercise the canvas itself.
      await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaY: 31, bubbles: true, cancelable: true });
      await page.waitForFunction(() => document.querySelector('main.system-workflow').style.getPropertyValue('--workbench-pan-y') !== '0px');
      assert.notDeepEqual(await state(), before, `${label} camera resumes`);
      assert.deepEqual(errors, [], label);
      console.log(`${label}: passed`);
      await page.close();
    }
  } finally { await browser.close(); }
});
