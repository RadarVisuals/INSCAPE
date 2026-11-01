import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';

test('Owner Image Retry remains reachable beside Image settings on pointer and touch layouts', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, size] of [[1440, null], [640, null], [390, null], [390, 32]]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: width === 390 ? 1.25 : 1, reducedMotion: 'reduce', hasTouch: touch });
      page.setDefaultTimeout(6000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320, seamReview: 'single' });
      let fail = true, requests = 0;
      await page.route('https://recovery.test/failed.webp', route => { requests++; return fail
        ? route.fulfill({ status: 404, body: 'Unavailable' })
        : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }); });
      await page.evaluate(({ width, size }) => {
        const draft = JSON.parse(localStorage.getItem(window.__motionKey));
        draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
        draft.imageModules = [{ ...draft.imageModules[0], name: 'Recovery image', width: size || 320, height: size || (width === 390 ? 200 : 280),
          sides: [{ ...draft.imageModules[0].sides[0], asset: { ...draft.imageModules[0].sides[0].asset,
            media: { ...draft.imageModules[0].sides[0].asset.media, url: 'https://recovery.test/failed.webp' } } }] }];
        draft.workbench.imageModules = [{ id: draft.imageModules[0].id, open: true, position: { left: width > 900 ? 300 : 32, top: size ? 260 : 180 } }];
        localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
      }, { width, size });
      await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).waitFor();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await page.locator('.image-module__canvas').focus();
      const panel = await openSharedTool(page, 'Image');
      if (width <= 640) {
        // Park the real dock below the test artwork using its keyboard controls.
        const resize = panel.locator('.workbench-tool-panel-resize[data-edge="se"]');
        await resize.focus(); for (let i = 0; i < 10; i++) await resize.press('Shift+ArrowUp');
        const move = panel.locator('.workbench-tool-panel-grip');
        await move.focus(); for (let i = 0; i < 18; i++) await move.press('Shift+ArrowDown');
      }
      await page.getByRole('tabpanel', { name: 'Image', exact: true }).getByRole('checkbox', { name: 'Include Image in publication' }).click({ trial: true });
      const retry = page.getByRole('button', { name: 'Retry artwork', exact: true });
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/recovery-reachability-${width}-${size || 'normal'}-${touch ? 'touch' : 'pointer'}.png` });
      await retry.click({ trial: true });
      assert.equal(await retry.evaluate(node => Boolean(node.closest('.image-module__canvas') || node.parentElement.closest('button'))), false);
      const geometry = await page.locator('.image-module__window').boundingBox();
      const camera = () => page.locator('main.system-workflow').evaluate(node => [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY]);
      const beforeCamera = await camera();
      const status = await page.locator('.image-module__flip-status').boundingBox();
      const inspect = await page.locator('.image-module__window > .image-module__inspect').boundingBox();
      assert.ok(status.y + status.height <= inspect.y || inspect.y + inspect.height <= status.y, `Recovery text overlaps Inspect: ${JSON.stringify({ status, inspect })}`);
      await mkdir(output, { recursive: true });
      if (size) for (const grip of await page.locator('.image-module__window .image-module__resize').all()) await grip.click({ trial: true });
      await page.screenshot({ path: `${output}/recovery-${width}-${size || 'normal'}-${touch ? 'touch' : 'pointer'}.png` });
      const beforeRetry = requests; fail = false;
      if (touch) await retry.tap(); else await retry.click();
      await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      assert.ok(requests > beforeRetry, 'Retry makes a new media request');
      assert.deepEqual(await page.locator('.image-module__window').boundingBox(), geometry);
      assert.deepEqual(await camera(), beforeCamera, 'Retry does not focus the camera');
      assert.equal(await page.locator('.image-lift').count(), 0, 'Retry does not inspect the Image');
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'retry never rewrites authored content');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('Small and thin Image recovery clears controls at both viewport edges for owner and Visitor', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const kind of ['raster', 'svg']) for (const owner of [true, false])
      for (const [width, height] of [[32, 32], [320, 32], [32, 320]]) for (const edge of ['top', 'bottom']) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25, hasTouch: true, reducedMotion: 'reduce' });
        page.setDefaultTimeout(6000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        let failed = true, requests = 0;
        const url = `https://edge-recovery.test/artwork.${kind === 'svg' ? 'svg' : 'webp'}`;
        await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        await page.route(url, route => { requests++; return failed ? route.fulfill({ status: 404, body: 'Unavailable' })
          : kind === 'svg' ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="edge-artwork" width="100" height="100" fill="#602ccd"/></svg>' })
            : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }); });
        await page.route(`${origin}/__image_edges__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
        await page.goto(`${origin}/__image_edges__`);
        // A bounded real Image host: keep the left-side edge cases clear of
        // the ordinary Navigator and camera tools on the right.
        await page.evaluate(async ({ owner, width, height, edge, url }) => {
          const refresh = (await import('/@react-refresh')).default;
          refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
          const React = (await import('/@id/react')).default, h = React.createElement;
          const { createRoot } = (await import('/@id/react-dom/client')).default;
          const { default: ImageWorkbench } = await import('/src/imageModule/ImageWorkbench.jsx');
          const { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
          const { useWorkbenchCamera } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
          const { WorkbenchPlacement } = await import('/src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx');
          const { ContextToolbarProvider } = await import('/src/public/ownerSystemWorkflow/ContextToolbar.jsx');
          const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
          const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
          const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
          const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
          await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
          const profileAddress = `0x${'1'.repeat(40)}`, values = new Map();
          const store = createSystemWorkflowDraftStore({ profileAddress, storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
          const asset = buildProfileDocumentV9Asset(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id);
          const draft = store.getDraft();
          draft.imageModules = [{ id: 'image:edge', name: 'Edge artwork', width, height, visibility: 'PUBLIC',
            sides: ['one', 'two'].map(id => ({ id: `side:${id}`, crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, asset: { ...asset, media: { ...asset.media, url, width: 2000, height: 2000 } } })) }];
          draft.workbench = { ...createDefaultWorkbenchPresentation(), imageModules: [{ id: 'image:edge', open: true, position: { left: 32, top: edge === 'top' ? 8 : innerHeight - height - 8 } }] };
          if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Edge fixture failed to save');
          const api = window.imageRecoveryEdge = { store };
          function Scene() {
            const hostRef = React.useRef(null), view = useWorkbenchView(), camera = useWorkbenchCamera();
            const [target, setTarget] = React.useState('image:edge');
            api.state = () => ({ selection: view.selection, scale: view.scale, offset: camera.offset, draft: store.getDraft(), history: store.getHistory(), generation: store.getGeneration() });
            return h(ContextToolbarProvider, { target }, h(WorkbenchPlacement, { hostRef, enabled: false, gridEnabled: false },
              h('main', { ref: hostRef, tabIndex: -1, className: 'system-workflow', style: { position: 'fixed', inset: 0 } },
                h(WorkbenchViewControls, { hostRef }), h(ImageWorkbench, { records: draft.imageModules, presentations: draft.workbench.imageModules, store: owner ? store : null, profileAddress, onActivate: setTarget }))));
          }
          createRoot(document.getElementById('root')).render(h(WorkbenchViewProvider, { store: owner ? store : null, profileAddress, presentation: draft.workbench }, h(Scene)));
        }, { owner, width, height, edge, url });
        const retry = page.getByRole('button', { name: kind === 'svg' ? 'Artwork unavailable — retry' : 'Retry artwork', exact: true });
        await retry.waitFor(); await retry.click({ trial: true });
        const image = page.locator('.image-module__window'), status = await page.locator('.image-module__recovery-status').boundingBox();
        assert.ok(status.x >= 0 && status.y >= 0 && status.x + status.width <= 1440 && status.y + status.height <= 1000, JSON.stringify({ width, height, edge, status }));
        for (const control of await page.locator('.image-module__window > :is(.image-module__inspect,.image-module__next,.image-module__close,.image-module__resize)').all()) {
          await control.click({ trial: true });
          const box = await control.boundingBox();
          assert.ok(box.x + box.width <= status.x || status.x + status.width <= box.x || box.y + box.height <= status.y || status.y + status.height <= box.y, `Recovery overlaps an Image control: ${JSON.stringify({ box, status })}`);
        }
        const before = await page.evaluate(() => imageRecoveryEdge.state()), geometry = await image.boundingBox();
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: `${output}/edge-${kind}-${owner ? 'owner' : 'visitor'}-${width}x${height}-${edge}.png` });
        const beforeRequests = requests; failed = false; await retry.tap();
        if (kind === 'svg') await page.frameLocator('.image-module__canvas iframe').frameLocator('iframe').locator('#edge-artwork').waitFor();
        else await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
        await page.getByRole('status').filter({ hasText: /artwork/i }).waitFor({ state: 'hidden' });
        assert.ok(requests > beforeRequests);
        assert.deepEqual(await image.boundingBox(), geometry);
        assert.deepEqual(await page.evaluate(() => imageRecoveryEdge.state()), before, 'Retry preserves selection, camera, draft and history');
        assert.equal(await page.locator('.image-lift').count(), 0);
        assert.deepEqual(errors, []); await page.close();
      }
  } finally { await browser.close(); }
});
