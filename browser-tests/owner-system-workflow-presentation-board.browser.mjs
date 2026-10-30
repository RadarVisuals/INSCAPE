import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { activate, openDisplayTool } from './fixtures/display-controls.mjs';
import { routeOpaqueWorkflowArtwork } from './fixtures/legacy-workflow-artwork.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR
  ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

const closeEnough = (left, right, tolerance = 0.2) => Math.abs(left - right) <= tolerance;

async function prepare(page) {
  page.setDefaultTimeout(12000);
  const origin = new globalThis.URL(URL).origin;
  await page.route('**/*', route => new globalThis.URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await routeOpaqueWorkflowArtwork(page);
}

async function revealShortcut(page, shortcut) {
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar', exact: true });
  if (await sidebar.isVisible()) {
    await page.locator('main.system-workflow').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'HIDE SIDEBAR', exact: true }).click();
    await sidebar.waitFor({ state: 'hidden' });
  }
  await shortcut.scrollIntoViewIfNeeded();
  assert.equal(await shortcut.evaluate(node => {
    const box = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), true, 'the shortcut receives native pointer hits');
}

async function capture(page, viewportName, percentage) {
  if (!SCREENSHOT_DIR) return;
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, `presentation-board-zoom-${viewportName}-${percentage}.png`) });
}



