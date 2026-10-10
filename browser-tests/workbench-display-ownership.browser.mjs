import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5189';

for (const primary of [true, false]) test(`Workbench theme and Display lifetimes with primary ${primary}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
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
      const props = { profileAddress: profile, reviewStorage: localStorage, reviewAssets: [], reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Ownership' } };
      window.ownership = { second, profile, read: () => JSON.parse(localStorage.getItem(systemWorkflowDraftKey(profile))),
        mount: () => { ownership.root = createRoot(document.getElementById('root')); ownership.root.render(React.createElement(Runtime, props)); } };
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
    await page.evaluate(() => { ownership.root.unmount(); ownership.mount(); });
    await instance.locator('.system-workflow__desktop-shortcut').dblclick();
    await instance.locator('header.system-workflow__identity-strip').focus();
    await instance.getByRole('button', { name: 'Unlock Display Module composition', exact: true }).waitFor();
    await page.screenshot({ path: `.browser-test-runtime/display-ownership-${primary}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
