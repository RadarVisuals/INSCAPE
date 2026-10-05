import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1, `${message}: ${actual} != ${expected}`);
const camera = page => page.evaluate(() => {
  const host = document.querySelector('main.system-workflow'), controls = host.querySelector('.workbench-view-controls');
  const frame = host.querySelector('.workbench-reference-frame').getBoundingClientRect();
  return { x: frame.x, y: frame.y, width: frame.width, height: frame.height, viewportWidth: host.clientWidth,
    viewportHeight: host.clientHeight - (parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0) - controls.offsetHeight - 16 };
});
async function gridPixels(page) {
  return page.locator('main.system-workflow > canvas.lattice-pixel-grid').evaluate(canvas => {
    const frame = document.querySelector('.workbench-reference-frame').getBoundingClientRect();
    const rect = canvas.getBoundingClientRect(), ratio = canvas.width / rect.width;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let inside = 0, outside = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (!pixels[(y * canvas.width + x) * 4 + 3]) continue;
      const sx = x / ratio + rect.x, sy = y / ratio + rect.y;
      if (sx < frame.left - 1 || sx > frame.right + 1 || sy < frame.top - 1 || sy > frame.bottom + 1) outside++;
      else inside++;
    }
    return { inside, outside };
  });
}

test('owner frame limits wheel and Space navigation, clips both grids and follows viewport and dock changes', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountGridMotionFixture(page, { origin, heavy: true, count: 2, displayWidth: 650 });
    await page.locator('.workbench-reference-frame').waitFor(); await settle(page);
    const host = page.locator('main.system-workflow').first();
    const wheel = async values => { await host.dispatchEvent('wheel', { bubbles: true, cancelable: true, clientX: 720, clientY: 450, ...values }); await settle(page); };
    const draft = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    const fitted = await camera(page);
    near(fitted.x + fitted.width / 2, fitted.viewportWidth / 2, 'initial horizontal centre');
    near(fitted.y + fitted.height / 2, fitted.viewportHeight / 2, 'initial vertical centre');
    await wheel({ deltaX: 1e6, deltaY: -1e6 });
    await wheel({ deltaY: 1e6, ctrlKey: true });
    assert.deepEqual(await camera(page), fitted, 'fit is the pan and zoom-out stop');
    // Zoom still works with the stale buttons mask left by a native colour picker.
    for (let i = 0; i < 4; i++) await wheel({ deltaY: -120, ctrlKey: true, buttons: 1 });
    near((await camera(page)).width, 2880, '200% zoom');
    for (const sign of [-1, 1]) {
      await wheel({ deltaX: sign * 1e6, deltaY: sign * 1e6 });
      const c = await camera(page);
      near(c.x, sign < 0 ? c.width * .25 : c.viewportWidth - c.width * 1.25, 'horizontal quarter-frame limit');
      near(c.y, sign < 0 ? c.height * .25 : c.viewportHeight - c.height * 1.25, 'vertical quarter-frame limit');
      await wheel({ deltaX: sign * 1e6, deltaY: sign * 1e6 });
      assert.deepEqual(await camera(page), c, 'repeated wheel cannot pass the boundary');
    }
    // Drag away from the lower bound, cancel, and then push into it again.
    const edge = await camera(page);
    await host.focus(); await page.mouse.move(1000, 300); await page.keyboard.down('Space'); await page.mouse.down();
    await page.mouse.move(1120, 360, { steps: 5 }); await settle(page);
    near((await camera(page)).x, edge.x + 120, 'Space drag pans within bounds');
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
    assert.deepEqual(await camera(page), edge, 'Escape restores the camera');
    await host.focus(); await page.mouse.move(1000, 300); await page.keyboard.down('Space'); await page.mouse.down();
    await page.mouse.move(500, 100, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
    assert.deepEqual(await camera(page), edge, 'Space drag uses the same boundary as wheel');
    await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
    assert.deepEqual(await camera(page), fitted, 'Reset view returns to the centred fit');
    for (const gridMode of ['LINES', 'DOTS']) {
      await page.evaluate(gridMode => {
        const key = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:preferences:'));
        const preferences = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...preferences, gridMode })); window.__motionRemount();
      }, gridMode);
      await page.locator('.workbench-reference-frame').waitFor(); await settle(page);
      const pixels = await gridPixels(page);
      assert.ok(pixels.inside > 1000, `${gridMode} is visible inside the frame`);
      assert.equal(pixels.outside, 0, `${gridMode} never paints outside the frame`);
    }
    await host.dispatchEvent('contextmenu', { clientX: 1400, clientY: 880, bubbles: true });
    await page.getByRole('menuitem', { name: 'HIDE DOCK', exact: true }).click(); await settle(page);
    const withoutDock = await camera(page);
    assert.ok(withoutDock.viewportHeight > fitted.viewportHeight);
    near(withoutDock.y + withoutDock.height / 2, withoutDock.viewportHeight / 2, 'hidden dock recentres fit');
    for (const width of [390, 320, 1440]) {
      await page.setViewportSize({ width, height: 844 }); await settle(page);
      const c = await camera(page);
      near(c.x + c.width / 2, c.viewportWidth / 2, 'resize horizontal centre');
      near(c.y + c.height / 2, c.viewportHeight / 2, 'resize vertical centre');
      assert.equal((await gridPixels(page)).outside, 0);
      await page.screenshot({ path: join(tmpdir(), `inscape-bounded-frame-${width}.png`) });
    }
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), draft, 'navigation and frame preferences never edit the saved composition');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
