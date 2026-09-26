import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5189';
test('independent Image: Library drop, free size, dock crop, wraparound flip, Lift, persistence and Visitor parity', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const shots = await mkdtemp(join(tmpdir(), 'inscape-image-')); console.log(`Image screenshots: ${shots}`);
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: Number(process.env.INSCAPE_IMAGE_DENSITY || 1), reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__image__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = () => page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => { if (window.failSave && key.startsWith('inscape.system-workflow-draft')) throw Error('full'); localStorage.setItem(key, value); } };
      window.readDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft();
      window.buildDocument = async () => (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: window.readDraft(), assetRecords: [] });
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      window.root = createRoot(document.getElementById('root'));
      const reviewAssets = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map((asset, index) => index === 0 ? { ...asset, imageWidth: null, imageHeight: null, width: null, height: null } : asset);
      window.root.render(React.createElement(Runtime, { profileAddress, reviewStorage: storage, reviewAssets,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Image review' } }));
    });
    await page.goto(`${origin}/__image__`); await mount();
    await page.getByRole('button', { name: 'Library', exact: true }).waitFor();
    await page.mouse.click(20, 20, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).click();
    await page.getByRole('menuitem', { name: 'IMAGE', exact: true }).click();
    const module = page.locator('[data-image-module]'), canvas = module.locator('.image-module__canvas');
    const dock = page.locator('[data-context-tools]');
    await canvas.waitFor();
    const grip = module.getByLabel('Move Image window', { exact: true });
    const gripBounds = await grip.boundingBox();
    await page.mouse.move(gripBounds.x + 60, gripBounds.y + 14); await page.mouse.down();
    await page.mouse.move(1120, 140, { steps: 12 }); await page.mouse.up();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const library = page.getByRole('region', { name: 'Library workspace' });
    await library.waitFor();
    const drop = async name => {
      const button = library.getByRole('button', { name: `${name} / INSCAPE STUDIES`, exact: true }); await button.waitFor();
      await button.scrollIntoViewIfNeeded();
      const from = await button.boundingBox(), to = await canvas.boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + 30); await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 }); await page.mouse.up();
    };
    await drop('ABYSSAL STUDY');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides.length === 1);
    await drop('SKULL REAPER');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides.length === 2);
    await drop('MOUNTAIN SIGNAL I');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides.length === 3);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await grip.focus();
    // Return from the Library drop area before widening the canvas: Workbench
    // windows may now extend beyond the viewport instead of being clamped.
    const movedGrip = await grip.boundingBox();
    await page.mouse.move(movedGrip.x + 60, movedGrip.y + 14); await page.mouse.down();
    await page.mouse.move(700, 140, { steps: 8 }); await page.mouse.up();
    assert.equal(await dock.getByRole('button', { name: 'Duplicate', exact: true }).count(), 0);
    assert.equal(await page.locator('[data-shared-tool="layers"]').count(), 0);
    const resizeHandle = module.getByRole('separator', { name: 'Resize Image window' });
    assert.equal(await resizeHandle.evaluate(el => getComputedStyle(el).borderRightWidth), '0px');
    const resizeBounds = await resizeHandle.boundingBox();
    const beforeResize = await page.evaluate(() => window.readDraft().imageModules[0]);
    await page.mouse.move(resizeBounds.x + 10, resizeBounds.y + 10); await page.mouse.down();
    await page.mouse.move(resizeBounds.x + 70, resizeBounds.y - 90, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(height => window.readDraft().imageModules[0].height !== height, beforeResize.height);
    assert.notEqual((await page.evaluate(() => window.readDraft().imageModules[0])).width, beforeResize.width);
    await dock.getByRole('spinbutton', { name: 'Image width' }).fill('640');
    await dock.getByRole('spinbutton', { name: 'Image height' }).fill('96');
    await dock.getByRole('button', { name: 'Set size', exact: true }).click();
    await page.waitForFunction(() => window.readDraft().imageModules[0].height === 96);
    const size = await canvas.boundingBox();
    assert.ok(Math.abs(size.width / size.height - 640 / 96) < .05);
    for (const name of ['Rotate', 'Mirror horizontal', 'Mirror vertical']) await dock.getByRole('button', { name, exact: true }).click();
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider', { name: 'Crop zoom' }).fill('2');
    await canvas.focus(); await page.keyboard.press('ArrowRight');
    const cropImage = canvas.locator('image');
    const beforePan = await cropImage.getAttribute('transform');
    const cropBounds = await canvas.boundingBox();
    await page.mouse.move(cropBounds.x + cropBounds.width / 2, cropBounds.y + cropBounds.height / 2); await page.mouse.down();
    await page.mouse.move(cropBounds.x + cropBounds.width / 2 + 50, cropBounds.y + cropBounds.height / 2, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await cropImage.getAttribute('transform'), beforePan, 'dragging pans media inside the crop');
    const before = await page.evaluate(() => window.readDraft());
    await page.evaluate(() => { window.failSave = true; });
    await dock.getByRole('button', { name: 'Done', exact: true }).click();
    await dock.getByRole('alert').waitFor();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), before);
    await page.evaluate(() => { window.failSave = false; });
    await dock.getByRole('button', { name: 'Done', exact: true }).click();
    const cropped = await page.evaluate(() => window.readDraft());
    assert.equal(cropped.imageModules[0].sides[2].crop.zoom, 2);
    assert.deepEqual(cropped.grids, before.grids);
    await page.screenshot({ path: join(shots, 'strip-wide.png') });
    // Lift uses the shared crop-to-native animation and returns to the exact saved crop.
    await canvas.click(); await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.image-module__canvas')?.hasAttribute('data-lift-source'));
    await page.screenshot({ path: join(shots, 'lift-wide.png') });
    await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => window.readDraft()), cropped);
    // Crop cancellation and Native fit retain the source and transform.
    await grip.focus();
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider', { name: 'Crop zoom' }).fill('3');
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), cropped);
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('button', { name: 'Native fit', exact: true }).click();
    assert.equal((await page.evaluate(() => window.readDraft())).imageModules[0].sides[2].crop, null);
    await canvas.focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides[2].crop?.zoom === 2);
    // A cancelled resize does not mutate saved dimensions.
    await resizeHandle.focus();
    const cancelBounds = await resizeHandle.boundingBox();
    await page.mouse.move(cancelBounds.x + 5, cancelBounds.y + 5); await page.mouse.down();
    await page.mouse.move(cancelBounds.x + 45, cancelBounds.y + 55, { steps: 4 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), cropped);
    await grip.focus(); await module.getByRole('button', { name: 'Close Image', exact: true }).click();
    await module.locator('.image-module__shortcut').click(); await canvas.waitFor();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), cropped);
    // Every normal-motion turn rotates the same way, including the wrap.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const ids = cropped.imageModules[0].sides.map(s => s.id);
    for (const id of [ids[0], ids[1], ids[2], ids[0]]) {
      await module.getByRole('button', { name: 'Next Image side' }).click();
      await page.waitForFunction(id => document.querySelector('.image-module__canvas')?.dataset.sideId === id, id);
      assert.equal(await canvas.locator('.image-module__turn').count(), 0, 'flip layers are removed after the transition');
      assert.equal(await canvas.evaluate(el => getComputedStyle(el).perspective), 'none');
    }
    assert.deepEqual(await page.evaluate(() => window.readDraft()), cropped);
    // Removing a side is undoable, and replacement keeps its sequence ID.
    const beforeInterruptedInspect = await canvas.locator('svg').screenshot();
    await canvas.click();
    await page.waitForFunction(() => document.querySelector('.image-module__canvas')?.hasAttribute('data-lift-source'));
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor({ state: 'detached' });
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    assert.deepEqual(await canvas.locator('svg').screenshot(), beforeInterruptedInspect, 'interrupted Lift restores the exact artwork pixels');
    await grip.focus(); await dock.getByRole('button', { name: 'Remove Image side' }).click();
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides.length === 2);
    await canvas.focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides.length === 3);
    await grip.focus(); await dock.getByRole('combobox', { name: 'Image drop action' }).selectOption('replace');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await drop('SKULL REAPER');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides[0].asset.name === 'SKULL REAPER');
    const replaced = (await page.evaluate(() => window.readDraft())).imageModules[0];
    assert.deepEqual(replaced.sides.map(side => side.id), ids);
    assert.deepEqual(replaced.sides[0].crop, { x: .5, y: .5, zoom: 1 });
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await canvas.focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.readDraft().imageModules[0].sides[0].asset.name === 'ABYSSAL STUDY');
    await grip.focus(); await dock.getByRole('checkbox', { name: 'Include Image in publication' }).focus(); await page.keyboard.press('Space');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    // Source transparency exposes different Workbench backgrounds. Compare
    // both presentations against the same backing, without their controls.
    const parityStyle = await page.addStyleTag({ content: '.image-module__canvas { background:#123456; } .image-module__header, .image-module__next { visibility:hidden; }' });
    const ownerPixels = await canvas.locator('svg').screenshot();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const visitorImage = page.locator('.visitor-grid-world [data-image-module]'); await visitorImage.locator('.image-module__canvas').waitFor();
    assert.equal(await visitorImage.locator('[role=separator]').count(), 0);
    const visitorPixels = await visitorImage.locator('.image-module__artwork').screenshot();
    assert.ok(visitorPixels.equals(ownerPixels), 'Owner and Visitor paint the same saved side over the same backing');
    await parityStyle.evaluate(node => node.remove());
    await visitorImage.getByRole('button', { name: 'Next Image side' }).click();
    await page.getByRole('button', { name: 'RETURN', exact: true }).click();
    await page.reload(); await mount(); await canvas.waitFor();
    assert.equal(await canvas.getAttribute('data-side-id'), ids[0], 'opening begins at the first side');
    await grip.focus();
    await page.setViewportSize({ width: 390, height: 844 });
    // The camera, rather than viewport clamping, brings offscreen modules back.
    await page.mouse.click(10, 500);
    await page.keyboard.down('Space');
    await page.mouse.move(350, 500); await page.mouse.down();
    await page.mouse.move(30, 500, { steps: 8 }); await page.mouse.up();
    await page.mouse.move(350, 500); await page.mouse.down();
    await page.mouse.move(30, 500, { steps: 8 }); await page.mouse.up();
    await page.keyboard.up('Space');
    await grip.focus();
    await page.waitForFunction(() => {
      const r = document.querySelector('.image-module__canvas')?.getBoundingClientRect();
      return r && r.left >= 0 && r.right <= innerWidth && r.height > 0;
    });
    const narrow = await canvas.boundingBox(); assert.ok(Math.abs(narrow.width / narrow.height - 640 / 96) < .05);
    await page.screenshot({ path: join(shots, 'strip-narrow.png') });
    // Selecting Display restores its own actions; Image crop cannot remain hidden.
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider', { name: 'Crop zoom' }).fill('2');
    await page.locator('[data-display-instance="display:primary"]').getByLabel(/Move Display Module:/).focus();
    await grip.focus();
    assert.equal(await dock.getByRole('slider', { name: 'Crop zoom' }).count(), 0);
    assert.equal(await dock.getByRole('button', { name: 'Duplicate', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
