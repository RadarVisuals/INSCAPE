import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function fixture(run) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/__crop_lifecycle__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__crop_lifecycle__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const useCrop = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowCrop.js')).default;
      const useController = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowController.js')).default;
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createSystemWorkflowAuthoringSession } = await import('/src/systemWorkflow/systemWorkflowAuthoringSession.js');
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const api = window.cropAudit = { failSave: false, placementClicks: 0 };
      const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => {
        if (api.failSave) throw new Error('Test storage unavailable'); localStorage.setItem(key, value);
      }, removeItem: key => localStorage.removeItem(key) };
      const profile = `0x${'1'.repeat(40)}`;
      const store = api.store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
      const session = createSystemWorkflowAuthoringSession({ store });
      const gridId = session.getState().selectedGridId;
      for (const column of [0, 10]) session.placeAsset({ gridId, stableAssetId: assets[0].id,
        destination: { column, row: 0, columnSpan: 8, rowSpan: 8 } });
      const asset = { ...assets[0], width: 100, height: 100, imageWidth: 100, imageHeight: 100 };
      const assetsById = new Map([[asset.id, asset]]);
      const root = createRoot(document.getElementById('root')); api.unmount = () => root.unmount();
      function App() {
        const controller = useController(profile, { sharedStore: store });
        const [media, setMedia] = React.useState(assetsById); api.setMedia = setMedia;
        const crop = useCrop({ assetsById: media, controller });
        api.controller = controller; api.crop = crop;
        return React.createElement('div', null,
          controller.selectedGrid.placements.map((placement, index) => React.createElement('div', {
            key: placement.id, 'data-system-workflow-placement-id': placement.id,
            'data-system-workflow-crop-surface': crop.cropSession?.placementId === placement.id || undefined,
            onPointerDown: event => crop.beginCropDrag(event, placement.id, 10),
            onClick: () => { api.placementClicks += 1; },
            style: { width: 80, height: 80, background: index ? 'grey' : 'green', margin: 20 },
          })),
          React.createElement('div', { className: 'system-workflow__crop-controls' },
            React.createElement('button', { onClick: crop.applyCrop }, 'Done'),
            React.createElement('button', { onClick: crop.restoreNativeFit }, 'Native fit')),
          controller.error && React.createElement('p', { role: 'alert' }, controller.error));
      }
      root.render(React.createElement(App));
    });
    await page.waitForFunction(() => cropAudit.crop);
    await page.evaluate(() => cropAudit.crop.beginCrop(cropAudit.controller.selectedGrid.placements[0])); await settle(page);
    await page.evaluate(() => cropAudit.crop.updateCropZoom(2)); await settle(page);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
const snapshot = page => page.evaluate(() => cropAudit.crop.cropSession);
async function beginPan(page) {
  await page.evaluate(() => cropAudit.crop.beginCropDrag({ button: 0, pointerId: 9, clientX: 40, clientY: 40,
    preventDefault() {}, stopPropagation() {} }, cropAudit.crop.cropSession.placementId, 10));
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, pointerType: 'mouse', buttons: 1, clientX: 65, clientY: 40 })));
  await settle(page);
}

test('failed crop save retains its preview, retries once and remains undoable', () => fixture(async page => {
  const before = await page.evaluate(() => cropAudit.store.getDraft());
  const preview = await snapshot(page);
  await page.evaluate(() => { cropAudit.failSave = true; cropAudit.crop.applyCrop(); }); await settle(page);
  assert.deepEqual(await snapshot(page), preview);
  assert.equal(await page.evaluate(() => cropAudit.placementClicks), 0);
  assert.deepEqual(await page.evaluate(() => cropAudit.store.getDraft()), before);
  assert.ok(await page.getByRole('alert').count());
  await page.evaluate(() => { cropAudit.failSave = false; cropAudit.crop.applyCrop(); }); await settle(page);
  assert.equal(await snapshot(page), null);
  const after = await page.evaluate(() => cropAudit.store.getDraft());
  assert.deepEqual(after.grids[0].placements[0].crop, preview.previewCrop);
  await page.evaluate(() => cropAudit.store.undo()); await settle(page);
  assert.deepEqual(await page.evaluate(() => cropAudit.store.getDraft()), before);
}));

