import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = page => page.locator('main.system-workflow').first().evaluate(host => ({
  scale: Number(host.querySelector('[data-workbench-scale]').dataset.workbenchScale),
  x: parseFloat(host.style.getPropertyValue('--workbench-pan-x')) || 0,
  y: parseFloat(host.style.getPropertyValue('--workbench-pan-y')) || 0,
}));
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);
async function select(page, id) {
  await page.locator(`[data-workbench-view-id="${id}"]`).evaluate(node => {
    const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
    target.focus({ preventScroll: true });
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  });
}
const arrived = async page => { await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]')); await settle(page); };

test('owner and Visitor have free camera movement without custom-frame controls, refitting or constrained Focus', { timeout: 90000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await launch();
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 3, textModes: true, displayWidth: 600 });
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await page.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready); await settle(page);
      const host = page.locator('main.system-workflow').first();
      const wheel = async values => { await host.dispatchEvent('wheel', { bubbles: true, cancelable: true, clientX: 720, clientY: 450, ...values }); await settle(page); };
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      assert.deepEqual(await camera(page), { scale: 1, x: 0, y: 0 });
      assert.equal(await page.locator('.workbench-reference-guide, .workbench-reference-size').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Fit frame', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Show reference frame', exact: true }).count(), 0);
      for (const delta of [{ deltaX: 6500, deltaY: 5200 }, { deltaX: -7200, deltaY: -6100 }]) {
        const before = await camera(page); await wheel(delta);
        assert.deepEqual(await camera(page), { scale: before.scale, x: before.x - delta.deltaX, y: before.y - delta.deltaY });
      }
      for (let i = 0; i < 6; i++) await wheel({ deltaY: 120, ctrlKey: true });
      assert.equal((await camera(page)).scale, .25);
      const zoomed = await camera(page); await wheel({ deltaX: 87, deltaY: 53 });
      assert.deepEqual(await camera(page), { scale: .25, x: zoomed.x - 87, y: zoomed.y - 53 });
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
      assert.deepEqual(await camera(page), { scale: .25, x: 0, y: 0 }, 'Reset restores pan without fitting or changing zoom');
      await page.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true }).click();
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);

      // A zoomed camera far beyond the old frame can approach an actual module.
      await wheel({ deltaX: 4500, deltaY: 3700 });
      const start = await camera(page);
      await select(page, 'image:motion-0'); await settle(page);
      await page.evaluate(() => {
        window.cameraSamples = []; let active = true;
        window.stopCameraSamples = () => { active = false; return window.cameraSamples; };
        const sample = () => {
          if (!active) return;
          const host = document.querySelector('main.system-workflow');
          window.cameraSamples.push({ scale: Number(host.querySelector('[data-workbench-scale]').dataset.workbenchScale),
            x: parseFloat(host.style.getPropertyValue('--workbench-pan-x')) || 0,
            y: parseFloat(host.style.getPropertyValue('--workbench-pan-y')) || 0 });
          requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
      });
      await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click(); await arrived(page);
      const end = await camera(page), samples = await page.evaluate(() => window.stopCameraSamples());
      assert.ok(samples.length > 2);
      assert.ok(end.scale > start.scale);
      let progress = 0;
      for (const sample of samples) {
        const next = (sample.scale - start.scale) / (end.scale - start.scale);
        assert.ok(next >= progress - 1e-7 && next <= 1 + 1e-7, 'camera never reverses or snaps past the destination');
        near(sample.x, start.x + (end.x - start.x) * next, 'pan and zoom share the same uninterrupted path');
        near(sample.y, start.y + (end.y - start.y) * next, 'vertical motion is not recentered by frame limits');
        progress = next;
      }
      await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click(); await arrived(page);
      assert.deepEqual(await camera(page), start);
      await page.keyboard.press('Escape'); await settle(page);
      const beforeResize = await camera(page);
      if (!visitor) {
        await host.dispatchEvent('contextmenu', { clientX: 1400, clientY: 850, bubbles: true });
        await page.getByRole('menuitem', { name: 'HIDE DOCK', exact: true }).click(); await settle(page);
        assert.deepEqual(await camera(page), beforeResize, 'hiding the dock does not move the camera');
      }
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await settle(page);
        assert.deepEqual(await camera(page), beforeResize, 'viewport changes do not refit the camera');
        await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
        await page.screenshot({ path: `.browser-test-runtime/workbench-area-${visitor}-${width}.png` });
        await wheel({ deltaX: -beforeResize.x, deltaY: -beforeResize.y });
      }
      // Production has no development probe button. On a narrow screen, the selection
      // count can then wrap the controls onto another row and must not drift Back.
      await page.setViewportSize({ width: 390, height: 900 });
      await page.getByRole('button', { name: 'Meet Grid-naad', exact: true }).evaluate(button => { button.style.display = 'none'; });
      const compactWidth = await page.locator('.workbench-view-controls').evaluate(controls => Math.ceil(
        [...controls.querySelectorAll('button')].filter(button => getComputedStyle(button).display !== 'none')
          .reduce((width, button) => width + button.getBoundingClientRect().width, 0)) + 34);
      await page.setViewportSize({ width: compactWidth, height: 900 });
      await select(page, 'image:motion-0'); await settle(page);
      const narrowStart = await camera(page);
      const selectedHeight = (await page.locator('.workbench-view-controls').boundingBox()).height;
      await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click(); await arrived(page);
      assert.ok((await page.locator('.workbench-view-controls').boundingBox()).height < selectedHeight, 'exercise selection-driven toolbar wrapping');
      await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click(); await arrived(page);
      assert.deepEqual(await camera(page), narrowStart, 'selection-driven toolbar wrapping cannot change the return position');
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('retired frame settings do not clip the 4000 grid or relocate older outlying artwork', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountGridMotionFixture(page, { origin, heavy: true, count: 2, displayWidth: 600 });
    await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
    await page.locator('[data-workbench-view-id="image:motion-0"]').waitFor();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:preferences:'));
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), referenceFrameVisible: true,
        referenceFrameSize: { width: 240, height: 320 } }));
      const draft = JSON.parse(localStorage.getItem(window.__motionKey));
      draft.workbench.imageModules[0].position = { left: 6200, top: 5100 };
      localStorage.setItem(window.__motionKey, JSON.stringify(draft));
      const layoutKey = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:layout:'));
      if (layoutKey) {
        const record = JSON.parse(localStorage.getItem(layoutKey));
        record.layout.imageModules[0].position = { left: 6200, top: 5100 };
        localStorage.setItem(layoutKey, JSON.stringify(record));
      }
      window.__motionRemount();
    });
    const image = page.locator('[data-workbench-view-id="image:motion-0"]');
    await image.waitFor(); await settle(page);
    assert.deepEqual(await camera(page), { scale: 1, x: 0, y: 0 });
    const oldPosition = await image.boundingBox();
    near(oldPosition.x, 6200, 'old horizontal position'); near(oldPosition.y, 5100, 'old vertical position');
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    await select(page, 'image:motion-0');
    await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click(); await arrived(page);
    const visible = await image.boundingBox();
    assert.ok(visible.x >= 0 && visible.y >= 0 && visible.x + visible.width <= 1440 && visible.y + visible.height <= 1100,
      'older artwork beyond the new grid remains reachable through Focus');
    await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click(); await arrived(page);
    assert.deepEqual(await image.boundingBox(), oldPosition);
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);

    for (const mode of ['LINES', 'DOTS']) {
      await page.evaluate(mode => {
        const key = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:preferences:'));
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), gridMode: mode }));
        window.__motionRemount();
      }, mode);
      await page.locator('main.system-workflow > canvas.lattice-pixel-grid').waitFor(); await settle(page);
      const host = page.locator('main.system-workflow').first();
      for (let i = 0; i < 6; i++) await host.dispatchEvent('wheel', { ctrlKey: true, deltaY: 120, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click();
      await host.dispatchEvent('wheel', { deltaX: -80, deltaY: -60, bubbles: true, cancelable: true }); await settle(page);
      assert.deepEqual(await camera(page), { scale: .25, x: 80, y: 60 });
      const coverage = await page.locator('main.system-workflow > canvas.lattice-pixel-grid').evaluate(canvas => {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let inside = 0, outside = 0, beyondOldFrame = 0;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          if (!data[(y * canvas.width + x) * 4 + 3]) continue;
          if (x < 81 || x > 1079 || y < 61 || y > 1059) outside++;
          else { inside++; if (x > 900 && y > 900) beyondOldFrame++; }
        }
        return { inside, outside, beyondOldFrame, width: canvas.width, height: canvas.height };
      });
      assert.ok(coverage.inside > 1000 && coverage.beyondOldFrame > 100);
      assert.equal(coverage.outside, 0, `${mode} is clipped only to the fixed 4000 area`);
      assert.equal(coverage.width, 1440); assert.equal(coverage.height, 1200, 'canvas stays viewport-sized');
      await page.screenshot({ path: `.browser-test-runtime/workbench-area-grid-${mode}.png` });
    }
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
