import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';
test('one shared Layers and Metadata window follow explicit Display targets without cross-editing', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
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
        const { addDisplayModule, createDisplayModuleSession } = await import('/src/systemWorkflow/displayModuleSession.js');
        const secondId = addDisplayModule(store);
        const second = createDisplayModuleSession(store, secondId);
        second.placeAsset({ gridId: second.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id,
          destination: { column: 8, row: 4, columnSpan: 10, rowSpan: 10 } });
        const publishable = store.getDraft(); publishable.displays[0].visibility = 'PUBLIC';
        store.commitCompletedOperation(publishable, { expectedGeneration: store.getGeneration() });
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


    const primary = page.locator('[data-display-instance="display:primary"]').first();
    const secondary = page.locator('.system-workflow__display-instance').nth(1);
    const clickControl = async (container, name) => {
      if (['Layers', 'Artwork info'].includes(name)) {
        await container.getByLabel(/Move Display Module:/).focus(); await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem', { name: 'TOOLS', exact: true }).click();
        await page.getByRole('menuitem', { name: name === 'Layers' ? 'LAYERS' : 'METADATA', exact: true }).click();
      } else { await container.getByRole('button', { name, exact: true }).focus(); await page.keyboard.press('Enter'); }
    };
    const openDisplayMenu = async container => {
      await container.getByLabel(/Move Display Module:/).focus(); await page.keyboard.press('Shift+F10');
    };
    await primary.getByLabel(/Move Display Module:/).waitFor();
    assert.equal(await primary.getByRole('button', { name: /^(Layers|Artwork info|Play Grids)$/ }).count(), 0);
    await openDisplayMenu(secondary);
    assert.equal(await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    await openDisplayMenu(primary);
    await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).click();
    await clickControl(primary, 'Pause Grids');
    assert.equal(await primary.getByRole('button', { name: 'Pause Grids', exact: true }).count(), 0);
    await clickControl(primary, 'Layers');
    const layers = page.locator('[data-shared-tool="layers"]');
    const metadata = page.locator('[data-shared-tool="metadata"]');
    assert.equal(await layers.count(), 1);
    assert.ok((await layers.innerText()).includes('MOON PURPLE'));
    await clickControl(primary, 'Artwork info');
    assert.equal(await metadata.count(), 1);
    await layers.getByRole('button', { name: 'MOON PURPLE', exact: true }).click();
    const listBounds = await layers.locator('.system-workflow__layer-list').boundingBox();
    const selectionBounds = await layers.getByRole('region', { name: 'Selection properties' }).boundingBox();
    assert.ok(listBounds.y + listBounds.height <= selectionBounds.y);
    await layers.getByText('Composition spacing', { exact: true }).click();
    assert.ok(await layers.getByRole('button', { name: 'Apply to all', exact: true }).isVisible());
    await layers.getByText('Composition spacing', { exact: true }).click();
    assert.ok((await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label')).includes('MOON PURPLE'));
    await secondary.getByLabel(/Move Display Module:/).focus();
    assert.equal(await layers.count(), 1); assert.equal(await metadata.count(), 1);
    assert.ok(!(await layers.innerText()).includes('MOON PURPLE'));
    await layers.getByRole('button', { name: 'ABYSSAL STUDY', exact: true }).click();
    assert.ok((await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label')).includes('ABYSSAL STUDY'));
    const before = await page.evaluate(() => window.readDisplayDraft());
    await layers.getByRole('button', { name: 'Cover Display', exact: true }).click();
    const after = await page.evaluate(() => window.readDisplayDraft());
    assert.deepEqual(after.grids, before.grids);
    assert.notDeepEqual(after.displays[0].grids, before.displays[0].grids);
    // Tool interactions retain selection; a primary click on empty Workbench clears every Display.
    const selectedArtwork = page.locator('[data-system-workflow-placement-id][aria-pressed="true"]');
    assert.equal(await selectedArtwork.count(), 2);
    await page.mouse.click(20, 20);
    assert.equal(await selectedArtwork.count(), 0);
    await page.getByText('Select a Display to see its layers.', { exact: true }).waitFor();
    await primary.getByLabel(/Move Display Module:/).focus();
    assert.equal(await selectedArtwork.count(), 0);
    await secondary.getByLabel(/Move Display Module:/).focus();
    assert.equal(await selectedArtwork.count(), 0);
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), after);
    await clickControl(secondary, 'Minimize Display Module to shortcut');
    assert.equal(await layers.locator('.system-workflow__layer-row').count(), 0);
    await page.getByText('Select a Display to see its layers.', { exact: true }).waitFor();
    await primary.getByLabel(/Move Display Module:/).focus();
    assert.ok((await layers.innerText()).includes('MOON PURPLE'));
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    assert.equal(await metadata.count(), 0);
    assert.equal(await page.locator('.display-inspection-cue').count(), 0);
    await primary.getByRole('button', { name: 'Select MOON PURPLE', exact: true }).click();
    assert.equal(await metadata.count(), 0);
    assert.equal(await page.locator('.display-inspection-bubble').count(), 0);
    await page.reload(); await mount();
    await page.locator('[data-shared-tool="layers"]').waitFor();
    assert.equal(await page.locator('[data-shared-tool="metadata"]').count(), 0);
    // Selection actions have their own host and survive closing Layers.
    await primary.getByLabel(/Move Display Module:/).focus();
    await layers.getByRole('button', { name: 'MOON PURPLE', exact: true }).click();
    const dock = page.locator('[data-context-tools]');
    assert.equal(await layers.getByRole('button', { name: 'Rotate', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
    assert.equal(await layers.count(), 0);
    const original = await page.evaluate(() => window.readDisplayDraft());
    await dock.getByRole('button', { name: 'Rotate', exact: true }).click();
    const rotated = await page.evaluate(() => window.readDisplayDraft());
    assert.notDeepEqual(rotated.grids, original.grids);
    assert.deepEqual(rotated.displays, original.displays);
    await dock.getByRole('button', { name: 'Mirror horizontal', exact: true }).click();
    await dock.getByRole('button', { name: 'Mirror vertical', exact: true }).click();
    const transformed = await page.evaluate(() => window.readDisplayDraft());
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    const zoom = dock.getByRole('slider', { name: 'Crop zoom' });
    await zoom.focus(); await page.keyboard.press('ArrowRight');
    assert.ok(Number(await zoom.inputValue()) > 1, 'range keeps native keyboard control during crop');
    await zoom.fill('2');
    await secondary.locator('.system-workflow__desktop-shortcut').click({ button: 'right' });
    await page.keyboard.press('Escape');
    await primary.getByLabel(/Move Display Module:/).focus();
    assert.equal(await zoom.count(), 0, 'switching target ends the old crop');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), transformed);
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await zoom.fill('1.5');
    await dock.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Rotate', 'finishing crop restores keyboard focus inside the dock');
    assert.notDeepEqual((await page.evaluate(() => window.readDisplayDraft())).grids, transformed.grids);
    assert.equal(await layers.count(), 0, 'crop does not reopen Layers');
    const shots = await mkdtemp(join(tmpdir(), 'inscape-context-toolbar-'));
    console.log(`Toolbar screenshots: ${shots}`);
    await dock.getByRole('button', { name: 'Rotate', exact: true }).focus();
    await page.screenshot({ path: join(shots, 'wide.png') });
    const moveHandle = dock.getByLabel('Move Artwork tools window', { exact: true });
    const bounds = await dock.locator('aside').boundingBox();
    await moveHandle.focus(); await page.keyboard.press('ArrowRight');
    assert.ok((await dock.locator('aside').boundingBox()).x > bounds.x, 'keyboard moves the dock');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const rect = document.querySelector('.context-toolbar').getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    });
    assert.equal(await dock.getByRole('button', { name: /Frame and/ }).count(), 0);
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await page.waitForFunction(() => {
      const surface = document.querySelector('.context-toolbar .system-workflow__instrument-content');
      return surface.scrollHeight <= surface.clientHeight + 1 && surface.getBoundingClientRect().bottom <= innerHeight - 54;
    });
    await page.screenshot({ path: join(shots, 'narrow-crop.png') });
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dock.getByRole('button', { name: 'Rotate', exact: true }).focus();
    await page.waitForFunction(() => {
      const surface = document.querySelector('.context-toolbar .system-workflow__instrument-content');
      return surface.scrollHeight <= surface.clientHeight + 1 && surface.getBoundingClientRect().bottom <= innerHeight - 54;
    });
    await page.screenshot({ path: join(shots, 'narrow.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      window.reviewRoot.render(React.createElement(Visitor, { document: await window.buildDisplayDocument() }));
    });
    assert.equal(await dock.count(), 0, 'Visitor has no authoring dock');
    const visitorPrimary = page.locator('main.visitor-grid-world[data-display-instance="display:primary"] > .system-workflow__workbench');
    const visitorSecondary = page.locator('main.visitor-grid-world[data-embedded-display]');
    await clickControl(visitorPrimary, 'Artwork info');
    await visitorPrimary.getByRole('button', { name: /Read metadata for MOON PURPLE/ }).focus(); await page.keyboard.press('Enter');
    assert.ok((await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label')).includes('MOON PURPLE'));
    await visitorSecondary.getByRole('button', { name: /Read metadata for ABYSSAL STUDY/ }).focus(); await page.keyboard.press('Enter');
    assert.equal(await metadata.count(), 1);
    assert.ok((await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label')).includes('ABYSSAL STUDY'));
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).count(), 0);
    await page.getByRole('menuitem', { name: 'METADATA', exact: true }).click();
    assert.ok((await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label')).includes('ABYSSAL STUDY'));
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    assert.equal(await page.locator('.display-inspection-cue').count(), 0);
    assert.equal(await page.locator('.display-inspection-bubble').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
