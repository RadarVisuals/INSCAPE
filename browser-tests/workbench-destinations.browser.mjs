import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { prepareCameraTestView } from './fixtures/workbench-camera-test.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const focus = page => page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true });
const back = page => page.getByRole('button', { name: 'Back to previous Workbench view', exact: true });
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);
function sameCamera(actual, expected) {
  near(actual.scale, expected.scale, 'camera scale');
  near(actual.offset.x, expected.offset.x, 'camera x');
  near(actual.offset.y, expected.offset.y, 'camera y');
}
const camera = page => page.locator('main.system-workflow').first().evaluate(host => ({
  scale: Number(host.querySelector('[data-workbench-scale]').dataset.workbenchScale),
  offset: { x: parseFloat(host.style.getPropertyValue('--workbench-pan-x')) || 0,
    y: parseFloat(host.style.getPropertyValue('--workbench-pan-y')) || 0 },
}));
async function select(page, id) {
  await page.locator(`[data-workbench-view-id="${id}"]`).evaluate(node => {
    const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
    target.focus({ preventScroll: true });
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  });
}
async function arrived(page) {
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await settle(page);
}

test('owner and Visitor focus live modules, inspect them and return without changing the saved arrangement', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await launch();
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const reduced = width === 390;
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 3, textModes: true, displayWidth: 600 });
      // The production owner route loads this shared theme above the runtime.
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await prepareCameraTestView(page, visitor);
      await page.evaluate(() => document.fonts.ready);
      await select(page, 'image:motion-0'); await settle(page);
      await page.waitForTimeout(180);
      const before = await camera(page);
      const saved = await page.evaluate(() => {
        window.destinationNodes = [...document.querySelectorAll('[data-workbench-view-id]')];
        return { draft: localStorage.getItem(window.__motionKey), layouts: Object.fromEntries(Object.keys(localStorage)
          .filter(key => key.startsWith('inscape:workbench:layout:')).map(key => [key, JSON.parse(localStorage.getItem(key)).layout])) };
      });
      if (!reduced) await focus(page).evaluate(button => button.addEventListener('click', () => {
        const gaps = []; let last = performance.now(), frame;
        const tick = time => { gaps.push(time - last); last = time; frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
        window.finishCameraSample = () => { cancelAnimationFrame(frame); return gaps; };
      }, { once: true }));
      await focus(page).click();
      if (reduced) assert.equal(await page.locator('[data-workbench-travelling]').count(), 0);
      await arrived(page);
      assert.equal(await focus(page).isDisabled(), true, 'arrival releases selection for content interaction');
      assert.equal(await back(page).isEnabled(), true);
      const first = await camera(page);
      assert.notDeepEqual(first, before);
      assert.equal(await page.evaluate(() => window.destinationNodes.every(node => node.isConnected)), true, 'live modules remain mounted');
      if (!reduced) {
        const gaps = (await page.evaluate(() => window.finishCameraSample())).sort((a, b) => a - b);
        console.log(`${visitor ? 'Visitor' : 'Owner'} camera motion: ${gaps.length} frames, median ${gaps[Math.floor(gaps.length / 2)].toFixed(1)} ms, p95 ${gaps[Math.floor(gaps.length * .95)].toFixed(1)} ms`);
        assert.ok(gaps.length > 2, 'travel has intermediate frames');
      }
      await page.screenshot({ path: `.browser-test-runtime/destination-${visitor}-${width}.png` });
      const source = page.locator('.image-module__canvas').first();
      await source.focus(); await source.press('Enter');
      await page.getByRole('button', { name: 'Return to Image', exact: true }).waitFor();
      assert.equal(await back(page).isDisabled(), true, 'inspection owns the camera until return finishes');
      sameCamera(await camera(page), first);
      await page.keyboard.press('Escape');
      await page.locator('.image-lift').waitFor({ state: 'detached' });
      assert.equal(await back(page).isEnabled(), true);
      sameCamera(await camera(page), first);

      await select(page, 'text:fit'); await settle(page);
      const secondOrigin = await camera(page);
      await focus(page).click(); await arrived(page);
      assert.notDeepEqual(await camera(page), secondOrigin);
      await back(page).click(); await arrived(page);
      sameCamera(await camera(page), secondOrigin);
      await back(page).click(); await arrived(page);
      sameCamera(await camera(page), before);
      assert.equal(await back(page).isDisabled(), true);
      assert.equal(await page.locator('[data-workbench-view-id="image:motion-0"]').evaluate(node => node === document.activeElement || node.contains(document.activeElement)), true);
      const restored = await page.evaluate(() => ({ draft: localStorage.getItem(window.__motionKey), layouts: Object.fromEntries(Object.keys(localStorage)
        .filter(key => key.startsWith('inscape:workbench:layout:')).map(key => [key, JSON.parse(localStorage.getItem(key)).layout])) }));
      assert.equal(JSON.stringify(restored), JSON.stringify(saved), 'draft and authored layout remain unchanged');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

async function mountLifetime(page) {
  await page.route(`${origin}/__destination_lifetime__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__destination_lifetime__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
    const { useWorkbenchCamera, useWorkbenchInspectionLock } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
    const { WorkbenchWindow } = await import('/src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx');
    await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    function Lock() { useWorkbenchInspectionLock(); return null; }
    function Bench({ disabled, removed, locked }) {
      const host = React.useRef(null), view = useWorkbenchView(), camera = useWorkbenchCamera();
      window.destinationCamera = camera.getCamera;
      window.destinationChoose = ids => view.setSelection(ids);
      return React.createElement('main', { ref: host, className: 'system-workflow', tabIndex: -1 },
        React.createElement(WorkbenchViewControls, { hostRef: host, disabled }), locked && React.createElement(Lock),
        !removed && React.createElement(WorkbenchWindow, { label: 'Text', title: 'A', viewId: 'a', width: 280, initialHeight: 220, initialX: 80, initialY: 100 },
          React.createElement('textarea', { 'aria-label': 'Draft text', defaultValue: 'Keep this draft.' }),
          React.createElement('button', { onKeyDown: event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.destinationDismissed = true; }
          } }, 'Local module action')),
        React.createElement(WorkbenchWindow, { label: 'Text', title: 'B', viewId: 'b', width: 340, initialHeight: 250, initialX: 850, initialY: 480 }, 'Second destination'));
    }
    function App() {
      const [disabled, suspend] = React.useState(false), [removed, remove] = React.useState(false), [locked, lock] = React.useState(false), [profile, replace] = React.useState(0);
      window.destinationSuspend = suspend; window.destinationRemove = remove; window.destinationLock = lock;
      window.destinationReplace = () => { remove(false); replace(value => value + 1); };
      return React.createElement(WorkbenchViewProvider, { key: profile }, React.createElement(Bench, { disabled, removed, locked }));
    }
    createRoot(document.getElementById('root')).render(React.createElement(App));
  });
  await page.getByRole('textbox', { name: 'Draft text', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready); await settle(page);
  await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
}
const read = page => page.evaluate(() => window.destinationCamera());
const choose = (page, id) => page.evaluate(id => window.destinationChoose([id]), id);
const advance = (page, time = 700) => page.clock.runFor(time);
async function begin(page, id = 'a') { await choose(page, id); await focus(page).dispatchEvent('click'); }

test('camera journeys retarget, retain interrupted Back, and stop for input, lock, resize and disposal', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountLifetime(page);
    const original = await read(page);
    await begin(page); await advance(page, 200);
    const midway = await read(page);
    assert.notDeepEqual(midway, original);
    assert.equal(await page.locator('[data-workbench-travelling]').count(), 1);
    await begin(page, 'b'); await advance(page);
    await back(page).dispatchEvent('click'); await advance(page);
    sameCamera(await read(page), midway);
    await back(page).dispatchEvent('click'); await advance(page, 100);
    await page.locator('main').dispatchEvent('wheel', { deltaX: 17, deltaY: 31, bubbles: true, cancelable: true });
    const interrupted = await read(page); await advance(page);
    sameCamera(await read(page), interrupted);
    assert.equal(await back(page).isEnabled(), true, 'an interrupted return is still available');
    await back(page).dispatchEvent('click'); await advance(page);
    sameCamera(await read(page), original);

    await begin(page); await advance(page);
    const inspecting = await read(page);
    await page.getByRole('button', { name: 'Local module action', exact: true }).focus();
    await page.keyboard.press('Escape'); await advance(page);
    assert.equal(await page.evaluate(() => window.destinationDismissed), true, 'module Escape runs before navigation');
    sameCamera(await read(page), inspecting);
    assert.equal(await back(page).isEnabled(), true);
    await page.locator('main').focus(); await page.keyboard.press('Escape'); await advance(page);
    sameCamera(await read(page), original);

    await page.evaluate(() => window.destinationChoose(['a', 'b']));
    await focus(page).dispatchEvent('click'); await advance(page);
    const framed = await page.locator('[data-workbench-view-id]').evaluateAll(nodes => nodes.map(node => {
      const { left, top, right, bottom } = node.getBoundingClientRect(); return { left, top, right, bottom };
    }));
    const rail = await page.locator('.workbench-view-controls').boundingBox();
    for (const rect of framed) assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= 1200 && rect.bottom <= rail.y,
      `every selected module fits above the navigation: ${JSON.stringify(rect)}`);
    await back(page).dispatchEvent('click'); await advance(page);
    sameCamera(await read(page), original);

    await begin(page); await advance(page, 160);
    const panOrigin = await read(page);
    await page.keyboard.down('Space');
    await page.mouse.move(600, 300); await page.mouse.down();
    await page.mouse.move(631, 323); await page.mouse.up(); await page.keyboard.up('Space');
    await advance(page);
    sameCamera(await read(page), { scale: panOrigin.scale, offset: { x: panOrigin.offset.x + 31, y: panOrigin.offset.y + 23 } });
    await back(page).dispatchEvent('click'); await advance(page);
    sameCamera(await read(page), original);

    for (const reason of ['pointer', 'keyboard', 'lock', 'blur', 'resize']) {
      await begin(page); await advance(page, 180);
      if (reason === 'pointer') await page.getByRole('textbox', { name: 'Draft text', exact: true }).click({ force: true });
      else if (reason === 'keyboard') {
        await page.getByRole('textbox', { name: 'Draft text', exact: true }).focus();
        await page.keyboard.press('End');
      } else if (reason === 'lock') await page.evaluate(() => window.destinationLock(true));
      else if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      else await page.setViewportSize({ width: 1000, height: 760 });
      await advance(page, 32);
      const stopped = await read(page); await advance(page);
      sameCamera(await read(page), stopped);
      assert.equal(await page.locator('[data-workbench-travelling]').count(), 0);
      if (reason === 'lock') {
        assert.equal(await back(page).isDisabled(), true);
        await page.evaluate(() => window.destinationLock(false));
      }
      await back(page).dispatchEvent('click'); await advance(page);
    }

    await begin(page); await advance(page, 160);
    await page.evaluate(() => window.destinationRemove(true)); await advance(page, 32);
    const removed = await read(page); await advance(page);
    sameCamera(await read(page), removed);
    await back(page).dispatchEvent('click'); await advance(page);
    assert.equal(await page.locator('.workbench-selection').count(), 0, 'removed modules are not restored as selected');
    assert.equal(await page.locator('main').evaluate(node => node === document.activeElement), true);

    await begin(page, 'b'); await advance(page, 120);
    await page.evaluate(() => window.destinationSuspend(true)); await advance(page);
    const suspended = await read(page);
    await page.evaluate(() => window.destinationSuspend(false)); await advance(page);
    sameCamera(await read(page), suspended);
    assert.equal(await back(page).isDisabled(), true);
    await begin(page, 'b'); await advance(page, 100);
    await page.evaluate(() => window.destinationReplace()); await advance(page);
    sameCamera(await read(page), original);
    assert.equal(await back(page).isDisabled(), true, 'a replacement Workbench has no old history or pending animation');
    await begin(page); await advance(page, 120);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await advance(page, 32);
    assert.equal(await page.locator('[data-workbench-travelling]').count(), 0, 'changing motion preference completes immediately');
    assert.equal(await focus(page).isDisabled(), true);
    await page.locator('main').focus(); await page.keyboard.press('Escape'); await advance(page, 32);
    sameCamera(await read(page), original);
    assert.equal(await back(page).isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
