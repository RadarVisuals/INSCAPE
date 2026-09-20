import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';
test('Static artwork tools, inspection and Visitor work without the removed animation module', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__display_text__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = () => page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createSystemWorkflowAuthoringSession } = await import('/src/systemWorkflow/systemWorkflowAuthoringSession.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
      if (!localStorage.getItem('display-text-initialized')) {
        const session = createSystemWorkflowAuthoringSession({ store });
        session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[6].id,
          destination: { column: 0, row: 0, columnSpan: 32, rowSpan: 18 } });
        session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id,
          destination: { column: 18, row: 5, columnSpan: 10, rowSpan: 10 } });
        session.createGrid();
        const seeded = store.getDraft();
        seeded.grids.find(grid => grid.id === session.getState().selectedGridId).visibility = 'PUBLIC';
        store.commitCompletedOperation(seeded, { expectedGeneration: store.getGeneration() });
        localStorage.setItem('display-text-initialized', 'true');
      }
      window.readDisplayDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
      window.buildDisplayDocument = async () => {
        const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
        return buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: window.readDisplayDraft(), assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS });
      };
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      window.reviewRoot = createRoot(document.getElementById('root'));
      window.reviewRoot.render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Display text review' } }));
    });
    await page.goto(`${origin}/__display_text__`); await mount();
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }


    const initial = await page.evaluate(() => window.readDisplayDraft());
    const artwork = page.getByRole('button', { name: 'Select ABYSSAL STUDY', exact: true });
    await artwork.focus(); await page.keyboard.press('Space');
    const rendered = await artwork.locator('img').first().evaluate(n => n.complete && n.naturalWidth > 0);
    assert.equal(rendered, true);
    await page.locator('main.system-workflow').dispatchEvent('contextmenu', { clientX: 20, clientY: 20 });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    assert.equal(await page.getByRole('menuitem', { name: 'ANIMATION MODULE', exact: true }).count(), 0);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.locator('.system-workflow__presentation-board').dispatchEvent('contextmenu', { clientX: 80, clientY: 100 });
    assert.equal(await page.getByRole('menuitem', { name: /ANIMATIONS/ }).count(), 0);
    await page.getByRole('menuitem', { name: 'APPEARANCE', exact: true }).click();
    await page.getByRole('button', { name: 'Close Display appearance', exact: true }).click();
    const noRuntime = () => page.evaluate(() => ({
      surfaces: document.querySelectorAll('.layered-artwork, [data-shared-tool="animation"]').length,
      animated: [...document.querySelectorAll('[data-system-workflow-placement-id], figure[data-placement-id]')].some(n => n.getAnimations().length),
      resources: performance.getEntriesByType('resource').filter(r => /layeredRuntime|layeredResources|pixi\.js|floatEffect|flickerEffect/.test(r.name)).map(r => r.name),
    }));
    assert.deepEqual(await noRuntime(), { surfaces: 0, animated: false, resources: [] });
    const shots = await mkdtemp(join(tmpdir(), 'inscape-animation-removal-')); console.log(shots);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: join(shots, `owner-${width}.png`) });
      assert.equal(await page.getByRole('region', { name: 'Selection and layers inspector', exact: true }).evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
    await page.getByRole('button', { name: 'Maximize Display Module', exact: true }).focus();
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    await artwork.focus(); await page.keyboard.press('Enter');
    await page.locator('.system-workflow__lift-artwork img').waitFor();
    await page.waitForFunction(() => document.querySelector('.system-workflow__lift-artwork')?.style.visibility === 'visible');
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'inspection.png') });
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), initial);
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      window.reviewRoot.render(React.createElement(Visitor, { document: await window.buildDisplayDocument() }));
    });
    await page.waitForFunction(() => document.querySelectorAll('figure[data-placement-id] img.is-ready').length === 2);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: join(shots, `visitor-${width}.png`) });
      assert.deepEqual(await noRuntime(), { surfaces: 0, animated: false, resources: [] });
    }
    assert.deepEqual(errors, []);
  } finally {
    await Promise.all(browser.contexts().flatMap(context => context.pages().map(page => page.unrouteAll({ behavior: 'wait' }))));
    await browser.close();
  }
});
