// Filled, layered Display scenes and independent Images shared by motion tests.
export async function mountGridMotionFixture(page, { origin, visitor = false, heavy = false, count = 4, displayWidth = 1000, grain }) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  await page.route(`${origin}/__motion__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__motion__`);
  await page.evaluate(async ({ visitor, heavy, count, displayWidth, grain }) => {
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
    const assets = heavy ? fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS : fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: 'https://motion.invalid/motion-artwork.png', originalImageUrl: 'https://motion.invalid/motion-artwork.png', thumbnailUrl: 'https://motion.invalid/motion-artwork.png', previewSrc: 'https://motion.invalid/motion-artwork.png', src: 'https://motion.invalid/motion-artwork.png' }));
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
    draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = true;
    draft.workbench.display.window = { left: 20, top: 40, width: displayWidth, height: displayWidth * 9 / 16 };
    const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const imageAsset = buildProfileDocumentV9Asset({ ...assets[0], width: 1024, height: 1024 }, assets[0].id);
    draft.imageModules = Array.from({ length: 7 }, (_, index) => ({
      id: `image:motion-${index}`, name: 'Motion companion', width: 120, height: 96, visibility: 'PUBLIC',
      sides: [0, 1].map(side => ({ id: `side:motion-${side}`, asset: imageAsset, crop: { x: .5, y: .5, zoom: 1 },
        transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } })),
    }));
    draft.workbench.imageModules = draft.imageModules.map((image, index) => ({
      id: image.id, open: true, position: { left: 20 + index * 130, top: 780 },
    }));
    localStorage.setItem(key, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(key); window.__motionKey = key;
    await import('/src/index.css');
    await import('/src/inscapeTokens.css');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default
      : (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: assets }) }
      : { profileAddress: profile, reviewStorage: localStorage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Motion measurement' } };
    window.__motionCommits = 0; window.__motionRenderMs = 0;
    createRoot(document.getElementById('root')).render(React.createElement(React.Profiler, { id: 'motion', onRender: (_id, _phase, duration) => { window.__motionCommits++; window.__motionRenderMs += duration; } }, React.createElement(Component, props)));
  }, { visitor, heavy, count, displayWidth, grain });
}
