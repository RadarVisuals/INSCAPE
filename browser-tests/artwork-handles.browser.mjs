import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';
test('full canvas artwork handles beat window resizing and stay reachable beyond the canvas', { timeout: 120_000 }, async () => {
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
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }

    const shots = await mkdtemp(join(tmpdir(), 'inscape-handles-'));
    console.log(shots);
    await page.getByRole('button', { name: 'Select MOON PURPLE', exact: true }).click();
    await page.getByRole('button', { name: 'Cover Display', exact: true }).click();
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const before = await board.boundingBox();
    const handle = page.getByRole('button', { name: 'Resize selection from se', exact: true });
    const box = await handle.boundingBox();
    assert.equal(box.width, 28);
    assert.equal(await page.evaluate(b => document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.getAttribute('aria-label'), box), 'Resize selection from se');
    const initial = await page.evaluate(() => window.readDisplayDraft());
    await page.mouse.move(box.x + 14, box.y + 14); await page.mouse.down();
    await page.keyboard.down('Alt'); await page.mouse.move(box.x - 35, box.y - 20, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt');
    assert.deepEqual(await board.boundingBox(), before);
    assert.notDeepEqual(await page.evaluate(() => window.readDisplayDraft()), initial);
    const after = await page.evaluate(() => window.readDisplayDraft());
    assert.equal(after.grids[0].placements[0].column, initial.grids[0].placements[0].column);
    assert.equal(after.grids[0].placements[0].row, initial.grids[0].placements[0].row);
    await page.getByRole('button', { name: 'Cover Display', exact: true }).click();
    const artwork = page.getByRole('button', { name: 'Select MOON PURPLE', exact: true });
    await artwork.locator('img').last().waitFor();
    const imageBefore = await artwork.locator('img').last().boundingBox();
    const sizeBefore = await page.evaluate(() => window.readDisplayDraft().grids[0].placements[0]);
    const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
    await width.fill(String(sizeBefore.columnSpan / 2)); await width.press('Enter');
    const sized = await page.evaluate(() => window.readDisplayDraft().grids[0].placements[0]);
    assert.equal(sized.rowSpan, sizeBefore.rowSpan);
    assert.ok(sized.columnSpan < sizeBefore.columnSpan);
    const imageAfter = await artwork.locator('img').last().boundingBox();
    assert.ok(Math.abs(imageAfter.height - imageBefore.height) < 1);
    assert.ok(Math.abs(imageAfter.width / imageBefore.width - sized.columnSpan / sizeBefore.columnSpan) < .02);
    const east = page.getByRole('button', { name: 'Resize selection from e', exact: true });
    const eastBounds = await east.boundingBox();
    await page.mouse.move(eastBounds.x + 14, eastBounds.y + 14); await page.mouse.down();
    await page.mouse.move(eastBounds.x - 35, eastBounds.y + 50, { steps: 5 }); await page.mouse.up();
    const dragged = await page.evaluate(() => window.readDisplayDraft().grids[0].placements[0]);
    assert.equal(dragged.rowSpan, sized.rowSpan); assert.equal(dragged.row, sized.row);
    assert.ok(dragged.columnSpan < sized.columnSpan);
    await east.focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft().grids[0].placements[0]), sized);
    await width.fill('0'); await width.press('Enter');
    assert.ok(await page.getByRole('alert').filter({ hasText: 'Use a size' }).isVisible());
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft().grids[0].placements[0]), sized);
    await width.press('Escape');
    await page.reload(); await mount();
    await page.getByRole('button', { name: 'Select MOON PURPLE', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft().grids[0].placements[0]), sized);
    await page.screenshot({ path: join(shots, 'wide.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shots, 'narrow.png') });
    for (const corner of ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']) {
      const h = await page.getByRole('button', { name: 'Resize selection from ' + corner, exact: true }).boundingBox();
      assert.ok(h.x >= 0 && h.x + h.width <= 391);
    }
    assert.deepEqual(errors, []);
    await handle.focus(); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Resize Display Module from se', exact: true }).evaluate(node => getComputedStyle(node).pointerEvents), 'auto');
    const authoredImage = await artwork.locator('img').last().boundingBox();
    const authoredFrame = await artwork.boundingBox();
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      window.reviewRoot.render(React.createElement(Visitor, { document: await window.buildDisplayDocument() }));
    });
    const published = page.locator('figure').filter({ has: page.getByRole('img', { name: 'MOON PURPLE', exact: true }) });
    await published.locator('img.is-ready').waitFor();
    const publicImage = await published.locator('img').boundingBox();
    const publicFrame = await published.boundingBox();
    assert.ok(Math.abs(publicImage.width / publicFrame.width - authoredImage.width / authoredFrame.width) < .02);
    assert.ok(Math.abs(publicImage.height / publicFrame.height - authoredImage.height / authoredFrame.height) < .02);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
