import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorMenu, editorCommand, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-cell-interaction';
const reception = page => page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
const shape = (page, id) => page.locator(`.shape-instance [data-workbench-view-id="${id}"]`);
async function setup(viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' }), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?session=${crypto.randomUUID()}`);
  await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
  return { browser, page, errors };
}
async function rectangle(page, from = { x: 300, y: 230 }, to = { x: 780, y: 610 }) {
  const before = (await reception(page)).shapes.map(item => item.id);
  await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('r');
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(ids => window.nativeReceptionFixture.root.getDraft().reception.shapes.some(item => !ids.includes(item.id)), before);
  return (await reception(page)).shapes.find(item => !before.includes(item.id)).id;
}
async function cell(page, from, to) {
  const id = await rectangle(page, from, to);
  await shape(page, id).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Turn into cell', exact: true }).click();
  return id;
}
const back = page => page.getByRole('button', { name: 'Back to cells', exact: true });

test('double-click enters an unselected and selected cell, then native inner drawing stays independent', async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await cell(page), before = (await reception(page)).workbench.shapes[0].window;
    await page.mouse.click(1100, 800);
    await page.mouse.dblclick(540, 420, { delay: 80 }); await back(page).waitFor();
    await page.mouse.click(600, 500); await back(page).waitFor();
    const child = await rectangle(page, { x: 360, y: 310 }, { x: 520, y: 430 });
    assert.deepEqual((await reception(page)).cells[0].members, [child]);
    await back(page).click();
    await page.mouse.click(600, 500);
    await page.locator(`[data-editor-cell-surface="${id}"]`).waitFor();
    await page.mouse.dblclick(600, 500, { delay: 80 }); await back(page).waitFor();
    const childBefore = (await reception(page)).workbench.shapes.find(item => item.id === child).window;
    await page.mouse.move(440, 370); await page.mouse.down(); await page.mouse.move(480, 390, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(({ id, left }) => window.nativeReceptionFixture.root.getDraft().reception.workbench.shapes.find(item => item.id === id).window.left !== left, { id: child, left: childBefore.left });
    assert.deepEqual((await reception(page)).workbench.shapes.find(item => item.id === id).window, before);
    await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('Escape');
    await back(page).waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('image-covered cells enter on double-click and expose the owning cell settings on right-click', async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await cell(page);
    await page.evaluate(async id => {
      const { root } = window.nativeReceptionFixture, draft = root.getDraft(), value = draft.reception;
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      const asset = createProfileDocumentV9AssetResolver(assets)(assets[0].id), frame = value.workbench.shapes.find(item => item.id === id).window;
      value.imageModules = [{ id: 'image:covered-cell', name: 'Cover', width: Math.round(frame.width), height: Math.round(frame.height), visibility: 'PUBLIC',
        sides: [{ id: 'side:cover', asset, crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }];
      value.workbench.imageModules = [{ id: 'image:covered-cell', open: true, position: { left: frame.left, top: frame.top } }];
      value.cells[0].members = ['image:covered-cell']; value.artworkLayers = [id, 'image:covered-cell'];
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid image-covered cell sample');
    }, id);
    await page.locator('[data-image-module="image:covered-cell"] .image-module__canvas').waitFor();
    await page.mouse.click(1100, 800); await page.mouse.dblclick(540, 420, { delay: 80 }); await back(page).waitFor();
    assert.equal(await page.locator(`[data-editor-cell="${id}"]`).count(), 1);
    await back(page).click(); await page.mouse.click(1100, 800);
    await page.mouse.click(540, 420, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Bento settings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Bento settings', exact: true }).waitFor();
    await page.getByLabel('Selected cell radius (px)', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento settings reuses split and merge actions and saves selected-cell styling', async () => {
  const { browser, page, errors } = await setup();
  try {
    const first = await cell(page);
    await page.mouse.click(540, 420, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Bento settings', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByLabel('Selected cell radius (px)', { exact: true }).fill('32');
    await panel.getByRole('button', { name: 'Apply cell radius', exact: true }).click();
    await panel.getByText('Split or merge this cell', { exact: true }).click();
    await panel.getByRole('button', { name: 'Split vertically', exact: true }).click();
    assert.equal((await reception(page)).cells.length, 2);
    assert.equal((await reception(page)).cells[0].id, first);
    await panel.getByText('Split or merge this cell', { exact: true }).click();
    await panel.getByRole('button', { name: 'Merge right', exact: true }).click();
    assert.equal((await reception(page)).cells.length, 1);
    assert.equal((await reception(page)).cells[0].radius, 32);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/cell-settings-structure.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 900]) test(`Merge below aligns unequal rows with artwork and one Undo at ${width}px`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  const surface = id => page.locator(`[data-editor-cell-surface="${id}"]`);
  const closeTools = async () => {
    const close = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    if (await close.isVisible()) await close.click();
  };
  try {
    if (width === 900) {
      await editorCommand(page, 'Edit', 'Settings'); await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    await panel.getByLabel('Number of cells', { exact: true }).fill('6');
    await panel.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await setEditorSidebarOpen(page, false); await closeTools();
    const ids = await page.evaluate(() => {
      const { root } = window.nativeReceptionFixture, draft = root.getDraft(), value = draft.reception;
      const frames = [[24, 24, 1000, 260], [1048, 24, 368, 260], [24, 308, 1080, 340],
        [1128, 308, 288, 340], [24, 672, 920, 204], [968, 672, 448, 204]];
      value.cells.forEach((cell, i) => {
        const [left, top, width, height] = frames[i];
        value.workbench.shapes.find(item => item.id === cell.id).window = { left, top, width, height };
      });
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Could not seed staggered grid');
      return value.cells.map(cell => cell.id);
    });
    await surface(ids[0]).click(); await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.reception-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' }); await back(page).click(); await closeTools();
    await surface(ids[2]).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('CONTENTS FROM THE LOWER CELL');
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('CONTENTS FROM THE LOWER CELL'));
    await back(page).click(); await closeTools();
    const before = await reception(page);
    if (width === 1440) { await surface(ids[0]).focus(); await page.keyboard.press('Shift+F10'); }
    else await surface(ids[0]).click({ button: 'right' });
    const merge = page.getByRole('menuitem', { name: 'Merge below', exact: true });
    assert.ok(await merge.isEnabled());
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/unequal-merge-menu-${width}.png` });
    await merge.click();
    const after = await reception(page), frame = id => after.workbench.shapes.find(item => item.id === id).window;
    assert.equal(after.cells.length, 5);
    assert.deepEqual(frame(ids[0]), { left: 24, top: 24, width: 1000, height: 624 });
    assert.deepEqual(frame(ids[3]), { left: 1048, top: 308, width: 368, height: 340 });
    assert.deepEqual(after.cells[0].members, [...before.cells[0].members, ...before.cells[2].members]);
    assert.deepEqual(after.imageModules, before.imageModules);
    await page.screenshot({ path: `${output}/unequal-merge-editor-${width}.png` });
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), before);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), after);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
    await preview.getByText('CONTENTS FROM THE LOWER CELL', { exact: true }).waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${after.imageModules[0].id}"]`).count(), 1);
    await page.screenshot({ path: `${output}/unequal-merge-preview-${width}.png` });
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    // Reload enumerates native windows in record order; artworkLayers owns paint order.
    const comparable = value => ({ ...value, workbench: { ...value.workbench,
      shapes: [...value.workbench.shapes].sort((a, b) => a.id.localeCompare(b.id)) } });
    assert.deepEqual(comparable(await reception(page)), comparable(after));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
