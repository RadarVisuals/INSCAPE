import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime';
const launch = () => chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b, label, tolerance = 1) => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} vs ${b}`);
const panel = page => page.getByRole('complementary', { name: 'Index — Destinations', exact: true });
const go = page => page.getByRole('button', { name: 'Go to bottom 01', exact: true });
const back = page => page.getByRole('button', { name: 'Back to previous Workbench view', exact: true });
const read = page => page.evaluate(() => {
  const fixture = window.__indexFixture, node = document.querySelector('[aria-label="Index — Destinations"]');
  const rect = node?.getBoundingClientRect();
  return { camera: fixture.camera.getCamera(), rect: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    frame: fixture.store.getSnapshot().workbenchIndex.window, draft: fixture.store.getDraft(), generation: fixture.store.getGeneration(),
    registered: fixture.view.entries.has('workbench:index'), travelling: Boolean(document.querySelector('[data-workbench-travelling]')) };
});

async function mount(page, { visitor = false, pinned = false, entryTarget = null, clocked = false } = {}) {
  if (clocked) await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/flushSync was called|Maximum update depth|unmounted component/.test(message.text())) errors.push(message.text()); });
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route(`${origin}/__index_fixture__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__index_fixture__`);
  await page.evaluate(async ({ visitor, pinned, entryTarget }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, client = await import('/@id/react-dom/client');
    const createRoot = client.createRoot || client.default.createRoot;
    const { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
    const { useWorkbenchCamera, useWorkbenchInspectionLock } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
    const { WorkbenchWindow } = await import('/src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx');
    const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { openWorkbenchIndex, editWorkbenchIndex } = await import('/src/systemWorkflow/workbenchIndexSession.js');
    await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    await import('/src/lattice/rendering/latticeMenuSurface.css');
    const profile = `0x${'3'.repeat(40)}`, values = new Map();
    const fixture = window.__indexFixture = { failSave: false };
    const store = fixture.store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { if (fixture.failSave) throw Error('Storage full'); values.set(key, value); },
    } });
    openWorkbenchIndex(store, profile);
    const index = store.getSnapshot().workbenchIndex;
    editWorkbenchIndex(store, profile, index, { ...index, pinned, destinations: [
      { id: 'workbench-view:one', name: 'bottom 01', visibility: 'PUBLIC', view: { left: 100, top: 50, width: 600, height: 350 } },
      { id: 'workbench-view:two', name: 'bottom 02', visibility: 'PUBLIC', view: { left: 10, top: 0, width: 2400, height: 1600 } },
    ] });
    function Lock() { useWorkbenchInspectionLock(); return null; }
    function Bench() {
      const host = React.useRef(null), [late, setLate] = React.useState(0), [locked, setLocked] = React.useState(false), [removed, setRemoved] = React.useState(false);
      fixture.addModule = () => setLate(value => value + 1); fixture.lock = setLocked;
      fixture.removeTarget = () => setRemoved(true);
      fixture.camera = useWorkbenchCamera(); fixture.view = useWorkbenchView();
      return React.createElement('main', { ref: host, className: 'system-workflow', tabIndex: -1,
        'data-menu-surface': 'carbon', 'data-lattice-menu-surface': true, style: { position: 'fixed', inset: 0 } },
        React.createElement(WorkbenchViewControls, { hostRef: host, entryTarget }), locked && React.createElement(Lock),
        !removed && React.createElement(WorkbenchWindow, { label: 'Artwork', title: 'Existing', viewId: 'a', width: 280, initialHeight: 220,
          initialX: 650, initialY: 150 }, React.createElement('textarea', { 'aria-label': 'Existing text', defaultValue: 'Keep this content' })),
        Array.from({ length: late }, (_, i) => React.createElement(WorkbenchWindow, { key: i, label: 'Late', title: String(i),
          viewId: `late:${i}`, width: 280, initialHeight: 220, initialX: 900, initialY: 150 + i * 240 }, 'Loaded module')));
    }
    function App() {
      const [content, setContent] = React.useState(store.getSnapshot()), [revision, setRevision] = React.useState(0);
      fixture.land = () => setContent(value => ({ ...value, workbenchIndex: { ...value.workbenchIndex, landingId: 'workbench-view:one' } }));
      fixture.replace = () => { setContent(store.getSnapshot()); setRevision(value => value + 1); };
      const owner = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
      return React.createElement(WorkbenchViewProvider, { key: revision, ...(visitor ? { groupContent: content } : { store, profileAddress: profile, presentation: owner.workbench }) }, React.createElement(Bench));
    }
    createRoot(document.getElementById('root')).render(React.createElement(App));
  }, { visitor, pinned, entryTarget });
  await go(page).waitFor(); await page.evaluate(() => document.fonts.ready); await settle(page);
  return errors;
}

async function clock(page) {
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
}
async function zoomAtIndex(page, scale) {
  await page.evaluate(scale => {
    const fixture = window.__indexFixture, frame = fixture.store.getSnapshot().workbenchIndex.window;
    fixture.camera.updateCamera({ scale, offset: { x: 40 - frame.left * scale, y: 55 - frame.top * scale } });
  }, scale);
  await settle(page);
}

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Index stays readable and follows the canvas at 25–200% (${visitor ? 'Visitor' : 'Owner'}, ${width}px)`, { timeout: 45000 }, async () => {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: width === 390 ? 2 : 1 });
      const errors = await mount(page, { visitor });
      const original = await read(page);
      for (const scale of [.25, .5, 1, 2]) {
        await zoomAtIndex(page, scale);
        const current = await read(page);
        near(current.rect.left, 40, 'anchor x'); near(current.rect.top, 55, 'anchor y');
        near(current.rect.width, 300, 'readable width'); near(current.rect.height, 440, 'screen height');
        assert.equal(current.registered, false, 'Index is not a composition member');
        assert.deepEqual(current.draft, original.draft, 'camera projection never saves geometry');
        const layout = await panel(page).evaluate(node => {
          const content = node.querySelector('.system-workflow__instrument-content'), button = node.querySelector('nav li button');
          const text = [...button.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
          const range = document.createRange(); range.selectNodeContents(text);
          const close = node.querySelector('[aria-label="Close Index"]');
          return { lines: range.getClientRects().length, overflow: content.scrollWidth - content.clientWidth,
            close: close.getBoundingClientRect().width, font: getComputedStyle(button).fontSize };
        });
        assert.equal(layout.lines, 1, 'destination labels do not collapse into vertical letters');
        assert.ok(layout.overflow <= 1, 'all fields remain inside the scroll surface');
        assert.ok(layout.close >= 26, 'close control retains its shared window size');
        await mkdir(output, { recursive: true });
        if (scale === .25 || scale === 2) await page.screenshot({ path: join(output, `index-${visitor}-${width}-${scale}.png`) });
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Index dragging, resizing, pinning and failed saves use one consistent frame at reduced zoom', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = await mount(page); await zoomAtIndex(page, .5);
    let before = await read(page);
    const title = page.getByLabel('Move Index window', { exact: true });
    const box = await title.boundingBox();
    await page.mouse.move(box.x + 55, box.y + 12); await page.mouse.down();
    await page.mouse.move(box.x + 95, box.y + 32); await page.mouse.up(); await settle(page);
    let after = await read(page);
    near(after.rect.left - before.rect.left, 40, 'drag screen x'); near(after.frame.left - before.frame.left, 80, 'drag world x');
    near(after.frame.top - before.frame.top, 40, 'drag world y');
    assert.equal(after.generation, before.generation + 1, 'move commits once');
    before = after;
    const resize = page.getByRole('separator', { name: 'Resize Index from right', exact: true });
    await resize.focus(); await resize.press('ArrowRight'); await settle(page);
    after = await read(page); near(after.rect.width - before.rect.width, 8, 'keyboard resize screen width');
    near(after.frame.width - before.frame.width, 8, 'persisted screen width');
    await page.evaluate(() => window.__indexFixture.store.undo()); await settle(page);
    near((await read(page)).rect.width, before.rect.width, 'undo width');
    await page.getByLabel('Pin Index to screen', { exact: true }).check(); await settle(page);
    const pinned = await read(page);
    await page.evaluate(() => window.__indexFixture.camera.updateCamera({ scale: .25, offset: { x: 100, y: 100 } })); await settle(page);
    assert.deepEqual((await read(page)).rect, pinned.rect, 'pinned Index remains fixed');
    await page.getByLabel('Pin Index to screen', { exact: true }).uncheck(); await settle(page);
    const unpinned = await read(page);
    near(unpinned.rect.width, pinned.rect.width, 'unpin preserves width');
    before = unpinned;
    await page.evaluate(() => { window.__indexFixture.failSave = true; });
    await page.getByRole('separator', { name: 'Resize Index from right', exact: true }).press('ArrowRight'); await settle(page);
    after = await read(page);
    assert.deepEqual(after.frame, before.frame); assert.deepEqual(after.rect, before.rect);
    assert.ok(await panel(page).getByRole('alert').isVisible());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Index pointer resize preserves its opposite edge; cancellation and remount retain saved geometry', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = await mount(page);
    for (const scale of [.25, 2]) {
      await zoomAtIndex(page, scale);
      const before = await read(page);
      const handle = page.getByRole('separator', { name: 'Resize Index from left', exact: true });
      const box = await handle.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), { x, y }), 'Resize Index from left');
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 16, y);
      await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
      assert.deepEqual((await read(page)).frame, before.frame, 'cancel does not persist the resize');
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 16, y); await page.mouse.up(); await settle(page);
      const after = await read(page);
      near(after.rect.left + after.rect.width, before.rect.left + before.rect.width, 'opposite edge');
      near(after.frame.width, before.frame.width - 16, 'screen width after pointer resize');
      near(after.frame.left, before.frame.left + 16 / scale, 'canvas position after pointer resize');
      assert.equal(after.generation, before.generation + 1);
    }
    const saved = (await read(page)).frame;
    await page.evaluate(() => window.__indexFixture.replace()); await settle(page);
    assert.deepEqual((await read(page)).frame, saved);
    near((await read(page)).rect.width, saved.width, 'remounted width');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const visitor of [false, true]) {
  test(`Index travel retains its clock and arrives when modules register late (${visitor ? 'Visitor landing' : 'Owner'})`, { timeout: 45000 }, async () => {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'no-preference' });
      const errors = await mount(page, { visitor, clocked: true }); await clock(page);
      const original = await read(page);
      if (visitor) await page.evaluate(() => window.__indexFixture.land()); else await go(page).dispatchEvent('click');
      await page.clock.runFor(180);
      const midway = await read(page);
      assert.ok(midway.travelling); assert.ok(midway.camera.scale > 1 && midway.camera.scale < 2);
      near(midway.rect.width, 300, 'Index stays screen-sized during native camera effects');
      near(midway.rect.left, midway.frame.left * midway.camera.scale + midway.camera.offset.x, 'live anchor x');
      near(midway.rect.top, midway.frame.top * midway.camera.scale + midway.camera.offset.y, 'live anchor y');
      await page.evaluate(() => window.__indexFixture.addModule()); await page.clock.runFor(64);
      assert.ok((await read(page)).camera.scale > midway.camera.scale, 'late registration does not stop or rewind travel');
      await page.evaluate(() => window.__indexFixture.addModule()); await page.clock.runFor(300);
      const arrived = await read(page);
      assert.equal(arrived.travelling, false, 'original 460ms clock completes without restarting');
      near(arrived.camera.scale, 2, 'destination scale', 1e-7);
      assert.deepEqual(arrived.draft, original.draft, 'travel and module loading do not edit the Index');
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
      await back(page).dispatchEvent('click'); await page.clock.runFor(520);
      assert.deepEqual((await read(page)).camera, original.camera, 'one Back restores the original view');
      assert.equal(await back(page).isDisabled(), true, 'loading added no history entries');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('late loading never resumes a journey cancelled by the visitor', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = await mount(page, { visitor: true, clocked: true }); await clock(page);
    await page.evaluate(() => window.__indexFixture.land()); await page.clock.runFor(180);
    await page.locator('main').dispatchEvent('wheel', { deltaX: 15, deltaY: 20, bubbles: true, cancelable: true });
    await page.clock.runFor(32); const stopped = (await read(page)).camera;
    await page.evaluate(() => window.__indexFixture.addModule()); await page.clock.runFor(700);
    assert.deepEqual((await read(page)).camera, stopped); assert.equal((await read(page)).travelling, false);
    await go(page).dispatchEvent('click'); await page.clock.runFor(120);
    await page.evaluate(() => window.__indexFixture.lock(true)); await page.clock.runFor(32);
    const locked = (await read(page)).camera;
    await page.evaluate(() => { window.__indexFixture.addModule(); window.__indexFixture.lock(false); }); await page.clock.runFor(700);
    assert.deepEqual((await read(page)).camera, locked, 'unlocking does not retry the original landing');
    await go(page).dispatchEvent('click'); await page.clock.runFor(120);
    await page.evaluate(() => window.__indexFixture.replace()); await page.clock.runFor(700);
    assert.deepEqual((await read(page)).camera, { scale: 1, offset: { x: 0, y: 0 } });
    assert.equal(await back(page).isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('explicit artwork entry suppresses the saved landing and reduced motion arrives immediately', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
    const errors = await mount(page, { visitor: true, entryTarget: { moduleId: 'a' }, clocked: true }); await clock(page);
    await page.evaluate(() => window.__indexFixture.land()); await page.clock.runFor(100);
    assert.deepEqual((await read(page)).camera, { scale: 1, offset: { x: 0, y: 0 } });
    await go(page).dispatchEvent('click'); await page.clock.runFor(32);
    assert.equal((await read(page)).camera.scale, 2); assert.equal((await read(page)).travelling, false);
    assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('ordinary Focus still cancels when its destination is removed, and clears native effects', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = await mount(page, { clocked: true }); await clock(page);
    await page.evaluate(() => window.__indexFixture.view.setSelection(['a']));
    await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).dispatchEvent('click');
    await page.clock.runFor(180);
    assert.equal((await read(page)).travelling, true);
    await page.evaluate(() => window.__indexFixture.removeTarget()); await page.clock.runFor(32);
    const stopped = (await read(page)).camera;
    await page.evaluate(() => window.__indexFixture.addModule()); await page.clock.runFor(700);
    assert.deepEqual((await read(page)).camera, stopped);
    assert.equal((await read(page)).travelling, false);
    assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
    await back(page).dispatchEvent('click'); await page.clock.runFor(520);
    assert.deepEqual((await read(page)).camera, { scale: 1, offset: { x: 0, y: 0 } });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
