import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
async function withPage(run) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__audit_repairs__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__audit_repairs__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('Settings follows the owner profile while Activity is closed', () => withPage(async page => {
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const { useSignalStore, resetSignalStoreForTests } = await import('/src/signals/state/useSignalStore.js');
    const useActivity = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowActivity.js')).default;
    const Settings = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowSettings.jsx')).default;
    const a = '0x1111111111111111111111111111111111111111', b = '0x2222222222222222222222222222222222222222';
    resetSignalStoreForTests(a, localStorage);
    const root = createRoot(document.getElementById('root'));
    function Harness({ profile }) {
      const activity = useActivity({ active: false, profileAddress: profile });
      return React.createElement(React.Fragment, null, React.createElement('output', { id: 'unread' }, activity.unreadCount),
        React.createElement(Settings, { phase: 'open', controller: { draft: { profileAddress: profile } },
          appearance: { surfaceId: 'paper', guideMode: 'NONE', guideSize: 0, guideColor: '#000000', menuSurfaceId: 'paper' },
          workbenchPreferences: { surfaceId: 'paper', gridMode: 'NONE', shortcutSnap: true, chromeNoise: false }, onClose() {}, onWorkbenchPreferencesChange() {} }));
    }
    window.switchProfile = () => root.render(React.createElement(Harness, { profile: b }));
    root.render(React.createElement(Harness, { profile: a }));
    window.signal = useSignalStore;
  });
  await page.getByRole('checkbox', { name: 'Activity notifications', exact: true }).waitFor();
  await page.evaluate(() => window.switchProfile());
  await page.waitForFunction(() => window.signal.getState().profileAddress.startsWith('0x2222'));
  await page.getByRole('checkbox', { name: 'Activity notifications', exact: true }).uncheck();
  await page.waitForFunction(() => Object.keys(localStorage).length > 0);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['os-underneath.keeper-signals.v1:0x2222222222222222222222222222222222222222']);
  assert.equal(await page.locator('#unread').innerText(), '0');
}));

test('owner startup preserves a private draft when its publication baseline is missing', () => withPage(async page => {
  // Keep the runtime beyond the reconciliation boundary inert; all storage,
  // document validation and startup reconciliation below are production code.
  await page.route('**/OwnerSystemWorkflowRuntime.jsx', route => route.fulfill({
    contentType: 'text/javascript', body: 'export default function Runtime() { return "Owner ready"; }',
  }));
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Boundary = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx')).default;
    const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    const profile = '0x1111111111111111111111111111111111111111';
    const draft = createEmptySystemWorkflowDraft(profile);
    const document = buildProfileDocumentV9({ assetRecords: [], createdAt: 1, exportedAt: 2,
      profileAddress: profile, profileIdentity: {}, revision: 1, systemWorkflowDraft: draft });
    draft.grids[0].title = 'Private unfinished work'; draft.grids[0].visibility = 'PRIVATE';
    window.savedDraftKey = systemWorkflowDraftKey(profile);
    window.savedDraftBytes = JSON.stringify(draft);
    localStorage.setItem(window.savedDraftKey, window.savedDraftBytes);
    createRoot(globalThis.document.getElementById('root')).render(React.createElement(Boundary, {
      profileAddress: profile, publishedResolution: { status: 'RESOLVED', document }, reviewStorage: localStorage,
    }));
  });
  await page.getByText('Owner ready', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem(window.savedDraftKey) === window.savedDraftBytes), true);
}));

test('a cold owner resolves persisted assets without opening Library', () => withPage(async page => {
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const hook = (await import('/src/public/useOwnerLatticeBrowser.js')).default;
    const { resetLibraryStoreForTests } = await import('/src/library/state/useLibraryStore.js');
    const { luksoCreationsRepository } = await import('/src/creations/data/luksoCreationsRepository.js');
    const profile = '0x1111111111111111111111111111111111111111';
    const id = '42:0x2222222222222222222222222222222222222222:0x01';
    window.referenceRequests = []; window.inventoryRequests = 0;
    luksoCreationsRepository.loadCreations = async function* () { window.inventoryRequests++; };
    luksoCreationsRepository.loadReferencedCreations = async function* (p, ids) {
      window.referenceRequests.push({ profile: p, ids });
      yield { assets: [{ id, stableAssetId: id, name: 'Restored artwork', imageUrl: '/fixtures/library-study.svg',
        viewedProfileIsCreator: true, creatorAttributionLevel: 'token', creators: [{ address: profile }] }], complete: true };
    };
    resetLibraryStoreForTests(profile, localStorage);
    function Harness() { const browser = hook(profile, false, [id]); return React.createElement('output', null, browser.records.map(asset => asset.name).join(',')); }
    createRoot(document.getElementById('root')).render(React.createElement(Harness));
  });
  await page.getByText('Restored artwork', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.inventoryRequests), 0);
  assert.equal(await page.evaluate(() => window.referenceRequests.length), 1);
}));

test('Preview survives a new publication with fewer Grids and resets selection', () => withPage(async page => {
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Preview = (await import('/src/profileDocument/components/ProfileDocumentV9Preview.jsx')).default;
    const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
    const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    const profile = '0x1111111111111111111111111111111111111111';
    const draft = createEmptySystemWorkflowDraft(profile, { generateId: () => 'home' });
    draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:second', title: 'Second' });
    const value = buildProfileDocumentV9({ assetRecords: [], createdAt: 1, exportedAt: 2, profileAddress: profile, profileIdentity: {}, revision: 1, systemWorkflowDraft: draft });
    const root = createRoot(document.getElementById('root'));
    window.shrink = () => root.render(React.createElement(Preview, { document: { ...value, revision: 2, grids: value.grids.slice(0, 1) } }));
    root.render(React.createElement(Preview, { document: value }));
  });
  await page.locator('.visitor-grid-world').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-active-grid-id]')?.dataset.activeGridId === 'grid:second');
  await page.evaluate(() => window.shrink());
  await page.waitForFunction(() => document.querySelector('[data-active-grid-id]')?.dataset.activeGridId === 'grid:home');
  assert.equal(await page.locator('.visitor-grid-world').evaluate(node => node === document.activeElement), true);
}));
