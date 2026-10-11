import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function mount(page, visitor = false) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  await page.route(`${origin}/__canvas_size__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__canvas_size__`);
  await page.evaluate(async visitor => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey, createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const { addArticleToDisplay } = await import('/src/text/textTransfer.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, key = systemWorkflowDraftKey(profileAddress);
    const seed = fixture.createOwnerSystemWorkflowReviewStorage();
    const storage = { getItem: name => localStorage.getItem(name) || seed.getItem(name), setItem: (name, value) => {
      if (name === key && window.failCanvasSave) throw Error('storage full');
      localStorage.setItem(name, value);
    } };
    const store = createSystemWorkflowDraftStore({ profileAddress, storage });
    if (!localStorage.getItem(key)) {
      addArticleToDisplay(store, profileAddress, { gridId: store.getDraft().grids[0].id });
      const draft = store.getDraft(), text = draft.grids[0].placements.find(p => p.kind === 'text');
      text.column = 1; text.row = 1; text.columnSpan = 12; text.rowSpan = 6;
      text.text.article.title = 'NOMAD';
      text.text.article.content.content[0].content = [{ type: 'text', text: 'HUMAN UNDERNEATH' }];
      draft.workbench = createDefaultWorkbenchPresentation();
      draft.workbench.display.window = { left: 24, top: 72, width: 640, height: 360 };
      store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
    }
    window.canvasTest = { read: () => JSON.parse(storage.getItem(key)) };
    await import('/src/index.css'); await import('/src/inscapeTokens.css');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    const root = createRoot(document.getElementById('root'));
    if (visitor) {
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: store.getDraft(), assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS });
      window.canvasTest.document = document;
      root.render(React.createElement(Visitor, { document }));
    } else {
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      root.render(React.createElement(Runtime, { profileAddress, reviewStorage: storage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Canvas review' } }));
    }
  }, visitor);
  await page.locator('.system-workflow__presentation-board').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
const board = (page, index = 0) => page.locator('.system-workflow__presentation-board').nth(index);
async function editSize(page, index = 0) {
  await board(page, index).locator('.system-workflow__identity-strip').click({ button: 'right', force: true });
  await page.getByRole('menuitem', { name: 'FORMAT', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'CUSTOM SIZE…', exact: true }).click();
  await page.getByRole('dialog', { name: 'Canvas size', exact: true }).waitFor();
}
async function createSize(page) {
  await page.mouse.click(12, 12, { button: 'right' });
  await page.getByRole('menuitem', { name: 'ADD', exact: true }).click();
  await page.getByRole('menuitem', { name: 'DISPLAY MODULE', exact: true }).click();
  await page.getByRole('menuitem', { name: 'CUSTOM SIZE…', exact: true }).click();
  await page.getByRole('dialog', { name: 'Create Display', exact: true }).waitFor();
}
async function enterSize(page, width, height, create = false) {
  await page.getByRole('spinbutton', { name: 'Width (units)', exact: true }).fill(String(width));
  await page.getByRole('spinbutton', { name: 'Height (units)', exact: true }).fill(String(height));
  await page.getByRole('button', { name: create ? 'Create' : 'Apply', exact: true }).click();
}
async function ratio(page, value, index = 0) {
  await page.waitForFunction(({ value, index }) => {
    const r = document.querySelectorAll('.system-workflow__presentation-board')[index]?.getBoundingClientRect();
    return r && Math.abs(r.width - r.height * value) <= (1 + value) * .6;
  }, { value, index }, { timeout: 5000 }).catch(async error => {
    console.log(await page.evaluate(() => ({ geometry: canvasTest.read().geometry, displays: canvasTest.read().displays?.map(d => ({ id: d.id, geometry: d.geometry })),
      boards: [...document.querySelectorAll('.system-workflow__presentation-board')].map(n => ({ id: n.dataset.workbenchViewId, rect: n.getBoundingClientRect().toJSON() })),
      shortcuts: [...document.querySelectorAll('.system-workflow__desktop-shortcut')].map(n => n.getAttribute('aria-label')),
      dialogs: [...document.querySelectorAll('dialog')].map(n => n.textContent) })));
    await page.screenshot({ path: '.browser-test-runtime/display-size-failure.png' });
    throw error;
  });
}

async function appearanceTools(page, index = 0) {
  await board(page, index).getByLabel(/Move Display Module:/).focus();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'APPEARANCE', exact: true }).click();
  const controls = page.locator('[data-shared-tool="appearance"]');
  await controls.getByRole('checkbox', { name: 'Snap to grid', exact: true }).waitFor();
  return controls;
}

