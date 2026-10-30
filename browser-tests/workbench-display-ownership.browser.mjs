import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { withinDeadline } from './browser-test-lifecycle.mjs';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5189';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';

for (const primary of [true, false]) test(`Workbench theme and Display lifetimes with primary ${primary}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  let page;
  try {
    await mkdir(output, { recursive: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__display_ownership__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__display_ownership__`);
    await page.evaluate(async primary => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const EditingBoundary = (await import('/src/systemWorkflow/ProfileEditingBoundary.jsx')).default;
      const { captureProfileDraftWriteAccess, beforeProfileEditorRelease } = await import('/src/systemWorkflow/profileEditorLease.js');
      const { workbenchLayoutKey } = await import('/src/public/ownerSystemWorkflow/workbenchLayoutStorage.js');
      const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addDisplayModule } = await import('/src/systemWorkflow/displayModuleSession.js');
      const { createDefaultWorkbenchPresentation, createNewDisplayPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const profile = `0x${'1'.repeat(40)}`;
      const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: localStorage });
      const second = addDisplayModule(store), draft = store.getDraft();
      if (!primary) draft.grids = [];
      draft.workbench = createDefaultWorkbenchPresentation();
      draft.workbench.display.window = { left: 24, top: 80, width: 480, height: 270 };
      draft.workbench.displays = [{ id: second, ...createNewDisplayPresentation('LANDSCAPE', 1), window: { left: 600, top: 80, width: 480, height: 270 } }];
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Fixture failed');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      const props = { profileAddress: profile, reviewStorage: localStorage, reviewAssets: [], reviewCategories: [], reviewActivity: [], reviewProfile: { name: 'Ownership' } };
      window.ownership = { second, profile, read: () => JSON.parse(localStorage.getItem(systemWorkflowDraftKey(profile))),
        mount: () => { ownership.root = createRoot(document.getElementById('root')); ownership.root.render(React.createElement(EditingBoundary, { profileAddress: profile }, React.createElement(Runtime, props))); } };
      ownership.trace = [];
      const layoutKey = workbenchLayoutKey(profile);
      ownership.snapshot = label => {
        const saved = JSON.parse(localStorage.getItem(layoutKey));
        const state = { label, time: performance.now(), writable: ownership.canSave?.(), saved,
          displays: [...document.querySelectorAll('[data-display-instance]')].map(element => ({
            id: element.dataset.displayInstance,
            open: Boolean(element.querySelector('.system-workflow__presentation-board')),
            locked: element.querySelector('[aria-label="Unlock Display Module composition"]') ? true
              : element.querySelector('[aria-label="Lock Display Module composition"]') ? false : null,
          })) };
        ownership.trace.push(state);
        return state;
      };
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        const result = setItem.call(this, key, value);
        if (this === localStorage && key === layoutKey) ownership.snapshot('layout-write');
        return result;
      };
      ownership.observeRelease = () => {
        ownership.canSave = captureProfileDraftWriteAccess(profile, localStorage);
        beforeProfileEditorRelease(profile, () => ownership.snapshot('before-release'));
      };
      ownership.mount();
    }, primary);
    const secondId = await page.evaluate(() => ownership.second);
    const second = page.locator(`[data-display-instance="${secondId}"]`);
    await second.locator('header.system-workflow__identity-strip').focus();
    const before = await page.evaluate(() => ownership.read());
    const theme = before.appearance.menuSurfaceId === 'paper' ? 'carbon' : 'paper';
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /^Menu theme:/ }).click();
    await page.getByRole('option', { name: theme[0].toUpperCase() + theme.slice(1), exact: true }).click();
    await page.waitForFunction(theme => ownership.read().appearance.menuSurfaceId === theme, theme);
    assert.deepEqual((await page.evaluate(() => ownership.read())).displays, before.displays, 'global theme never edits the selected Display');
    assert.equal(await page.locator('main.system-workflow').getAttribute('data-menu-surface'), theme);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const instance = primary ? page.locator('[data-display-instance="display:primary"]') : second;
    await instance.locator('header.system-workflow__identity-strip').focus();
    await instance.getByRole('button', { name: 'Lock Display Module composition', exact: true }).press('Enter');
    await instance.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).press('Enter');
    await instance.locator('.system-workflow__presentation-board').waitFor({ state: 'detached' });
    if (primary) assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(`inscape:workbench:presentation-board:${ownership.profile}`)).open), false, 'legacy primary shortcut storage key remains usable');
    // Unmount flushes the same temporary layout cache used on route navigation.
    await page.evaluate(() => {
      ownership.observeRelease();
      ownership.snapshot('before-unmount');
      ownership.root.unmount();
      ownership.snapshot('after-release');
      ownership.mount();
    });
    await page.locator('main.system-workflow').waitFor();
    await page.evaluate(() => ownership.snapshot('after-remount'));
    const release = await page.evaluate(() => ownership.trace.filter(item => item.label !== 'layout-write'));
    const id = primary ? 'display:primary' : secondId;
    assert.equal(release.find(item => item.label === 'before-unmount').writable, true, 'the departing editor owns a real lease');
    assert.equal(release.find(item => item.label === 'before-release').writable, true, 'final persistence runs before lease revocation');
    for (const label of ['after-release', 'after-remount']) {
      const state = release.find(item => item.label === label);
      assert.equal(state.writable, false, 'a later editor cannot revive the departed capability');
      assert.equal((primary ? state.saved.layout.display : state.saved.layout.displays.find(display => display.id === id)).open, false, `${label}: minimized layout survives`);
      assert.equal(state.saved.views[id].locked, true, `${label}: composition lock survives`);
    }
    assert.equal(release.find(item => item.label === 'after-remount').displays.find(display => display.id === id).open, false, 'the restored Display starts minimized');
    // The accepted sidebar overlays the fixture's original shortcut position.
    // Reveal that canvas area through the real menu before exercising the pointer.
    await page.locator('main.system-workflow').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'HIDE SIDEBAR', exact: true }).click();
    await page.getByRole('complementary', { name: 'Workspace sidebar', exact: true }).waitFor({ state: 'hidden' });
    await instance.locator('.system-workflow__desktop-shortcut').dblclick();
    await instance.locator('header.system-workflow__identity-strip').focus();
    await instance.getByRole('button', { name: 'Unlock Display Module composition', exact: true }).waitFor();
    await page.screenshot({ path: `${output}/display-ownership-${primary}.png` });
    assert.deepEqual(errors, []);
  } finally {
    try {
      if (page) await withinDeadline((async () => {
        await writeFile(`${output}/release-${primary}.json`, JSON.stringify(await page.evaluate(() => ownership.trace), null, 2));
        await page.screenshot({ path: `${output}/release-${primary}.png`, timeout: 4000 });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: `${output}/release-${primary}-390.png`, timeout: 4000 });
      })(), 5000, 'Display release diagnostics timed out');
    } catch (error) { console.warn('Display release diagnostics unavailable:', error.message); }
    finally { await browser.close(); }
  }
});
