// Regression coverage for the three 2026-09-21 lifecycle audit findings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5189';
test('route recovery, stale preview rejection and Display suspension share explicit lifetimes', { timeout: 90000 }, async () => {
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const shots = await mkdtemp(join(tmpdir(), 'inscape-lifecycle-'));
  console.log(`Screenshots: ${shots}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  await page.route(`${origin}/__hygiene__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__hygiene__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const useNavigation = (await import('/src/profileDiscovery/useApplicationNavigation.js')).default;
    const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { addDisplayModule, createDisplayModuleSession } = await import('/src/systemWorkflow/displayModuleSession.js');
    const { addTextModule } = await import('/src/text/textSession.js');
    const { createDefaultWorkbenchPresentation, createTextPresentation, createNewDisplayPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const profileAddress = `0x${'1'.repeat(40)}`;
    const storage = { getItem: k => localStorage.getItem(k), setItem: (k, v) => {
      if (window.failDraft && k.startsWith('inscape.system-workflow-draft')) throw Error('full');
      localStorage.setItem(k, v);
    } };
    const store = createSystemWorkflowDraftStore({ profileAddress, storage });
    const second = addDisplayModule(store);
    createDisplayModuleSession(store, 'display:primary').createGrid();
    createDisplayModuleSession(store, second).createGrid();
    addTextModule(store, profileAddress);
    const draft = store.getDraft();
    draft.texts[0].visibility = 'PUBLIC';
    draft.texts[0].article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved sentence.' }] }];
    draft.workbench = createDefaultWorkbenchPresentation();
    draft.workbench.display.window = { left: 360, top: 50, width: 480, height: 270 };
    draft.workbench.displays = [{ ...createNewDisplayPresentation('LANDSCAPE', 1), id: second, window: { left: 860, top: 50, width: 480, height: 270 } }];
    draft.workbench.texts = [{ ...createTextPresentation(draft.texts[0].id), window: { left: 20, top: 400, width: 330, height: 300 } }];
    if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Fixture save failed');
    window.second = second;
    window.readDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft();
    await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    const props = { profileAddress, reviewStorage: storage, reviewAssets: [], reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Hygiene audit' } };
    function NavigationFixture() {
      const navigation = useNavigation({ status: 'complete', ownershipVerified: true, profileAddress });
      window.visitAuditProfile = navigation.visitProfile;
      const owner = navigation.destination.kind === 'workbench';
      return owner ? React.createElement(Runtime, { ...props, onVisitProfile: navigation.visitProfile })
        : React.createElement('button', { onClick: () => navigation.visitProfile(profileAddress) }, 'Return to audit Workbench');
    }
    window.mountAudit = () => { window.root = createRoot(document.getElementById('root')); window.root.render(React.createElement(NavigationFixture)); };
    window.mountAudit();
  });
  const editor = page.getByRole('textbox', { name: 'Article text', exact: true });
  await editor.waitFor();
  const additional = page.locator(`[data-display-instance="${await page.evaluate(() => window.second)}"]`);
  const openDisplayMenu = () => additional.getByRole('article', { name: 'Display Module', exact: true })
    .click({ button: 'right', position: { x: 160, y: 80 } });
  await page.evaluate(() => { window.failDraft = true; });
  await openDisplayMenu();
  await page.getByRole('menuitem', { name: 'INCLUDE DISPLAY IN PUBLICATION', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss notification' }).filter({ hasText: 'publication choice could not be saved' }).waitFor();
  assert.equal(await page.evaluate(() => window.readDraft().displays[0].visibility), 'PRIVATE');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.evaluate(() => { window.failDraft = false; });
  // The shortcut and open Display use the same explicit inclusion action.
  await additional.locator('.system-workflow__desktop-shortcut').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'INCLUDE DISPLAY IN PUBLICATION', exact: true }).click();
  assert.equal(await page.evaluate(() => window.readDraft().displays[0].visibility), 'PUBLIC');
  await openDisplayMenu();
  await page.getByRole('menuitem', { name: 'MAKE DISPLAY PRIVATE', exact: true }).click();
  assert.equal(await page.evaluate(() => window.readDraft().displays[0].visibility), 'PRIVATE');
  await page.evaluate(() => { window.failDraft = true; });
  await editor.fill('Unsaved audit sentence.');
  await page.getByRole('button', { name: 'Retry local save', exact: true }).waitFor();
  await page.evaluate(() => window.visitAuditProfile(`0x${'2'.repeat(40)}`));
  await page.getByRole('button', { name: 'Return to audit Workbench' }).waitFor();
  assert.equal(await editor.count(), 0);
  assert.ok(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
  }), 'pending recovery protects a page leave even while its Workbench is absent');
  await page.evaluate(() => { window.failDraft = false; });
  await page.getByRole('button', { name: 'Return to audit Workbench' }).click();
  await editor.waitFor();
  assert.equal(await editor.innerText(), 'Unsaved audit sentence.');
  assert.equal(await page.locator('.system-workflow__recovery-notice').count(), 1);
  await page.getByRole('button', { name: 'Retry local save', exact: true }).click();
  assert.ok(await page.evaluate(() => JSON.stringify(window.readDraft()).includes('Unsaved audit sentence.')));
  assert.equal(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
  }), false, 'confirmed save releases the page leave guard');
  await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
  for (const id of ['display:primary', await page.evaluate(() => window.second)]) {
    const board = page.locator(`[data-display-instance="${id}"]`).getByRole('article', { name: 'Display Module', exact: true });
    await board.click({ button: 'right', position: { x: 160, y: 80 } });
    await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).click();
  }
  const owner = page.locator('main.system-workflow');
  assert.equal(await owner.locator('[aria-label="Pause Grids"]').count(), 2);
  let releasePreview;
  let markRequested;
  const requested = new Promise(resolve => { markRequested = resolve; });
  const release = new Promise(resolve => { releasePreview = resolve; });
  await page.route('**/ownerSystemWorkflowPreviewDocument.js*', async route => {
    markRequested(); await release; await route.continue();
  });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(Error('Preview import was not intercepted')), 10000))]);
  await editor.fill('Saved while preview was loading.');
  await page.screenshot({ path: join(shots, 'preview-loading-wide.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, 'preview-loading-narrow.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  releasePreview();
  await page.getByRole('button', { name: 'Dismiss notification' }).filter({ hasText: 'Your work changed while Preview was loading' }).waitFor();
  assert.equal(await page.locator('.visitor-grid-world').count(), 0, 'stale preparation cannot open');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('main.system-workflow[data-previewing]').waitFor({ state: 'attached' });
  assert.equal(await owner.locator('[aria-label="Pause Grids"]').count(), 0);
  await page.locator('.visitor-grid-world').waitFor();
  assert.equal(await page.locator('.visitor-grid-world').getByText('Saved while preview was loading.', { exact: true }).count(), 1);
  const secondId = await page.evaluate(() => window.second);
  const activeGrid = await owner.locator(`[data-display-instance="${secondId}"] [data-rendered-grid-id]:not([aria-hidden])`).getAttribute('data-rendered-grid-id');
  // One full playback interval: the hidden owner Display must remain paused.
  await page.waitForTimeout(12500);
  assert.equal(await owner.locator(`[data-display-instance="${secondId}"] [data-rendered-grid-id]:not([aria-hidden])`).getAttribute('data-rendered-grid-id'), activeGrid);
  await page.getByRole('button', { name: 'RETURN', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).waitFor();
  assert.equal(await owner.locator('[aria-label="Pause Grids"]').count(), 0);
  assert.equal(await owner.locator(`[data-display-instance="${secondId}"] [data-rendered-grid-id]:not([aria-hidden])`).getAttribute('data-rendered-grid-id'), activeGrid);
  // Normal motion must preserve its fractional camera position, not snap back.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const secondBoard = owner.locator(`[data-display-instance="${secondId}"]`).getByRole('article', { name: 'Display Module', exact: true });
  await secondBoard.click({ button: 'right', position: { x: 160, y: 80 } });
  await page.getByRole('menuitem', { name: 'PLAY GRIDS', exact: true }).click();
  const track = owner.locator(`[data-display-instance="${secondId}"] .system-workflow__grid-track`);
  await page.waitForFunction(id => {
    const element = document.querySelector(`main.system-workflow [data-display-instance="${id}"] .system-workflow__grid-track`);
    return element && Math.abs(new DOMMatrix(getComputedStyle(element).transform).m41) > 10;
  }, secondId);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('.visitor-grid-world').waitFor();
  const stopped = await track.evaluate(node => getComputedStyle(node).transform);
  await page.waitForTimeout(200);
  assert.equal(await track.evaluate(node => getComputedStyle(node).transform), stopped);
  assert.ok(await track.evaluate(node => Math.abs(new DOMMatrix(getComputedStyle(node).transform).m41) > 10));
  await page.getByRole('button', { name: 'RETURN', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).waitFor();
  assert.equal(await track.evaluate(node => getComputedStyle(node).transform), stopped);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
});

test('Preview ignores superseded, cancelled and disposed requests and can recover after failure', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await page.route(`${origin}/__preview_requests__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__preview_requests__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const usePreview = (await import('/src/public/ownerSystemWorkflow/useWorkbenchPreview.js')).default;
      const store = { getGeneration: () => 1, getProfileAddress: () => 'profile:one' };
      window.operations = {}; window.previewErrors = []; window.presentationRevision = 1;
      function Fixture() {
        const session = usePreview(store, e => window.previewErrors.push(e));
        window.beginPreview = id => {
          const revision = window.presentationRevision;
          return session.open(() => new Promise((resolve, reject) => { window.operations[id] = { resolve, reject }; }),
            () => revision === window.presentationRevision, document.querySelector('button'));
        };
        window.closePreview = session.close;
        return React.createElement('div', null,
          React.createElement('button', null, 'Preview trigger'),
          React.createElement('output', null, session.preview?.title || (session.preparing ? 'loading' : 'closed')));
      }
      window.previewRoot = createRoot(document.getElementById('root'));
      window.previewRoot.render(React.createElement(Fixture));
    });
    await page.getByRole('button').waitFor();
    await page.evaluate(() => { window.beginPreview('old'); window.beginPreview('new'); window.operations.new.resolve({ title: 'new' }); });
    await page.getByText('new', { exact: true }).waitFor();
    await page.evaluate(() => window.operations.old.resolve({ title: 'old' }));
    assert.equal(await page.locator('output').innerText(), 'new');
    await page.evaluate(() => { window.closePreview(); window.beginPreview('cancelled'); window.closePreview(); window.operations.cancelled.resolve({ title: 'cancelled' }); });
    await page.getByText('closed', { exact: true }).waitFor();
    await page.waitForFunction(() => document.activeElement?.tagName === 'BUTTON');
    await page.evaluate(() => { window.beginPreview('moved'); window.presentationRevision++; window.operations.moved.resolve({ title: 'moved' }); });
    await page.waitForFunction(() => window.previewErrors.length === 1);
    assert.match(await page.evaluate(() => window.previewErrors[0]), /work changed/);
    await page.evaluate(() => { window.beginPreview('failure'); window.operations.failure.reject(Error('Unavailable media')); });
    await page.waitForFunction(() => window.previewErrors.length === 2);
    await page.evaluate(() => { window.beginPreview('recovered'); window.operations.recovered.resolve({ title: 'recovered' }); });
    await page.getByText('recovered', { exact: true }).waitFor();
    await page.evaluate(() => { window.beginPreview('disposed'); window.previewRoot.unmount(); window.operations.disposed.reject(Error('obsolete failure')); });
    assert.equal(await page.evaluate(() => window.previewErrors.length), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
