export async function mountFilledDisplay(page, origin, { gridCount = 3, placementsPerGrid = 32, profile = false, svg = false, visitor = false, svgBody } = {}) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  if (visitor) await page.route('https://filled.invalid/**', async route => route.fulfill({ response: await route.fetch({ url: origin + new URL(route.request().url()).pathname }) }));
  if (svg) await page.route('**/__filled_live.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: svgBody || `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <circle id="pulse" cx="320" cy="240" r="100" fill="#9dff42" fill-opacity=".78" stroke="#ffffff" stroke-width="12"/>
    <script><![CDATA[
      window.__filledSvgTicks = 0;
      window.__filledSvgInstance = Math.random();
      const circle = document.getElementById('pulse');
      function animate(now) { window.__filledSvgTicks++; circle.setAttribute('cx', String(320 + 100 * Math.sin(now / 500))); requestAnimationFrame(animate); }
      requestAnimationFrame(animate);
    ]]></script></svg>` }));
  await page.route(`${origin}/__display_filled__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__display_filled__`);
  await page.evaluate(async ({ gridCount, placementsPerGrid, profile, svg, visitor }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const key = systemWorkflowDraftKey(fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE);
    const draft = JSON.parse(fixture.createOwnerSystemWorkflowReviewStorage().getItem(key));
    const assets = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map((asset, index) => {
      const animated = svg && index === 1;
      const url = new URL(animated ? '/__filled_live.svg' : asset.src, visitor ? 'https://filled.invalid' : location.origin).href;
      return { ...asset, src: url, previewSrc: url, imageUrl: url, thumbnailUrl: url, originalImageUrl: url,
        ...(animated ? { width: 640, height: 480, imageWidth: 640, imageHeight: 480, mediaFileType: 'image/svg+xml' } : {}) };
    });
    const template = draft.grids[0], placement = template.placements[0];
    draft.grids = Array.from({ length: gridCount }, (_, scene) => ({ ...template, visibility: 'PUBLIC', id: `grid:filled-${scene}`, title: `Filled scene ${scene + 1}`,
      placements: Array.from({ length: placementsPerGrid }, (_, index) => ({ ...placement,
        id: `filled-${scene}-${index}`, stableAssetId: assets[index === 0 ? 6 : index % 6].id,
        column: index === 0 ? 0 : ((index * 5 + scene * 3) % 26) - 1,
        row: index === 0 ? 0 : ((index * 3 + scene * 2) % 12) - 1,
        columnSpan: index === 0 ? 32 : 7 + index % 4, rowSpan: index === 0 ? 18 : 7 + index % 4,
        layer: index, navigationOrder: index, crop: index === 0 ? { x: .5, y: .5, zoom: 1 } : null,
        transform: { quarterTurns: index % 8 === 0 ? 1 : 0, mirrorX: index % 3 === 0, mirrorY: false },
      })) }));
    draft.workbench = createDefaultWorkbenchPresentation();
    draft.workbench.display.window = { left: 120, top: 110, width: 960, height: 540 };
    draft.workbench.identity.open = false;
    const values = new Map([[key, JSON.stringify(draft)]]);
    const probe = window.filledDisplay = { writes: 0, commits: [], assets, initialDraft: structuredClone(draft),
      draft: () => JSON.parse(values.get(key)), read: name => values.get(name) };
    const storage = { getItem: name => values.get(name) || null, setItem: (name, value) => { values.set(name, value); if (name === key) probe.writes++; } };
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    if (visitor) draft.grids.push((await import('/src/systemWorkflow/domain/systemWorkflowDraft.js')).createEmptySystemWorkflowWorldCoverGrid());
    const runtime = visitor ? React.createElement((await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default,
      { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: draft.profileAddress, assetRecords: assets }) })
      : React.createElement(Runtime, { profileAddress: draft.profileAddress, reviewStorage: storage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Filled Display fixture' } });
    createRoot(document.getElementById('root')).render(profile ? React.createElement(React.Profiler, { id: 'Filled Display', onRender: (_id, phase, duration, baseDuration, start, commit) => {
      if (probe.recording) probe.commits.push({ phase, duration, baseDuration, start, commit });
    } }, runtime) : runtime);
  }, { gridCount, placementsPerGrid, profile, svg, visitor });
  await page.locator(visitor ? '.visitor-grid-world__viewport' : '.system-workflow__canvas').waitFor();
  if (!visitor) await page.waitForFunction(expected => document.querySelectorAll('.system-workflow__grid-plane--current [data-system-workflow-placement-id]').length === expected, placementsPerGrid);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.system-workflow__canvas img')].map(image => image.decode().catch(() => {}))); });
  if (svg) {
    await page.locator('.artwork-svg-document').first().waitFor({ state: 'attached' });
    await page.waitForFunction(() => !document.querySelector('.artwork-svg-status'));
  }
}
