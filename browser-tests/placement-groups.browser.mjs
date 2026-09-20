import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';
test('Persistent groups select, move and resize together across save, undo and Visitor', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      if (new URL(route.request().url()).searchParams.has('group-late')) await new Promise(resolve => setTimeout(resolve, 1200));
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


    const moon = page.getByRole('button', { name: 'Select MOON PURPLE', exact: true });
    const creature = page.getByRole('button', { name: 'Select ABYSSAL STUDY', exact: true });
    await moon.focus(); await page.keyboard.press('Space');
    await creature.focus(); await page.keyboard.press('Shift+Space');
    const initial = await page.evaluate(() => window.readDisplayDraft());
    await page.getByRole('button', { name: 'Group layers', exact: true }).click();
    const grouped = await page.evaluate(() => window.readDisplayDraft());
    assert.deepEqual(grouped.grids[0].placements, initial.grids[0].placements);
    assert.equal(grouped.grids[0].groups[0].placementIds.length, 2);
    const staticScene = () => page.evaluate(() => [...document.querySelectorAll('[data-system-workflow-placement-id], figure[data-placement-id]')]
      .every(n => n.getAnimations().length === 0));
    assert.equal(await staticScene(), true);
    const handle = page.getByRole('button', { name: 'Resize selection from se', exact: true });
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 50, handleBox.y + 50, { steps: 4 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), grouped, 'cancelled resize changes nothing');
    await moon.focus(); await page.keyboard.press('Escape');
    await creature.focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-system-workflow-placement-id][aria-pressed="true"]').count(), 2);
    await page.keyboard.press('ArrowRight');
    const moved = await page.evaluate(() => window.readDisplayDraft());
    const deltas = moved.grids[0].placements.map((p,i) => p.column - grouped.grids[0].placements[i].column);
    assert.ok(deltas[0] > 0); assert.equal(deltas[0], deltas[1]);
    await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), grouped);
    const shots = await mkdtemp(join(tmpdir(), 'inscape-groups-')); console.log(shots);
    await page.screenshot({ path: join(shots, 'wide.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shots, 'narrow.png') });
    await page.screenshot({ path: join(shots, 'narrow-layers.png') });
    assert.equal(await page.getByRole('region', { name: 'Selection and layers inspector', exact: true }).evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Ungroup', exact: true }).click();
    const ungrouped = await page.evaluate(() => window.readDisplayDraft());
    assert.equal(ungrouped.grids[0].groups, undefined);
    assert.deepEqual(ungrouped.grids[0].placements, grouped.grids[0].placements);
    await moon.focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), grouped);
    await page.getByRole('button', { name: 'Lock MOON PURPLE', exact: true }).click();
    assert.ok((await page.evaluate(() => window.readDisplayDraft())).grids[0].placements.every(p => p.locked));
    await page.getByRole('button', { name: 'Unlock MOON PURPLE', exact: true }).click();
    await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.reload(); await mount();
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), grouped);
    await moon.waitFor(); assert.equal(await staticScene(), true);
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const document = await window.buildDisplayDocument();
      document.grids[0].placements[1].asset.media.url += '?group-late=1';
      window.reviewRoot.render(React.createElement(Visitor, { document }));
    });
    await page.locator('figure[data-placement-id]').first().waitFor();
    await page.waitForTimeout(300); assert.equal(await staticScene(), true);
    assert.equal(await page.locator('figure[data-placement-id]').nth(1).getAttribute('data-media-state'), 'loading');
    await page.locator('figure[data-placement-id]').nth(1).locator('img.is-ready').waitFor();
    assert.equal(await staticScene(), true);
    await page.screenshot({ path: join(shots, 'visitor.png') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await staticScene(), true);
    assert.deepEqual(errors, []);
  } finally {
    await Promise.all(browser.contexts().flatMap(context => context.pages().map(page => page.unrouteAll({ behavior: 'wait' }))));
    await browser.close();
  }
});
