import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = page => page.locator('main.system-workflow').first().evaluate(node => ({ scale: Number(node.dataset.workbenchCameraScale || 1),
  x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) }));
const arrived = page => page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));

test('Explore pans live owner and Visitor scenes without per-frame React commits or authored changes', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/flushSync was called|Maximum update depth|unmounted component/.test(message.text())) errors.push(message.text()); });
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 3, textModes: true, displayWidth: 600 });
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      const toggle = page.getByRole('button', { name: 'Explore Workbench', exact: true }); await toggle.waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-workbench-view-id^="text:"]').length === 3);
      await page.evaluate(() => document.fonts.ready); await settle(page);
      const host = page.locator('main.system-workflow').first();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await page.evaluate(() => { window.exploreNodes = [...document.querySelectorAll('[data-workbench-view-id], .tiptap, iframe')]; });
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
      // Put empty Workbench beneath the pointer without changing the authored scene.
      await host.dispatchEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true }); await settle(page);
      const before = await camera(page);
      await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(900, 530, { steps: 4 });
      assert.equal(await page.locator('.workbench-marquee').count(), 1); await page.mouse.up();
      assert.deepEqual(await camera(page), before);
      await toggle.click(); await settle(page);
      await page.mouse.move(700, 420); await page.mouse.down(); await settle(page);
      const dragCommits = await page.evaluate(() => window.__motionCommits);
      // Snapshot at release: assertion roundtrips before mouseup can themselves
      // turn a moving release into a deliberately paused one (the 64ms cutoff).
      await page.evaluate(() => document.addEventListener('pointerup', () => {
        const node = document.querySelector('main.system-workflow');
        window.__exploreRelease = { camera: { scale: Number(node.dataset.workbenchCameraScale || 1),
          x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) },
        commits: window.__motionCommits, marquees: document.querySelectorAll('.workbench-marquee').length };
      }, { once: true, capture: true }));
      for (let step = 1; step <= 10; step++) { await page.mouse.move(700 + step * 14, 420 + step * 6); if (step < 10) await page.waitForTimeout(10); }
      await page.mouse.up();
      const { camera: dragged, commits: afterDragCommits, marquees } = await page.evaluate(() => window.__exploreRelease);
      assert.equal(marquees, 0);
      assert.deepEqual(dragged, { ...before, x: before.x + 140, y: before.y + 60 });
      assert.ok(afterDragCommits - dragCommits <= 4, 'pointer samples must not render module editors');
      await page.waitForFunction(() => document.querySelector('[data-workbench-travelling]'));
      const coastCommits = await page.evaluate(() => window.__motionCommits);
      await page.waitForTimeout(130);
      const coasting = await camera(page);
      assert.ok(coasting.x > dragged.x && coasting.y > dragged.y);
      assert.ok(await page.evaluate(() => window.__motionCommits) - coastCommits <= 4, 'coasting must not render on every frame');
      // Escape consumes inertia first, preserving whatever Back history exists.
      await host.focus(); await page.keyboard.press('Escape'); await arrived(page);
      const stopped = await camera(page); await page.waitForTimeout(170); assert.deepEqual(await camera(page), stopped);
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
      // Cancellation restores the exact drag start and never starts a coast.
      await page.mouse.move(740, 440); await page.mouse.down(); await page.mouse.move(830, 520, { steps: 6 });
      await page.keyboard.press('Escape'); await page.mouse.up(); await arrived(page);
      assert.deepEqual(await camera(page), stopped);
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
      assert.equal(await page.evaluate(() => window.exploreNodes.every(node => node.isConnected)), true);
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
      assert.deepEqual(await camera(page), { scale: 1, x: 0, y: 0 });
      // Explore claims empty space only. A long reader keeps native wheel scroll.
      const textWindow = page.locator('[data-workbench-view-id="text:overflow"]');
      if (await textWindow.count()) {
        const beforeReading = await camera(page);
        const scrolled = await textWindow.evaluate(node => {
          const reader = [...node.querySelectorAll('*')].find(child => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight + 1);
          if (!reader) return false;
          reader.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true })); return true;
        });
        assert.equal(scrolled, true, 'the long article has a native scroll container'); await settle(page);
        assert.deepEqual(await camera(page), beforeReading);
        assert.notEqual(await host.evaluate(node => getComputedStyle(node).touchAction), 'none');
      }
      await page.screenshot({ path: '.browser-test-runtime/workbench-explore-' + (visitor ? 'visitor' : 'owner') + '.png' });
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('reduced motion and paused releases omit inertia, and input cancels a new coast', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce' });
    await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320 });
    const toggle = page.getByRole('button', { name: 'Explore Workbench', exact: true }); await toggle.click();
    const host = page.locator('main.system-workflow').first();
    await host.dispatchEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true }); await settle(page);
    const drag = async pause => {
      await page.mouse.move(80, 300); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(80 + 18 * i, 300 + 8 * i); await page.waitForTimeout(12); }
      const end = await camera(page); if (pause) await page.waitForTimeout(pause); await page.mouse.up(); return end;
    };
    const reduced = await drag(); await arrived(page); assert.deepEqual(await camera(page), reduced);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const paused = await drag(150); await arrived(page); assert.deepEqual(await camera(page), paused);
    await drag(); await page.waitForTimeout(80);
    await host.dispatchEvent('wheel', { deltaX: 20, deltaY: 10, bubbles: true, cancelable: true }); await arrived(page);
    const stopped = await camera(page); await page.waitForTimeout(170); assert.deepEqual(await camera(page), stopped);
    await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
    await page.screenshot({ path: '.browser-test-runtime/workbench-explore-390.png' });
  } finally { await browser.close(); }
});
