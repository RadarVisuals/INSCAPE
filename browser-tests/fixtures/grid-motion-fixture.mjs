// Filled, layered Display scenes and independent Images shared by motion tests.
export async function mountGridMotionFixture(page, { origin, visitor = false, heavy = false, count = 4, displayWidth = 1000, grain, edgeReview = false, seamReview = false, artwork, inspectionArtwork, textModes = false }) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  if (artwork?.body) await page.route(artwork.url, route => route.fulfill({ contentType: artwork.contentType || 'image/svg+xml', body: artwork.body }));
  await page.route(`${origin}/__motion__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__motion__`);
  await page.evaluate(async ({ visitor, heavy, count, displayWidth, grain, edgeReview, seamReview, artwork, inspectionArtwork, textModes }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const profile = `0x${'1'.repeat(40)}`, key = systemWorkflowDraftKey(profile);
    const storage = fixture.createOwnerSystemWorkflowReviewStorage();
    const draft = JSON.parse(storage.getItem(key));
    if (grain !== undefined) draft.appearance.edges = { corners: [0, 0, 0, 0], shadow: false, grain };
    let assets = heavy ? fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS : fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: 'https://motion.invalid/motion-artwork.png', originalImageUrl: 'https://motion.invalid/motion-artwork.png', thumbnailUrl: 'https://motion.invalid/motion-artwork.png', previewSrc: 'https://motion.invalid/motion-artwork.png', src: 'https://motion.invalid/motion-artwork.png' }));
    if (artwork) assets = assets.map(asset => ({ ...asset, imageUrl: artwork.url, originalImageUrl: artwork.url,
      thumbnailUrl: artwork.url, previewSrc: artwork.url, src: artwork.url,
      width: artwork.width, height: artwork.height, imageWidth: artwork.width, imageHeight: artwork.height }));
    const base = draft.grids[0], retainedGrids = draft.grids.slice(1);
    draft.grids = Array.from({ length: count }, (_, gridIndex) => ({ ...base, id: `grid:motion-${gridIndex}`, title: `Motion ${gridIndex}`, visibility: 'PUBLIC',
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
    if (edgeReview) {
      draft.appearance = { ...draft.appearance, surfaceId: 'carbon', guideMode: 'DOTS' };
      draft.grids.forEach((grid, index) => { grid.placements = index === 0 ? [] : [{ ...base.placements[0], id: `edge-${index}`,
        stableAssetId: assets[6].id, column: 0, row: 0, columnSpan: 32, rowSpan: 18 }]; });
    }
    if (seamReview) draft.grids[0].placements = (seamReview === 'single' ? [0] : [0, 1]).map(index => ({ ...base.placements[0],
      id: `seam-${index}`, stableAssetId: assets[2].id, column: seamReview === 'horizontal' ? 0 : index * 16, row: seamReview === 'horizontal' ? index * 9 : 0,
      transform: { quarterTurns: 0, mirrorX: index === 1, mirrorY: false },
      columnSpan: ['single', 'horizontal'].includes(seamReview) ? 32 : 16, rowSpan: seamReview === 'horizontal' ? 9 : 18, layer: index, navigationOrder: index, crop: { x: .5, y: .5, zoom: 1 } }));
    if (artwork?.transform) draft.grids[0].placements.forEach(placement => { placement.transform = artwork.transform; });
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
      if (inspectionArtwork.target !== 'image') draft.grids[0].placements[0].stableAssetId = inspectionAsset.id;
    }
    draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = true;
    draft.workbench.display.window = { left: 20, top: 40, width: displayWidth, height: displayWidth * 9 / 16 };
    const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const imageAsset = buildProfileDocumentV9Asset({ ...assets[0], width: artwork?.width ?? 1024, height: artwork?.height ?? 1024 }, assets[0].id);
    const inspectionImageAsset = inspectionAsset && inspectionArtwork.target !== 'display'
      ? buildProfileDocumentV9Asset(inspectionAsset, inspectionAsset.id) : imageAsset;
    draft.imageModules = Array.from({ length: 7 }, (_, index) => ({
      id: `image:motion-${index}`, name: 'Motion companion', width: 120, height: 96, visibility: 'PUBLIC',
      sides: [0, 1].map(side => ({ id: `side:motion-${side}`, asset: index === 0 ? inspectionImageAsset : imageAsset, crop: { x: .5, y: .5, zoom: 1 },
        transform: artwork?.transform || { quarterTurns: 0, mirrorX: false, mirrorY: false } })),
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
    localStorage.setItem(key, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(key); window.__motionKey = key;
    await import('/src/index.css');
    await import('/src/inscapeTokens.css');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default
      : (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: assets }) }
      : { profileAddress: profile, reviewStorage: localStorage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Motion measurement' } };
    window.__motionCommits = 0; window.__motionRenderMs = 0;
    window.__motionRoot = createRoot(document.getElementById('root'));
    window.__motionRoot.render(React.createElement(React.Profiler, { id: 'motion', onRender: (_id, _phase, duration) => { window.__motionCommits++; window.__motionRenderMs += duration; } }, React.createElement(Component, props)));
  }, { visitor, heavy, count, displayWidth, grain, edgeReview, seamReview, artwork, inspectionArtwork, textModes });
}
