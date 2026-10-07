import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5189';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Display subscriptions ignore sibling content while following own edits, visibility, undo and navigation', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__display_isolation__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__display_isolation__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const useController = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowController.js')).default;
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addDisplayModule, createDisplayModuleSession, setDisplayModuleVisibility } = await import('/src/systemWorkflow/displayModuleSession.js');
      const { addShape, editShape } = await import('/src/shapes/shapeSession.js');
      const profile = `0x${'1'.repeat(40)}`, records = new Map();
      const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
      const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
      const sibling = addDisplayModule(store);
      addShape(store, profile);
      const renders = {}, controllers = {};
      function Display({ id }) {
        const controller = useController(profile, { sharedStore: store, moduleId: id });
        controllers[id] = controller; renders[id] = (renders[id] || 0) + 1;
        return React.createElement('output', { 'data-display': id }, JSON.stringify({
          title: controller.selectedGrid.title, grid: controller.selectedGridId,
          count: controller.draft.grids.length, visibility: controller.visibility,
        }));
      }
      window.isolation = { sibling, renders, controllers, store,
        editShape: () => editShape(store, profile, store.getSnapshot().shapes[0], { color: '#abcdef' }),
        addGrid: () => createDisplayModuleSession(store, sibling).createGrid(),
        publishChoice: () => setDisplayModuleVisibility(store, profile, sibling, 'PRIVATE', 'PUBLIC'),
      };
      createRoot(document.getElementById('root')).render(React.createElement(React.Fragment, null,
        React.createElement(Display, { id: 'display:primary' }), React.createElement(Display, { id: sibling })));
    });
    await page.locator('output').nth(1).waitFor();
    await settle(page);
    const counts = () => page.evaluate(() => ({ ...window.isolation.renders }));
    const sibling = await page.evaluate(() => window.isolation.sibling);
    const readSibling = async () => JSON.parse(await page.locator(`output[data-display="${sibling}"]`).innerText());
    const initial = await counts();
    await page.evaluate(() => window.isolation.editShape());
    await settle(page);
    assert.deepEqual(await counts(), initial, 'Shape edits must not render either Display controller');

    const originalCount = (await readSibling()).count;
    await page.evaluate(() => window.isolation.addGrid());
    await settle(page);
    assert.equal((await counts())['display:primary'], initial['display:primary']);
    assert.ok((await counts())[sibling] > initial[sibling]);
    assert.equal((await readSibling()).count, originalCount + 1);
    await page.evaluate(() => window.isolation.store.undo());
    await settle(page);
    assert.equal((await readSibling()).count, originalCount);

    await page.evaluate(() => window.isolation.publishChoice());
    await settle(page);
    assert.equal((await readSibling()).visibility, 'PUBLIC', 'publication inclusion is observed separately from composition content');
    await page.evaluate(() => window.isolation.store.undo());
    await settle(page);
    assert.equal((await readSibling()).visibility, 'PRIVATE');
    assert.equal((await counts())['display:primary'], initial['display:primary']);

    const target = await page.evaluate(() => {
      const controller = window.isolation.controllers['display:primary'];
      const id = controller.draft.grids.at(-1).id;
      controller.changeGrid(id);
      return id;
    });
    await settle(page);
    assert.equal(JSON.parse(await page.locator('output[data-display="display:primary"]').innerText()).grid, target);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
