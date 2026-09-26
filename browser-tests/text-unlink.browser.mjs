import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
test('Text can unlink after its Display was deleted, reload independently, and relink', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const legacy of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route(`${origin}/__unlink__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      const mount = async () => page.evaluate(async legacy => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => x => x; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
        const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const { createArticle } = await import('/src/text/domain/article.js');
        const { createDefaultWorkbenchPresentation, createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
        const { removeWorkbenchModule } = await import('/src/systemWorkflow/removeWorkbenchModule.js');
        const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
        const profileAddress = `0x${'1'.repeat(40)}`, store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
        if (!store.getDraft().texts?.length) {
          const draft = store.getDraft(), article = { ...createArticle('Preserved story'), content: { type: 'doc', content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Beginning survives' }] }, { type: 'pageBreak' },
            { type: 'paragraph', content: [{ type: 'text', text: 'Ending survives' }] }] } };
          draft.texts = [{ id: 'text:story', article, visibility: 'PRIVATE', sceneLink: legacy
            ? { displayId: 'display:primary', gridId: draft.grids[0].id, passages: [{ gridId: 'old-grid', article: createArticle('Extra passage') }] }
            : { mode: 'sections', displayId: 'display:primary' } }];
          draft.workbench = createDefaultWorkbenchPresentation();
          draft.workbench.texts = [{ ...createTextPresentation('text:story'), window: { left: 24, top: 100, width: 380, height: 500 } }];
          if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('setup failed');
          if (!removeWorkbenchModule(store, profileAddress, 'display', { id: 'display:primary', grids: store.getDraft().grids })) throw Error('delete failed');
        }
        window.readUnlinkDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
        createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage,
          reviewAssets: [], reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Unlink review' } }));
      }, legacy);
      await page.goto(`${origin}/__unlink__`); await mount();
      await page.getByText('The linked Display was removed.', { exact: false }).waitFor();
      const before = await page.evaluate(() => window.readUnlinkDraft().texts[0]);
      await page.getByRole('button', { name: 'Unlink Text from Display', exact: true }).click();
      await page.waitForFunction(() => !window.readUnlinkDraft().texts[0].sceneLink);
      const after = await page.evaluate(() => window.readUnlinkDraft().texts);
      assert.deepEqual(after[0].article, before.article);
      assert.equal(after.length, legacy ? 2 : 1);
      if (legacy) assert.deepEqual(after[1].article, before.sceneLink.passages[0].article);
      await page.locator('[data-text-id="text:story"] .tiptap').waitFor();
      await page.screenshot({ path: `.browser-test-runtime/text-unlinked-${legacy}.png` });
      await page.reload(); await mount();
      await page.locator('[data-text-id="text:story"] .tiptap').waitFor();
      assert.deepEqual(await page.evaluate(() => window.readUnlinkDraft().texts), after);
      assert.equal(await page.getByRole('button', { name: 'Unlink Text from Display', exact: true }).count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `.browser-test-runtime/text-unlinked-narrow-${legacy}.png` });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(async () => {
        const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const { addDisplayModule } = await import('/src/systemWorkflow/displayModuleSession.js');
        addDisplayModule(createSystemWorkflowDraftStore({ profileAddress: `0x${'1'.repeat(40)}`, storage: localStorage }));
      });
      await page.reload(); await mount();
      const primary = page.locator('[data-text-id="text:story"]');
      await primary.getByRole('combobox', { name: 'Follow Display', exact: true }).selectOption('display:primary');
      await primary.getByRole('button', { name: 'Link Text to Display', exact: true }).click();
      await page.waitForFunction(() => window.readUnlinkDraft().texts[0].sceneLink?.displayId === 'display:primary');
      await primary.getByRole('button', { name: 'Unlink Text from Display', exact: true }).click();
      await page.waitForFunction(() => !window.readUnlinkDraft().texts[0].sceneLink);
      assert.deepEqual(await page.evaluate(() => window.readUnlinkDraft().texts[0].article), before.article);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
