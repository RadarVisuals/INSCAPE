import { undockWindow } from './fixtures/undock-window.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorOverview, editorMenu, editSelectedWork, openEditorMenu } from './fixtures/editor-menu.mjs';
import { seedPresentation } from './fixtures/overview-artwork.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5227';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.verification/owner-workspace';
const top = editorMenu;
async function settled(page) { await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' }); }

async function setGridView(page, enabled) {
  const toggle = page.getByRole('switch', { name: 'Grid view', exact: true });
  if (await toggle.isChecked() !== enabled) await toggle.click();
  await page.waitForFunction(enabled => document.querySelector('[role="switch"][aria-label="Grid view"]')?.getAttribute('aria-checked') === String(enabled), enabled);
}

test('owner frame persists, contextual actions work, and the canvas travels both ways', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1&shell=1`, { waitUntil: 'domcontentloaded' });
    try {
      await top(page).waitFor(); await page.locator('aside.text-window').waitFor();
      await page.evaluate(() => { window.originalBar = document.querySelector('.editor-menu-bar[data-document]'); window.originalSidebar = document.querySelector('[aria-label="Workspace sidebar"]'); });
      await openEditorMenu(page, 'Docs'); await page.getByRole('button', { name: 'Close Docs', exact: true }).click();
      await openEditorMenu(page, 'Backup'); await page.getByRole('button', { name: 'Close Backup', exact: true }).click();
      await editorOverview(page);
      await page.getByRole('switch', { name: 'Grid view', exact: true }).waitFor();
      await page.locator('.composition-explorer-viewport').waitFor();
      await settled(page);
      assert.deepEqual(await page.evaluate(() => ({bar: window.originalBar === document.querySelector('.editor-menu-bar[data-document]'), sidebar: window.originalSidebar === document.querySelector('[aria-label="Workspace sidebar"]')})), {bar: true, sidebar: true});
      assert.equal(await page.locator('.editor-menu-bar[data-document]').isVisible(), false);
      assert.equal(await page.locator('aside.text-window').isVisible(), false);
      assert.equal(await page.locator('.workbench-overview-navigation').count(), 0);
      assert.equal(await page.getByRole('menubar').count(), 0);
      const overview = await page.locator('.workbench-overview').boundingBox();
      const bar = await page.locator('.editor-menu-bar:visible').boundingBox();
      assert.equal(overview.y, bar.y + bar.height);
      assert.equal(overview.x, 0, 'the collapsed sidebar leaves the overview full width');
      assert.equal(overview.width, page.viewportSize().width);
      const before = await page.evaluate(() => JSON.stringify(window.savedDraft()));
      await page.keyboard.press('Control+z'); await page.keyboard.press('Delete');
      assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), before, 'browsing cannot edit the hidden document');
      await page.screenshot({ path: `${output}/list-1440.png` });
      const source = await page.locator('.composition-explorer-viewport').boundingBox();
      await editSelectedWork(page);
      await page.locator('.owner-canvas-journey[data-direction="editor"]').waitFor();
      const motion = await page.locator('.owner-canvas-journey').evaluate(node => ({ bounds: node.getBoundingClientRect().toJSON(), animations: node.getAnimations().map(animation => animation.effect.getKeyframes()) }));
      assert.ok(motion.animations.length, 'frame is animated');
      assert.ok(Math.abs(parseFloat(motion.animations[0][0].width) - source.width) < 1);
      assert.equal(motion.animations[0].at(-1).borderRadius, '0px');
      const canvasFrame = await page.locator('.workbench-canvas-content').evaluate(node => {
        const style = getComputedStyle(node);
        return Object.fromEntries(['left', 'top', 'width', 'height'].map(key => [key, parseFloat(style.getPropertyValue(`--canvas-${key}`))]));
      });
      for (const key of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(parseFloat(motion.animations[0].at(-1)[key]) - canvasFrame[key]) < 1, `the moving frame ends at the canvas ${key}`);
      await page.screenshot({ path: `${output}/expanding.png` });
      await settled(page); await page.locator('aside.text-window').waitFor();
      assert.equal(await page.evaluate(() => window.originalBar === document.querySelector('.editor-menu-bar[data-document]')), true);
      await editorOverview(page); await page.locator('.owner-canvas-journey[data-direction="overview"]').waitFor();
      await page.locator('[data-canvas-journey-target]').waitFor();
      assert.equal(await page.locator('.composition-explorer-viewport[data-canvas-journey-target] > .workbench-overview-preview').evaluate(node => getComputedStyle(node).opacity), '0', 'only the moving artwork and frame are painted');
      await settled(page);
      await page.getByRole('button', { name: 'Edit details', exact: true }).click();
      await page.getByLabel('Composition name', { exact: true }).fill('Shared workspace');
      await page.getByRole('button', { name: 'Save details', exact: true }).click();
      await page.getByRole('heading', { name: 'Shared workspace', exact: true }).waitFor();
      await setGridView(page, true);
      await page.locator('.workbench-overview-gallery').waitFor();
      await page.screenshot({ path: `${output}/grid-1440.png` });
      await page.getByRole('button', { name: 'Inscape menu', exact: true }).waitFor();
      assert.equal(await page.locator('.editor-menu-bar[data-document]').isVisible(), false);
      const immersiveCard = page.locator('[data-gallery-cycle="0"] [data-card-id="workbench:main"]');
      await immersiveCard.scrollIntoViewIfNeeded(); await immersiveCard.hover();
      await immersiveCard.getByRole('button', { name: 'Edit Shared workspace', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.owner-canvas-journey')?.getAnimations().length > 0);
      assert.equal(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.owner-canvas-journey')).zIndex) > Number(getComputedStyle(document.querySelector('.owner-works')).zIndex)), true, 'the moving canvas stays above the fading immersive overview');
      await settled(page); await editorOverview(page); await settled(page);
      await setGridView(page, false);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await editSelectedWork(page);
      await page.locator('aside.text-window').waitFor(); assert.equal(await page.locator('.owner-canvas-journey').count(), 0);
      await editorOverview(page); await settled(page);
      await setGridView(page, true);
      await page.locator('.workbench-overview-card').first().waitFor();
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.screenshot({ path: `${output}/grid-${width}.png` });
        assert.ok(await page.locator('.workbench-overview').evaluate(node => node.clientWidth > 100 && node.scrollWidth <= node.clientWidth + 1));
      }
      assert.deepEqual(errors, []);
    } catch (error) { await page.screenshot({ path: `${output}/failure.png` }); throw error; }
  } finally { await browser.close(); }
});

test('portrait margins contract while prepared docked tools stay above the artwork', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1&shell=1`);
    await page.locator('aside.text-window').waitFor();
    await seedPresentation(page, { portrait: true }); await settled(page);
    await editSelectedWork(page); await settled(page);
    await page.evaluate(async () => {
      const store = window.guardedStore(), draft = store.getDraft();
      draft.keeperDocks = [{ id: 'keeper:return', name: 'Return test', asset: draft.imageModules[0].artwork.asset,
        faces: 'right', movement: 'flip', size: 192, visibility: 'PRIVATE' }];
      draft.workbench.keeperDocks = [{ id: 'keeper:return', position: { left: 250, top: 80 } }];
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }) || !await store.whenCommitted()) throw Error('Keeper fixture save failed');
    });
    await page.reload(); await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    await openSharedTool(page, 'Layers');
    const dock = page.locator('.workbench-tool-dock').filter({ has: page.getByRole('tab', { name: 'Layers', exact: true }) });
    await undockWindow(page, dock);
    await dock.getByRole('button', { name: / window options$/ }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Dock on right', exact: true }).click();
    const keeperDockButton = page.locator('.keeper-dock-window').getByRole('button', { name: 'Keeper window options', exact: true });
    await keeperDockButton.press('Enter');
    await page.getByRole('menuitemcheckbox', { name: 'Dock on left', exact: true }).click();
    await page.evaluate(() => {
      window.leavingDock = document.querySelector('.workbench-tool-dock');
      window.leavingDockFrame = window.leavingDock.getBoundingClientRect().toJSON();
      window.leavingKeeper = document.querySelector('.keeper-dock-window');
      window.leavingKeeperFrame = window.leavingKeeper.getBoundingClientRect().toJSON();
      window.returnPreviewFrames = []; window.recordReturnPreview = true;
      const sample = () => {
        const moving = document.querySelector('.owner-canvas-journey'), preview = document.querySelector('.composition-explorer-viewport > .workbench-overview-preview');
        if (moving && preview) window.returnPreviewFrames.push(getComputedStyle(preview).opacity);
        if (window.recordReturnPreview) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await editorOverview(page);
    await page.waitForFunction(() => document.querySelector('.owner-canvas-journey')?.getAnimations().length > 0);
    const exit = await page.evaluate(() => {
      const motion = document.querySelector('.owner-canvas-journey'), overview = document.querySelector('.owner-works');
      const tools = document.querySelector('.workbench-tool-dock'), keeper = document.querySelector('.keeper-dock-window');
      const targets = [motion, overview, ...document.querySelectorAll('[data-workbench-toolbar], .workbench-tool-panel, .workbench-tool-window, .workbench-side-dock, .workbench-view-controls')];
      window.returnAnimations = targets.flatMap(node => node.getAnimations({ subtree: node === motion }));
      window.returnAnimations.forEach(animation => { animation.pause(); animation.currentTime = 100; });
      const rect = tools.getBoundingClientRect();
      return { retained: tools === window.leavingDock, inert: tools.inert, opacity: Number(getComputedStyle(tools).opacity),
        utilities: [...document.querySelectorAll('.workbench-utility-panel')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
          .map(node => ({ name: node.getAttribute('aria-label'), inert: node.inert, opacity: Number(getComputedStyle(node).opacity) })),
        keeperRetained: keeper === window.leavingKeeper && !keeper.hidden && getComputedStyle(keeper).visibility === 'visible',
        keeperStable: ['x', 'y', 'width', 'height'].every(key => keeper.getBoundingClientRect()[key] === window.leavingKeeperFrame[key]),
        before: window.leavingDockFrame, during: rect.toJSON(), overviewOpacity: Number(getComputedStyle(overview).opacity), stable: ['x', 'y', 'width', 'height'].every(key => rect[key] === window.leavingDockFrame[key]) };
    });
    assert.equal(exit.retained, true); assert.equal(exit.inert, true); assert.equal(exit.stable, true, JSON.stringify(exit));
    assert.equal(exit.keeperRetained, true); assert.equal(exit.keeperStable, true);
    assert.ok(exit.utilities.length && exit.utilities.every(node => node.inert && node.opacity > 0 && node.opacity < 1), `visible utility windows fade with the dock: ${JSON.stringify(exit.utilities)}`);
    assert.ok(exit.opacity > 0 && exit.opacity < 1, 'the actual outgoing dock fades out');
    assert.ok(exit.overviewOpacity > 0 && exit.overviewOpacity < 1, 'the overview fades in behind it');
    assert.equal(await page.locator('.composition-explorer-viewport[data-canvas-journey-target] > .workbench-overview-preview').evaluate(node => getComputedStyle(node).opacity), '0', 'the empty destination frame cannot pop in');
    const savedDuringFade = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await page.keyboard.press('Control+k'); await page.keyboard.press('Control+z'); await page.keyboard.press('Delete');
    assert.equal(await page.getByRole('textbox', { name: 'Search commands', exact: true }).count(), 0, 'outgoing toolbar shortcuts are suspended');
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), savedDuringFade);
    await page.screenshot({ path: `${output}/portrait-returning.png` });
    await page.evaluate(() => window.returnAnimations.forEach(animation => animation.play()));
    await settled(page);
    const returnPaint = await page.evaluate(() => { window.recordReturnPreview = false; return window.returnPreviewFrames; });
    assert.ok(returnPaint.length > 0); assert.ok(returnPaint.every(opacity => opacity === '0'), 'the stationary preview is hidden from the first return frame');
    const preview = page.locator('.composition-explorer-viewport');
    await preview.locator('img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
    const source = await preview.boundingBox();
    await page.screenshot({ path: `${output}/portrait-overview.png` });
    await editSelectedWork(page);
    await page.waitForFunction(() => document.querySelector('.owner-canvas-journey')?.getAnimations().length > 0);
    const sizes = await page.locator('.owner-canvas-journey').evaluate(node => {
      node.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 180; });
      const last = node.getAnimations()[0].effect.getKeyframes().at(-1);
      window.preparedTool = document.querySelector('.workbench-tool-dock');
      window.preparedNavigator = document.querySelector('.workbench-navigator');
      return { finalWidth: parseFloat(last.width), finalHeight: parseFloat(last.height), layer: Number(getComputedStyle(node).zIndex) };
    });
    assert.ok(sizes.finalWidth < source.width * .8, 'the portrait keeps its shape while the wide empty margins close');
    assert.ok(Math.abs(sizes.finalWidth / sizes.finalHeight - 962 / 1216) < .001);
    await page.waitForTimeout(180); // Let the tools' brief entrance finish while canvas motion remains paused.
    assert.equal(await dock.getAttribute('data-side-docked'), 'true');
    const tools = await dock.evaluate(node => ({ opacity: getComputedStyle(node).opacity, visibility: getComputedStyle(node).visibility, layer: Number(getComputedStyle(node).zIndex), box: node.getBoundingClientRect().toJSON() }));
    assert.equal(tools.opacity, '1'); assert.equal(tools.visibility, 'visible'); assert.ok(tools.layer > sizes.layer);
    assert.equal(await page.locator('[data-workbench-area]').evaluate(node => getComputedStyle(node).visibility), 'hidden');
    await page.screenshot({ path: `${output}/portrait-travelling.png` });
    await page.locator('.owner-canvas-journey').evaluate(node => node.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
    await settled(page);
    assert.deepEqual(await page.evaluate(() => ({ dock: window.preparedTool === document.querySelector('.workbench-tool-dock'), navigator: Boolean(window.preparedNavigator) && window.preparedNavigator === document.querySelector('.workbench-navigator') })), { dock: true, navigator: true });
    assert.deepEqual(await dock.boundingBox(), { x: tools.box.x, y: tools.box.y, width: tools.box.width, height: tools.box.height });
    await page.screenshot({ path: `${output}/portrait-editor.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('artwork travel retains cameras, handles another canvas and cancels on resize', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1&shell=1`, { waitUntil: 'domcontentloaded' });
    await top(page).waitFor(); await page.locator('aside.text-window').waitFor();
    await seedPresentation(page); await settled(page);
    try {
      const host = page.locator('.composition-explorer-viewport'); await host.waitFor();
      await host.locator('img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await host.press('ArrowRight');
      const camera = await host.evaluate(node => ({ scale: node.dataset.cameraScale, x: node.dataset.cameraX, y: node.dataset.cameraY }));
      const draft = await page.evaluate(() => JSON.stringify(window.savedDraft()));
      await page.screenshot({ path: `${output}/artwork-list.png` });
      await editSelectedWork(page);
      await page.waitForFunction(() => document.querySelector('.owner-canvas-journey')?.getAnimations().length > 0);
      await page.locator('.owner-canvas-journey').evaluate(node => {
        const animations = node.getAnimations({ subtree: true });
        animations.forEach(animation => { animation.pause(); animation.currentTime = 220; });
      });
      await page.screenshot({ path: `${output}/artwork-expanding.png` });
      assert.equal(await page.locator('.owner-canvas-journey svg image').count(), 3);
      await page.locator('.owner-canvas-journey').evaluate(node => node.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
      await settled(page);
      const editorCamera = await page.locator('main.system-workflow').evaluate(node => [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY]);
      await editorOverview(page); await settled(page);
      assert.deepEqual(await host.evaluate(node => ({ scale: node.dataset.cameraScale, x: node.dataset.cameraX, y: node.dataset.cameraY })), camera);
      assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), draft, 'camera travel never changes authored geometry');
      await editSelectedWork(page); await settled(page);
      assert.deepEqual(await page.locator('main.system-workflow').evaluate(node => [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY]), editorCamera);
      await editorOverview(page); await settled(page);
      await page.getByRole('button', { name: 'Composition actions' }).click();
      await page.getByRole('button', { name: 'New composition', exact: true }).click();
      await page.getByLabel('Composition name', { exact: true }).fill('Another canvas');
      await page.getByRole('button', { name: 'Create composition', exact: true }).click();
      await editorOverview(page); await settled(page);
      await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).click();
      await editSelectedWork(page); await settled(page);
      assert.equal(await page.evaluate(() => window.savedDraft().activeId), 'workbench:main');
      await page.locator('.image-module__canvas').first().waitFor();
      await editorOverview(page); await settled(page);
      await setGridView(page, true);
      await page.locator('.workbench-overview-gallery').waitFor();
      await page.getByRole('button', { name: 'Inscape menu' }).click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('[data-gallery-cycle="0"] [data-card-id="workbench:main"]').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('[data-gallery-cycle="0"] [data-card-id="workbench:main"] svg image'));
        await page.mouse.move(width - 5, 45);
        await page.screenshot({ path: `${output}/artwork-grid-${width}.png` });
      }
      const card = page.locator('[data-gallery-cycle="0"] [data-card-id="workbench:main"]');
      await card.scrollIntoViewIfNeeded(); await card.hover();
      await card.getByRole('button', { name: 'Edit Workbench 1', exact: true }).click();
      await page.locator('.owner-canvas-journey').waitFor();
      await page.setViewportSize({ width: 430, height: 900 });
      await settled(page);
      await top(page).waitFor();
      assert.deepEqual(errors, []);
    } catch (error) { await page.screenshot({ path: `${output}/artwork-failure.png` }); throw error; }
  } finally { await browser.close(); }
});
