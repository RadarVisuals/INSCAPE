import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { prepareCameraTestView } from './fixtures/workbench-camera-test.mjs';

const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
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
  scale: Number(host.dataset.workbenchCameraScale ?? host.querySelector('[data-workbench-scale]').dataset.workbenchScale),
  offset: { x: parseFloat(host.dataset.workbenchCameraX ?? host.style.getPropertyValue('--workbench-pan-x')) || 0,
    y: parseFloat(host.dataset.workbenchCameraY ?? host.style.getPropertyValue('--workbench-pan-y')) || 0 },
}));
async function select(page, id) {
  const target = page.locator(`[data-workbench-view-id="${id}"][data-workbench-selectable], [data-workbench-view-id="${id}"] [data-workbench-selectable]`).first();
  // Focus activates owner artwork. Let that state commit before the user's
  // separate Shift+Enter turns it into an explicit Workbench selection.
  await target.focus();
  await settle(page);
  await target.press('Shift+Enter');
  await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
  assert.equal(await focus(page).isEnabled(), true, 'explicit keyboard selection enables camera focus');
}
async function arrived(page) {
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await settle(page);
}

test('owner and Visitor focus live modules, activate them idempotently and return without changing the saved arrangement', { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await launch();
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const reduced = width === 390;
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: visitor ? 2 : 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 3, textModes: true, displayWidth: 600 });
      // The production owner route loads this shared theme above the runtime.
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await prepareCameraTestView(page, visitor);
      if (!reduced) {
        for (let i = 0; i < 6; i++) await page.locator('main.system-workflow').first().dispatchEvent('wheel', {
          ctrlKey: true, deltaY: 120, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
        await settle(page);
      }
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
        window.__motionCommits = 0;
        const source = document.querySelector('[data-workbench-view-id="image:motion-0"]');
        let magnifiedBitmap = false, scaledHandles = false;
        const gaps = []; let last = performance.now(), frame;
        const tick = time => {
          gaps.push(time - last); last = time;
          if (document.querySelector('[data-workbench-travelling]')) {
            const paintedScale = source.getBoundingClientRect().width / source.offsetWidth;
            if (paintedScale > 1 / devicePixelRatio + .015) magnifiedBitmap = true;
            const handle = document.querySelector('.workbench-selection__handle');
            if (handle && Math.abs(handle.getBoundingClientRect().width - 28) > .015) scaledHandles = true;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        window.finishCameraSample = () => { cancelAnimationFrame(frame); return { gaps, magnifiedBitmap, scaledHandles, commits: window.__motionCommits }; };
      }, { once: true }));
      await focus(page).click();
      if (reduced) assert.equal(await page.locator('[data-workbench-travelling]').count(), 0);
      await arrived(page);
      assert.equal(await focus(page).isDisabled(), true, 'arrival releases selection for content interaction');
      assert.equal(await back(page).isEnabled(), true);
      const first = await camera(page);
      assert.equal(await page.locator('.navigator-zoom output').textContent(),
        `${Math.round(first.scale * 100)}%`, 'zoom readout matches the focused camera');
      assert.notDeepEqual(first, before);
      assert.equal(await page.evaluate(() => window.destinationNodes.every(node => node.isConnected)), true, 'live modules remain mounted');
      if (!reduced) {
        const sample = await page.evaluate(() => window.finishCameraSample());
        const gaps = sample.gaps.sort((a, b) => a - b);
        assert.equal(sample.magnifiedBitmap, false, 'camera never magnifies beyond the prepared image resolution');
        assert.equal(sample.scaledHandles, false, 'selection handles stay at native screen resolution');
        assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0, 'arrival releases temporary transforms');
        assert.ok(sample.commits < 20, 'camera motion must not render React on every frame');
        console.log(`${visitor ? 'Visitor' : 'Owner'} camera motion: ${gaps.length} frames, median ${gaps[Math.floor(gaps.length / 2)].toFixed(1)} ms, p95 ${gaps[Math.floor(gaps.length * .95)].toFixed(1)} ms`);
        assert.ok(gaps.length > 2, 'travel has intermediate frames');
      }
      await page.screenshot({ path: `${output}/destination-${visitor}-${width}.png` });
      const source = page.locator('.image-module__canvas').first();
      await source.focus(); await source.press('Enter');
      await arrived(page);
      assert.equal(await page.locator('.image-lift').count(), 0, 'artwork activation focuses without lifting');
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
      assert.equal(await page.locator('.navigator-zoom output').textContent(),
        `${Math.round(before.scale * 100)}%`, 'zoom readout matches the restored camera');
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
    const { createArticle } = await import('/src/text/domain/article.js');
    const textModules = ['text:a', 'text:b'].map(id => ({ id, visibility: 'PUBLIC', article: createArticle() }));
    await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    function Lock() { useWorkbenchInspectionLock(); return null; }
    function Bench({ disabled, removed, locked }) {
      const host = React.useRef(null), view = useWorkbenchView(), camera = useWorkbenchCamera();
      window.destinationCamera = camera.getCamera;
      window.destinationChoose = ids => view.setSelection(ids);
      window.destinationSelection = view.captureSelection;
      return React.createElement('main', { ref: host, className: 'system-workflow', tabIndex: -1 },
        React.createElement(WorkbenchViewControls, { hostRef: host, disabled }), locked && React.createElement(Lock),
        !removed && React.createElement(WorkbenchWindow, { label: 'Text', title: 'A', viewId: 'text:a', width: 280, initialHeight: 220, initialX: 80, initialY: 100 },
          React.createElement('textarea', { 'aria-label': 'Draft text', defaultValue: 'Keep this draft.' }),
          React.createElement('button', { onKeyDown: event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.destinationDismissed = true; }
          } }, 'Local module action')),
        React.createElement(WorkbenchWindow, { label: 'Text', title: 'B', viewId: 'text:b', width: 340, initialHeight: 250, initialX: 850, initialY: 480 }, 'Second destination'));
    }
    function App() {
      const [disabled, suspend] = React.useState(false), [removed, remove] = React.useState(false), [locked, lock] = React.useState(false), [profile, replace] = React.useState(0);
      window.destinationSuspend = suspend; window.destinationRemove = remove; window.destinationLock = lock;
      window.destinationReplace = () => { remove(false); replace(value => value + 1); };
      const groupContent = React.useMemo(() => ({ texts: textModules.filter(text => !removed || text.id !== 'text:a') }), [removed]);
      return React.createElement(WorkbenchViewProvider, { key: profile, groupContent }, React.createElement(Bench, { disabled, removed, locked }));
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
async function begin(page, id = 'text:a') {
  await choose(page, id);
  assert.deepEqual(await page.evaluate(() => window.destinationSelection().ids), [id], 'lifetime fixture accepts the requested content selection');
  assert.equal(await focus(page).isEnabled(), true, 'valid lifetime selection enables Focus before travel');
  await focus(page).dispatchEvent('click');
}

const arrivalCamera = page => page.locator('main.system-workflow').first().evaluate(host => ({
  scale: Number(host.dataset.workbenchCameraScale || 1),
  offset: { x: Number(host.dataset.workbenchCameraX || 0), y: Number(host.dataset.workbenchCameraY || 0) },
}));
async function mountArrivalReview(page, visitor) {
  await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 320, seamReview: 'single' });
  await page.evaluate(async visitor => {
    const draft = JSON.parse(localStorage.getItem(window.__motionKey)), original = draft.imageModules[0];
    draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
    draft.imageModules = ['a', 'b'].map(id => ({ ...original, id: `image:arrival-${id}`, name: `Arrival ${id.toUpperCase()}`, width: 200, height: 180 }));
    draft.workbench.imageModules = draft.imageModules.map((image, index) => ({ id: image.id, open: true, position: { left: 32, top: 64 + index * 250 } }));
    draft.artworkLayers = draft.imageModules.map(image => image.id);
    draft.workbenchGroups = [{ id: 'workbench-group:arrival-empty', name: 'Arrival empty', memberIds: [] }];
    localStorage.setItem(window.__motionKey, JSON.stringify(draft));
    if (visitor) {
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      Object.assign(window.__motionDocument, buildProfileDocumentV9({ systemWorkflowDraft: draft,
        profileAddress: `0x${'1'.repeat(40)}`, assetRecords: [] }));
    }
    window.__motionRemount();
  }, visitor);
  await page.locator('[data-image-module="image:arrival-a"] .image-module__artwork[data-media-state="ready"]').waitFor();
  await page.evaluate(() => document.fonts.ready); await arrived(page);
  const sidebar = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  if (await sidebar.count()) await sidebar.click();
  await arrived(page);
}

