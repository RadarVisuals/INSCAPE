export async function mountTextToolsFixture(page, origin, { visitor = false, textCount = 1, surfaces = false, displayTextCount = 0, beforeImports } = {}) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ path: `public/${path}` });
  });
  await page.route(`${origin}/__text_tools__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__text_tools__`);
  await beforeImports?.();
  await page.evaluate(async ({ visitor, textCount, surfaces, displayTextCount }) => {
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
      for (let index = 1; index < textCount; index++) {
        const extraId = addTextModule(store, profileAddress), next = store.getDraft();
        const text = next.texts.find(item => item.id === extraId);
        text.article.title = `Article ${index + 1}`;
        text.article.content.content[0].content = [{ type: 'text', text: `Body ${index + 1}` }];
        next.workbench.texts.push({ id: extraId, open: true, window: { left: 460, top: 120 + (index - 1) * 80, width: 360, height: 540 } });
        if (!store.commitCompletedOperation(next, { expectedGeneration: store.getGeneration(), historyLabel: 'Seed another Text' })) throw Error('Extra Text fixture did not save');
      }
      if (surfaces) {
        const { addImageModule } = await import('/src/imageModule/imageModuleSession.js');
        const { addShape } = await import('/src/shapes/shapeSession.js');
        const imageId = addImageModule(store, profileAddress), next = store.getDraft();
        next.imageModules[0].width = 240; next.imageModules[0].height = 220;
        next.workbench.imageModules = [{ id: imageId, open: true, position: { left: 520, top: 740 } }];
        if (!store.commitCompletedOperation(next, { expectedGeneration: store.getGeneration(), historyLabel: 'Seed Image' })) throw Error('Image fixture did not save');
        addShape(store, profileAddress, { position: { left: 920, top: 660 } });
      }
      if (displayTextCount) {
        const { createSystemWorkflowAuthoringSession } = await import('/src/systemWorkflow/systemWorkflowAuthoringSession.js');
        const { addArticleToDisplay } = await import('/src/text/textTransfer.js');
        const session = createSystemWorkflowAuthoringSession({ store }), gridId = session.getState().selectedGridId;
        for (let index = 0; index < displayTextCount; index++) {
          const id = addArticleToDisplay(store, profileAddress, { gridId }), next = store.getDraft();
          const placement = next.grids.find(grid => grid.id === gridId).placements.find(item => item.id === id);
          placement.column = 1 + index * 16; placement.row = 1; placement.columnSpan = 12; placement.rowSpan = 10;
          placement.text.article.title = `Display article ${index + 1}`;
          if (!store.commitCompletedOperation(next, { expectedGeneration: store.getGeneration(), historyLabel: 'Seed Display Text' })) throw Error('Display Text fixture did not save');
        }
      }
    }
    window.readDraft = () => store.getDraft();
    window.savedDraft = () => JSON.parse(storage.getItem(key));
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    if (visitor) {
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const draft = store.getDraft(); draft.texts.forEach(text => { text.visibility = 'PUBLIC'; });
      createRoot(document.getElementById('root')).render(React.createElement(Visitor, { document: buildProfileDocumentV9({
        profileAddress, systemWorkflowDraft: draft, assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
      }) }));
    } else createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: storage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
      reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Text tools review' } }));
  }, { visitor, textCount, surfaces, displayTextCount });
  await page.locator('.text-window').first().waitFor();
  if (await page.getByRole('button', { name: 'Read', exact: true }).count())
    await page.getByRole('textbox', { name: 'Article text', exact: true }).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
