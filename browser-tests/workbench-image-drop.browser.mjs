import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function mount(page) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://images.inscape.test/**', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
  await page.route('**/OwnerSystemWorkflowRuntime.jsx*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('await decodeOwnerSystemWorkflowAssetDimensions(asset)',
      'await (globalThis.holdDimensions ? new Promise(resolve => { globalThis.releaseDimensions = () => resolve({width:1920,height:1080,source:asset.src}); }) : decodeOwnerSystemWorkflowAssetDimensions(asset))');
    await route.fulfill({ response, body });
  });
  await page.route(`${origin}/__image_drop__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__image_drop__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, key = systemWorkflowDraftKey(profileAddress);
    const seed = fixture.createOwnerSystemWorkflowReviewStorage();
    window.draftWrites = 0;
    const storage = { getItem: name => localStorage.getItem(name) || seed.getItem(name), setItem: (name, value) => {
      if (name === key) { if (window.failSave) throw Error('storage full'); window.draftWrites++; }
      localStorage.setItem(name, value);
    } };
    const assets = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: 'https://images.inscape.test/art.jpg',
      originalImageUrl: 'https://images.inscape.test/art.jpg', thumbnailUrl: 'https://images.inscape.test/art.jpg',
      src: 'https://images.inscape.test/art.jpg', previewSrc: 'https://images.inscape.test/art.jpg', imageWidth: 1920, imageHeight: 1080,
      imageGroups: [{ index: 0, originalImageUrl: 'https://images.inscape.test/art.jpg' }, { index: 1, originalImageUrl: 'https://images.inscape.test/attached.jpg' }] }));
    window.readDraft = () => JSON.parse(storage.getItem(key));
    window.publicDocument = async () => (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({
      profileAddress, systemWorkflowDraft: window.readDraft(), assetRecords: assets });
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    const props = { profileAddress, reviewStorage: storage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Drop review' } };
    let root = createRoot(document.getElementById('root'));
    const render = () => root.render(React.createElement(Runtime, props));
    window.remount = () => { root.unmount(); root = createRoot(document.getElementById('root')); render(); };
    render();
  });
  await page.getByRole('button', { name: 'Library', exact: true }).waitFor();
}
async function startDrag(page, point, attachment = false) {
  const library = page.getByRole('region', { name: 'Library workspace' });
  const card = attachment ? library.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true })
    : library.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(label => document.querySelector(`[aria-label="${label}"]`)?.getAttribute('aria-disabled') !== 'true', await card.getAttribute('aria-label'));
  const rect = await card.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + 35); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 }); await settle(page);
}

for (const width of [1440, 700]) test(`Library creates an Image at its preview, with undo, existing targets and cancellation (${width}px)`, { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mount(page);
    await setWorkbenchZoom(page, .67);
    await page.mouse.move(width - 20, 700); await page.mouse.wheel(0, 83); await settle(page);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Show 2 images of ABYSSAL STUDY', exact: true }).click();
    const point = { x: width - 170, y: 680 };
    const before = await page.evaluate(() => window.readDraft());
    await startDrag(page, point, true);
    const preview = page.locator('.system-workflow__placement-preview');
    await page.getByText('Release to place Image', { exact: true }).waitFor();
    const rect = await preview.boundingBox();
    await page.screenshot({ path: `.browser-test-runtime/image-drop-${width}-preview.png` });
    await page.mouse.up();
    const image = page.locator('.image-module__window'); await image.waitFor(); await settle(page);
    const actual = await image.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) {
      // The CSS preview has browser layout-unit precision; the Image paints in
      // physical pixels. Both must land on the same physical-pixel boundary.
      assert.ok(Math.abs(actual[key] - rect[key]) < 1 / 64, `${key} matches preview: ${actual[key]} / ${rect[key]}`);
      assert.equal(Math.round(actual[key] * 1.25), Math.round(rect[key] * 1.25));
    }
    assert.ok(Math.abs(actual.x + actual.width / 2 - point.x) < 1, 'centred on release, not default corner');
    const dropped = await page.evaluate(() => window.readDraft());
    assert.equal(dropped.imageModules.length, 1); assert.equal(dropped.imageModules[0].visibility, 'PUBLIC');
    assert.equal(dropped.imageModules[0].sides[0].asset.media.url, 'https://images.inscape.test/attached.jpg');
    assert.deepEqual(dropped.imageModules[0].sides[0].crop, { x: .5, y: .5, zoom: 1 }, 'new Image fills the canvas like any other Library side');
    assert.equal(await page.evaluate(() => window.draftWrites), 1);
    assert.equal(await page.getByRole('spinbutton', { name: 'Image width', exact: true }).count(), 1, 'created Image is the active tools target');
    const published = await page.evaluate(() => window.publicDocument());
    assert.deepEqual(published.workbench.imageModules, dropped.workbench.imageModules);
    assert.deepEqual(published.imageModules[0].sides, dropped.imageModules[0].sides);
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    await image.waitFor({ state: 'detached' }); assert.deepEqual(await page.evaluate(() => window.readDraft()), before);
    await page.keyboard.press('Control+Shift+z'); await image.waitFor(); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), dropped);
    // Existing Image is still an append destination, never another new module.
    await startDrag(page, point);
    await page.getByText('Add Image side', { exact: true }).waitFor(); await page.mouse.up();
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides.length === 2);
    assert.equal((await page.evaluate(() => window.readDraft())).imageModules.length, 1);
    // Display remains the placement target; a locked Display is not empty space.
    const stage = page.locator('[data-system-workflow-artboard]').first();
    const stageRect = await stage.boundingBox(), stagePoint = { x: stageRect.x + stageRect.width * .8, y: stageRect.y + stageRect.height * .7 };
    const priorCount = (await page.evaluate(() => window.readDraft())).grids.reduce((sum, grid) => sum + grid.placements.length, 0);
    await startDrag(page, stagePoint); await page.getByText('Release to add layer', { exact: true }).waitFor(); await page.mouse.up();
    await page.waitForFunction(count => window.readDraft().grids.reduce((sum, grid) => sum + grid.placements.length, 0) === count + 1, priorCount);
    assert.equal((await page.evaluate(() => window.readDraft())).imageModules.length, 1);
    await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).focus(); await page.keyboard.press('Enter');
    const locked = await page.evaluate(() => window.readDraft());
    await startDrag(page, stagePoint); assert.equal(await preview.count(), 0); await page.mouse.up(); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), locked, 'a locked Display never creates an Image behind itself');
    // A cancelled or failed empty-space drop leaves both content and layout alone.
    const empty = { x: width - 170, y: 400 };
    const unchanged = await page.evaluate(() => window.readDraft());
    await startDrag(page, empty); await page.getByText('Release to place Image', { exact: true }).waitFor();
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), unchanged);
    await page.evaluate(() => { window.failSave = true; });
    await startDrag(page, empty); await page.mouse.up();
    await page.getByRole('button', { name: 'Dismiss notification' }).filter({ hasText: 'Image could not be saved' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), unchanged);
    await page.evaluate(() => { window.failSave = false; window.holdDimensions = true; });
    await startDrag(page, empty); await page.mouse.up();
    await page.waitForFunction(() => typeof window.releaseDimensions === 'function');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.evaluate(() => window.releaseDimensions()); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), unchanged, 'closed Library cannot finish a delayed drop');
    await page.evaluate(() => { window.holdDimensions = false; window.remount(); });
    await image.waitFor(); await settle(page);
    assert.deepEqual((await page.evaluate(() => window.readDraft())).workbench.imageModules, unchanged.workbench.imageModules);
    const saved = unchanged.workbench.imageModules[0].position, afterReload = await image.boundingBox();
    assert.ok(Math.abs(afterReload.x - saved.left) < 1 && Math.abs(afterReload.y - saved.top) < 1, 'reload uses authored world position at reset camera');
    await setWorkbenchZoom(page, .67);
    await page.mouse.move(width - 20, 700); await page.mouse.wheel(0, 83); await settle(page);
    await page.screenshot({ path: `.browser-test-runtime/image-drop-${width}-saved.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
