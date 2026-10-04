import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5207';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const emptyPoint = page => page.evaluate(() => {
  for (let y = 350; y < innerHeight - 100; y += 20) for (let x = 30; x < innerWidth - 30; x += 20) {
    const target = document.elementFromPoint(x, y);
    if (target?.matches('.system-workflow, .system-workflow__workbench, .system-workflow__display-instance')) return { x, y };
  }
  throw Error('No empty Workbench space');
});
const snapshot = page => page.evaluate(() => ({
  modules: [...document.querySelectorAll('[data-workbench-view-id]')].map(el => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.workbenchViewId, x: r.x, y: r.y, width: r.width, height: r.height, left: el.style.left, top: el.style.top };
  }),
  dock: document.querySelector('.system-workflow__global-bar, .visitor-grid-world__dock').getBoundingClientRect().toJSON(),
  grid: document.querySelector('main.system-workflow > .lattice-pixel-grid')?.getBoundingClientRect().toJSON(),
  shortcut: document.querySelector('.system-workflow__desktop-shortcut')?.getBoundingClientRect().toJSON(),
  storage: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
}));
async function drag(page, delta, { space = true, end = 'up', focus = true, target = null } = {}) {
  if (focus) await page.locator('main.system-workflow').first().focus();
  const rect = target && await target.boundingBox();
  const start = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : await emptyPoint(page);
  await page.mouse.move(start.x, start.y);
  if (space) await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 12 });
  await settle(page);
  if (end === 'escape') await page.keyboard.press('Escape');
  if (end === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  if (end === 'cancel') await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
  if (end === 'space') await page.keyboard.up('Space');
  await page.mouse.up();
  if (space) await page.keyboard.up('Space');
  await settle(page);
}
function shifted(before, after, dx, dy, checkStorage = true) {
  assert.equal(after.modules.length, before.modules.length);
  before.modules.forEach((a, index) => {
    const b = after.modules[index];
    assert.ok(Math.abs(b.x - a.x - dx) < 1, `${a.id} x: ${b.x - a.x}, expected ${dx}`);
    assert.ok(Math.abs(b.y - a.y - dy) < 1, `${a.id} y: ${b.y - a.y}, expected ${dy}`);
    assert.deepEqual([b.left, b.top, b.width, b.height], [a.left, a.top, a.width, a.height]);
  });
  assert.deepEqual(after.dock, before.dock);
  assert.deepEqual(after.grid, before.grid);
  if (before.shortcut) {
    assert.ok(Math.abs(after.shortcut.x - before.shortcut.x - dx) < 1);
    assert.ok(Math.abs(after.shortcut.y - before.shortcut.y - dy) < 1);
  }
  if (checkStorage) assert.deepEqual(after.storage, before.storage, 'Panning never writes content or window layouts');
}

