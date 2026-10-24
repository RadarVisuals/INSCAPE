import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const draft = page => page.evaluate(() => window.readToolChromeDraft());
const selection = page => page.getByRole('toolbar', { name: 'Selection tools', exact: true });
const inspection = page => page.getByRole('toolbar', { name: 'Inspection and placement', exact: true });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
async function mount(browser, viewport = { width: 1440, height: 1000 }, theme = 'carbon', hasTouch = false) {
  const page = await browser.newPage({ viewport, hasTouch, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=actions&theme=${theme}`);
  await page.locator('.image-module__canvas').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
async function activate(page, kind) {
  if (kind === 'image') await page.locator('.image-module__canvas').first().focus();
  else if (kind === 'shape') await page.locator('.shape-window header').first().focus();
  else { await page.locator('.system-workflow__placement').first().focus(); await page.keyboard.press('Enter'); }
  await settle(page);
}
async function undo(page) {
  await page.locator('main.system-workflow').focus();
  await page.keyboard.press('Control+z'); await settle(page);
}

test('Display, Image and Shape actions follow the active module and retain undo', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, errors } = await mount(browser);
    await activate(page, 'display');
    await page.locator('.system-workflow__identity-strip').first().focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'TOOLS', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const lock = button(page, 'Lock ABYSSAL STUDY');
    const lockReachable = () => lock.evaluate(node => {
      const r = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    for (let moves = 0; !await lockReachable() && moves < 30; moves++)
      await page.getByLabel('Move Layers window', { exact: true }).press('Shift+ArrowRight');
    assert.equal(await lockReachable(), true, 'moving the Layers window exposes the real placement lock');
    await button(page, 'Lock ABYSSAL STUDY').click();
    assert.equal(await button(selection(page), 'Rotate').isDisabled(), true);
    await button(page, 'Unlock ABYSSAL STUDY').click();
    assert.equal(await button(selection(page), 'Rotate').isEnabled(), true);
    await button(page, 'Close Layers').click();
    assert.equal(await page.locator('[data-context-tools] .system-workflow__selection-actions').count(), 0);
    assert.equal(await page.getByRole('navigation', { name: 'Selection actions', exact: true }).count(), 1);
    await button(inspection(page), 'In place').click();
    assert.equal((await draft(page)).grids[0].placements[0].inspectionMode, 'IN_PLACE');
    await button(selection(page), 'Rotate').click();
    assert.equal((await draft(page)).grids[0].placements[0].transform.quarterTurns, 1);
    await undo(page);
    assert.equal((await draft(page)).grids[0].placements[0].transform.quarterTurns, 0);
    await activate(page, 'display');
    const beforeCover = (await draft(page)).grids[0].placements[0];
    await button(inspection(page), 'Cover Display').click();
    assert.notEqual((await draft(page)).grids[0].placements[0].columnSpan, beforeCover.columnSpan);
    await undo(page);
    const display = (await draft(page)).grids;
    await activate(page, 'image');
    assert.equal(await button(inspection(page), 'In place').count(), 0);
    await button(inspection(page), 'Fit inside').click();
    assert.equal((await draft(page)).imageModules[0].sides[0].crop, null);
    await button(selection(page), 'Rotate').click();
    assert.equal((await draft(page)).imageModules[0].sides[0].transform.quarterTurns, 1);
    assert.deepEqual((await draft(page)).grids, display, 'Image edits never touch Display');
    await undo(page);
    assert.equal((await draft(page)).imageModules[0].sides[0].transform.quarterTurns, 0);
    await activate(page, 'shape');
    assert.equal(await inspection(page).count(), 0, 'Shape has no unrelated fit or inspection controls');
    assert.equal(await button(selection(page), 'Rotate').count(), 0);
    await button(selection(page), 'Duplicate shape').click();
    assert.equal((await draft(page)).shapes.length, 2);
    await button(selection(page), 'Delete shape').click();
    assert.equal((await draft(page)).shapes.length, 1);
    await undo(page);
    assert.equal((await draft(page)).shapes.length, 2);
    assert.deepEqual((await draft(page)).grids, display);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('crop moves into the inspection row, cancels without saving and commits one undoable edit', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, errors } = await mount(browser);
    for (const kind of ['image', 'display']) {
      await activate(page, kind);
      const before = await draft(page);
      await button(selection(page), 'Crop').click();
      const zoom = inspection(page).getByRole('slider', { name: 'Crop zoom' });
      await zoom.waitFor();
      assert.equal(await selection(page).count(), 0);
      assert.equal(await page.locator('[data-context-tools]').isVisible(), false);
      await zoom.fill('2'); await zoom.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await zoom.evaluate(node => node === document.activeElement), true, 'toolbar arrows do not steal slider input');
      assert.deepEqual(await draft(page), before, 'crop preview never saves');
      await button(inspection(page), 'Cancel').click();
      assert.deepEqual(await draft(page), before);
      assert.equal(await selection(page).locator('button:focus').count(), 1, 'focus returns to an available action');
      await button(selection(page), 'Crop').click(); await zoom.fill('2');
      await button(inspection(page), 'Done').click();
      assert.notDeepEqual(await draft(page), before);
      await undo(page);
      assert.deepEqual(await draft(page), before, 'one undo restores the crop');
    }
    await activate(page, 'image');
    const beforeSwitch = await draft(page);
    await button(selection(page), 'Crop').click(); await inspection(page).getByRole('slider').fill('3');
    await activate(page, 'shape'); await activate(page, 'image');
    assert.equal(await inspection(page).getByRole('slider').count(), 0, 'changing modules cancels the old crop');
    assert.deepEqual(await draft(page), beforeSwitch);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [width, height, touch, theme] of [[1440, 1000, false, 'carbon'], [1440, 1000, false, 'mist'], [390, 844, true, 'carbon'], [320, 568, true, 'mist'], [844, 390, true, 'carbon']]) {
  test(`context rows and keyboard access fit ${width}×${height} ${theme}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const { page, errors } = await mount(browser, { width, height }, theme, touch);
      await activate(page, 'display');
      const saved = await draft(page);
      const stack = page.locator('[data-workbench-toolbar]');
      const box = await stack.boundingBox(), camera = await page.locator('.workbench-view-controls').boundingBox();
      for (const [name, bounds] of [['toolbar stack', box], ['camera', camera]]) {
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, `${name}: ${JSON.stringify(bounds)}`);
      }
      const inspectBox = await inspection(page).boundingBox(), selectBox = await selection(page).boundingBox();
      assert.ok(inspectBox.y + inspectBox.height < selectBox.y && selectBox.y + selectBox.height < (await page.getByRole('toolbar', { name: 'Creation tools' }).boundingBox()).y);
      const styles = await button(selection(page), 'Rotate').evaluate(node => {
        const s = getComputedStyle(node), icon = node.querySelector('svg');
        return { radius: s.borderRadius, shadow: s.boxShadow, height: node.getBoundingClientRect().height, icon: icon.getBoundingClientRect().width, stroke: getComputedStyle(icon.firstElementChild).strokeWidth, vector: getComputedStyle(icon.firstElementChild).vectorEffect };
      });
      assert.deepEqual(styles, { radius: '5px', shadow: 'none', height: touch ? 44 : 36, icon: 18, stroke: '1.5px', vector: 'non-scaling-stroke' });
      await button(selection(page), 'Inspect artwork').focus(); await page.keyboard.press('End');
      const crop = button(selection(page), 'Crop');
      assert.equal(await crop.evaluate(node => node === document.activeElement), true);
      assert.equal(await crop.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'overflow scroll exposes the final action');
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      assert.equal(await button(selection(page), 'Rotate').evaluate(node => node === document.activeElement), true);
      assert.deepEqual(await draft(page), saved, 'layout and keyboard navigation never author content');
      await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/context-${theme}-${width}.png` });
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}


for (const width of [1440, 390]) test(`Inspect button and I honour the selected Display mode (${width}px)`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, errors } = await mount(browser, { width, height: 1000 }, 'carbon', width === 390);
    await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=layers&theme=carbon`);
    await activate(page, 'display');
    await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
    const source = page.locator('.system-workflow__placement').first();
    const camera = () => page.locator('main.system-workflow').evaluate(node => ({
      scale: node.dataset.workbenchCameraScale, x: node.dataset.workbenchCameraX, y: node.dataset.workbenchCameraY,
    }));
    for (const mode of ['In place', 'Lift']) {
      await button(inspection(page), mode).click();
      assert.equal(await button(inspection(page), mode).getAttribute('aria-pressed'), 'true');
      assert.equal(await button(page, 'Close artwork viewer').count(), 0, 'choosing a mode only changes the setting');
      const saved = await draft(page), geometry = await source.boundingBox(), view = await camera();
      for (const trigger of ['button', 'keyboard']) {
        if (trigger === 'button') await button(selection(page), 'Inspect artwork').click();
        else { await source.focus(); await page.keyboard.press('i'); }
        await button(page, 'Close artwork viewer').waitFor();
        await page.waitForFunction(() => document.querySelector('[data-inspection-phase="active"]'));
        assert.equal(await source.getAttribute('data-inspection-context'), 'selected');
        if (mode === 'In place') {
          assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 0, 'In place never mounts the lifted copy');
          assert.equal(await source.getAttribute('data-lift-source'), null, 'the original artwork stays visible');
          assert.deepEqual(await source.boundingBox(), geometry, 'In place retains the exact artwork rectangle');
          assert.ok(await page.locator('[data-inspection-context="foreground"]').count() > 0, 'foreground layers fade away');
          await page.waitForFunction(() => [...document.querySelectorAll('[data-inspection-context="foreground"]')].every(node => getComputedStyle(node).opacity === '0'));
          assert.equal(await source.evaluate(node => getComputedStyle(node).opacity), '1', 'the inspected artwork itself stays visible');
        } else {
          await page.waitForFunction(() => document.querySelector('[data-inspection-context="selected"][data-lift-source]'));
          const media = page.locator('.system-workflow__lift-artwork .lattice-production-focus-artwork__media');
          await media.waitFor();
          await page.waitForFunction(() => Number(document.querySelector('.system-workflow__artwork-plane')?.style.getPropertyValue('--inspection-lift-progress')) === 1);
          const lifted = await media.boundingBox();
          assert.ok(lifted.width > geometry.width || lifted.height > geometry.height, 'Lift visibly enlarges the artwork');
        }
        assert.deepEqual(await camera(), view, 'inspection does not move the camera');
        assert.deepEqual(await draft(page), saved, 'opening inspection never writes authored content');
        await mkdir(output, { recursive: true });
        if (trigger === 'button') await page.screenshot({ path: `${output}/inspect-${mode.replaceAll(' ', '-')}-${width}.png` });
        await page.keyboard.press('Escape');
        await button(page, 'Close artwork viewer').waitFor({ state: 'detached' });
        await settle(page);
        assert.equal(await source.evaluate(node => node === document.activeElement), true, 'Escape restores source focus');
        assert.equal(await page.locator('[data-inspection-context], [data-lift-source], .system-workflow__lift-artwork').count(), 0, 'return clears temporary inspection presentation');
        assert.deepEqual(await source.boundingBox(), geometry, 'return restores the exact artwork rectangle');
        assert.deepEqual(await camera(), view);
        assert.deepEqual(await draft(page), saved);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const interruption of ['none', 'new focus', 'new scope']) {
  test(`inspection return waits for the closing commit (${interruption})`, { timeout: 30000 }, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route(`${origin}/__inspection_return__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__inspection_return__`);
      await page.evaluate(async () => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default;
        const { createRoot } = (await import('/@id/react-dom/client')).default;
        const useInspection = (await import('/src/public/ownerSystemWorkflow/useDisplayInspection.js')).default;
        const Viewer = (await import('/src/public/ownerSystemWorkflow/DisplayFocusViewer.jsx')).default;
        const api = window.inspectionReturn = { scope: 'profile-a:grid-a', hold: false, closingRendered: false };
        api.promise = new Promise(resolve => { api.release = () => { api.hold = false; resolve(); }; });
        function Harness() {
          const source = React.useRef(null);
          const [scene, setScene] = React.useState(null), [controls, setControls] = React.useState(null);
          const viewer = useInspection({ scope: api.scope, items: [{ id: 'artwork', navigationOrder: 0 }],
            getElement: () => source.current, getEntry: () => ({ placement: { inspectionMode: 'IN_PLACE' } }) });
          // React can retain the old DOM while committing a closing update.
          // Hold that commit explicitly so the test does not rely on CPU timing.
          if (!viewer.placementId && api.hold) { api.closingRendered = true; throw api.promise; }
          const close = (...args) => { api.hold = true; React.startTransition(() => viewer.close(...args)); };
          return React.createElement('main', null,
            React.createElement('button', { id: 'other-target' }, 'Other control'),
            React.createElement('div', { 'data-inspecting': viewer.placementId ? '' : undefined },
              React.createElement('div', { ref: setScene }, React.createElement('button', {
                ref: source, className: 'system-workflow__placement', style: { width: 120, height: 80 },
                onClick: () => viewer.open('artwork', source.current, { inspectionMode: 'IN_PLACE' }),
              }, 'Source artwork')),
              React.createElement('div', { ref: setControls }),
              viewer.placementId && React.createElement(Viewer, { scene, controlsContainer: controls, viewer: { ...viewer, close } })));
        }
        createRoot(document.getElementById('root')).render(React.createElement(React.Suspense, { fallback: 'Waiting' }, React.createElement(Harness)));
      });
      const source = page.getByRole('button', { name: 'Source artwork', exact: true });
      await source.click();
      const close = button(page, 'Close artwork viewer');
      await close.waitFor(); await close.focus(); await page.keyboard.press('Escape');
      await page.waitForFunction(() => inspectionReturn.closingRendered);
      await settle(page);
      assert.equal(await close.count(), 1, 'closing DOM remains mounted while React work is held');
      assert.equal(await source.evaluate(node => node === document.activeElement), false, 'do not focus the still-inspected source');
      if (interruption === 'new focus') await button(page, 'Other control').focus();
      await page.evaluate(interruption => {
        if (interruption === 'new scope') inspectionReturn.scope = 'profile-b:grid-b';
        inspectionReturn.release();
      }, interruption);
      await close.waitFor({ state: 'detached' }); await settle(page);
      assert.equal(await source.evaluate(node => node === document.activeElement), interruption === 'none', 'return belongs to the committed inspection scope');
      if (interruption === 'new focus') assert.equal(await button(page, 'Other control').evaluate(node => node === document.activeElement), true, 'preserve a newer focus choice');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