test('Snap to grid controls actual Display dragging and keyboard resizing', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await mount(page);
    const text = board(page).getByRole('button', { name: 'Select NOMAD', exact: true });
    const readText = () => page.evaluate(() => canvasTest.read().grids[0].placements.find(p => p.kind === 'text'));
    for (const snap of [false, true]) {
      const controls = await appearanceTools(page);
      await controls.getByRole('checkbox', { name: 'Snap to grid', exact: true }).setChecked(snap);
      await page.getByRole('button', { name: 'Close Display appearance', exact: true }).click();
      const rect = await text.boundingBox();
      // Below the Display title bar, which is visible while its menu trigger has focus.
      await page.mouse.move(rect.x + 30, rect.y + 90); await page.mouse.down();
      await page.mouse.move(rect.x + 56, rect.y + 90, { steps: 6 }); await page.mouse.up();
      const moved = await readText();
      assert.equal(Number.isInteger(moved.column), snap, `drag follows snap=${snap}; column=${moved.column}`);
      const handle = page.getByRole('button', { name: 'Resize selection from e', exact: true });
      await handle.focus(); await page.keyboard.press('ArrowRight');
      const resized = await readText();
      assert.ok(Math.abs(resized.columnSpan - moved.columnSpan - (snap ? 1 : 1 / 9)) < 1e-7);
    }
  } finally { await browser.close(); }
});

