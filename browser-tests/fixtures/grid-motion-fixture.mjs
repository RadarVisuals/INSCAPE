// Independent Image, Shape and Text layers for camera and artwork interaction tests.
export async function mountGridMotionFixture(page, { origin, visitor = false, heavy = false, shapeWidth = 1000, artwork, inspectionArtwork, textModes = false, adjoiningModules = null, workbenchGroups, privateModuleIds = [], retentionStudy = false }) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  if (artwork?.body) await page.route(artwork.url, route => route.fulfill({ contentType: artwork.contentType || 'image/svg+xml', body: artwork.body }));
  if (inspectionArtwork?.body) await page.route(inspectionArtwork.url, route => route.fulfill({ contentType: inspectionArtwork.contentType || 'image/svg+xml', body: inspectionArtwork.body }));
  await page.route(`${origin}/__motion__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__motion__`);
  await page.evaluate(async ({ visitor, heavy, shapeWidth, artwork, inspectionArtwork, textModes, adjoiningModules, workbenchGroups, privateModuleIds, retentionStudy }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const profile = `0x${'1'.repeat(40)}`, key = systemWorkflowDraftKey(profile);
    const storage = fixture.createOwnerSystemWorkflowReviewStorage();
    const draft = JSON.parse(storage.getItem(key));
    let assets = heavy ? [...fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS] : fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: 'https://motion.invalid/motion-artwork.png', originalImageUrl: 'https://motion.invalid/motion-artwork.png', thumbnailUrl: 'https://motion.invalid/motion-artwork.png', previewSrc: 'https://motion.invalid/motion-artwork.png', src: 'https://motion.invalid/motion-artwork.png' }));
    if (artwork) assets = assets.map(asset => ({ ...asset, imageUrl: artwork.url, originalImageUrl: artwork.url,
      thumbnailUrl: artwork.url, previewSrc: artwork.url, src: artwork.url,
      width: artwork.width, height: artwork.height, imageWidth: artwork.width, imageHeight: artwork.height }));
    // A comparison target can differ while the surrounding artwork stays live.
    let inspectionAsset;
    if (inspectionArtwork) {
      const inspectionId = `${assets[0].chainId}:${assets[0].contractAddress}:0x09`;
      inspectionAsset = { ...assets[0], id: inspectionId, stableAssetId: inspectionId, tokenId: '0x09',
        imageUrl: inspectionArtwork.url, originalImageUrl: inspectionArtwork.url, thumbnailUrl: inspectionArtwork.url,
        previewSrc: inspectionArtwork.url, src: inspectionArtwork.url,
        width: inspectionArtwork.width, height: inspectionArtwork.height,
        imageWidth: inspectionArtwork.width, imageHeight: inspectionArtwork.height };
      assets.push(inspectionAsset);
    }

    draft.workbench = createDefaultWorkbenchPresentation();
    draft.shapes = [{ id: 'shape:motion', name: 'Motion shape', visibility: 'PUBLIC', color: adjoiningModules ? '#ff0000' : '#343d42', opacity: 1 }];
    draft.workbench.shapes = [{ id: 'shape:motion', open: true, window: { left: 20, top: 40, width: shapeWidth, height: shapeWidth * 9 / 16 } }];
    const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const imageAsset = buildProfileDocumentV9Asset({ ...assets[0], width: artwork?.width ?? 1024, height: artwork?.height ?? 1024 }, assets[0].id);
    const inspectionImageAsset = inspectionAsset
      ? buildProfileDocumentV9Asset(inspectionAsset, inspectionAsset.id) : imageAsset;
    draft.imageModules = Array.from({ length: 7 }, (_, index) => ({
      id: `image:motion-${index}`, name: 'Motion companion', width: 120, height: 96, visibility: 'PUBLIC',
      artwork: { id: `artwork:motion-${index}`, asset: index === 0 ? inspectionImageAsset : imageAsset, crop: { x: .5, y: .5, zoom: 1 },
        transform: artwork?.transform || { quarterTurns: 0, mirrorX: false, mirrorY: false } },
    }));
    draft.workbench.imageModules = draft.imageModules.map((image, index) => ({
      id: image.id, open: true, position: { left: 20 + index * 130, top: 780 },
    }));
    if (textModes) {
      const { createArticle } = await import('/src/text/domain/article.js');
      const { createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      draft.texts = ['fit', 'overflow', 'pages'].map(mode => {
        const article = createArticle();
        article.content.content = Array.from({ length: mode === 'fit' ? 1 : 24 }, (_, i) => ({
          type: 'paragraph', content: [{ type: 'text', text: `Passage ${i + 1}. A visitor explores the Lunar Desert.` }],
        }));
        return { id: `text:${mode}`, visibility: 'PUBLIC', article, ...(mode === 'pages' ? { pagination: 'pages' } : {}) };
      });
      draft.workbench.texts = draft.texts.map((text, index) => ({ ...createTextPresentation(text.id),
        window: { left: 20 + index * 340, top: 440, width: 300, height: 240 } }));
    }
    if (adjoiningModules) {
      const edges = { corners: [0, 0, 0, 0], shadow: false, grain: 0 };
      draft.appearance = { ...draft.appearance, guideMode: 'NONE', frame: false, edges };
      draft.workbench.shapes[0].window = { left: 340.6, top: 100.7, width: 601.3, height: 601.3 * 9 / 16 };
      draft.workbench.identity.open = false;
      draft.texts = draft.texts.slice(0, 1);
      draft.texts[0].article.appearance = { ...draft.texts[0].article.appearance,
        background: '#ff0000', opacity: 1, frame: false, color: '#ffffff', edges, ...adjoiningModules.textAppearance };
      if (adjoiningModules.textTransform) draft.texts[0].article.appearance.transform = adjoiningModules.textTransform;
      draft.workbench.texts = draft.workbench.texts.slice(0, 1);
      draft.workbench.texts[0].window = { left: 100.3, top: 100.7, width: 240.3, height: 601.3 * 9 / 16 };
      draft.imageModules = draft.imageModules.slice(0, 2).map(image => ({ ...image, width: 317, height: 193 }));
      draft.workbench.imageModules = draft.workbench.imageModules.slice(0, 2);
      draft.workbench.imageModules[0].position = { left: 941.9, top: 100.7 };
      draft.workbench.imageModules[1].position = { left: 100.3, top: 100.7 + 601.3 * 9 / 16 };
    }
    if (workbenchGroups) draft.workbenchGroups = workbenchGroups;
    if (retentionStudy) {
      const original = draft.imageModules[0];
      const width = retentionStudy === 'large' ? 240 : 72, height = retentionStudy === 'large' ? 240 : 90;
      draft.imageModules = Array.from({ length: 12 }, (_, i) => ({ ...original, id: `image:retention-${i}`, name: `Moving artwork ${i + 1}`, width, height }));
      draft.workbench.imageModules = draft.imageModules.map((image, i) => ({ id: image.id, open: true,
        position: { left: 20 + i % 4 * (width + 12), top: 170 + Math.floor(i / 4) * (height + 10) } }));
      draft.workbench.identity.open = false; draft.workbench.shapes = []; draft.shapes = [];
      draft.texts = []; draft.workbench.texts = [];
    }
    for (const key of ['imageModules', 'texts', 'shapes', 'keeperDocks']) for (const item of draft[key] || [])
      if (privateModuleIds.includes(item.id)) item.visibility = 'PRIVATE';
    localStorage.setItem(key, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(key); window.__motionKey = key;
    await import('/src/index.css');
    await import('/src/inscapeTokens.css');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    if (!visitor) {
      const { acquireProfileEditor } = await import(performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/systemWorkflow/profileEditorLease.js')?.name || '/src/systemWorkflow/profileEditorLease.js');
      window.__motionEditorLease = acquireProfileEditor(profile);
      if (await window.__motionEditorLease.ready !== 'editing') throw new Error('Motion fixture could not acquire its editor');
    }
    const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default
      : (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    // Motion cases inspect and reseed these disposable bytes between mounts.
    const reviewStorage = {
      getItem: name => localStorage.getItem(name),
      setItem: (name, value) => localStorage.setItem(name, value),
      removeItem: name => localStorage.removeItem(name),
    };
    const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: assets }) }
      : { profileAddress: profile, reviewStorage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewProfile: { name: 'Motion measurement' } };
    window.__motionDocument = props.document;
    window.__motionCommits = 0; window.__motionRenderMs = 0;
    window.__motionRoot = createRoot(document.getElementById('root'));
    const render = () => window.__motionRoot.render(React.createElement(React.Profiler, { id: 'motion', onRender: (_id, _phase, duration) => { window.__motionCommits++; window.__motionRenderMs += duration; } }, React.createElement(Component, props)));
    // Owner reload checks reread storage without reseeding the fixture draft.
    window.__motionRemount = () => { window.__motionRoot.unmount(); window.__motionRoot = createRoot(document.getElementById('root')); render(); };
    render();
  }, { visitor, heavy, shapeWidth, artwork, inspectionArtwork, textModes, adjoiningModules, workbenchGroups, privateModuleIds, retentionStudy });
}
