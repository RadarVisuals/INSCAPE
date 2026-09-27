import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const opacity = locator => locator.evaluate(node => getComputedStyle(node).opacity);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1, `${message}: ${actual} / ${expected}`);
const positionOf = draft => draft.workbench.imageModules.find(item => item.id === draft.imageModules[0].id).position;

for (const width of [1440, 390]) test(`Image resize controls expose transparent, wide and thin canvases (${width}px)`, { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__image_resize__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_resize__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const { addImageModule } = await import('/src/imageModule/imageModuleSession.js');
      const { resolveImageLibrarySide } = await import('/src/imageModule/imageLibrarySide.js');
      const { saveWorkbenchPreferences } = await import('/src/public/ownerSystemWorkflow/workbenchPreferences.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, key = systemWorkflowDraftKey(profileAddress);
      window.writes = 0;
      const storage = { getItem: name => localStorage.getItem(name), setItem: (name, value) => {
        if (name === key) { if (window.failSave) throw Error('storage full'); window.writes++; }
        localStorage.setItem(name, value);
      } };
      const store = createSystemWorkflowDraftStore({ profileAddress, storage });
      saveWorkbenchPreferences(profileAddress, { surfaceId: 'graphite', gridMode: 'DOTS' }, storage);
      const assets = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS;
      const square = { ...assets[0], selectedMedia: { url: assets[0].originalImageUrl.replace('actors/abyssal_eye/full.webp', 'PFP/PFP.webp'), width: 2000, height: 2000 } };
      const workbench = createDefaultWorkbenchPresentation(); workbench.display.open = false;
      addImageModule(store, profileAddress, { side: await resolveImageLibrarySide(square), size: { width: 720, height: 240 }, position: { left: 8, top: 160 }, workbench });
      addImageModule(store, profileAddress, { side: await resolveImageLibrarySide(assets[1]), size: { width: 320, height: 300 }, position: { left: innerWidth > 700 ? 900 : 32, top: innerWidth > 700 ? 160 : 470 } });
      window.readDraft = () => JSON.parse(storage.getItem(key));
      await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: storage, reviewAssets: assets,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Image resize review' } }));
    });
    const images = page.locator('.image-module__window'), first = images.nth(0), transparent = images.nth(1);
    await first.waitFor(); await transparent.waitFor();
    const bounds = first.locator('.image-module__bounds'), grip = first.getByLabel('Move Image window', { exact: true });
    const southeast = first.getByRole('separator', { name: 'Resize Image window', exact: true });
    await page.mouse.move(width - 10, 900); await settle(page);
    assert.equal(await opacity(bounds), '0');
    await first.locator('.image-module__canvas').hover();
    assert.equal(await opacity(bounds), '1', 'hover over the artwork exposes the whole canvas');
    assert.equal(await opacity(southeast), '1');
    let art = await first.boundingBox(), bar = await grip.boundingBox();
    assert.ok(bar.y + bar.height <= art.y - 27, 'title strip clears both artwork and top resize targets');
    assert.ok(bar.width < art.width, 'title strip stays compact');
    for (const handle of await first.locator('.image-module__resize').all()) {
      const rect = await handle.boundingBox();
      assert.ok(rect.x >= -.01 && rect.x + rect.width <= width + .01, 'resize target stays reachable at the viewport sides');
    }
    const before = await page.evaluate(() => window.readDraft());
    await grip.focus(); await page.mouse.move(width - 10, 900);
    await page.getByRole('spinbutton', { name: 'Image width', exact: true }).focus();
    assert.equal(await opacity(bounds), '1', 'active Image stays outlined while its tools have focus');
    await page.screenshot({ path: `.browser-test-runtime/image-resize-${width}-wide.png` });
    await transparent.locator('.image-module__canvas').hover();
    assert.equal(await opacity(transparent.locator('.image-module__bounds')), '1');
    await page.screenshot({ path: `.browser-test-runtime/image-resize-${width}-transparent.png` });

    // Every handle remains a screen-sized target with camera zoom and pan.
    let currentZoom = 1;
    for (const zoom of [.25, .67, 1.37, 1]) {
      while (Math.abs(currentZoom - zoom) > 1e-7) {
        const deltaY = Math.max(-100, Math.min(100, -Math.log(zoom / currentZoom) / .003));
        await first.dispatchEvent('wheel', { deltaY, ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
        currentZoom *= Math.exp(-deltaY * .003); await settle(page);
      }
      for (const handle of await first.locator('.image-module__resize').all()) {
        const rect = await handle.boundingBox(); near(rect.width, 28, 'target width'); near(rect.height, 28, 'target height');
      }
    }
    await first.dispatchEvent('wheel', { deltaY: 83, bubbles: true, cancelable: true }); await settle(page);
    await first.dispatchEvent('wheel', { deltaY: -83, bubbles: true, cancelable: true }); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), before, 'view changes never author geometry');

    // A one-cell-high canvas leaves distinct top and bottom targets, outside the art.
    await grip.focus();
    await page.getByRole('spinbutton', { name: 'Image height', exact: true }).fill('32');
    await page.getByRole('button', { name: 'Set size', exact: true }).click(); await settle(page);
    await page.screenshot({ path: `.browser-test-runtime/image-resize-${width}-thin.png` });
    const thin = await page.evaluate(() => window.readDraft()), writes = await page.evaluate(() => window.writes);
    const top = first.getByRole('separator', { name: 'Resize Image top', exact: true });
    const bottom = first.getByRole('separator', { name: 'Resize Image bottom', exact: true });
    const topRect = await top.boundingBox(), bottomRect = await bottom.boundingBox(); art = await first.boundingBox(); bar = await grip.boundingBox();
    assert.ok(topRect.y + topRect.height <= bottomRect.y, 'thin canvas controls never overlap');
    assert.ok(bar.y + bar.height <= topRect.y + .01, 'move strip does not steal the top resize target');
    await page.keyboard.down('Alt');
    await page.mouse.move(topRect.x + 14, topRect.y + 20); await page.mouse.down();
    await page.mouse.move(topRect.x + 14, topRect.y - 40, { steps: 8 }); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), thin, 'resizing is a temporary preview until release');
    near((await first.boundingBox()).y + (await first.boundingBox()).height, art.y + art.height, 'opposite bottom remains anchored');
    await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
    const resized = await page.evaluate(() => window.readDraft());
    assert.equal(await page.evaluate(() => window.writes), writes + 1, 'position and dimensions save once');
    assert.equal(resized.imageModules[0].width, thin.imageModules[0].width);
    assert.ok(resized.imageModules[0].height > 32);
    assert.ok(positionOf(resized).top < positionOf(thin).top);
    const resizedRect = await first.boundingBox();
    near(resizedRect.y + resizedRect.height, art.y + art.height, 'release preserves opposite bottom');
    await top.focus(); await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), thin);
    near((await first.boundingBox()).y, art.y, 'undo restores position');
    await page.keyboard.press('Control+Shift+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), resized);

    // Escape and a failed save restore the complete starting rectangle.
    for (const failure of ['cancel', 'storage']) {
      const handle = await top.boundingBox();
      if (failure === 'storage') await page.evaluate(() => { window.failSave = true; });
      await page.keyboard.down('Alt'); await page.mouse.move(handle.x + 14, handle.y + 20); await page.mouse.down();
      await page.mouse.move(handle.x + 14, handle.y - 20, { steps: 4 });
      if (failure === 'cancel') await page.keyboard.press('Escape');
      await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
      assert.deepEqual(await page.evaluate(() => window.readDraft()), resized);
      near((await first.boundingBox()).y, resizedRect.y, `${failure} restores position`);
      near((await first.boundingBox()).height, resizedRect.height, `${failure} restores height`);
      await page.evaluate(() => { window.failSave = false; });
    }
    // Keyboard resize follows the focused edge, and can be undone as one edit.
    await top.focus(); await page.keyboard.press('Alt+Shift+ArrowUp'); await settle(page);
    assert.equal((await page.evaluate(() => window.readDraft())).imageModules[0].height, resized.imageModules[0].height + 10);
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), resized);
    // Left/corner resizing uses the same saved fit as its preview on narrow screens.
    const corner = first.getByRole('separator', { name: 'Resize Image top left', exact: true });
    const cornerRect = await corner.boundingBox(), oldRect = await first.boundingBox();
    await page.keyboard.down('Alt'); await page.mouse.move(cornerRect.x + 18, cornerRect.y + 20); await page.mouse.down();
    await page.mouse.move(cornerRect.x + 58, cornerRect.y + 30, { steps: 5 }); await settle(page);
    const previewRect = await first.boundingBox();
    near(previewRect.x + previewRect.width, oldRect.x + oldRect.width, 'corner retains right edge');
    near(previewRect.y + previewRect.height, oldRect.y + oldRect.height, 'corner retains bottom edge');
    await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
    const committedRect = await first.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) near(committedRect[key], previewRect[key], `release matches preview ${key}`);
    await corner.focus(); await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.readDraft()), resized);
    await first.locator('.image-module__canvas').click();
    await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor();
    assert.equal(await first.locator('.image-module__resize').count(), 0);
    await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const visitor = page.locator('.visitor-grid-world .image-module__window').first(); await visitor.waitFor();
    assert.equal(await visitor.locator('.image-module__bounds, .image-module__resize').count(), 0);
    await visitor.locator('.image-module__canvas').hover();
    const visitorArt = await visitor.boundingBox(), visitorBar = await visitor.locator('header').boundingBox();
    assert.ok(visitorBar.y + visitorBar.height <= visitorArt.y || visitorBar.y >= visitorArt.y + visitorArt.height);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