for (const width of [1440, 390]) test(`Visitor arrival keeps native I targets and host fallback (${width}px)`, { timeout: 90000 }, async () => {
  const browser = await launch(); let page;
  try {
    page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountArrivalReview(page, true);
    const a = page.locator('[data-image-module="image:arrival-a"] .image-module__canvas');
    const b = page.locator('[data-image-module="image:arrival-b"] .image-module__canvas');
    const host = page.locator('main.system-workflow').first(), initial = await arrivalCamera(page);
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    await a.focus(); await a.press('Enter'); await arrived(page);
    const focused = await arrivalCamera(page); assert.notDeepEqual(focused, initial);
    assert.equal(await focus(page).isDisabled(), true);
    assert.equal(await page.locator('.workbench-view-controls__selection-count').count(), 0);
    await b.focus(); await page.keyboard.press('i');
    await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
    await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
    assert.equal(await b.evaluate(node => node === document.activeElement), true, 'I inspects B and returns to B, not retained arrival A');
    sameCamera(await arrivalCamera(page), focused);
    await a.focus(); await a.press('Enter'); await arrived(page);
    await host.focus(); await page.keyboard.press('i');
    await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
    await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
    assert.equal(await a.evaluate(node => node === document.activeElement), true, 'host I retains the arrived A inspection fallback');
    sameCamera(await arrivalCamera(page), focused);
    await host.focus(); await page.keyboard.press('f'); await arrived(page);
    sameCamera(await arrivalCamera(page), initial);
    assert.equal(await back(page).isDisabled(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
    assert.deepEqual(errors, []);
  } finally {
    if (page) { await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/arrival-visitor-i-${width}.png` }); }
    await browser.close();
  }
});

for (const width of [1440, 390]) test(`arrival releases Groups while Layers, Shift and Back retain their meaning (${width}px)`, { timeout: 120000 }, async () => {
  const browser = await launch(); let page;
  try {
    page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountArrivalReview(page, false);
    const { openSharedTool, closeSharedTool } = await import('./fixtures/shared-tools.mjs');
    const groupsButton = page.getByRole('button', { name: 'Workbench groups', exact: true });
    const panel = page.locator('.workbench-groups');
    await groupsButton.press('Enter');
    await panel.locator('[data-workbench-group-drop="workbench-group:arrival-empty"]').press('Enter');
    await page.getByRole('button', { name: 'Close Workbench groups', exact: true }).press('Enter');
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Select Arrival A', exact: true }).press('Enter'); await settle(page);
    assert.equal(await focus(page).isEnabled(), true, 'single Layers choice enables the global Focus control');
    assert.match(await page.locator('.workbench-view-controls__selection-count').innerText(), /1 selected/);
    const initial = await arrivalCamera(page), saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    await focus(page).press('Enter'); await arrived(page);
    const first = await arrivalCamera(page); assert.notDeepEqual(first, initial);
    assert.equal(await focus(page).isDisabled(), true);
    assert.equal(await page.locator('.workbench-selection').count(), 0);
    assert.equal(await page.locator('.workbench-view-controls__selection-count').count(), 0);
    assert.equal(await page.locator('[data-image-module="image:arrival-a"] .image-module__window').getAttribute('data-active'), 'true');
    const transform = await openSharedTool(page, 'Transform');
    const widthInput = transform.getByRole('spinbutton', { name: 'Transform Width', exact: true });
    assert.equal(await widthInput.isEnabled(), true, 'arrived Image keeps working native module tools');
    assert.equal(Number(await widthInput.inputValue()), 200);
    await closeSharedTool(page, 'Transform');
    await groupsButton.press('Enter'); await settle(page);
    assert.equal(await panel.getByRole('button', { name: 'Add selection (0)', exact: true }).isDisabled(), true);
    sameCamera(await arrivalCamera(page), first);
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'opening Groups does not write content');
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Select Arrival B', exact: true }).press('Enter'); await settle(page);
    assert.equal(await focus(page).isEnabled(), true);
    assert.equal(await panel.getByRole('button', { name: 'Add selection (1)', exact: true }).isEnabled(), true, 'a conscious Layers choice restores membership actions');
    await focus(page).press('Enter'); await arrived(page);
    assert.notDeepEqual(await arrivalCamera(page), first);
    assert.equal(await panel.getByRole('button', { name: 'Add selection (0)', exact: true }).isDisabled(), true);
    const b = page.locator('[data-image-module="image:arrival-b"] .image-module__canvas');
    await b.focus(); await b.press('Shift+Enter'); await settle(page);
    assert.equal(await panel.getByRole('button', { name: 'Add selection (1)', exact: true }).isEnabled(), true, 'first Shift after arrival selects B instead of removing it');
    await panel.getByRole('button', { name: 'New group', exact: true }).press('Enter');
    assert.equal(await panel.getByRole('button', { name: 'Create from selection', exact: true }).isEnabled(), true);
    await focus(page).press('Enter'); await arrived(page);
    assert.equal(await panel.getByRole('button', { name: 'Create from selection', exact: true }).isDisabled(), true);
    assert.doesNotMatch(await panel.innerText(), /1 selected/);
    await page.getByRole('button', { name: 'Close Workbench groups', exact: true }).press('Enter');
    await back(page).press('Enter'); await arrived(page);
    sameCamera(await arrivalCamera(page), first);
    assert.match(await page.locator('.workbench-view-controls__selection-count').innerText(), /1 selected/, 'Back restores the prior conscious module selection');
    assert.equal(await b.evaluate(node => node === document.activeElement || node.closest('.image-module__window') === document.activeElement), true);
    await page.locator('main.system-workflow').first().focus(); await page.keyboard.press('f'); await arrived(page);
    sameCamera(await arrivalCamera(page), initial);
    assert.equal(await back(page).isDisabled(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
    assert.deepEqual(errors, []);
  } finally {
    if (page) { await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/arrival-groups-${width}.png` }); }
    await browser.close();
  }
});

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
    await begin(page, 'text:b'); await advance(page);
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

    await page.evaluate(() => window.destinationChoose(['text:a', 'text:b']));
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
      else {
        await page.setViewportSize({ width: 1000, height: 760 });
        // ResizeObserver uses the browser's rendering cycle, not the paused
        // journey clock. Require resize to cancel travel before advancing it.
        await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'), null, { polling: 10 });
      }
      await advance(page, 32);
      const stopped = await read(page); await advance(page);
      const afterStopped = await read(page);
      assert.deepEqual(afterStopped, stopped, `${reason} stops camera travel`);
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

    await begin(page, 'text:b'); await advance(page, 120);
    await page.evaluate(() => window.destinationSuspend(true)); await advance(page);
    const suspended = await read(page);
    await page.evaluate(() => window.destinationSuspend(false)); await advance(page);
    sameCamera(await read(page), suspended);
    assert.equal(await back(page).isDisabled(), true);
    await begin(page, 'text:b'); await advance(page, 100);
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