test('owner and Visitor pan all modules equally at native and zoomed sizes without saving', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, textModes: true, displayWidth: Math.min(600, width - 40) });
      await page.locator('[data-workbench-view-id]').nth(7).waitFor();
      if (!visitor && await page.getByRole('button', { name: 'Close Text tools', exact: true }).isVisible())
        await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
      await page.waitForTimeout(1000);
      let before = await snapshot(page);
      await drag(page, { x: 100, y: -65 });
      shifted(before, await snapshot(page), 100, -65);
      await page.screenshot({ path: `.browser-test-runtime/workbench-pan-${visitor}-${width}.png` });
      await page.getByRole('button', { name: 'Reset Workbench position' }).click();
      await settle(page);
      shifted(before, await snapshot(page), 0, 0);
      // Existing marquee and zoom remain separate from the camera.
      await drag(page, { x: 50, y: 20 }, { space: false });
      shifted(before, await snapshot(page), 0, 0, false);
      await page.waitForTimeout(200); // Existing selection context has a 120 ms save debounce.
      before = await snapshot(page);
      await page.keyboard.press('Escape');
      await page.locator('main.system-workflow').first().focus();
      await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaY: 35, ctrlKey: true, bubbles: true, cancelable: true }); await settle(page);
      const zoomed = await snapshot(page);
      await drag(page, { x: 83, y: 44 });
      shifted(zoomed, await snapshot(page), 83, 44);
      await page.keyboard.press('Control+0'); await settle(page);
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      shifted(before, await snapshot(page), 0, 0);
      for (const end of ['escape', 'cancel']) {
        await drag(page, { x: 60, y: 35 }, { end });
        shifted(before, await snapshot(page), 0, 0);
      }
      for (const end of ['blur', 'space']) {
        await drag(page, { x: 40, y: 25 }, { end });
        const stopped = await snapshot(page);
        shifted(before, stopped, 40, 25);
        await page.mouse.move(230, 580); await settle(page);
        shifted(stopped, await snapshot(page), 0, 0);
        await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      }
      const rail = page.locator('.system-workflow__grid-track, .visitor-grid-world__grid-track').first();
      const railBefore = await rail.evaluate(el => getComputedStyle(el).transform);
      const image = page.locator('.image-module__canvas').first();
      const targets = [image, page.locator('[data-system-workflow-artboard], .visitor-grid-world__viewport').first(),
        page.locator('[data-workbench-view-id="text:fit"] .text-module-scroll')];
      for (const target of targets) {
        const original = await snapshot(page);
        await drag(page, { x: 70, y: -30 }, { target });
        shifted(original, await snapshot(page), 70, -30);
        assert.equal(await rail.evaluate(el => getComputedStyle(el).transform), railBefore, 'Space never moves the Display Grid camera');
        assert.equal(await page.locator('.image-lift, .system-workflow__lift-artwork').count(), 0, 'release never opens artwork');
        await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      }
      // Releasing Space before the mouse, including a press with no movement,
      // must not turn the remainder of that gesture into a module click.
      await drag(page, { x: 0, y: 0 }, { target: image, end: 'space' });
      assert.equal(await page.locator('.image-lift').count(), 0);
      await image.focus(); await page.keyboard.press('Space');
      assert.equal(await page.locator('.image-lift').count(), 0, 'Space on a focused Image remains a camera modifier');
      await drag(page, { x: 0, y: -260 });
      await image.click();
      await page.getByRole('button', { name: 'Return to Image', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.image-lift').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Next Image side', exact: true }).first().press('Space');
      await page.waitForFunction(() => document.querySelector('.image-module__canvas')?.dataset.sideId === 'side:motion-1');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('pan respects editable controls and clears gestures on suspension and Workbench replacement', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    await page.route(`${origin}/__pan_lifecycle__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__pan_lifecycle__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { WorkbenchViewProvider, WorkbenchViewControls } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
      const { WorkbenchWindow } = await import('/src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      function Bench({ disabled }) {
        const ref = React.useRef(null);
        return React.createElement(WorkbenchViewProvider, null, React.createElement('main', { ref, className: 'system-workflow', tabIndex: -1 },
          React.createElement(WorkbenchViewControls, { hostRef: ref, disabled }),
          React.createElement(WorkbenchWindow, { label: 'Text', viewId: 'text:test', title: 'Test', width: 280, resizableWidth: true, initialHeight: 220, initialX: 50 },
            React.createElement('input', { 'aria-label': 'Text entry' }), React.createElement('button', { onClick: () => { window.nativeClicks = (window.nativeClicks || 0) + 1; } }, 'Native button')),
          React.createElement(WorkbenchWindow, { label: 'Tools', title: 'Test', width: 280, initialHeight: 220, initialX: 400 }, 'Tools')));
      }
      function App() {
        const [disabled, disable] = React.useState(false), [profile, replace] = React.useState(0);
        window.panDisable = disable; window.panReplace = () => replace(value => value + 1);
        return React.createElement(Bench, { key: profile, disabled });
      }
      createRoot(document.getElementById('root')).render(React.createElement(App));
    });
    await page.getByRole('textbox', { name: 'Text entry' }).waitFor();
    await page.getByRole('textbox', { name: 'Text entry' }).fill('Two');
    await page.keyboard.press('End'); await page.keyboard.press('Space'); await page.keyboard.type('words');
    assert.equal(await page.getByRole('textbox', { name: 'Text entry' }).inputValue(), 'Two words');
    assert.equal(await page.locator('[data-workbench-pan-ready]').count(), 0);
    await page.getByRole('button', { name: 'Native button' }).focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-workbench-pan-ready]').count(), 0);
    assert.equal(await page.evaluate(() => window.nativeClicks), 1, 'ordinary keyboard button activation remains available');
    for (const target of [page.getByRole('textbox', { name: 'Text entry' }), page.getByRole('separator', { name: 'Resize Text window', exact: true })]) {
      const frame = page.locator('[data-workbench-view-id="text:test"]');
      const before = await frame.boundingBox();
      await drag(page, { x: 70, y: 35 }, { target });
      const after = await frame.boundingBox();
      assert.deepEqual(after, { ...before, x: before.x + 70, y: before.y + 35 }, 'armed Space overrides text and resize input without editing geometry');
      assert.equal(await page.getByRole('textbox', { name: 'Text entry' }).inputValue(), 'Two words');
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page);
    }
    const windows = page.locator('[data-workbench-pan]');
    const tools = page.getByRole('complementary', { name: 'Tools — Test', exact: true });
    const toolsBefore = await tools.boundingBox();
    const before = await windows.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    await drag(page, { x: 110, y: 50 }, { focus: false });
    const after = await windows.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    before.forEach((r, i) => { assert.equal(after[i].x - r.x, 110); assert.equal(after[i].y - r.y, 50); });
    assert.deepEqual(await tools.boundingBox(), toolsBefore, 'tools stay at their screen position while panning');
    await page.locator('main').dispatchEvent('wheel', { ctrlKey: true, deltaY: 110, clientX: 850, clientY: 530, bubbles: true, cancelable: true }); await settle(page);
    assert.deepEqual(await tools.boundingBox(), toolsBefore, 'cursor zoom never moves or scales tools');
    await page.screenshot({ path: '.browser-test-runtime/fixed-tools-zoom.png' });
    await page.locator('main').focus(); await page.keyboard.press('Control+0'); await settle(page);
    await page.locator('main').focus();
    const start = await emptyPoint(page);
    await page.mouse.move(start.x, start.y); await page.keyboard.down('Space'); await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 10); await settle(page);
    await page.evaluate(() => window.panDisable(true)); await settle(page);
    const stopped = await windows.first().boundingBox();
    await page.mouse.move(start.x + 100, start.y + 100); await settle(page);
    assert.deepEqual(await windows.first().boundingBox(), stopped);
    await page.mouse.up(); await page.keyboard.up('Space');
    await page.evaluate(() => { window.panDisable(false); window.panReplace(); }); await settle(page);
    assert.equal(await page.locator('[data-workbench-panned], [data-workbench-pan-ready], [data-workbench-panning]').count(), 0);
    assert.deepEqual(await windows.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON())), before);
    await page.close();
  } finally { await browser.close(); }
});
