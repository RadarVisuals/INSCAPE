import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
test('Layers and direct editing retain an offset Grid through unlock, crop and navigation', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

  try {
    for (const visitor of [false]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, ...(process.env.INSCAPE_MOTION_RECORD ? { recordVideo: { dir: '.browser-test-runtime/grid-handoff-video', size: { width, height: 1000 } } } : {}) });
      const cdp = await page.context().newCDPSession(page);
      if (process.env.INSCAPE_MOTION_CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.INSCAPE_MOTION_CPU) });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
      await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
      await page.route(`${origin}/__motion__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__motion__`);
      await page.evaluate(async ({ visitor, heavy }) => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
        const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
        const profile = `0x${'1'.repeat(40)}`, key = systemWorkflowDraftKey(profile);
        const storage = fixture.createOwnerSystemWorkflowReviewStorage();
        const draft = JSON.parse(storage.getItem(key));
        const assets = heavy ? fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS : fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: 'https://motion.invalid/motion-artwork.png', originalImageUrl: 'https://motion.invalid/motion-artwork.png', thumbnailUrl: 'https://motion.invalid/motion-artwork.png', previewSrc: 'https://motion.invalid/motion-artwork.png', src: 'https://motion.invalid/motion-artwork.png' }));
        const base = draft.grids[0], retainedGrids = draft.grids.slice(1);
        draft.grids = Array.from({ length: 4 }, (_, gridIndex) => ({ ...base, id: `grid:motion-${gridIndex}`, title: `Motion ${gridIndex}`, visibility: 'PUBLIC',
          placements: Array.from({ length: 24 }, (_, index) => ({ ...base.placements[0], id: `motion-${gridIndex}-${index}`, stableAssetId: assets[0].id,
            column: index % 6 * 5, row: Math.floor(index / 6) * 4, columnSpan: 6, rowSpan: 5, layer: index, navigationOrder: index,
          })) }));
        if (heavy) draft.grids.forEach((grid, index) => {
          grid.placements = grid.placements.slice(0, 5).map((placement, i) => ({ ...placement,
            stableAssetId: assets[i === 0 ? 6 : (i + index) % 6].id,
            column: i === 0 ? 0 : i * 5, row: i === 0 ? 0 : 3,
            columnSpan: i === 0 ? 32 : 10, rowSpan: i === 0 ? 18 : 13,
          }));
        });
        draft.grids.push(...retainedGrids);
        draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = true;
        draft.workbench.display.window = { left: 20, top: 40, width: 1000, height: 562.5 };
        localStorage.setItem(key, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(key); window.__motionKey = key;
        await import('/src/index.css');
        await import('/src/inscapeTokens.css');
        await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
        const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default
          : (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: assets }) }
          : { profileAddress: profile, reviewStorage: localStorage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Motion measurement' } };
        window.__motionCommits = 0; window.__motionRenderMs = 0;
        createRoot(document.getElementById('root')).render(React.createElement(React.Profiler, { id: 'motion', onRender: (_id, _phase, duration) => { window.__motionCommits++; window.__motionRenderMs += duration; } }, React.createElement(Component, props)));
      }, { visitor, heavy: Boolean(process.env.INSCAPE_MOTION_HEAVY) });
      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');

      await stage.waitFor(); await page.waitForTimeout(1200);
      const board = page.locator('.system-workflow__presentation-board');
      const track = page.locator('.system-workflow__grid-track');
      const offset = () => track.evaluate(n => new DOMMatrix(getComputedStyle(n).transform).m41);
      const toggle = async name => {
        await page.getByRole('button', { name, exact: true }).focus(); await page.keyboard.press('Enter');
        await page.getByRole('button', { name, exact: true }).waitFor({ state: 'detached' });
      };
      const lock = () => toggle('Lock Display Module composition');
      const unlock = () => toggle('Unlock Display Module composition');
      const box = await stage.boundingBox();
      const swipe = async held => {
        await page.mouse.move(box.x + box.width * .7, box.y + box.height * .5); await page.mouse.down();
        await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5, { steps: 4 });
        if (held) await page.waitForTimeout(160);
        await page.mouse.up();
      };
      // A locked Display navigates without Space; a held release retains its offset.
      await lock(); await swipe(true);
      assert.ok(await offset() < -10);
      const restingOffset = await offset();
      await unlock(); await page.waitForTimeout(50);
      assert.equal(await offset(), restingOffset, 'unlock retains the fractional camera for editing');
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
      const placement = stage.locator('[data-system-workflow-placement-id="motion-0-23"]');
      const art = await placement.boundingBox();
      await page.mouse.move(art.x + art.width * .5, art.y + art.height * .5); await page.mouse.down();
      await page.mouse.move(art.x + art.width * .5 - box.width / 16, art.y + art.height * .5, { steps: 5 }); await page.mouse.up();
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
      const selected = draft => draft.grids.find(g => g.id === 'grid:motion-0').placements.find(p => p.id === 'motion-0-23');
      assert.ok(selected(after).column < selected(before).column, 'first unlocked drag moves the layer');
      assert.equal(await offset(), restingOffset, 'layer dragging does not navigate or align');
      await page.getByRole('button', { name: 'Tools', exact: true }).click();
      await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
      const layers = page.locator('[data-shared-tool="layers"]');
      const size = layers.getByRole('spinbutton', { name: 'Width', exact: true });
      assert.equal(await size.isEnabled(), true, 'a resting offset does not lock Layers');
      await size.fill('7'); await size.press('Enter');
      assert.equal(selected(await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)))).columnSpan, 7);
      assert.equal(await offset(), restingOffset, 'Layers changes do not align the camera');
      const otherGrids = draft => draft.grids.filter(g => g.id !== 'grid:motion-0');
      assert.deepEqual(otherGrids(await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)))), otherGrids(before),
        'editing targets only the selected Grid, not its visible neighbor');
      await layers.getByRole('button', { name: 'Crop', exact: true }).click();
      const zoom = layers.getByRole('slider', { name: 'Crop zoom' });
      await zoom.fill('1.2');
      assert.equal(await offset(), restingOffset, 'crop retains the offset');
      await layers.getByRole('button', { name: 'Done', exact: true }).click();
      assert.equal(await offset(), restingOffset, 'committing crop retains the offset');
      const topLayer = layers.locator('.system-workflow__layer-row').first();
      await topLayer.locator('.system-workflow__layer-visibility').click();
      assert.equal(await placement.count(), 0, 'editor visibility works at an offset');
      await topLayer.locator('.system-workflow__layer-visibility').click();
      await placement.waitFor();
      await topLayer.locator('.system-workflow__layer-select').click();
      const output = process.env.INSCAPE_BROWSER_OUTPUT || process.env.TEMP + '/inscape-swipe-analysis';
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: output + '/layers-offset-' + width + '.png' });
      await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
      const handle = page.getByRole('button', { name: 'Resize selection from e', exact: true });
      assert.equal(await handle.isEnabled(), true, 'resting selection handles stay editable');
      const handleBox = await handle.boundingBox(), visibleArt = await placement.boundingBox();
      assert.ok(Math.abs(handleBox.x + handleBox.width / 2 - visibleArt.x - visibleArt.width) < 6,
        'selection handle follows the offset artwork');
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2); await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2 + box.width / 32, handleBox.y + handleBox.height / 2, { steps: 5 }); await page.mouse.up();
      const resized = selected(await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey))));
      assert.ok(resized.columnSpan > 7, 'resizing uses the offset Grid coordinates');
      assert.equal(resized.column, selected(after).column, 'east resize preserves the authored left edge');
      assert.equal(await offset(), restingOffset);
      await page.getByRole('button', { name: 'Tools', exact: true }).click();
      await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
      await placement.focus(); await page.keyboard.down('Space');
      await stage.dispatchEvent('pointerdown', { button: 0, pointerId: 9, clientX: box.x + box.width * .7, clientY: box.y + box.height * .5 });
      await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: x, clientY: y, bubbles: true })),
        { x: box.x + box.width * .6, y: box.y + box.height * .5 });
      await page.waitForFunction(() => document.querySelector('[data-shared-tool="layers"] input[aria-label="Width"]')?.disabled);
      assert.equal(await page.locator('[data-resize-corner="e"]').isEnabled(), false, 'active camera movement suspends resize');
      await page.waitForTimeout(160);
      await stage.dispatchEvent('pointerup', { pointerId: 9 }); await page.keyboard.up('Space');
      await page.waitForFunction(() => document.querySelector('[data-shared-tool="layers"] input[aria-label="Width"]')?.disabled === false);
      await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
      // Space navigation still works unlocked. Unlocking during a coast cancels it.
      await placement.focus(); await page.keyboard.down('Space'); await swipe(true); await page.keyboard.up('Space');
      assert.ok(await offset() < -10);
      await lock(); await swipe(false); await unlock();
      await page.waitForTimeout(50); const stoppedOffset = await offset();
      await page.waitForTimeout(350); assert.equal(await offset(), stoppedOffset, 'old momentum cannot restart after unlock');
      // Cross to another Grid, then reverse to a positive local offset. Layers
      // must follow the new selected Grid and use its scene, not the old plane.
      const currentGrid = () => stage.locator('.system-workflow__grid-plane--current').getAttribute('data-rendered-grid-id');
      const previousGrid = await currentGrid();
      const heldMove = async distance => {
        await stage.locator('[data-system-workflow-placement-id]').last().focus(); await page.keyboard.down('Space');
        const x = box.x + box.width * .5, y = box.y + box.height * .5;
        await stage.dispatchEvent('pointerdown', { button: 0, pointerId: 9, clientX: x, clientY: y });
        await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: x, clientY: y, bubbles: true })), { x: x + distance, y });
        await page.waitForTimeout(160); await stage.dispatchEvent('pointerup', { pointerId: 9 }); await page.keyboard.up('Space');
        await page.waitForTimeout(30);
      };
      await heldMove(-box.width * 1.2);
      assert.notEqual(await currentGrid(), previousGrid);
      const activeGrid = await currentGrid();
      const activePlane = stage.locator('.system-workflow__grid-plane--current');
      await heldMove(box.width * .2 - ((await activePlane.boundingBox()).x - box.x));
      assert.equal(await currentGrid(), activeGrid);
      assert.ok((await activePlane.boundingBox()).x > box.x + box.width * .19);
      const positiveOffset = await offset();
      const positiveBefore = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
      await page.getByRole('button', { name: 'Tools', exact: true }).click();
      await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
      await layers.locator('.system-workflow__layer-select').first().click();
      await layers.getByRole('spinbutton', { name: 'Height', exact: true }).fill('6');
      await layers.getByRole('spinbutton', { name: 'Height', exact: true }).press('Enter');
      const positiveAfter = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
      assert.equal(positiveAfter.grids.find(g => g.id === activeGrid).placements.at(-1).rowSpan, 6);
      assert.deepEqual(positiveAfter.grids.filter(g => g.id !== activeGrid), positiveBefore.grids.filter(g => g.id !== activeGrid));
      assert.equal(await offset(), positiveOffset);
      await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
      const drop = x => stage.evaluate((node, { x, y, assetId }) => {
        const dataTransfer = new DataTransfer(); dataTransfer.setData('application/x-inscape-asset', assetId);
        node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer }));
      }, { x, y: box.y + box.height * .5, assetId: positiveAfter.grids.find(g => g.id === activeGrid).placements[0].stableAssetId });
      await drop(box.x + box.width * .1); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem(window.__motionKey)).grids.find(g => g.id === id).placements.length, activeGrid), 24,
        'dropping on the neighboring preview does not edit the selected Grid');
      await drop(box.x + box.width * .5);
      await page.waitForFunction(id => JSON.parse(localStorage.getItem(window.__motionKey)).grids.find(g => g.id === id).placements.length === 25, activeGrid);
      const newId = await page.evaluate(id => JSON.parse(localStorage.getItem(window.__motionKey)).grids.find(g => g.id === id).placements.at(-1).id, activeGrid);
      const dropped = await stage.locator(`[data-system-workflow-placement-id="${newId}"]`).boundingBox();
      assert.ok(Math.abs(dropped.x + dropped.width / 2 - box.x - box.width * .5) < box.width / 32 * .6,
        'asset drop lands under the pointer in the translated Grid');
      assert.equal(await offset(), positiveOffset);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
