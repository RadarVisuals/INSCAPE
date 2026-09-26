import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5183';

test('owner Display and Text windows snap to the Workbench, with free movement and keyboard access', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__workbench_snap__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__workbench_snap__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createSystemWorkflowAuthoringSession } = await import('/src/systemWorkflow/systemWorkflowAuthoringSession.js');
      const { addTextModule } = await import('/src/text/textSession.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
      const session = createSystemWorkflowAuthoringSession({ store });
      session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id,
        destination: { column: 6, row: 1, columnSpan: 16, rowSpan: 16 } });
      addTextModule(store, profileAddress);
      window.readSnapDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage,
        reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Grid snapping' } }));
    });
    await page.getByLabel('Text inner spacing', { exact: true }).selectOption('custom');
    for (const [side, value] of Object.entries({ top: 8, right: 0, bottom: 16, left: 12 })) await page.getByLabel(`Text padding ${side}`, { exact: true }).fill(String(value));
    assert.deepEqual(await page.evaluate(() => window.readSnapDraft().texts[0].article.appearance.padding), { top: 8, right: 0, bottom: 16, left: 12 });
    const paddingStyle = node => node.evaluate(el => { const s = getComputedStyle(el); return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft]; });
    assert.deepEqual(await paddingStyle(page.locator('.text-editor-page')), ['8px', '0px', '16px', '12px']);
    await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.deepEqual(await paddingStyle(page.locator('article.text-document')), ['8px', '0px', '16px', '12px']);
    await page.getByLabel('Text padding bottom', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.browser-test-runtime/text-padding-tools-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Text padding bottom', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.browser-test-runtime/text-padding-tools-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel('Text inner spacing', { exact: true }).selectOption('auto');
    assert.equal(await page.evaluate(() => window.readSnapDraft().texts[0].article.appearance.padding), undefined);
    await page.getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const before = await page.evaluate(() => window.readSnapDraft());
    const text = page.locator('.text-window');
    const textHeader = page.getByLabel('Move Text window', { exact: true });
    const position = node => node.evaluate(element => { const box = element.getBoundingClientRect(); return { left: box.left, top: box.top }; });
    const drag = async (header, dx, dy, alt = false) => {
      const b = await header.boundingBox();
      await page.mouse.move(b.x + 18, b.y + b.height / 2);
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.down(); await page.mouse.move(b.x + 18 + dx, b.y + b.height / 2 + dy, { steps: 6 }); await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    };
    const aligned = p => Math.abs(p.left % 24) < .1 && Math.abs(p.top % 24) < .1;
    await textHeader.focus(); await page.keyboard.press('ArrowRight');
    assert.ok(aligned(await position(text)), 'Text keyboard movement snaps');
    await drag(textHeader, 37, 29);
    assert.ok(aligned(await position(text)), 'Text dragging snaps');
    await drag(textHeader, 7, 7, true);
    assert.equal(aligned(await position(text)), false, 'Alt bypasses Text snapping');
    const textResize = page.getByRole('separator', { name: 'Resize Text window', exact: true });
    await textResize.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
    const edges = node => node.evaluate(el => { const b = el.getBoundingClientRect(); return { right: b.right, bottom: b.bottom }; });
    let e = await edges(text);
    assert.deepEqual(await text.locator('.text-module-body').boundingBox(), await text.boundingBox(), 'visible Text surface uses the actual snap rectangle');
    assert.ok(Math.abs(e.right % 24) < .1 && Math.abs(e.bottom % 24) < .1, 'Text resize snaps edges even from a free position');
    await page.keyboard.press('Alt+ArrowRight');
    assert.equal(Math.round((await edges(text)).right - e.right), 8, 'Alt bypasses resize snapping');
    await drag(textResize, 37, 29);
    e = await edges(text);
    assert.ok(Math.abs(e.right % 24) < .1 && Math.abs(e.bottom % 24) < .1, 'Text pointer resize snaps both moving edges');
    await page.getByRole('button', { name: 'Close Untitled article', exact: true }).click();
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const boardHeader = page.getByLabel('Move Display Module: DISPLAY MODULE', { exact: true });
    // Move into available space: the viewport inset takes priority over the grid.
    await boardHeader.focus(); await page.keyboard.press('ArrowRight');
    assert.ok(aligned(await position(board)), 'Display keyboard movement snaps');
    await drag(boardHeader, 37, 29);
    assert.ok(aligned(await position(board)), 'Display dragging snaps');
    await drag(boardHeader, 7, 7, true);
    assert.equal(aligned(await position(board)), false, 'Alt bypasses Display snapping');
    const boardResize = page.getByRole('button', { name: 'Resize Display Module from se', exact: true });
    await boardResize.focus(); await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs((await edges(board)).right % 24) < .1, 'Display resize snaps moving edge');
    await drag(boardResize, -37, -11);
    assert.ok(Math.abs((await edges(board)).right % 24) < .1, 'Display pointer resize snaps its dominant edge');
    await page.getByRole('button', { name: 'Untitled article', exact: true }).click();
    const baseline = await board.boundingBox();
    const stage = board.locator('.system-workflow__stage-viewport');
    const wheel = async deltaY => {
      await stage.dispatchEvent('wheel', { deltaY, deltaX: 0, bubbles: true, cancelable: true });
      await page.waitForTimeout(200);
    };
    await wheel(-60); await wheel(60);
    assert.deepEqual(await board.boundingBox(), baseline, 'ordinary wheel does not resize Display');
    await textHeader.focus();
    await page.getByRole('button', { name: 'Close Untitled article', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Grid snapping', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Module edge snapping', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    const unsnapped = await position(board); await drag(boardHeader, 17, 13);
    assert.deepEqual(await position(board), { left: unsnapped.left + 17, top: unsnapped.top + 13 });
    await page.getByRole('button', { name: 'Untitled article', exact: true }).click();
    await textHeader.focus(); const textBefore = await position(text); await page.keyboard.press('ArrowRight');
    assert.equal((await position(text)).left, textBefore.left + 8, 'Text respects disabled snapping');
    const after = await page.evaluate(() => window.readSnapDraft());
    assert.deepEqual(after.grids, before.grids); assert.deepEqual(after.texts, before.texts);
    for (const [name, size] of [['wide', { width: 1440, height: 1000 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(size);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Grid snapping', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.browser-test-runtime/workbench-snapping-${name}.png` });
      await page.getByRole('button', { name: 'Close Settings', exact: true }).focus();
      await page.keyboard.press('Enter');
      if (name === 'narrow') {
        await boardResize.focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
        const narrowBaseline = await board.boundingBox();
        assert.equal(await board.evaluate(el => el.closest('[data-presentation-workbench]').scrollLeft), 0, 'offscreen keyboard focus does not scroll the Workbench behind its camera');
        await wheel(-60);
        assert.equal((await board.boundingBox()).width, narrowBaseline.width, 'ordinary wheel keeps the narrow Display size');
        assert.equal((await board.boundingBox()).y, narrowBaseline.y + 60, 'ordinary wheel pans the narrow Workbench');
        await page.screenshot({ path: '.browser-test-runtime/workbench-wheel-zoom-narrow.png' });
        await wheel(60);
        assert.deepEqual(await board.boundingBox(), narrowBaseline, 'narrow viewport restores its starting rectangle');
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
