import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5225';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/camera';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const inside = (box, width, height) => assert.ok(box.x >= 7.5 && box.y >= 7.5 && box.x + box.width <= width - 7.5 && box.y + box.height <= height - 7.5, JSON.stringify({ box, width, height }));
const snapshot = page => page.locator('main.system-workflow').first().evaluate(node => ({
  scale: Number(node.dataset.workbenchCameraScale ?? node.querySelector('[data-workbench-scale]').dataset.workbenchScale),
  x: parseFloat(node.dataset.workbenchCameraX ?? node.style.getPropertyValue('--workbench-pan-x')) || 0,
  y: parseFloat(node.dataset.workbenchCameraY ?? node.style.getPropertyValue('--workbench-pan-y')) || 0,
}));

for (const theme of ['carbon', 'mist']) for (const [width, height, touch] of [[1440,900,false], [390,844,true], [320,568,true], [844,390,true]]) {
  test(`flat camera and scrollable canvas menu fit ${theme} ${width}×${height}`, { timeout: 60000 }, async () => {
    await mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/browser-tests/workbench-toolbar-fixture.html?theme=${theme}`);
      const rail = page.getByRole('group', { name: 'Workbench zoom', exact: true });
      const canvas = rail.getByRole('button', { name: 'Canvas size', exact: true });
      await canvas.waitFor(); await page.evaluate(() => document.fonts.ready); await settle(page);
      const box = await rail.boundingBox(); inside(box, width, height);
      const style = await rail.evaluate(node => { const s = getComputedStyle(node), icon = getComputedStyle(node.querySelector('svg.lucide > *')); return [s.borderRadius, s.boxShadow, s.colorScheme, icon.strokeWidth, icon.vectorEffect]; });
      assert.deepEqual(style, ['9px', 'none', theme === 'mist' ? 'light' : 'dark', '1.5px', 'non-scaling-stroke']);
      for (const button of await rail.locator(':scope > button').all()) {
        const target = await button.boundingBox();
        assert.ok(target.width >= (touch ? 44 : 36) && target.height >= (touch ? 44 : 36));
        assert.ok(target.x >= box.x + 3 && target.y >= box.y + 3 && target.x + target.width <= box.x + box.width - 3 && target.y + target.height <= box.y + box.height - 3);
        assert.equal(await button.evaluate(node => getComputedStyle(node).borderRadius), '5px');
      }
      const creation = await page.getByRole('toolbar', { name: 'Creation tools' }).boundingBox();
      if (width >= 1100) assert.equal(box.y + box.height, creation.y + creation.height, 'both rails share their lower edge');
      else assert.ok(box.y + box.height <= creation.y - 7, 'narrow camera stays above creation');
      await canvas.click(); await page.keyboard.press('Tab');
      const popup = rail.getByRole('group', { name: 'Canvas size controls' });
      assert.equal(await popup.getByRole('button', { name: 'Close canvas size' }).evaluate(node => node === document.activeElement), true);
      inside(await popup.boundingBox(), width, height);
      assert.equal(await popup.evaluate(node => getComputedStyle(node).borderRadius), '9px');
      const cameraBefore = await snapshot(page);
      if (height < 400) {
        assert.ok(await popup.evaluate(node => node.scrollHeight > node.clientHeight), 'short viewport gets a native scroller');
        await popup.hover(); await page.mouse.wheel(0, 400); await settle(page);
        assert.deepEqual(await snapshot(page), cameraBefore, 'scrolling the menu cannot pan the artwork');
      }
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      const last = popup.getByRole('button', { name: 'Find resize corner', exact: true });
      assert.equal(await last.evaluate(node => node === document.activeElement), true);
      const lastBox = await last.boundingBox(), popupBox = await popup.boundingBox();
      assert.ok(lastBox.y >= popupBox.y && lastBox.y + lastBox.height <= popupBox.y + popupBox.height, 'keyboard reveals the last command');
      await page.screenshot({ path: `${output}/camera-${theme}-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await popup.count(), 0);
      assert.equal(await canvas.evaluate(node => node === document.activeElement), true);
      const host = page.locator('main.system-workflow');
      await host.dispatchEvent('wheel', { bubbles: true, cancelable: true, clientX: 80, clientY: 90, deltaX: 70, deltaY: 90 }); await settle(page);
      assert.notDeepEqual(await snapshot(page), cameraBefore);
      await rail.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
      assert.deepEqual(await snapshot(page), cameraBefore);
      await host.dispatchEvent('wheel', { bubbles: true, cancelable: true, clientX: 80, clientY: 90, deltaY: -100, ctrlKey: true }); await settle(page);
      const zoom = rail.getByRole('button', { name: 'Reset Workbench zoom to 100%', exact: true });
      assert.notEqual(await zoom.innerText(), '100%');
      await zoom.click(); await settle(page); assert.equal(await zoom.innerText(), '100%');
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
      await canvas.click(); await page.keyboard.press('Escape');
      const focus = await canvas.evaluate(node => ({ outline: getComputedStyle(node).outlineWidth, transition: getComputedStyle(node).transitionDuration }));
      assert.equal(focus.outline, '2px'); assert.equal(focus.transition, '0s');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Visitor uses the same flat camera with an inverted Hand tool and unchanged publication', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await mountGridMotionFixture(page, { origin, visitor: true, count: 1 });
    const rail = page.getByRole('group', { name: 'Workbench zoom', exact: true });
    const hand = rail.getByRole('button', { name: 'Hand tool', exact: true });
    await hand.waitFor(); await settle(page);
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    assert.equal(await rail.getAttribute('data-workflow-finish'), 'flat');
    await hand.click(); await page.mouse.move(0, 0);
    assert.equal(await hand.getAttribute('aria-pressed'), 'true');
    assert.equal(await hand.evaluate(node => getComputedStyle(node, '::after').display), 'none');
    const active = await hand.evaluate(node => getComputedStyle(node).backgroundColor);
    await hand.click(); assert.notEqual(await hand.evaluate(node => getComputedStyle(node).backgroundColor), active);
    await page.emulateMedia({ forcedColors: 'active' }); await hand.click();
    const systemSelection = await hand.evaluate(node => {
      const probe = document.createElement('span'); probe.style.cssText = 'background:Highlight;color:HighlightText'; document.body.append(probe);
      const actual = getComputedStyle(node), expected = getComputedStyle(probe);
      const matches = actual.color === expected.color && actual.backgroundColor === expected.backgroundColor;
      probe.remove(); return matches;
    });
    assert.equal(systemSelection, true, 'Hand retains system selection colours in forced colours');
    assert.equal(await rail.getByRole('button', { name: 'Canvas size' }).count(), 0, 'editing stays owner-only');
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