test('Display background and grid controls save, undo and render consistently at wide and narrow widths', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(8000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await mount(page);
      const original = await page.evaluate(() => canvasTest.read());
      await editSize(page);
      await page.getByLabel('Background colour', { exact: true }).fill('#274359');
      await page.getByRole('combobox', { name: 'Grid style', exact: true }).selectOption('DOTS');
      await page.getByRole('checkbox', { name: 'Show grid', exact: true }).uncheck();
      await page.getByRole('checkbox', { name: 'Snap to grid', exact: true }).uncheck();
      assert.deepEqual(await page.evaluate(() => canvasTest.read().appearance), original.appearance, 'form edits remain temporary');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => canvasTest.read().appearance), original.appearance);
      let controls = await appearanceTools(page);
      await controls.getByLabel('Background colour', { exact: true }).fill('#274359');
      const canvas = board(page).locator('.system-workflow__canvas');
      assert.equal(await canvas.evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(39, 67, 89)');
      await controls.getByRole('combobox', { name: 'Grid style', exact: true }).selectOption('DOTS');
      const spacing = await canvas.locator('.lattice-pixel-grid').getAttribute('data-guide-spacing');
      await controls.getByRole('checkbox', { name: 'Snap to grid', exact: true }).uncheck();
      assert.equal(await canvas.locator('.lattice-pixel-grid').getAttribute('data-guide-spacing'), spacing, 'snap switch must not change grid density');
      await controls.getByRole('checkbox', { name: 'Show grid', exact: true }).uncheck();
      assert.equal(await canvas.locator('.lattice-pixel-grid').count(), 0);
      await controls.getByRole('checkbox', { name: 'Show grid', exact: true }).check();
      assert.equal(await canvas.locator('.lattice-pixel-grid path').getAttribute('stroke-linecap'), 'round', 'show restores dots');
      await page.evaluate(() => { window.failCanvasSave = true; });
      await controls.getByRole('checkbox', { name: 'Snap to grid', exact: true }).click();
      await controls.getByRole('alert').waitFor();
      assert.equal(await controls.getByRole('checkbox', { name: 'Snap to grid', exact: true }).isChecked(), false);
      await page.evaluate(() => { window.failCanvasSave = false; });
      await controls.getByRole('checkbox', { name: 'Snap to grid', exact: true }).check();
      assert.equal(await controls.getByRole('alert').count(), 0);
      await page.getByRole('button', { name: 'Close Display appearance', exact: true }).click();
      await page.keyboard.press('Control+z');
      assert.equal(await page.evaluate(() => canvasTest.read().appearance.snapToGrid), false);
      await page.keyboard.press('Control+Shift+z');
      assert.equal(await page.evaluate(() => canvasTest.read().appearance.snapToGrid), true);
      controls = await appearanceTools(page);
      await controls.getByRole('checkbox', { name: 'Show grid', exact: true }).uncheck();
      await controls.getByRole('checkbox', { name: 'Show border', exact: true }).scrollIntoViewIfNeeded();
      assert.equal(await controls.getByRole('checkbox', { name: 'Show border', exact: true }).isVisible(), true);
      await controls.getByLabel('Background colour', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.browser-test-runtime/display-appearance-${width}.png` });
      assert.deepEqual(await page.evaluate(() => canvasTest.read().grids), original.grids);
      await mount(page);
      controls = await appearanceTools(page);
      assert.equal(await controls.getByRole('checkbox', { name: 'Show grid', exact: true }).isChecked(), false);
      assert.equal(await controls.getByRole('combobox', { name: 'Grid style', exact: true }).inputValue(), 'DOTS');
      await mount(page, true);
      const renderer = board(page).locator('.visitor-grid-renderer');
      assert.equal(await renderer.evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(39, 67, 89)');
      assert.equal(await renderer.locator('.lattice-pixel-grid').count(), 0);
      await page.screenshot({ path: `.browser-test-runtime/display-appearance-visitor-${width}.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('custom canvas editing preserves content, size, undo, failures, reload and Visitor rendering', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await mount(page);
    const original = await page.evaluate(() => canvasTest.read());
    const textWidth = (await board(page).locator('.display-text-content').first().boundingBox()).width;
    await editSize(page);
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/display-size-wide.png' });
    await enterSize(page, 20, 20);
    await ratio(page, 1);
    assert.deepEqual(await page.evaluate(() => canvasTest.read().grids), original.grids);
    assert.ok(Math.abs((await board(page).locator('.display-text-content').first().boundingBox()).width - textWidth) <= 1);
    await page.keyboard.press('Control+z'); await ratio(page, 16 / 9);
    assert.deepEqual(await page.evaluate(() => canvasTest.read().geometry), original.geometry);
    await page.keyboard.press('Control+Shift+z'); await ratio(page, 1);
    await editSize(page);
    await enterSize(page, 0, 24);
    await page.getByRole('dialog').getByRole('alert').waitFor();
    assert.deepEqual(await page.evaluate(() => canvasTest.read().geometry), { columns: 20, rows: 20 });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await editSize(page); await page.evaluate(() => { window.failCanvasSave = true; });
    await enterSize(page, 24, 24);
    await page.getByRole('dialog').getByRole('alert').waitFor();
    assert.deepEqual(await page.evaluate(() => canvasTest.read().geometry), { columns: 20, rows: 20 });
    await page.evaluate(() => { window.failCanvasSave = false; });
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => canvasTest.read().geometry), { columns: 24, rows: 24 });
    await mount(page); await ratio(page, 1);
    assert.deepEqual(await page.evaluate(() => canvasTest.read().grids), original.grids);
    await page.screenshot({ path: '.browser-test-runtime/display-size-square-owner.png' });
    await mount(page, true); await ratio(page, 1);
    assert.equal(await page.getByRole('button', { name: 'Apply', exact: true }).count(), 0);
    await page.screenshot({ path: '.browser-test-runtime/display-size-square-visitor.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await ratio(page, 1);
    await page.screenshot({ path: '.browser-test-runtime/display-size-square-visitor-narrow.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('custom creation and editing target only their Display, including narrow screens and shortcut menus', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await mount(page);
      const original = await page.evaluate(() => canvasTest.read());
      await createSize(page);
      assert.equal(await board(page).count(), 1);
      const box = await page.getByRole('dialog').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      if (width === 390) await page.screenshot({ path: '.browser-test-runtime/display-size-narrow.png' });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await page.evaluate(() => canvasTest.read().displays?.length || 0), 0);
      await createSize(page);
      await page.getByLabel('Background colour', { exact: true }).fill('#452631');
      await page.getByRole('checkbox', { name: 'Snap to grid', exact: true }).uncheck();
      await page.getByRole('checkbox', { name: 'Show grid', exact: true }).uncheck();
      await enterSize(page, 24, 24, true);
      await ratio(page, 1, 1);
      assert.deepEqual(await page.evaluate(() => canvasTest.read().grids), original.grids);
      assert.deepEqual(await page.evaluate(() => canvasTest.read().geometry), original.geometry);
      assert.deepEqual(await page.evaluate(() => canvasTest.read().appearance), original.appearance);
      assert.equal(await board(page, 1).locator('.system-workflow__canvas').evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(69, 38, 49)');
      await editSize(page, 1);
      assert.equal(await page.getByRole('checkbox', { name: 'Snap to grid', exact: true }).isChecked(), false);
      await page.getByRole('combobox', { name: 'Background preset', exact: true }).selectOption('carbon');
      await enterSize(page, 40, 10);
      await ratio(page, 4, 1);
      assert.equal(await board(page, 1).locator('.system-workflow__canvas').evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(11, 12, 12)');
      assert.deepEqual(await page.evaluate(() => canvasTest.read().geometry), original.geometry);
      await mount(page); await ratio(page, 4, 1);
      // The shortcut exposes the same explicit target even while minimized.
      await board(page, 1).getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).focus();
      await page.keyboard.press('Enter');
      const shortcut = page.getByRole('button', { name: 'Open DISPLAY 2', exact: true });
      await shortcut.focus(); await page.keyboard.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'FORMAT', exact: true }).click();
      await page.getByRole('menuitemcheckbox', { name: 'CUSTOM SIZE…', exact: true }).click();
      await enterSize(page, 18, 32);
      await shortcut.focus(); await page.keyboard.press('Enter');
      await ratio(page, 9 / 16, 1);
      await board(page, 1).locator('.system-workflow__identity-strip').click({ button: 'right', force: true });
      await page.getByRole('menuitem', { name: 'FORMAT', exact: true }).click();
      assert.equal(await page.getByRole('menuitemcheckbox', { name: 'VERTICAL 9:16', exact: true }).getAttribute('aria-checked'), 'true');
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
