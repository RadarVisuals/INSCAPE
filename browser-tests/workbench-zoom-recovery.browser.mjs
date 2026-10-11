import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = page => page.locator('main.system-workflow').first().evaluate(node => ({
  scale: Number(node.dataset.workbenchCameraScale || 1), x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) }));
const zoom = async page => { await page.keyboard.down('Control'); await page.mouse.wheel(0, -80); await page.keyboard.up('Control'); await settle(page); };

for (const visitor of [false, true]) for (const lost of ['control', 'hand', 'module']) {
  test(`zoom recovers from a missed ${lost} release without switching windows (${visitor ? 'Visitor' : 'owner'})`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      // Browser/OS UI can consume release events. Drop only their delivery to
      // the app: the real mouse is released and browser capture ends normally.
      await page.addInitScript(() => {
        for (const name of ['pointerup', 'lostpointercapture', 'click']) window.addEventListener(name, event => {
          if (window.__loseRelease) { event.preventDefault(); event.stopImmediatePropagation(); }
        }, true);
        window.__focusChanges = 0;
        window.addEventListener('blur', () => window.__focusChanges++);
      });
      await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 320 });
      const host = page.locator('main.system-workflow').first();
      const image = page.locator('[data-workbench-view-id="image:motion-0"]');
      await image.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      await settle(page);
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      if (lost === 'hand') await page.getByRole('button', { name: 'Hand tool', exact: true }).click();
      const target = lost === 'control' ? page.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true })
        : lost === 'module' ? image.locator('.image-module__canvas') : host;
      if (lost === 'hand') await page.mouse.move(1150, 650);
      else await target.hover();
      await page.mouse.down();
      if (lost === 'hand') await page.mouse.move(1180, 670, { steps: 4 });
      const held = await camera(page);
      if (lost === 'module') await page.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true })
        .dispatchEvent('pointerdown', { pointerId: 901, pointerType: 'pen', button: 0, buttons: 1 });
      if (lost !== 'control') {
        await zoom(page);
        assert.deepEqual(await camera(page), held, 'a genuinely held gesture still blocks zoom');
      }
      await page.evaluate(() => { window.__loseRelease = true; });
      await page.mouse.up(); await settle(page);
      await page.evaluate(() => { window.__loseRelease = false; });
      // Do not move the pointer, blur the page, Escape, or reset the view.
      await zoom(page);
      const recovered = await camera(page);
      assert.ok(recovered.scale > held.scale, `wheel should recover immediately: ${JSON.stringify({ held, recovered })}`);
      if (lost === 'hand') {
        assert.ok(Math.abs((1180 - recovered.x) / recovered.scale - (1180 - held.x) / held.scale) < 1e-6, 'recovery zooms from the visible camera without undoing the pan');
        assert.ok(Math.abs((670 - recovered.y) / recovered.scale - (670 - held.y) / held.scale) < 1e-6);
      }
      assert.equal(await host.getAttribute('data-workbench-panning'), null);
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
      // Native dialogs can also report a stale buttons bit on a wheel event.
      await host.dispatchEvent('wheel', { ctrlKey: true, deltaY: -20, buttons: 1, bubbles: true, cancelable: true }); await settle(page);
      assert.ok((await camera(page)).scale > recovered.scale, 'a stale wheel buttons bit is not a drag');
      assert.equal(await page.evaluate(() => window.__focusChanges), 0, 'recovery needs no focus reset');
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'recovery preserves the draft');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