test('Display corners resize native artwork and preserve window and shortcut state', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await prepare(page); await page.goto(URL, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('slider', { name: 'Board zoom' }).count(), 0);
    const board = page.locator('.system-workflow__presentation-board'), stage = page.locator('[data-presentation-stage]');
    const nativeStage = async () => {
      const [frame, paint] = await Promise.all([board.boundingBox(), stage.boundingBox()]);
      assert.deepEqual(paint, frame, 'Display Stage has the same native paint boundary as its window');
      assert.equal(await stage.evaluate(node => getComputedStyle(node).transform), 'none', 'resize renders at native resolution');
      assert.ok(closeEnough(frame.width / frame.height, 16 / 9, .004), JSON.stringify(frame));
    };
    await nativeStage();
    const initial = await board.boundingBox();
    const placements = await page.locator('.system-workflow__placement').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    const handle = await page.getByRole('button', { name: 'Resize Display Module from se', exact: true }).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.keyboard.down('Alt'); await page.mouse.down();
    assert.deepEqual(await page.locator('.system-workflow__placement').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON())), placements,
      'taking a resize handle does not move artwork');
    await page.mouse.move(handle.x + handle.width / 2 + 1, handle.y + handle.height / 2 + 1);
    const first = await board.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2 + 2, handle.y + handle.height / 2 + 2);
    const second = await board.boundingBox();
    assert.ok(first.width > initial.width && second.width > first.width && second.width - first.width < 2, JSON.stringify({ initial, first, second }));
    await page.mouse.move(handle.x + 250, handle.y + 130, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await nativeStage(); const resized = await board.boundingBox();
    assert.ok(resized.width > initial.width + 200);
    await activate(page, board.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true })); await board.waitFor({ state: 'detached' });
    const shortcut = page.getByRole('button', { name: 'Open DISPLAY MODULE', exact: true });
    await revealShortcut(page, shortcut); await shortcut.dblclick(); await board.waitFor();
    assert.deepEqual(await board.boundingBox(), resized);
    await capture(page, 'native-resize', 1440);
    let belowBreakpoint;
    for (const width of [759, 761, 390]) {
      await page.setViewportSize({ width, height: 720 });
      await nativeStage();
      const frame = await board.boundingBox();
      if (width === 759) belowBreakpoint = frame;
      if (width === 761) {
        assert.ok(Math.abs(frame.width - belowBreakpoint.width) < 10, 'crossing the layout breakpoint preserves Display width');
        assert.ok(Math.abs(frame.x - belowBreakpoint.x) < 10, 'crossing the layout breakpoint preserves Display position');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    }
    await capture(page, 'native-resize', 390);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('contained artwork inspection preserves Display geometry and source through return', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await prepare(page); await page.goto(URL, { waitUntil: 'networkidle' });
    const board = page.locator('.system-workflow__presentation-board');
    const placement = page.locator('.system-workflow__placement[aria-label^="Select ABYSSAL STUDY"]');
    const inspection = page.getByRole('group', { name: 'Artwork inspection', exact: true });
    for (const small of [false, true]) {
      if (small) {
        const handle = await page.getByRole('button', { name: 'Resize Display Module from se', exact: true }).boundingBox();
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
        await page.mouse.move(handle.x - 500, handle.y - 280, { steps: 8 }); await page.mouse.up();
      }
      const saved = await board.boundingBox(), source = await placement.boundingBox();
      await placement.evaluate(node => { window.__presentationSource = node; });
      await page.keyboard.press('Escape');
      await placement.focus(); await page.keyboard.press('i'); await inspection.waitFor();
      await page.waitForFunction(() => document.querySelector('.system-workflow__lift-artwork')?.style.getPropertyValue('--inspection-lift-progress') === '1'
        || Number(document.querySelector('.system-workflow__artwork-plane')?.style.getPropertyValue('--inspection-lift-progress')) === 1);
      assert.deepEqual(await board.boundingBox(), saved, 'artwork Lift does not enlarge the module');
      assert.equal(await inspection.getByRole('button').count(), 1);
      assert.equal(await page.locator('.lattice-focus-viewer__rack, .lattice-focus-viewer__dossier').count(), 0);
      assert.equal(await placement.evaluate(node => node === window.__presentationSource), true);
      const lifted = await page.locator('.system-workflow__lift-artwork .lattice-production-focus-artwork__media').boundingBox();
      assert.ok(lifted.x >= saved.x - 1 && lifted.y >= saved.y - 1 && lifted.x + lifted.width <= saved.x + saved.width + 1 && lifted.y + lifted.height <= saved.y + saved.height + 1, JSON.stringify({ lifted, saved }));
      await capture(page, 'contained-inspection', small ? 'small' : 'wide');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.system-workflow__placement[data-inspection-context="selected"]')?.getAttribute('aria-label')?.includes('MOUNTAIN SIGNAL II'));
      await activate(page, page.getByRole('button', { name: 'Close artwork viewer', exact: true })); await inspection.waitFor({ state: 'detached' });
      assert.deepEqual(await board.boundingBox(), saved); assert.deepEqual(await placement.boundingBox(), source);
      assert.equal(await page.locator('[data-inspection-context]').count(), 0);
      await placement.focus(); await page.keyboard.press('i'); await inspection.waitFor();
      await page.keyboard.press('Escape'); await inspection.waitFor({ state: 'detached' });
      assert.deepEqual(await board.boundingBox(), saved, 'Escape during opening also restores the same window');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Workbench shortcut snaps, renames, and accepts a Library artwork as its icon', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await prepare(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await activate(page, page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }));
    let shortcut = page.locator('.system-workflow__desktop-shortcut');
    await revealShortcut(page, shortcut);
    const before = await shortcut.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + 10);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 51, before.y + 47, { steps: 4 });
    await page.mouse.up();
    const moved = await shortcut.boundingBox();
    assert.equal(moved.x % 24, 0);
    assert.equal(moved.y % 24, 0);

    await revealShortcut(page, shortcut);
    await shortcut.click({ button: 'right' });
    const shortcutMenu = page.getByRole('menu', { name: 'Display Module shortcut commands' });
    assert.equal(await shortcutMenu.getAttribute('data-menu-surface'),
      await page.locator('.system-workflow').getAttribute('data-menu-surface'));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'display-module-shortcut-menu-wide.png') });
    await page.getByRole('menuitem', { name: 'RENAME' }).click();
    const input = page.getByRole('textbox', { name: 'Display Module shortcut name' });
    await input.fill('CURATED NFTs');
    await input.press('Enter');
    shortcut = page.getByRole('button', { name: 'Open CURATED NFTs' });
    await shortcut.waitFor();

    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const firstAsset = page.locator('.lattice-browser-asset').first();
    await firstAsset.waitFor();
    assert.equal(await firstAsset.getAttribute('draggable'), 'true');
    await page.evaluate(() => {
      const source = document.querySelector('.lattice-browser-asset');
      const target = document.querySelector('.system-workflow__desktop-shortcut');
      const transfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    assert.equal(await shortcut.locator('.system-workflow__desktop-shortcut-icon img').count() > 0, true);
    const customIcon = shortcut.locator('.system-workflow__desktop-shortcut-icon');
    assert.deepEqual(await customIcon.evaluate((node) => {
      const rectangle = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        border: style.borderTopWidth,
        custom: node.dataset.custom,
        height: rectangle.height,
        objectFit: getComputedStyle(node.querySelector('img')).objectFit,
        width: rectangle.width,
      };
    }), { background: 'rgba(0, 0, 0, 0)', border: '0px', custom: 'true', height: 60, objectFit: 'contain', width: 60 });

    await page.getByRole('button', { name: 'Close workspace' }).click();
    await revealShortcut(page, shortcut);
    await shortcut.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'EDIT ICON' }).click();
    const iconEditor = page.getByRole('dialog', { name: 'Edit Display Module shortcut icon' });
    await iconEditor.waitFor();
    await iconEditor.getByRole('slider', { name: 'Shortcut icon size' }).fill('140');
    await iconEditor.getByRole('slider', { name: 'Shortcut icon zoom' }).fill('2');
    await iconEditor.getByRole('slider', { name: 'Shortcut icon horizontal position' }).fill('7');
    await iconEditor.getByRole('slider', { name: 'Shortcut icon vertical position' }).fill('-5');
    await iconEditor.getByRole('slider', { name: 'Shortcut label size' }).fill('11');
    assert.equal(await iconEditor.getByRole('slider', { name: 'Shortcut label size' }).getAttribute('max'), '20');
    assert.equal(await iconEditor.getByRole('slider', { name: 'Shortcut icon horizontal position' }).getAttribute('max'), '150');
    assert.equal(await iconEditor.getByRole('slider', { name: 'Shortcut icon vertical position' }).getAttribute('min'), '-150');
    assert.match(await customIcon.locator('img').first().getAttribute('style'), /translate\(7px, -5px\) scale\(2\)/);
    assert.match(await iconEditor.locator('.system-workflow__shortcut-icon-preview img').first().getAttribute('style'),
      /translate\(4\.2px, -3px\) scale\(2\)/);
    assert.deepEqual(await customIcon.evaluate((node) => {
      const rectangle = node.getBoundingClientRect();
      return { height: rectangle.height, width: rectangle.width };
    }), { height: 140, width: 140 });
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-shortcut-icon-editor-wide.png') });
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('inscape:workbench:presentation-board:'));
      const stored = key && JSON.parse(localStorage.getItem(key));
      return stored?.iconPresentation?.scale === 2 && stored.iconPresentation.size === 140
        && stored.iconPresentation.labelSize === 11
        && stored.iconPresentation.offsetX === 7 && stored.iconPresentation.offsetY === -5;
    });
    const done = iconEditor.getByRole('button', { name: 'Done', exact: true });
    assert.equal(await done.evaluate(node => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), true, 'the icon editor Done button receives real pointer hits');
    await done.click();
    await page.reload({ waitUntil: 'networkidle' });
    shortcut = page.getByRole('button', { name: 'Open CURATED NFTs' });
    await shortcut.waitFor();
    assert.match(await shortcut.locator('.system-workflow__desktop-shortcut-icon img').first().getAttribute('style'),
      /translate\(7px, -5px\) scale\(2\)/);
    assert.equal((await shortcut.locator('.system-workflow__desktop-shortcut-icon').boundingBox()).width, 140);
    await revealShortcut(page, shortcut);
    const shortcutPositionBeforeOpen = await shortcut.boundingBox();
    await shortcut.dblclick();
    const board = page.getByRole('article', { name: 'Display Module' });
    await board.waitFor();
    assert.equal(await page.locator('.system-workflow__desktop-shortcut').count(), 1,
      'the desktop shortcut remains visible while its Display Module is open');
    const boardHeader = await board.locator('.system-workflow__identity-strip').boundingBox();
    await page.mouse.move(boardHeader.x + 90, boardHeader.y + boardHeader.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardHeader.x + 190, boardHeader.y + boardHeader.height / 2 + 80, { steps: 4 });
    await page.mouse.up();
    await activate(page, page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }));
    shortcut = page.getByRole('button', { name: 'Open CURATED NFTs' });
    await shortcut.waitFor();
    const shortcutPositionAfterClose = await shortcut.boundingBox();
    assert.ok(closeEnough(shortcutPositionAfterClose.x, shortcutPositionBeforeOpen.x)
      && closeEnough(shortcutPositionAfterClose.y, shortcutPositionBeforeOpen.y),
    JSON.stringify({ shortcutPositionAfterClose, shortcutPositionBeforeOpen }));
    await page.setViewportSize({ width: 390, height: 720 });
    // Resizing the viewport preserves authored shortcut position. Keyboard
    // commands remain available without requiring it to move back on screen.
    await shortcut.focus(); await shortcut.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'EDIT ICON' }).click();
    const narrowEditor = page.getByRole('dialog', { name: 'Edit Display Module shortcut icon' });
    await narrowEditor.waitFor();
    const narrowEditorBox = await narrowEditor.boundingBox();
    const narrowEditorGeometry = await narrowEditor.evaluate((node) => ({
      computedLeft: getComputedStyle(node).left,
      host: node.closest('.system-workflow__workbench').getBoundingClientRect().toJSON(),
      inlineLeft: node.style.left,
      offsetParent: node.offsetParent?.getBoundingClientRect().toJSON(),
      position: getComputedStyle(node).position,
      transform: getComputedStyle(node).transform,
      translate: getComputedStyle(node).translate,
      viewportWidth: globalThis.innerWidth,
    }));
    assert.ok(narrowEditorBox.x >= 8 && narrowEditorBox.x + narrowEditorBox.width <= 382,
      JSON.stringify({ box: narrowEditorBox, ...narrowEditorGeometry }));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-shortcut-icon-editor-narrow.png') });
    for (const name of ['Reset', 'Done', 'Close icon editor']) {
      assert.equal(await narrowEditor.getByRole('button', { name, exact: true }).evaluate(node => {
        const box = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), true, `${name} receives pointer hits in the narrow icon editor`);
    }
    await narrowEditor.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.equal(await narrowEditor.getByRole('slider', { name: 'Shortcut icon size', exact: true }).inputValue(), '60');
    await narrowEditor.getByRole('button', { name: 'Close icon editor', exact: true }).click();
    await narrowEditor.waitFor({ state: 'detached' });
  } finally {
    await browser.close();
  }
});