test('zoom percentage follows Focus, wheel, reset, Back and interrupted travel', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    for (const width of [1200, 390]) for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountLifetime(page);
      const mismatches = [];
      const check = async label => {
        const actual = await page.evaluate(() => ({
          scale: window.destinationCamera().scale,
          label: document.querySelector('.navigator-zoom output')?.textContent,
        }));
        const expected = `${Math.round(actual.scale * 100)}%`;
        if (actual.label !== expected) mismatches.push({ action: label, expected, ...actual });
      };
      const wheel = async deltaY => {
        await page.locator('main').dispatchEvent('wheel', {
          ctrlKey: true, deltaY, clientX: width / 2, clientY: 350, bubbles: true, cancelable: true,
        });
        await advance(page, 32);
      };
      const initial = await read(page);
      await check('initial');
      await begin(page); await advance(page, 160); await check('during focus');
      await advance(page); await check('after focus');
      const focused = await read(page);
      assert.notDeepEqual(focused, initial, 'Focus must actually move the camera');
      await wheel(120); await check('wheel after focus');
      assert.notEqual((await read(page)).scale, focused.scale, 'wheel still changes the camera');
      await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('100');
      await advance(page, 32); await check('percentage reset');
      near((await read(page)).scale, 1, 'reset restores native zoom');
      await back(page).dispatchEvent('click'); await advance(page, 160); await check('during Back');
      await advance(page); await check('after Back');
      await wheel(90); await check('wheel after Back');
      await begin(page); await advance(page, 160);
      await wheel(70); await check('wheel interrupts focus');
      await advance(page); await check('interrupted focus stays settled');
      await page.locator('main').focus(); await page.keyboard.press('Control+0');
      await advance(page, 32); await check('keyboard reset');
      near((await read(page)).scale, 1, 'reset restores native zoom');
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/zoom-readout-${width}-${reducedMotion}.png` });
      assert.deepEqual(mismatches, [], `${width}px / ${reducedMotion}: displayed zoom must track the camera`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
