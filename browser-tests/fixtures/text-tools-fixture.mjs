export async function mountTextToolsFixture(page, origin) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
  });
  await page.route(`${origin}/__text_tools__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__text_tools__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { addTextModule } = await import('/src/text/textSession.js');
    const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const { saveWorkbenchPreferences } = await import('/src/public/ownerSystemWorkflow/workbenchPreferences.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, key = systemWorkflowDraftKey(profileAddress);
    const seed = fixture.createOwnerSystemWorkflowReviewStorage();
    const storage = { getItem: name => localStorage.getItem(name) || seed.getItem(name), setItem: (name, value) => {
      if (name === key && window.failSave) throw Error('storage full'); localStorage.setItem(name, value);
    } };
    const store = createSystemWorkflowDraftStore({ profileAddress, storage });
    if (!store.getDraft().texts?.length) {
      const id = addTextModule(store, profileAddress), draft = store.getDraft();
      draft.texts[0].article.title = 'Titel kan rechtstreeks';
      draft.texts[0].article.content.content[0].content = [{ type: 'text', text: 'Vanaf hier kan je beginnen typen.' }];
      const workbench = createDefaultWorkbenchPresentation();
      workbench.display.window = { left: 880, top: 160, width: 450, height: 253.125 };
      workbench.texts = [{ id, open: true, window: { left: 64, top: 120, width: 360, height: 540 } }];
      if (!store.commitCompletedOperation({ ...draft, workbench }, { expectedGeneration: store.getGeneration(), historyLabel: 'Seed Text review' })) throw Error('Text fixture did not save');
      saveWorkbenchPreferences(profileAddress, { surfaceId: 'graphite', gridMode: 'DOTS' }, storage);
    }
    window.readDraft = () => store.getDraft();
    window.savedDraft = () => JSON.parse(storage.getItem(key));
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: storage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
      reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Text tools review' } }));
  });
  await page.locator('.text-tools-window').waitFor();
  await page.getByRole('textbox', { name: 'Article text', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}
