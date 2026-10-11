import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { routeOpaqueWorkflowArtwork } from './fixtures/legacy-workflow-artwork.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime';

async function mount(page) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route =>
    route.fulfill({ path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  await routeOpaqueWorkflowArtwork(page);
  await page.route(`${origin}/__inspection_keyboard__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__inspection_keyboard__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
    const storage = fixture.createOwnerSystemWorkflowReviewStorage(), key = systemWorkflowDraftKey(profileAddress);
    window.inspectionDraft = () => storage.getItem(key); window.inspectionWrites = 0;
    addEventListener('inscape:review-storage-write', event => { if (event.detail.key === key) window.inspectionWrites++; });
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: storage,
      reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [],
      reviewProfile: { name: 'Keyboard inspection' } }));
  });
  await page.getByRole('article', { name: 'Display Module', exact: true }).waitFor();
}

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Inspection lock preserves header keyboard access (${visitor ? 'Visitor' : 'Owner'}, ${width}px)`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mount(page);
      const saved = await page.evaluate(() => window.inspectionDraft());
      if (visitor) {
        await page.getByRole('button', { name: 'Preview', exact: true }).click();
        await page.getByRole('main', { name: 'Published INSCAPE Grid visitor' }).waitFor();
      }
      const board = page.getByRole('article', { name: 'Display Module', exact: true });
      const host = visitor ? page.getByRole('main', { name: 'Published INSCAPE Grid visitor' }) : page.locator('main.system-workflow').first();
      const header = board.getByLabel(/Move Display Module:/);
      const source = visitor ? board.locator('.visitor-grid-world__grid-plane--current [data-placement-id="placement-abyssal"]')
        : board.getByRole('button', { name: /Select ABYSSAL STUDY/ });
      const original = await board.boundingBox();
      await source.focus(); await page.keyboard.press('Enter');
      const inspection = page.getByRole('group', { name: 'Artwork inspection', exact: true });
      await inspection.waitFor();
      const inspecting = await board.boundingBox();
      const camera = await host.evaluate(node => [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY]);
      await header.focus();
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift+Enter', 'Space', 'Enter']) await page.keyboard.press(key);
      assert.deepEqual(await board.boundingBox(), inspecting, 'inspection blocks header movement');
      assert.deepEqual(await host.evaluate(node => [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY]), camera);
      await page.keyboard.press('Tab');
      assert.equal(await header.evaluate(node => node === document.activeElement), false, 'Tab leaves the title instead of trapping focus');
      for (const key of ['Shift+F10', 'ContextMenu']) {
        await header.focus(); await page.keyboard.press(key);
        const menu = page.getByRole('menu', { name: visitor ? 'Display commands' : 'Display Module commands', exact: true });
        await menu.waitFor();
        await menu.getByRole('menuitem', { name: 'TOOLS', exact: true }).press('Enter');
        await page.getByRole('menuitem', { name: 'METADATA', exact: true }).press('Enter');
        const metadata = page.locator('[data-shared-tool="metadata"]');
        await metadata.waitFor();
        assert.match(await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label'), /ABYSSAL STUDY/);
        assert.equal(await inspection.isVisible(), true, 'reading Metadata keeps the same inspection open');
        if (key === 'Shift+F10') {
          await mkdir(output, { recursive: true });
          await page.screenshot({ path: join(output, `inspection-keyboard-${visitor ? 'visitor' : 'owner'}-${width}.png`) });
        }
        await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
        await metadata.waitFor({ state: 'detached' });
      }
      await header.focus(); await page.keyboard.press('Escape');
      await inspection.waitFor({ state: 'detached' });
      assert.deepEqual(await board.boundingBox(), original);
      assert.equal(await page.locator('.workbench-selection').count(), 0, 'Shift+Enter did not queue a Workbench selection while locked');
      assert.equal(await page.evaluate(() => window.inspectionDraft()), saved);
      assert.equal(await page.evaluate(() => window.inspectionWrites), 0);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
