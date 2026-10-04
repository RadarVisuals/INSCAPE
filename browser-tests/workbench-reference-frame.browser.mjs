import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const browserOptions = { executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true };
const savedDraft = page => page.evaluate(() => localStorage.getItem(window.__motionKey));
const moduleGeometry = page => page.locator('[data-workbench-view-id]').evaluateAll(nodes => nodes.map(node => {
  const rect = node.getBoundingClientRect(), host = node.closest('main'), css = getComputedStyle(host);
  const scale = Number(host.querySelector('[data-workbench-scale]').dataset.workbenchScale);
  return { id: node.dataset.workbenchViewId, width: rect.width / scale, height: rect.height / scale,
    left: (rect.left - (parseFloat(css.getPropertyValue('--workbench-pan-x')) || 0)) / scale,
    top: (rect.top - (parseFloat(css.getPropertyValue('--workbench-pan-y')) || 0)) / scale };
}));
async function assertFits(page) {
  const bounds = await page.locator('.workbench-reference-frame').boundingBox();
  const controls = await page.getByRole('group', { name: 'Workbench zoom' }).boundingBox();
  assert.ok(bounds.x >= 0 && bounds.y >= 24, 'frame and label remain visible');
  assert.ok(bounds.x + bounds.width <= page.viewportSize().width, 'frame fits the width');
  assert.ok(bounds.y + bounds.height < controls.y, 'frame clears wrapped controls and dock');
  return bounds;
}