test('Workbench appearance stays local and independent from the published Display Module appearance', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await prepare(page);
    const persistentURL = new globalThis.URL('/browser-tests/tool-chrome-fixture.html?persistent', URL).href;
    await page.goto(persistentURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('inscape:workbench:preferences:')) localStorage.removeItem(key);
      }
    });
    await page.reload({ waitUntil: 'networkidle' });

    const root = page.locator('.system-workflow');
    const stage = page.locator('[data-presentation-stage]');
    const originalStageSurface = await stage.getAttribute('data-surface');
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.waitFor();

    await settings.getByRole('button', { name: /^Workbench background:/ }).click();
    await page.getByRole('option', { name: 'Carbon' }).click();
    assert.equal(await root.getAttribute('data-surface'), 'carbon');
    assert.equal(await stage.getAttribute('data-surface'), originalStageSurface);

    await settings.getByLabel('Workbench grid color').fill('#ff00ff');
    await settings.getByRole('button', { name: /^Workbench grid display:/ }).click();
    await page.getByRole('option', { name: 'Dots' }).click();
    const workbenchGrid = page.locator('main.system-workflow > canvas.lattice-pixel-grid');
    await workbenchGrid.waitFor();
    assert.equal(await workbenchGrid.evaluate(node => getComputedStyle(node).color), 'rgb(255, 0, 255)');
    assert.equal(await workbenchGrid.evaluate(node => {
      const pixels = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255 && pixels[i + 3] > 0) colored++;
      return colored > 0;
    }), true, 'the Workbench canvas actually paints the chosen grid colour');

    await settings.getByLabel('Grid snapping', { exact: true }).uncheck();
    await settings.getByRole('button', { name: /^Workbench grid display:/ }).click();
    await page.getByRole('option', { name: 'None' }).click();
    assert.equal(await workbenchGrid.count(), 0);
    const stored = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('inscape:workbench:preferences:'));
      return key ? JSON.parse(localStorage.getItem(key)) : null;
    });
    assert.deepEqual(stored, { chromeNoise: true, compositionLocked: false, dockVisible: true, edgeSnap: true, moduleGap: 0, gridSpacing: 24, gridColor: '#ff00ff', gridMode: 'NONE', shortcutSnap: false, surfaceId: 'carbon' });

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await root.getAttribute('data-surface'), 'carbon');
    assert.equal(await stage.getAttribute('data-surface'), originalStageSurface);
    assert.equal(await page.locator('main.system-workflow > canvas.lattice-pixel-grid').count(), 0);
    await page.getByRole('button', { name: 'Settings' }).click();
    const reloadedSettings = page.getByRole('dialog', { name: 'Settings' });
    assert.equal(await reloadedSettings.getByLabel('Grid snapping', { exact: true }).isChecked(), false);
    assert.deepEqual(pageErrors, []);

    if (SCREENSHOT_DIR) {
      await page.waitForFunction(() => getComputedStyle(document.querySelector('aside[aria-label="Settings"]')).opacity === '1');
      await mkdir(SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'workbench-settings-local-wide.png') });
    }
    await page.setViewportSize({ width: 390, height: 720 });
    if (SCREENSHOT_DIR) {
      await page.waitForTimeout(100);
      await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'workbench-settings-local-narrow.png') });
    }
  } finally {
    await browser.close();
  }
});

