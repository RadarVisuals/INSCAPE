import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';
test('Animation module follows selection and preserves authored motion across preview, undo, reload and Visitor', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
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
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }


    const openAnimation = async () => {
      await page.locator('main.system-workflow').dispatchEvent('contextmenu', { clientX: 20, clientY: 20 });
      await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
      await page.getByRole('menuitem', { name: 'ANIMATION MODULE', exact: true }).click();
    };
    await openAnimation();
    await page.getByRole('button', { name: 'Select MOON PURPLE', exact: true }).click();
    const module = page.locator('[data-shared-tool="animation"]');
    const artwork = page.locator('[data-system-workflow-placement-id]').first();
    const initial = await page.evaluate(() => window.readDisplayDraft());
    assert.equal(await module.getByRole('checkbox').count(), 0);
    await module.getByRole('button', { name: 'Add effect', exact: true }).click();
    await module.getByRole('button', { name: 'Add Float', exact: true }).click();
    await module.getByRole('button', { name: 'Add effect', exact: true }).click();
    assert.equal(await module.getByRole('button', { name: 'Add Float', exact: true }).count(), 0);
    await module.getByRole('button', { name: 'Add Flicker', exact: true }).click();
    await module.getByRole('button', { name: 'Float settings', exact: true }).click();
    const horizontal = module.getByRole('spinbutton', { name: 'Horizontal · canvas units', exact: true });
    await horizontal.fill('1.2'); await horizontal.press('Enter');
    const slider = module.getByRole('slider', { name: 'Float cycle · seconds slider', exact: true });
    await slider.focus(); await slider.press('ArrowRight'); await slider.press('ArrowRight');
    assert.equal(await slider.evaluate(n => document.activeElement === n), true);
    assert.equal(await module.getByRole('spinbutton', { name: 'Float cycle · seconds', exact: true }).inputValue(), '9');
    // Restore cycle so undo below still tests the amplitude operation.
    await artwork.focus(); await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
    const animated = await page.evaluate(() => window.readDisplayDraft());
    assert.equal(animated.grids[0].placements[0].animation.float.horizontal, 1.2);
    assert.equal(animated.grids[0].placements[1].animation, undefined);
    assert.equal(await artwork.evaluate(n => getComputedStyle(n).animationName), 'none');
    await module.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.equal(await artwork.evaluate(n => n.getAnimations().length), 2);
    assert.equal(await page.getByRole('button', { name: 'Resize selection from se', exact: true }).count(), 0);
    const a = await artwork.evaluate(n => getComputedStyle(n).translate);
    await page.waitForTimeout(450);
    const b = await artwork.evaluate(n => getComputedStyle(n).translate);
    assert.notEqual(a, b);
    const opacity = await artwork.evaluate(n => {
      n.getAnimations().find(animation => animation.animationName === 'inscape-flicker').currentTime = 4380;
      return Number(getComputedStyle(n).opacity);
    });
    assert.ok(Math.abs(opacity - .15) < .03);
    await artwork.evaluate(n => n.closest('.system-workflow__canvas').style.transform = 'translateX(3000px)');
    await page.waitForFunction(() => document.querySelector('.system-workflow__canvas')?.dataset.motionPaused === 'true');
    assert.match(await artwork.evaluate(n => getComputedStyle(n).animationPlayState), /paused/);
    await artwork.evaluate(n => n.closest('.system-workflow__canvas').style.transform = '');
    await page.waitForFunction(() => document.querySelector('.system-workflow__canvas')?.dataset.motionPaused === 'false');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    await module.getByRole('button', { name: 'Stop preview', exact: true }).click();
    assert.equal(await artwork.evaluate(n => getComputedStyle(n).translate), 'none');
    await artwork.focus(); await page.keyboard.press('Control+z');
    assert.equal((await page.evaluate(() => window.readDisplayDraft())).grids[0].placements[0].animation.float.horizontal, .35);
    await page.keyboard.press('Control+Shift+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    await module.getByRole('button', { name: 'Remove Float', exact: true }).click();
    assert.equal((await page.evaluate(() => window.readDisplayDraft())).grids[0].placements[0].animation.float, undefined);
    assert.equal(await module.getByRole('button', { name: 'Add effect', exact: true }).evaluate(n => document.activeElement === n), true);
    await artwork.focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    await module.getByRole('button', { name: 'Remove all effects', exact: true }).click();
    assert.equal((await page.evaluate(() => window.readDisplayDraft())).grids[0].placements[0].animation, undefined);
    await artwork.focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    // Turning the last effect off during preview must not trap the canvas.
    await module.getByRole('button', { name: 'Preview', exact: true }).click();
    await module.getByRole('checkbox', { name: 'Float', exact: true }).uncheck();
    await module.getByRole('checkbox', { name: 'Flicker', exact: true }).uncheck();
    assert.equal(await page.getByRole('button', { name: 'Resize selection from se', exact: true }).count(), 1);
    const disabledDraft = await page.evaluate(() => window.readDisplayDraft());
    assert.deepEqual(disabledDraft.grids[0].placements[0].animation.float, { ...animated.grids[0].placements[0].animation.float, enabled: false });
    assert.equal(disabledDraft.grids[0].placements[0].animation.flicker.enabled, false);
    await artwork.focus(); await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    await module.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('button', { name: 'Select ABYSSAL STUDY', exact: true }).focus(); await page.keyboard.press('Space');
    assert.equal(await module.getByRole('checkbox', { name: 'Float', exact: true }).count(), 0);
    assert.equal(await artwork.evaluate(n => n.getAnimations().length), 0);
    await page.getByRole('button', { name: 'Select MOON PURPLE', exact: true }).click();
    const shots = await mkdtemp(join(tmpdir(), 'inscape-animation-')); console.log(shots);
    await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
    await page.screenshot({ path: join(shots, 'wide.png') });
    await module.getByRole('button', { name: 'Float settings', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shots, 'narrow.png') });
    const contained = await module.evaluate(n => n.scrollWidth <= n.clientWidth + 1);
    assert.equal(contained, true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await module.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('button', { name: 'Close Animation', exact: true }).click();
    assert.equal(await artwork.evaluate(n => n.getAnimations().length), 0);
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await artwork.evaluate(n => n.getAnimations().length), 2);
    await page.reload(); await mount();
    assert.deepEqual(await page.evaluate(() => window.readDisplayDraft()), animated);
    await page.waitForFunction(() => document.querySelector('[data-system-workflow-placement-id]')?.getAnimations().length === 2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-system-workflow-placement-id]')?.getAnimations().length === 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      window.reviewRoot.render(React.createElement(Visitor, { document: await window.buildDisplayDocument() }));
    });
    const published = page.locator('figure[data-placement-motion]').first();
    await published.locator('img.is-ready').waitFor();
    assert.equal(await published.evaluate(n => n.getAnimations().length), 2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await published.evaluate(n => n.getAnimations().length), 0);
    // Disabled effects also stay off in public rendering, retaining other effects.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const document = await window.buildDisplayDocument();
      document.grids[0].placements[0].animation.float.enabled = false;
      window.reviewRoot.render(React.createElement(Visitor, { document }));
    });
    await page.waitForFunction(() => {
      const node = document.querySelector('figure[data-placement-motion]');
      return node?.getAnimations().length === 1 && node.getAnimations()[0].animationName === 'inscape-flicker';
    });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
