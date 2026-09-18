import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5183';
test('Display text belongs to the Grid, saves and matches Visitor at wide and narrow widths', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__display_text__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = () => page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createSystemWorkflowAuthoringSession } = await import('/src/systemWorkflow/systemWorkflowAuthoringSession.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
      if (!localStorage.getItem('display-text-initialized')) {
        const session = createSystemWorkflowAuthoringSession({ store });
        session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[6].id,
          destination: { column: 0, row: 0, columnSpan: 32, rowSpan: 18 } });
        session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id,
          destination: { column: 18, row: 5, columnSpan: 10, rowSpan: 10 } });
        session.createGrid();
        const seeded = store.getDraft();
        seeded.grids.find(grid => grid.id === session.getState().selectedGridId).visibility = 'PUBLIC';
        store.commitCompletedOperation(seeded, { expectedGeneration: store.getGeneration() });
        localStorage.setItem('display-text-initialized', 'true');
      }
      window.readDisplayDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
      window.buildDisplayDocument = async () => {
        const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
        return buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: window.readDisplayDraft(), assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS });
      };
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      window.reviewRoot = createRoot(document.getElementById('root'));
      window.reviewRoot.render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Display text review' } }));
    });
    await page.goto(`${origin}/__display_text__`); await mount();
    await page.getByRole('button', { name: 'Layers', exact: true }).waitFor();
    if (!await page.getByRole('button', { name: 'Add text', exact: true }).isVisible()) await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) await unlock.click();
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text' }).fill('//ARRIVAL');
    await page.getByRole('spinbutton', { name: 'Text size' }).fill('76');
    await page.getByRole('button', { name: 'Align center', exact: true }).click();
    await page.getByRole('button', { name: 'Align left', exact: true }).click();
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const text = page.locator('.system-workflow__grid-plane--current .display-text-content');
    assert.equal(await text.innerText(), '//ARRIVAL');
    assert.equal(await page.getByRole('button', { name: 'Crop', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Frame and mat', exact: true }).isDisabled(), true);
    const placement = text.locator('..'); await placement.focus();
    const before = await placement.boundingBox(); await page.keyboard.press('ArrowRight');
    assert.ok((await placement.boundingBox()).x > before.x, 'text moves through the existing selection workflow');
    await page.keyboard.press('Control+z');
    assert.ok(Math.abs((await placement.boundingBox()).x - before.x) < 1, 'movement can be undone');
    await page.mouse.move(before.x + 25, before.y + 25); await page.mouse.down();
    await page.mouse.move(before.x + 85, before.y + 55, { steps: 5 }); await page.mouse.up();
    assert.ok((await placement.boundingBox()).x > before.x, 'text can be dragged on Stage');
    await placement.focus(); await page.keyboard.press('Control+z');
    const handle = await page.getByRole('button', { name: 'Resize selection from se' }).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + 90, handle.y + 40, { steps: 5 }); await page.mouse.up();
    assert.ok((await placement.boundingBox()).width > before.width, 'text box uses the existing resize gesture');
    await placement.focus(); await page.keyboard.press('Control+z');
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(await text.count(), 2);
    await page.locator('.system-workflow__layer-row[data-selected]').getByRole('button', { name: 'Remove //ARRIVAL from Grid', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Remove //ARRIVAL from Grid', exact: true }).getByRole('button', { name: 'Remove', exact: true }).click();
    assert.equal(await text.count(), 1);
    await text.locator('..').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.system-workflow__grid-plane--current img')].every(img => img.complete && img.naturalWidth > 0));
    await page.getByRole('button', { name: 'Hide //ARRIVAL in editor', exact: true }).click();
    assert.equal(await text.count(), 0);
    await page.getByRole('button', { name: 'Show //ARRIVAL in editor', exact: true }).click();
    assert.equal(await text.count(), 1);
    await page.reload(); await mount();
    assert.equal(await text.innerText(), '//ARRIVAL', 'saved text survives reload');
    const doc = await page.evaluate(() => window.buildDisplayDocument());
    assert.equal(doc.grids[0].placements.filter(p => p.kind === 'text').length, 1);
    await text.locator('..').click();
    for (const [name, viewport] of [['wide', { width: 1440, height: 1000 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `.browser-test-runtime/display-text-${name}.png` });
      assert.ok(await text.isVisible());
      assert.equal(await page.locator('main.system-workflow').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
      await page.getByRole('button', { name: 'Edit Text', exact: true }).scrollIntoViewIfNeeded();
    }
    // Mount the full Visitor with the same public document, without editor tools.
    await page.evaluate(async doc => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      window.reviewRoot.render(React.createElement(Visitor, { document: doc }));
    }, doc);
    const visitorText = page.locator('.display-text-placement .display-text-content').first();
    await visitorText.waitFor(); assert.equal(await visitorText.innerText(), '//ARRIVAL');
    await page.waitForFunction(() => [...document.querySelectorAll('.visitor-grid-renderer img')].length > 0 && [...document.querySelectorAll('.visitor-grid-renderer img')].every(img => img.complete && img.naturalWidth > 0));
    await page.waitForFunction(() => [...document.querySelectorAll('.visitor-grid-renderer img')].every(img => img.classList.contains('is-ready')));
    await page.waitForTimeout(400); // Allow decoded images and opacity transitions to reach a painted frame.
    assert.equal(await page.getByRole('button', { name: 'Add text', exact: true }).count(), 0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: '.browser-test-runtime/display-text-visitor.png' });
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    assert.equal(await page.locator('.visitor-grid-world__grid-plane--current .display-text-content').count(), 0, 'text belongs only to its authored Grid');
    await page.getByRole('button', { name: 'Previous Grid', exact: true }).click();
    await page.locator('.visitor-grid-world__grid-plane--current .display-text-content').waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
