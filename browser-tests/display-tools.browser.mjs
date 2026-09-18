import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';
test('Display tools float without moving artwork, remember position, and reveal controls only at the edge', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
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

    const shots = await mkdtemp(join(tmpdir(), 'inscape-tools-')); console.log(shots);
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const header = page.getByLabel('Move Display Module: DISPLAY MODULE', { exact: true });
    await board.waitFor();
    const before = await board.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    assert.equal(await header.evaluate(n => getComputedStyle(n).opacity), '0');
    await page.mouse.move(before.x + before.width / 2, before.y + 5);
    assert.equal(await header.evaluate(n => getComputedStyle(n).opacity), '1');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const moveLayers = page.getByLabel('Move Layers window', { exact: true });
    await moveLayers.waitFor();
    assert.deepEqual(await board.boundingBox(), before);
    assert.equal(await page.getByRole('tab', { name: 'Metadata', exact: true }).count(), 0);
    assert.equal(await page.locator('[data-shared-tool="metadata"]').count(), 0);
    await moveLayers.focus(); await page.keyboard.press('ArrowLeft');
    const tools = page.locator('.system-workflow__instrument-window').filter({ has: moveLayers });
    const moved = await tools.boundingBox();
    await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Tools');
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    assert.deepEqual(await tools.boundingBox(), moved);
    await page.reload(); await mount(); await moveLayers.waitFor();
    assert.deepEqual(await tools.boundingBox(), moved);
    assert.deepEqual(await board.boundingBox(), before);
    await page.getByRole('button', { name: 'Select MOON PURPLE', exact: true }).click();
    await page.locator('[data-shared-tool="layers"]').getByRole('button', { name: 'Artwork info', exact: true }).click();
    await page.getByLabel('Move Artwork info window', { exact: true }).waitFor();
    assert.ok(await moveLayers.isVisible()); assert.deepEqual(await board.boundingBox(), before);
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    await page.mouse.move(1, 1); await page.screenshot({ path: join(shots, 'wide.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shots, 'narrow.png') });
    const bounds = await tools.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    // Shared visitor controls have the same quiet toolbar and no authoring panel.
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const document = await window.buildDisplayDocument();
      window.reviewRoot.render(React.createElement(Visitor, { document }));
    });
    await page.getByRole('article', { name: 'Display Module', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Layers', exact: true }).count(), 0);
    const info = page.getByRole('button', { name: 'Tools', exact: true });
    await info.focus(); await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'METADATA', exact: true }).click();
    await page.getByLabel('Move Artwork info window', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    assert.equal(await page.evaluate(() => matchMedia('(hover: none)').matches), true);
    await page.getByRole('button', { name: 'Show Display controls', exact: true }).click();
    assert.equal(await page.locator('.system-workflow__identity-strip').getAttribute('data-toolbar-open'), 'true');
    await page.getByRole('button', { name: 'Hide Display controls', exact: true }).click();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
