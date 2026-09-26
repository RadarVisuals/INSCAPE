import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const close = (a, b, message, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${message}: ${a} / ${b}`);
const geometry = page => page.evaluate(() => {
  const text = document.querySelector('.text-window').getBoundingClientRect();
  const display = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
  const draft = JSON.parse(localStorage.getItem(window.__motionKey));
  return { text: text.toJSON(), display: display.toJSON(),
    savedText: draft.workbench.texts[0].window, savedDisplay: (draft.workbench.displays?.[0] || draft.workbench.display).window,
    article: draft.texts[0].article };
});
async function checkJoin(page, label, saved = true) {
  await settle(page);
  const state = await geometry(page);
  if (Math.abs(state.text.right - state.display.left) > .0001) await page.screenshot({ path: `.browser-test-runtime/text-display-resize-${label}-failure.png` });
  // DOMMatrix float serialization at fractional DPR differs by millionths of a
  // CSS pixel. The screenshot check below independently verifies pixel coverage.
  close(state.text.right, state.display.left, label + ' painted join', .0001);
  close(state.text.top, state.display.top, label + ' aligned tops', .0001);
  close(state.text.bottom, state.display.bottom, label + ' aligned bottoms', .0001);
  if (saved) {
    close(state.savedText.left + state.savedText.width, state.savedDisplay.left, label + ' authored join');
    close(state.savedDisplay.width / state.savedDisplay.height, 16 / 9, label + ' Stage ratio');
  }
  return state;
}
async function selectPair(page) {
  for (const name of ['Move Text window', 'Move Display Module: DISPLAY MODULE']) {
    await page.getByLabel(name, { exact: true }).focus(); await page.keyboard.press('Shift+Enter');
  }
  await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).waitFor();
}
async function pixelJoin(page, label) {
  const png = await page.screenshot();
  const result = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const t = document.querySelector('.text-window').getBoundingClientRect();
    const d = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
    let count = 0, bad = 0;
    for (let y = Math.ceil((Math.max(t.top, d.top) + 90) * devicePixelRatio); y < Math.floor((Math.min(t.bottom, d.bottom) - 12) * devicePixelRatio); y++) {
      for (let x = Math.round(d.left * devicePixelRatio) - 1; x <= Math.round(d.left * devicePixelRatio) + 1; x++) {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
        count++;
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] > 2 || p[1] > 2 || p[2] > 2) bad++;
      }
    }
    return { count, bad };
  }, png.toString('base64'));
  assert.ok(result.count > 0, label + ' visible sample band');
  assert.equal(result.bad, 0, label + ' opaque black join');
}

for (const secondaryDisplay of [false, true]) for (const density of [1, 1.25, 2]) test(`Text/${secondaryDisplay ? 'additional' : 'primary'} Display group resize preserves joins through preview, save and camera changes at DPR ${density}`, { timeout: 90000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1305 }, deviceScaleFactor: density });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const black = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 2560; c.height = 1440;
      const context = c.getContext('2d'); context.fillStyle = '#000'; context.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    });
    await mountGridMotionFixture(page, { origin, count: 3, textModes: true,
      adjoiningModules: { secondaryDisplay, textAppearance: { background: '#000000' } },
      artwork: { url: 'https://motion.invalid/opaque.png', width: 2560, height: 1440, contentType: 'image/png', body: Buffer.from(black, 'base64') } });
    await page.locator('.text-window').waitFor();
    for (const name of ['Read', 'Close Text tools']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.count()) { await button.focus(); await page.keyboard.press('Enter'); }
    }
    await page.waitForFunction(() => [...document.querySelectorAll('.system-workflow__presentation-board img')].every(i => i.complete && i.naturalWidth));
    const initial = await checkJoin(page, 'existing fractional draft');
    await selectPair(page);
    // Different anchors exercise both positioning and Text's available space.
    for (const corner of ['se', 'nw', 'sw', 'ne']) {
      await page.getByRole('button', { name: `Scale selected modules from ${corner}`, exact: true }).focus();
      await page.keyboard.press('Alt+ArrowRight');
      const state = await checkJoin(page, corner);
      assert.deepEqual(state.article, initial.article, 'resizing never rewrites article typography or content');
    }
    const selection = page.getByRole('group', { name: '2 selected Workbench modules', exact: true });
    const bounds = await selection.boundingBox();
    const handle = await page.getByRole('button', { name: 'Scale selected modules from se', exact: true }).boundingBox();
    await page.keyboard.down('Alt');
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    for (const fraction of [.035, .087, .133]) {
      await page.mouse.move(handle.x + handle.width / 2 + bounds.width * fraction, handle.y + handle.height / 2 + bounds.height * fraction);
      await checkJoin(page, `preview-${fraction}`, false);
    }
    await page.mouse.up(); await page.keyboard.up('Alt');
    await checkJoin(page, 'pointer release');
    // Cancelling another gesture restores exactly the previously saved frames.
    const beforeCancel = await geometry(page);
    const cancelHandle = await page.getByRole('button', { name: 'Scale selected modules from se', exact: true }).boundingBox();
    await page.mouse.move(cancelHandle.x + cancelHandle.width / 2, cancelHandle.y + cancelHandle.height / 2); await page.mouse.down();
    await page.mouse.move(cancelHandle.x - 40, cancelHandle.y - 20); await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await geometry(page), beforeCancel, 'Escape rolls back preview without saving');
    await page.keyboard.press('Escape');
    const beforeUndo = await geometry(page);
    await page.locator('main').first().focus(); await page.keyboard.press('Control+z');
    const undone = await checkJoin(page, 'undo');
    assert.notEqual(undone.savedText.width, beforeUndo.savedText.width, 'Undo restores the previous size');
    await page.keyboard.press('Control+Shift+z');
    await checkJoin(page, 'redo');
    assert.deepEqual(await geometry(page), beforeUndo, 'Redo restores both modules together');
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    for (const zoom of [.56, .6703200562639108, 1, 1.371]) {
      await setWorkbenchZoom(page, zoom);
      await checkJoin(page, `zoom-${zoom}`);
      await pixelJoin(page, `zoom-${zoom}`);
    }
    await setWorkbenchZoom(page, .6703200562639108);
    await page.keyboard.down('Space'); await page.mouse.move(2500, 1200); await page.mouse.down();
    await page.mouse.move(2531.37, 1217.13, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Space');
    await checkJoin(page, 'fractional pan'); await pixelJoin(page, 'fractional pan');
    await page.setViewportSize({ width: 1000, height: 800 }); await settle(page);
    await checkJoin(page, 'narrow viewport'); await pixelJoin(page, 'narrow viewport');
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'camera changes never rewrite saved geometry');
    await page.screenshot({ path: `.browser-test-runtime/text-display-resize-${secondaryDisplay}-${density}-narrow.png` });
    await page.setViewportSize({ width: 2560, height: 1305 });
    await page.evaluate(() => window.__motionRemount());
    await page.locator('.text-window').waitFor(); await settle(page);
    const restored = await checkJoin(page, 'fresh mount from saved draft');
    assert.deepEqual(restored.savedText, beforeUndo.savedText);
    assert.deepEqual(restored.savedDisplay, beforeUndo.savedDisplay);
    assert.deepEqual(restored.article, initial.article);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
