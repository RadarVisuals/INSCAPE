import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
test('both Display windows remain movable and resizable after activation changes', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [1500, 760]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: width === 1500 ? 'no-preference' : 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__window_interaction__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__window_interaction__`);
    const secondId = await page.evaluate(async ({ visitor, width }) => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addDisplayModule } = await import('/src/systemWorkflow/displayModuleSession.js');
      const { createDefaultWorkbenchPresentation, createNewDisplayPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
      const id = addDisplayModule(store);
      const draft = store.getDraft(); draft.workbench = createDefaultWorkbenchPresentation();
      draft.workbench.display.open = true; draft.workbench.display.window = { left: 40, top: 80, width: 560, height: 315 };
      draft.workbench.displays = [{ ...createNewDisplayPresentation('LANDSCAPE', 1), id, open: true, window: { left: 760, top: 100, width: 560, height: 315 } }];
      draft.displays[0].visibility = 'PUBLIC';
      if (width < 1000) {
        draft.workbench.display.window = { left: 40, top: 80, width: 400, height: 225 };
        draft.workbench.displays[0].window = { left: 80, top: 480, width: 400, height: 225 };
      }
      store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      await import('/src/index.css'); await import('/src/inscapeTokens.css');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default : Runtime;
      const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({
        profileAddress, systemWorkflowDraft: store.getDraft(), assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS }) }
        : { profileAddress, reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
          reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Two Displays' } };
      createRoot(document.getElementById('root')).render(React.createElement(Component, props));
      return id;
    }, { visitor, width });
    const boards = ['display:primary', secondId].map(id => page.locator(`[data-display-instance="${id}"] > .system-workflow__workbench > .system-workflow__presentation-board`));
    await boards[1].waitFor(); await page.waitForTimeout(800);
    for (const index of [0, 1, 0, 1]) {
      const board = boards[index], other = boards[1 - index];
      const before = await board.boundingBox(), untouched = await other.boundingBox();
      const x = before.x + 100, y = before.y + 5;
      await page.mouse.move(x, y); await page.waitForTimeout(80);
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-display-instance]')?.dataset.displayInstance, { x, y }), index ? secondId : 'display:primary', 'desktop shortcuts must not intercept another Display header');
      await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(x + 35, y + 25, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
      const moved = await board.boundingBox();
      assert.ok(Math.abs(moved.x - before.x - 35) < 2, `Display ${index + 1} follows horizontal drag: ${JSON.stringify({ before, moved })}`);
      assert.ok(Math.abs(moved.y - before.y - 25) < 2, `Display ${index + 1} follows vertical drag`);
      const handle = board.getByRole('button', { name: 'Resize Display Module from se', exact: true });
      const grip = await handle.boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(grip.x + grip.width / 2 + 40, grip.y + grip.height / 2 + 22.5, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
      assert.ok((await board.boundingBox()).width > moved.width + 30, `Display ${index + 1} resizes`);
      assert.deepEqual(await other.boundingBox(), untouched, 'the other Display does not move or resize');
    }
    // Rapid movement and overshooting the screen must resize around the same
    // opposite corner, rather than pushing the whole window across the desk.
    const board = boards[1], initial = await board.boundingBox();
    const corner = await board.getByRole('button', { name: 'Resize Display Module from se', exact: true }).boundingBox();
    const pointer = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 };
    await page.mouse.move(pointer.x, pointer.y); await page.mouse.down();
    const moveResize = async (x, y) => {
      await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y, bubbles: true })), { x, y });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      return board.boundingBox();
    };
    const first = await moveResize(pointer.x + 100, pointer.y - 99);
    const second = await moveResize(pointer.x + 100, pointer.y - 101);
    assert.ok(Math.abs(first.width - second.width) <= 25, 'crossing the pointer diagonal does not flip resize direction');
    for (const delta of [3000, 12, 2000, 24]) {
      const resized = await moveResize(pointer.x + delta, pointer.y + delta);
      assert.ok(Math.abs(resized.x - initial.x) < 1 && Math.abs(resized.y - initial.y) < 1, 'opposite corner stays fixed through fast overshoot and reversal');
      assert.ok(resized.x + resized.width <= 7993 && resized.y + resized.height <= 7993, 'resized window stays in the Workbench placement area');
    }
    await page.mouse.up();
    // Workbench zoom must preserve movement and corner resizing.
    const stage = board.locator('.system-workflow__stage-viewport');
    for (let i = 0; i < 5; i++) {
      await board.dispatchEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true });
      await page.waitForTimeout(30);
    }
    const header = board.locator('header');
    await header.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press('Shift+ArrowRight');
    const resizedStart = await board.boundingBox();
    const resizeGrip = await board.getByRole('button', { name: 'Resize Display Module from se', exact: true }).boundingBox();
    const gripX = resizeGrip.x + resizeGrip.width / 2, gripY = resizeGrip.y + resizeGrip.height / 2;
    await page.mouse.move(gripX, gripY); await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(width + 1000, 2000); await page.waitForTimeout(40);
    const boundedResize = await board.boundingBox();
    assert.ok(await board.evaluate(el => parseFloat(el.style.left) + parseFloat(el.style.width) <= 7993 && parseFloat(el.style.top) + parseFloat(el.style.height) <= 7993), 'resize respects Workbench placement limits');
    await page.mouse.move(gripX - 30, gripY - 20); await page.waitForTimeout(40);
    assert.ok((await board.boundingBox()).width < resizedStart.width, 'reversing at the boundary keeps resizing responsive');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForTimeout(500);
    const startZoom = await board.boundingBox();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    for (const deltaY of [-120, 120]) await stage.dispatchEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    assert.deepEqual(await board.boundingBox(), startZoom, 'ordinary wheel does not enlarge Display');
    assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), stored, 'view input does not save geometry');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `.browser-test-runtime/display-windows-${visitor ? 'visitor' : 'owner'}-${width}.png` });
    await page.close();
    }
  } finally { await browser.close(); }
});