test('failed outside-click crop save cannot retarget and discard the preview', () => fixture(async page => {
  const preview = await snapshot(page);
  await page.evaluate(() => { cropAudit.failSave = true; });
  await page.locator('[data-system-workflow-placement-id]').nth(1).click(); await settle(page);
  assert.deepEqual(await snapshot(page), preview);
  assert.equal(await page.evaluate(() => cropAudit.placementClicks), 0);
  await page.evaluate(() => { cropAudit.failSave = false; });
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await settle(page);
  assert.equal(await snapshot(page), null);
}));

test('failed crop exit also consumes the same gesture click retargeted to a parent', () => fixture(async page => {
  const preview = await snapshot(page);
  await page.evaluate(() => {
    cropAudit.failSave = true;
    const placement = document.querySelectorAll('[data-system-workflow-placement-id]')[1];
    const child = document.createElement('span'); placement.append(child);
    child.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 4 }));
    placement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }); await settle(page);
  assert.deepEqual(await snapshot(page), preview);
  assert.equal(await page.evaluate(() => cropAudit.placementClicks), 0);
}));

for (const ending of ['pointercancel', 'blur', 'released mouse', 'hidden document']) test(`crop pan restores its starting preview on ${ending} and ignores late movement`, () => fixture(async page => {
  const before = await snapshot(page);
  await beginPan(page);
  assert.notDeepEqual((await snapshot(page)).previewCrop, before.previewCrop);
  await page.evaluate(ending => {
    if (ending === 'blur') dispatchEvent(new Event('blur'));
    else if (ending === 'hidden document') {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    }
    else dispatchEvent(new PointerEvent(ending === 'released mouse' ? 'pointermove' : 'pointercancel', {
      pointerId: 9, pointerType: 'mouse', buttons: 0, clientX: 75, clientY: 40,
    }));
  }, ending); await settle(page);
  assert.deepEqual(await snapshot(page), before);
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, pointerType: 'mouse', buttons: 1, clientX: 90, clientY: 40 }))); await settle(page);
  assert.deepEqual(await snapshot(page), before);
}));

test('completed crop pan retains its adjustment and Native fit no-op closes cleanly', () => fixture(async page => {
  const start = await snapshot(page);
  await beginPan(page);
  const moved = await snapshot(page);
  assert.notDeepEqual(moved.previewCrop, start.previewCrop);
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, buttons: 0 }))); await settle(page);
  assert.deepEqual(await snapshot(page), moved);
  await page.evaluate(() => cropAudit.crop.applyCrop()); await settle(page);
  assert.deepEqual(await page.evaluate(() => cropAudit.store.getDraft().grids[0].placements[0].crop), moved.previewCrop);
  await page.evaluate(() => cropAudit.crop.beginCrop(cropAudit.controller.selectedGrid.placements[0])); await settle(page);
  await page.evaluate(() => cropAudit.crop.restoreNativeFit()); await settle(page);
  assert.equal(await snapshot(page), null);
  const generation = await page.evaluate(() => cropAudit.store.getGeneration());
  await page.evaluate(() => cropAudit.crop.beginCrop(cropAudit.controller.selectedGrid.placements[0])); await settle(page);
  await page.evaluate(() => cropAudit.crop.restoreNativeFit()); await settle(page);
  assert.equal(await snapshot(page), null);
  assert.equal(await page.evaluate(() => cropAudit.store.getGeneration()), generation);
}));

test('stale placement changes end a retained failed crop instead of overwriting newer content', () => fixture(async page => {
  await page.evaluate(() => { cropAudit.failSave = true; cropAudit.crop.applyCrop(); }); await settle(page);
  assert.ok(await snapshot(page));
  await page.evaluate(() => {
    cropAudit.failSave = false;
    const draft = cropAudit.store.getDraft();
    draft.grids[0].placements[0].crop = { x: .5, y: .5, zoom: 3 };
    cropAudit.store.commitCompletedOperation(draft, { expectedGeneration: cropAudit.store.getGeneration() });
  }); await settle(page);
  assert.equal(await snapshot(page), null);
  await page.evaluate(() => cropAudit.crop.applyCrop());
  assert.equal(await page.evaluate(() => cropAudit.store.getDraft().grids[0].placements[0].crop.zoom), 3);
}));

test('changed source dimensions invalidate the pending crop before retry', () => fixture(async page => {
  await page.evaluate(() => { cropAudit.failSave = true; cropAudit.crop.applyCrop(); }); await settle(page);
  assert.ok(await snapshot(page));
  await page.evaluate(() => cropAudit.setMedia(current => new Map([...current].map(([id, asset]) => [id,
    { ...asset, width: 200, imageWidth: 200 }])))); await settle(page);
  assert.equal(await snapshot(page), null);
}));