test('owner reference frame fits, follows the camera and persists visibility without editing the draft', { timeout: 90000 }, async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await mountGridMotionFixture(page, { origin, heavy: true, count: 2, displayWidth: 650, textModes: true });
    await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
    await page.locator('.system-workflow__presentation-board').first().waitFor();
    await page.locator('.text-window').first().waitFor();
    await page.evaluate(() => document.fonts.ready); await settle(page);
    if (await page.getByRole('button', { name: 'Close Text tools' }).count()) {
      await page.getByRole('button', { name: 'Close Text tools' }).click(); await settle(page);
    }
    const draft = await savedDraft(page), original = await moduleGeometry(page);
    const frame = page.locator('.workbench-reference-frame');
    assert.equal(await frame.count(), 1);
    const initial = await frame.boundingBox();
    assert.deepEqual([initial.x, initial.y, initial.width, initial.height], [48, 48, 1440, 900]);
    await page.getByRole('button', { name: 'Fit frame', exact: true }).press('Enter'); await settle(page);
    await assertFits(page);
    const fitted = await moduleGeometry(page);
    for (let index = 0; index < original.length; index++) {
      assert.equal(fitted[index].id, original[index].id);
      for (const key of ['left', 'top', 'width', 'height']) {
        assert.ok(Math.abs(fitted[index][key] - original[index][key]) < 1.5,
          `${original[index].id} ${key} unchanged: ${original[index][key]} -> ${fitted[index][key]}`);
      }
    }
    await page.screenshot({ path: join(tmpdir(), 'inscape-reference-frame-desktop.png') });
    const host = page.locator('main.system-workflow').first(), beforePan = await frame.boundingBox();
    await host.dispatchEvent('wheel', { deltaX: 45, deltaY: 70, bubbles: true, cancelable: true }); await settle(page);
    const afterPan = await frame.boundingBox();
    assert.ok(Math.abs(afterPan.x - beforePan.x + 45) < 1);
    assert.ok(Math.abs(afterPan.y - beforePan.y + 70) < 1);
    assert.equal(await frame.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    assert.equal(await frame.evaluate(el => Boolean(document.elementFromPoint(Math.max(0, el.getBoundingClientRect().left), 400)?.closest('.workbench-reference-guide'))), false);
    await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).click(); await settle(page);
    assert.equal((await frame.boundingBox()).width, 1440);
    assert.equal((await frame.boundingBox()).height, 900);
    assert.equal(await savedDraft(page), draft, 'view actions never write composition geometry');
    await page.getByRole('button', { name: 'Show reference frame' }).click();
    assert.equal(await frame.count(), 0);
    await page.evaluate(() => window.__motionRemount());
    await page.getByRole('button', { name: 'Show reference frame' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Show reference frame' }).getAttribute('aria-pressed'), 'false');
    assert.equal(await frame.count(), 0);
    await page.getByRole('button', { name: 'Fit frame', exact: true }).click(); await settle(page);
    assert.equal(await frame.count(), 1, 'fit reveals a hidden guide');
    const frameWidth = page.getByRole('spinbutton', { name: 'Reference frame width' });
    const frameHeight = page.getByRole('spinbutton', { name: 'Reference frame height' });
    await frameWidth.fill('1920');
    await frameHeight.click(); // Leaving a field commits it.
    await frameHeight.fill('1080');
    await frameHeight.press('Enter'); await settle(page);
    assert.equal(await frame.textContent(), 'Reference · 1920 × 1080');
    await frameWidth.fill('2560'); await frameWidth.press('Escape');
    assert.equal(await frameWidth.inputValue(), '1920', 'Escape restores the existing width');
    for (const invalid of ['', '0', '-1', '1920.5', '7945']) {
      await frameWidth.fill(invalid); await frameWidth.press('Enter');
      assert.equal(await frameWidth.inputValue(), '1920', 'invalid input restores the existing width');
    }
    await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).click(); await settle(page);
    assert.equal((await frame.boundingBox()).width, 1920);
    assert.equal((await frame.boundingBox()).height, 1080);
    const resizedView = await moduleGeometry(page);
    for (let index = 0; index < original.length; index++) {
      for (const key of ['left', 'top', 'width', 'height']) {
        assert.ok(Math.abs(resizedView[index][key] - original[index][key]) < 1.5, 'frame size never resizes or moves artwork');
      }
    }
    assert.equal(await savedDraft(page), draft, 'frame resolution never writes the composition');
    await page.evaluate(() => window.__motionRemount());
    await frameWidth.waitFor(); await settle(page);
    assert.equal(await frameWidth.inputValue(), '1920', 'width survives remount');
    assert.equal(await frameHeight.inputValue(), '1080', 'height survives remount');
    await page.getByRole('button', { name: 'Fit frame', exact: true }).click(); await settle(page);
    await assertFits(page);
    await page.screenshot({ path: join(tmpdir(), 'inscape-frame-resolution-desktop.png') });
    if (await page.getByRole('button', { name: 'Close Text tools' }).count()) {
      await page.getByRole('button', { name: 'Close Text tools' }).click(); await settle(page);
    }
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 }); await settle(page);
      await frameWidth.fill('1080'); await frameWidth.press('Enter');
      await frameHeight.fill('1920'); await frameHeight.press('Enter');
      await page.getByRole('button', { name: 'Fit frame', exact: true }).click(); await settle(page);
      await assertFits(page);
      for (const input of [frameWidth, frameHeight]) {
        const box = await input.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width, 'resolution fields remain reachable');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, 'controls never create horizontal scrolling');
      await page.screenshot({ path: join(tmpdir(), `inscape-reference-frame-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await settle(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await settle(page);
    await frame.waitFor({ state: 'detached', timeout: 10000 }).catch(async error => {
      throw new Error(`${error.message}\nPreview notices: ${await page.locator('[role="alert"], .system-workflow__notice').allTextContents()}`);
    });
    assert.equal(await frame.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Fit frame', exact: true }).count(), 0);
    assert.equal(await page.getByRole('spinbutton', { name: 'Reference frame width' }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('published visitors have no owner reference guide or controls', { timeout: 60000 }, async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mountGridMotionFixture(page, { origin, visitor: true, heavy: true, count: 2, displayWidth: 300 });
    await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
    await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).waitFor();
    assert.equal(await page.locator('.workbench-reference-frame').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Fit frame', exact: true }).count(), 0);
    assert.equal(await page.getByRole('spinbutton', { name: 'Reference frame width' }).count(), 0);
  } finally { await browser.close(); }
});