test('Display composition Lock blocks edits but preserves inspection, Layers and Grid navigation', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await prepare(page); await page.goto(URL, { waitUntil: 'networkidle' });
    const board = page.locator('.system-workflow__presentation-board');
    assert.equal(await board.getByRole('button', { name: /^(Layers|Artwork info|Play Grids)$/ }).count(), 0);
    await page.getByRole('button', { name: 'Grids', exact: true }).click();
    const grids = page.locator('.system-workflow__grid-switcher'); await grids.waitFor();
    await grids.getByRole('button', { name: 'New Grid', exact: true }).click();
    await grids.locator('.system-workflow__grid-row:not([data-world-cover]) .system-workflow__grid-activate').first().click();
    await page.getByRole('button', { name: 'Grids', exact: true }).click(); await grids.waitFor({ state: 'detached' });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click(); const before = await placement.boundingBox();
    await openDisplayTool(page, board, 'LAYERS');
    const layers = page.locator('[data-shared-tool="layers"]'); await layers.waitFor();
    await activate(page, board.getByRole('button', { name: 'Lock Display Module composition', exact: true }));
    assert.equal(await board.getAttribute('data-authoring-locked'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Resize selection from se', exact: true }).count(), 0);
    assert.equal(await layers.isVisible(), true, 'composition Lock does not close the independent Layers tool');
    await placement.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Delete');
    assert.deepEqual(await placement.boundingBox(), before); assert.equal(await placement.count(), 1);
    await page.getByRole('button', { name: 'Close Layers', exact: true }).click();
    await placement.focus(); await page.keyboard.press('i');
    const inspection = page.getByRole('group', { name: 'Artwork inspection', exact: true }); await inspection.waitFor();
    await page.keyboard.press('Escape'); await inspection.waitFor({ state: 'detached' });
    const stage = page.locator('[data-system-workflow-stage]'), label = await stage.getAttribute('aria-label');
    const canvas = page.locator('.system-workflow__canvas'), box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7 - box.width * .65, box.y + box.height * .7, { steps: 6 });
    assert.equal(await canvas.getAttribute('data-swiping'), 'true'); await page.mouse.up();
    await page.waitForFunction(label => document.querySelector('[data-system-workflow-stage]')?.getAttribute('aria-label') !== label, label);
    await activate(page, board.getByRole('button', { name: 'Unlock Display Module composition', exact: true }));
    assert.equal(await board.getAttribute('data-authoring-locked'), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('Display preserves user-chosen names through shortcut and open-window reload', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await prepare(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    for (const name of ['CURATED NFTs', 'PRESENTATION BOARD']) {
      await activate(page, page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }));
      const shortcut = page.locator('.system-workflow__desktop-shortcut');
      await shortcut.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'RENAME', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Display Module shortcut name' });
      await input.fill(name); await input.press('Enter');
      assert.equal(await shortcut.locator('strong').innerText(), name, 'native rename displays the chosen name');
      await page.reload({ waitUntil: 'networkidle' });
      await shortcut.waitFor();
      assert.equal(await shortcut.locator('strong').innerText(), name, 'reload preserves the exact chosen shortcut name');
      await shortcut.press('Enter');
      const title = page.locator('.system-workflow__board-title');
      await title.waitFor();
      assert.equal(await title.getAttribute('title'), name, 'opening the Display uses the chosen name');
      await page.reload({ waitUntil: 'networkidle' });
      await title.waitFor();
      assert.equal(await title.getAttribute('title'), name, 'open-window reload preserves the chosen name');
      if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, `display-name-${name.replaceAll(' ', '-')}.png`) });
    }
  } finally { await browser.close(); }
});
