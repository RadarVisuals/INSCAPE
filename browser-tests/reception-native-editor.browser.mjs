import { editorMenu, activeEditorDocument, editorCommand, selectEditorDocument, editorOverview, editorDestination } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-native-editor';
const snapshot = page => page.evaluate(() => window.nativeReceptionFixture.root.getDraft());
const reception = async page => (await snapshot(page)).reception;
const shape = (page, id) => page.locator(`.shape-instance [data-workbench-view-id="${id}"]`);
const withoutReception = ({ reception: _reception, ...draft }) => draft;
const cellFrame = (value, id) => value.workbench.shapes.find(item => item.id === id).window;

test('deleting the edited cell then Undo leaves a consistent mode and explicit reentry authors members', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 1);
    const initial = await reception(page), id = initial.cells[0].id;
    await bentoCell(page, id).dblclick({ position: { x: 60, y: 120 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    const layers = await openSharedTool(page, 'Layers');
    await layers.getByRole('button', { name: `Delete ${initial.shapes.find(item => item.id === id).name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm layer deletion', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo');
    assert.equal(await page.getByRole('button', { name: 'Back to cells', exact: true }).count(), 0);
    await page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u }).click();
    await bentoCell(page, id).dblclick({ position: { x: 60, y: 120 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('r');
    await page.mouse.move(320, 320); await page.mouse.down(); await page.mouse.move(600, 500, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.shapes.length === 2);
    const after = await reception(page);
    assert.deepEqual(after.cells[0].members, [after.shapes.find(item => item.id !== id).id]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Fit uses the available desktop width and new Light Text keeps authored contrast after theme changes', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width: 900, height: 900 });
  try {
    await generateBento(page, 1);
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    const id = (await reception(page)).cells[0].id;
    await bentoCell(page, id).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('Readable new text on the light cell.');
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.texts[0]?.article.content.content.length > 0);
    const appearance = (await reception(page)).texts[0].article.appearance;
    assert.equal(appearance.color, '#000000'); assert.equal(appearance.background, null);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
    const viewport = preview.locator('.reception-document-viewport');
    await preview.locator('.reception-document-canvas:not([data-mobile])').waitFor();
    assert.equal(await preview.getByRole('button', { name: 'Fit', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await preview.getByRole('complementary', { name: 'Responsive cell settings' }).count(), 0);
    const effective = Math.round((await viewport.boundingBox()).width);
    assert.ok(effective > 800); await preview.getByText(`Preview width · ${effective} px`, { exact: true }).waitFor();
    assert.equal(Number(await preview.getByRole('slider', { name: 'Preview width' }).inputValue()), effective);
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await editorCommand(page, 'Edit', 'Settings'); await page.getByRole('button', { name: 'DARK', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    assert.deepEqual((await reception(page)).texts[0].article.appearance, appearance);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Inner lines form an open six-cell grid, follow resizing and agree in Editor and projected preview', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await mkdir(output, { recursive: true });
    await generateBento(page, 1);
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await editorMenu(page, 'Bento').click();
    for (const [name, value] of [['Width (px)', '1200'], ['Height (px)', '400'], ['Gutter (px)', '0'], ['Outer margin (px)', '0']])
      await panel.getByLabel(name, { exact: true }).fill(value);
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await bentoCell(page, (await reception(page)).cells[0].id).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    await editorMenu(page, 'Bento').click();
    await panel.getByRole('button', { name: 'Add row below', exact: true }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await bentoCell(page, (await reception(page)).cells.at(-1).id).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    for (const cell of (await reception(page)).cells) {
      await bentoCell(page, cell.id).click();
      const colour = await openSharedTool(page, 'Color');
      const opacity = colour.getByRole('slider', { name: 'Color opacity', exact: true });
      await opacity.focus(); await opacity.press('Home');
      await colour.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('outline');
      const width = colour.getByRole('spinbutton', { name: 'Outline width (px)', exact: true });
      await width.fill('6'); await width.press('Enter');
      await colour.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('fill');
      await colour.getByRole('button', { name: 'Close Color', exact: true }).click();
    }
    const before = await reception(page), otherCanvas = withoutReception(await snapshot(page));
    const lines = page.locator('.reception-bento-line-layer .reception-inner-lines path');
    await editorMenu(page, 'Bento').click();
    await panel.getByLabel('Show inner lines', { exact: true }).check();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.deepEqual(await reception(page), before, 'closing without Apply discards line settings');
    assert.equal(await lines.count(), 0);
    await editorMenu(page, 'Bento').click();
    await panel.getByLabel('Show inner lines', { exact: true }).check();
    await panel.getByLabel('Show outer frame', { exact: true }).uncheck();
    assert.equal(await panel.locator('input[type="color"]').count(), 0);
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    const saved = await reception(page);
    assert.deepEqual(saved, { ...before, showFrame: false, innerLines: { color: '#ebece7', width: 1, opacity: 1 } });
    const expected = 'M400,0V800 M800,0V800 M0,400H1200';
    assert.equal(await lines.getAttribute('d'), expected);
    assert.equal(await page.locator('.shape-instance[data-cell-owner] .shape-outline').count(), 0);
    await panel.getByLabel('Gutter (px)', { exact: true }).fill('20');
    assert.notEqual(await lines.getAttribute('d'), expected, 'lines follow temporary gutter geometry');
    assert.deepEqual(await reception(page), saved);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.equal(await lines.getAttribute('d'), expected);
    const divider = page.getByRole('separator', { name: 'Resize adjacent columns', exact: true }).first();
    await divider.focus(); await divider.press('ArrowRight');
    assert.notEqual(await lines.getAttribute('d'), expected);
    await editorCommand(page, 'Edit', 'Undo'); assert.equal(await lines.getAttribute('d'), expected);
    await editorCommand(page, 'Edit', 'Undo'); assert.equal(await lines.count(), 0);
    assert.equal(await page.locator('.shape-instance[data-cell-owner] .shape-outline').count(), 6);
    await editorCommand(page, 'Edit', 'Redo');
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), saved); assert.equal(await lines.getAttribute('d'), expected);
    await bentoCell(page, saved.cells[0].id).click();
    let colour = await openSharedTool(page, 'Color');
    await colour.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('inner-lines');
    const strokeWidth = colour.getByRole('spinbutton', { name: 'Outline width (px)', exact: true });
    await strokeWidth.fill('2'); await strokeWidth.press('Enter');
    const hex = colour.getByRole('textbox', { name: 'Color colour', exact: true });
    await hex.fill('c86432'); await hex.press('Enter');
    assert.equal(await lines.getAttribute('stroke'), '#c86432');
    const opacity = colour.getByRole('slider', { name: 'Color opacity', exact: true });
    await opacity.focus(); await opacity.press('Home'); await opacity.press('ArrowRight');
    assert.equal(Number(await lines.getAttribute('stroke-opacity')), (await reception(page)).innerLines.opacity);
    assert.ok((await reception(page)).innerLines.opacity < 1);
    await opacity.press('End');
    const beforeGesture = await reception(page), hue = colour.getByRole('slider', { name: 'Colour hue', exact: true });
    const hueBox = await hue.boundingBox();
    await page.mouse.move(hueBox.x + hueBox.width / 2, hueBox.y + 4); await page.mouse.down();
    await page.mouse.move(hueBox.x + hueBox.width - 4, hueBox.y + hueBox.height / 2);
    assert.deepEqual(await reception(page), beforeGesture, 'wheel movement is temporary until release');
    assert.notEqual(await lines.getAttribute('stroke'), beforeGesture.innerLines.color);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await reception(page), beforeGesture); assert.equal(await lines.getAttribute('stroke'), beforeGesture.innerLines.color);
    await hue.focus(); await hue.press('ArrowRight');
    assert.notEqual((await reception(page)).innerLines.color, beforeGesture.innerLines.color);
    await colour.getByRole('button', { name: 'Close Color', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual((await reception(page)).innerLines, beforeGesture.innerLines);
    assert.deepEqual((await reception(page)).shapes, before.shapes, 'editing shared strokes does not edit cell fills or their saved outlines');
    for (const [width, theme] of [[1440, 'DARK'], [900, 'LIGHT']]) {
      await page.setViewportSize({ width, height: 1000 });
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: theme, exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
      colour = await openSharedTool(page, 'Color');
      await colour.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('inner-lines');
      const field = colour.getByRole('textbox', { name: 'Color colour', exact: true });
      await field.fill(theme === 'DARK' ? 'ebece7' : '171717'); await field.press('Enter');
      await page.screenshot({ path: `${output}/inner-lines-colour-wheel-${width}.png` });
      await colour.getByRole('button', { name: 'Close Color', exact: true }).click();
      assert.equal(await lines.evaluate(node => getComputedStyle(node).stroke), theme === 'DARK' ? 'rgb(235, 236, 231)' : 'rgb(23, 23, 23)');
      await editorMenu(page, 'Bento').click();
      const box = await panel.getByLabel('Show inner lines', { exact: true }).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width && box.y + box.height <= 1000);
      await page.screenshot({ path: `${output}/inner-lines-editor-${width}.png` });
      await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
      await editorCommand(page, 'Canvas', 'Preview');
      const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
      await preview.getByRole('button', { name: 'Desktop', exact: true }).click();
      const paint = preview.locator('.reception-inner-lines path');
      assert.equal(await paint.getAttribute('d'), expected);
      assert.equal(await paint.getAttribute('stroke-width'), '2');
      assert.equal(await preview.locator('.shape-outline').count(), 0);
      assert.equal(await preview.locator('.reception-document-canvas').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await preview.getByRole('button', { name: 'Fit', exact: true }).click();
      await page.screenshot({ path: `${output}/inner-lines-preview-${width}.png` });
      await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    }
    await editorMenu(page, 'Bento').click();
    await panel.getByLabel('Show inner lines', { exact: true }).uncheck();
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    assert.equal(await lines.count(), 0);
    assert.equal(await page.locator('.shape-instance[data-cell-owner] .shape-outline').count(), 6);
    assert.deepEqual((await reception(page)).shapes, before.shapes);
    assert.deepEqual(withoutReception(await snapshot(page)), otherCanvas);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Wireframe outlines and the optional outer frame save through native controls, undo, reload and preview', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width: 1440, height: 1000 });
  try {
    await mkdir(output, { recursive: true });
    await generateBento(page, 4);
    const original = await reception(page), id = original.cells[0].id;
    const otherCanvas = withoutReception(await snapshot(page));
    await bentoCell(page, id).click();
    let color = await openSharedTool(page, 'Color');
    const opacity = color.getByRole('slider', { name: 'Color opacity', exact: true });
    await opacity.focus(); await opacity.press('Home');
    assert.equal((await reception(page)).shapes.find(item => item.id === id).opacity, 0);
    await color.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('outline');
    const width = color.getByRole('spinbutton', { name: 'Outline width (px)', exact: true });
    await width.fill('4'); await width.press('Enter');
    const hex = color.getByRole('textbox', { name: 'Color colour', exact: true });
    await hex.fill('d5f75d'); await hex.press('Enter');
    const outlined = await reception(page), record = outlined.shapes.find(item => item.id === id);
    assert.deepEqual(record.outline, { width: 4, color: '#d5f75d', opacity: 1 });
    assert.deepEqual(outlined.workbench, original.workbench);
    const stroke = shape(page, id).locator('.shape-outline');
    assert.equal(await stroke.evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await shape(page, id).locator('.shape-fill').evaluate(node => getComputedStyle(node).opacity), '0');
    await page.screenshot({ path: `${output}/wireframe-color-1440.png` });
    await color.getByRole('button', { name: 'Close Color', exact: true }).click();
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const frame = panel.getByRole('checkbox', { name: 'Show outer frame', exact: true });
    await frame.uncheck();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.deepEqual(await reception(page), outlined, 'closing without Apply discards the frame choice');
    await editorMenu(page, 'Bento').click(); await frame.uncheck();
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    const frameless = await reception(page);
    assert.deepEqual(frameless, { ...outlined, showFrame: false });
    assert.equal(await page.locator('canvas[data-workbench-area]').getAttribute('data-show-frame'), 'false');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), outlined);
    assert.equal(await page.locator('canvas[data-workbench-area]').getAttribute('data-show-frame'), 'true');
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), frameless);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), frameless);
    for (const viewportWidth of [1440, 1024]) {
      await page.setViewportSize({ width: viewportWidth, height: 1000 });
      await editorMenu(page, 'Bento').click();
      const checkboxBounds = await frame.boundingBox();
      assert.ok(checkboxBounds.x >= 0 && checkboxBounds.x + checkboxBounds.width <= viewportWidth);
      assert.equal(await frame.isChecked(), false);
      await page.screenshot({ path: `${output}/wireframe-bento-${viewportWidth}.png` });
      await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
      await editorCommand(page, 'Canvas', 'Preview');
      const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
      const canvas = preview.locator('.reception-document-canvas');
      assert.equal(await canvas.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      const outlinePaint = preview.locator(`[data-cell-id="${id}"] .shape-outline`);
      assert.match(await outlinePaint.evaluate(node => getComputedStyle(node).boxShadow), /4px.*inset|inset.*4px/u);
      assert.equal(await preview.locator(`[data-cell-id="${id}"] .shape-fill`).evaluate(node => getComputedStyle(node).opacity), '0');
      await page.screenshot({ path: `${output}/wireframe-preview-${viewportWidth}.png` });
      await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    }
    assert.deepEqual(withoutReception(await snapshot(page)), otherCanvas);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
async function generateBento(page, count = 6) {
  await editorMenu(page, 'Bento').click();
  const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
  await panel.getByRole('button', { name: 'New layout', exact: true }).click();

  await panel.getByLabel('Number of cells', { exact: true }).fill(String(count));
  await panel.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
  await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
  const sidebar = page.getByRole('button', { name: 'Inscape sidebar', exact: true });
  if (await sidebar.getAttribute('aria-expanded') === 'true') await sidebar.click();
  const tools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
  if (await tools.isVisible()) await tools.click();
}
const bentoCell = (page, id) => page.locator(`.reception-bento-cell[data-editor-cell-surface="${id}"]`);

async function openSavedReception(page) {
  await editorOverview(page);
  await editorDestination(page, 'Reception');
}

async function setup(viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  try {
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?session=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
  } catch (error) { await browser.close(); throw error; }
  return { browser, page, errors };
}

test('Reception layout generator previews without saving, applies native cells and supports undo, reload and failure recovery', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await mkdir(output, { recursive: true });
    const original = await snapshot(page);
    await editorMenu(page, 'Bento').click();
    const dialog = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Width (px)', { exact: true }).inputValue(), '1440');
    assert.equal(await dialog.getByLabel('Height (px)', { exact: true }).inputValue(), '900');
    assert.equal(await dialog.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(8, 8, 8)');
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await dialog.getByLabel('Number of cells', { exact: true }).fill('10');
    const first = await dialog.locator('svg[role="img"]').innerHTML();
    await dialog.getByRole('button', { name: 'Another layout', exact: true }).click();
    assert.notEqual(await dialog.locator('svg[role="img"]').innerHTML(), first);
    assert.deepEqual(await snapshot(page), original, 'typing and rerolling leave the document untouched');
    await page.screenshot({ path: `${output}/layout-generator-1440-dark.png` });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(await snapshot(page), original, 'cancel does not save');
    assert.equal(await editorMenu(page, 'Bento').evaluate(node => node === document.activeElement), true);
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.setViewportSize({ width: 900, height: 800 });
    await editorMenu(page, 'Bento').click();
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await dialog.getByLabel('Number of cells', { exact: true }).fill('10');
    await dialog.getByLabel('New cell radius (px)', { exact: true }).fill('24');
    assert.equal(await dialog.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(235, 236, 231)');
    const proposal = await dialog.locator('svg[role="img"] rect').evaluateAll(nodes => nodes.map(node => ({
      left: Number(node.getAttribute('x')), top: Number(node.getAttribute('y')), width: Number(node.getAttribute('width')), height: Number(node.getAttribute('height')),
    })));
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth && node.getBoundingClientRect().bottom <= innerHeight), true);
    assert.equal(await dialog.getByLabel('Width (px)', { exact: true }).evaluate(node => {
      const r = node.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === node;
    }), true, 'Bento opens in front of the other tools');
    await page.screenshot({ path: `${output}/layout-generator-900-light.png` });
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await dialog.getByLabel('Number of cells', { exact: true }).fill('0');
    assert.equal(await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await dialog.getByLabel('Number of cells', { exact: true }).fill('10');
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await dialog.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await reception(page), original.reception);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await dialog.getByRole('button', { name: 'Close Bento', exact: true }).click();
    const saved = await reception(page);
    assert.equal(saved.cells.length, 10);
    saved.cells.forEach((cell, index) => {
      assert.equal(cell.radius, 24);
      assert.deepEqual(saved.workbench.shapes.find(item => item.id === cell.id).window, proposal[index]);
    });
    assert.deepEqual(withoutReception(await snapshot(page)), withoutReception(original));
    await shape(page, saved.cells[0].id).waitFor({ state: 'visible' });
    await page.screenshot({ path: `${output}/layout-applied-900-light.png` });
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await reception(page), original.reception);
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual(await reception(page), saved);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), saved);
    await editorMenu(page, 'Bento').click();
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await dialog.getByLabel('Number of cells', { exact: true }).fill('4');
    await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await dialog.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.equal((await reception(page)).cells.length, 4);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), saved);
    await editorCommand(page, 'Canvas', 'Preview');
    await page.getByRole('region', { name: 'Reception responsive preview', exact: true }).waitFor();
    await page.screenshot({ path: `${output}/layout-preview-900-light.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    const id = (await page.evaluate(() => window.nativeReceptionFixture.root.listWorkbenches()))[0].id;
    await selectEditorDocument(page, id);
    await editorMenu(page, 'Canvas').click();
    assert.equal(await page.getByRole('menuitem', { name: 'Generate cell layout', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento previous variants and start formats remain temporary and restore the exact proposal', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 4);
    const before = await reception(page);
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    const previous = panel.getByRole('button', { name: 'Previous layout', exact: true });
    assert.equal(await previous.isDisabled(), true);
    const first = await panel.locator('svg[role="img"]').innerHTML();
    await panel.getByRole('button', { name: 'Another layout', exact: true }).click();
    const second = await panel.locator('svg[role="img"]').innerHTML();
    await previous.click(); assert.equal(await panel.locator('svg[role="img"]').innerHTML(), first);
    await panel.getByRole('button', { name: 'Another layout', exact: true }).click();
    assert.equal(await panel.locator('svg[role="img"]').innerHTML(), second);
    for (const [name, width, height] of [['Square', '1080', '1080'], ['Portrait', '900', '1440'], ['Landscape', '1440', '900']]) {
      await panel.getByRole('button', { name, exact: true }).click();
      assert.equal(await panel.getByLabel('Width (px)', { exact: true }).inputValue(), width);
      assert.equal(await panel.getByLabel('Height (px)', { exact: true }).inputValue(), height);
      assert.deepEqual(await reception(page), before);
    }
    await panel.getByRole('button', { name: 'Current grid', exact: true }).click();
    await panel.getByRole('button', { name: 'Square', exact: true }).click();
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    assert.equal((await reception(page)).workbench.area.width, 1080);
    assert.equal((await reception(page)).workbench.area.height, 1080);
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    assert.equal(await previous.isDisabled(), false, 'applying size does not lose previous variants');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento gutter and radius preview live, cancel on close, and save as one reversible edit', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 2);
    await bentoCell(page, (await reception(page)).cells[0].id).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.reception-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const before = await reception(page), id = before.cells[0].id, initialBox = await bentoCell(page, id).boundingBox();
    const artwork = page.locator(`[data-workbench-view-id="${before.imageModules[0].id}"]`), imageBox = await artwork.boundingBox();
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByLabel('Gutter (px)', { exact: true }).fill('40');
    await panel.getByLabel('Corner radius (px)', { exact: true }).fill('32');
    await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('.reception-bento-cell')).borderRadius) > 0);
    assert.notDeepEqual(await bentoCell(page, id).boundingBox(), initialBox);
    assert.notDeepEqual(await artwork.boundingBox(), imageBox);
    assert.match(await artwork.evaluate(node => node.style.clipPath), /^path\(/u);
    assert.deepEqual(await reception(page), before, 'painted spacing and corners are not saved');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/bento-live-artwork.png` });
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.deepEqual(await bentoCell(page, id).boundingBox(), initialBox);
    assert.deepEqual(await artwork.boundingBox(), imageBox);
    assert.equal(await bentoCell(page, id).evaluate(node => getComputedStyle(node).borderRadius), '0px');
    assert.deepEqual(await reception(page), before);
    await editorMenu(page, 'Bento').click();
    await panel.getByLabel('Gutter (px)', { exact: true }).fill('40');
    await panel.getByLabel('Corner radius (px)', { exact: true }).fill('32');
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    await panel.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await bentoCell(page, id).boundingBox(), initialBox);
    assert.deepEqual(await reception(page), before);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    const after = await reception(page);
    assert.equal(after.bento.gap, 40); assert.ok(after.cells.every(cell => cell.radius === 32));
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), before);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), after);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), after);
    await editorMenu(page, 'Bento').click();
    await panel.getByLabel('Gutter (px)', { exact: true }).fill('60');
    const canvasId = (await page.evaluate(() => window.nativeReceptionFixture.root.listWorkbenches()))[0].id;
    await selectEditorDocument(page, canvasId); await selectEditorDocument(page, 'reception');
    assert.deepEqual(await reception(page), after);
    assert.equal(await page.locator('.reception-bento-overlay[data-previewing]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento adds cells across a fixed row and grows a new bottom row with unchanged existing geometry', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 1);
    const first = (await reception(page)).cells[0].id;
    await bentoCell(page, first).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    const row = await reception(page);
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    const added = await reception(page);
    assert.deepEqual(added.workbench.area, row.workbench.area);
    for (const cell of row.cells) assert.ok(cellFrame(added, cell.id).width < cellFrame(row, cell.id).width);
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByRole('button', { name: 'Add row below', exact: true }).click();
    const taller = await reception(page);
    assert.ok(taller.workbench.area.height > added.workbench.area.height);
    assert.equal(taller.workbench.area.width, added.workbench.area.width);
    for (const cell of added.cells) assert.deepEqual(cellFrame(taller, cell.id), cellFrame(added, cell.id));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/bento-followup-1440-dark.png` });
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), added);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), taller);
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.setViewportSize({ width: 900, height: 800 });
    await editorMenu(page, 'Bento').click();
    assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth && node.getBoundingClientRect().bottom <= innerHeight), true);
    for (const label of ['Add row below', 'Previous layout', 'Replace layout']) {
      await panel.getByRole('button', { name: label === 'Add row below' ? 'Current grid' : 'New layout', exact: true }).click();
      const button = panel.getByRole('button', { name: label, exact: true });
      await button.scrollIntoViewIfNeeded();
      assert.equal(await button.evaluate(node => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
      }), true, `${label} stays reachable in a narrow computer window`);
    }
    await page.screenshot({ path: `${output}/bento-followup-900-light-bottom.png` });
    await panel.getByRole('button', { name: 'Landscape', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/bento-followup-900-light.png` });
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), taller); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento swaps and shared edges preview without saving, cancel cleanly, and commit one reversible operation', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 4);
    const original = await reception(page), [first, second] = original.cells;
    const a = await bentoCell(page, first.id).boundingBox(), b = await bentoCell(page, second.id).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
    assert.deepEqual(await reception(page), original, 'swap preview is temporary');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await reception(page), original);
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await page.mouse.up();
    const swapped = await reception(page);
    assert.deepEqual(cellFrame(swapped, first.id), cellFrame(original, second.id));
    assert.deepEqual(cellFrame(swapped, second.id), cellFrame(original, first.id));
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), original);
    const seam = page.getByRole('separator', { name: /Resize adjacent/ }).first();
    const box = await seam.boundingBox(), vertical = await seam.getAttribute('aria-orientation') === 'vertical';
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const move = async () => {
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x + (vertical ? 27 : 0), point.y + (vertical ? 0 : 27), { steps: 8 });
    };
    await move(); assert.deepEqual(await reception(page), original);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
    assert.deepEqual(await reception(page), original, 'blur cancels shared-edge previews');
    await move(); await page.mouse.up();
    const resized = await reception(page);
    assert.ok(resized.cells.filter(cell => JSON.stringify(cellFrame(resized, cell.id)) !== JSON.stringify(cellFrame(original, cell.id))).length >= 2);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), original);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), resized);
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await seam.focus(); await page.keyboard.press(vertical ? 'ArrowRight' : 'ArrowDown');
    await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await reception(page), resized);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await bentoCell(page, first.id).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    assert.equal((await reception(page)).cells.length, 5);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), resized);
    assert.equal(await page.locator('.workbench-selection__handle').count(), 0, 'outer cells have shared edges rather than free canvas resize handles');
    await page.screenshot({ path: `${output}/bento-direct-controls-1440.png` });
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), resized);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 900]) test(`Bento merge and split preserve artwork, history and keyboard access at ${width}px`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  // Native presentations may enumerate windows in record order. Authored paint
  // order is the separate artworkLayers list and must remain byte-for-byte intact.
  const normalizeWindows = value => ({ ...value, workbench: { ...value.workbench,
    ...Object.fromEntries(['shapes', 'texts', 'imageModules'].map(key => [key, [...(value.workbench[key] || [])].sort((a, b) => a.id.localeCompare(b.id))])) } });
  const expectReception = async value => assert.deepEqual(normalizeWindows(await reception(page)), normalizeWindows(value));
  const closeTools = async () => {
    const close = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    if (await close.isVisible()) await close.click();
  };
  const command = async (id, label) => {
    await closeTools();
    const box = await bentoCell(page, id).boundingBox();
    await bentoCell(page, id).click({ button: 'right', position: { x: 16, y: box.height / 2 } });
    await page.getByRole('menuitem', { name: label, exact: true }).click();
  };
  try {
    await generateBento(page, 1);
    if (width === 900) {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const first = (await reception(page)).cells[0].id, canvas = withoutReception(await snapshot(page));
    await command(first, 'Split vertically');
    const right = (await reception(page)).cells[1].id;
    await bentoCell(page, first).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.reception-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click(); await closeTools();
    await command(first, 'Split horizontally');
    const below = (await reception(page)).cells[1].id;
    await bentoCell(page, below).click();
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('MERGED ARTWORK');
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('MERGED ARTWORK'));
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click(); await closeTools();
    await command(right, 'Split horizontally');
    const before = await reception(page);
    assert.equal(before.cells.length, 4);
    await command(first, 'Merge below');
    const merged = await reception(page), members = before.cells.filter(cell => [first, below].includes(cell.id)).flatMap(cell => cell.members);
    assert.equal(merged.cells.length, 3);
    assert.deepEqual(merged.cells.find(cell => cell.id === first).members, members);
    assert.deepEqual(merged.imageModules, before.imageModules); assert.deepEqual(merged.texts, before.texts);
    assert.deepEqual(merged.workbench.imageModules, before.workbench.imageModules); assert.deepEqual(merged.workbench.texts, before.workbench.texts);
    await editorCommand(page, 'Edit', 'Undo'); await expectReception(before);
    await editorCommand(page, 'Edit', 'Redo'); await expectReception(merged);
    await bentoCell(page, first).focus(); await page.keyboard.press('Shift+F10');
    assert.equal(await page.getByRole('menuitem', { name: 'Merge above', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('menuitem', { name: 'Merge right', exact: true }).isEnabled(), true);
    const menu = await page.locator('.workbench-object-menu').boundingBox();
    assert.ok(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= width && menu.y + menu.height <= 900);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/bento-merge-menu-${width}.png` });
    await page.getByRole('menuitem', { name: 'Split horizontally', exact: true }).focus(); await page.keyboard.press('Enter');
    const split = await reception(page), index = split.cells.findIndex(cell => cell.id === first);
    assert.equal(split.cells.length, 4);
    assert.deepEqual(split.cells[index].members, members); assert.deepEqual(split.cells[index + 1].members, []);
    assert.ok(split.imageModules[0].height < merged.imageModules[0].height);
    await editorCommand(page, 'Edit', 'Undo'); await expectReception(merged);
    await editorCommand(page, 'Edit', 'Redo'); await expectReception(split);
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await command(first, 'Merge below');
    await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await reception(page), split, 'failed storage does not partially merge cells');
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await page.getByRole('alert').filter({ hasText: 'could not be saved' }).click();
    await command(first, 'Merge below');
    const saved = await reception(page);
    assert.deepEqual(withoutReception(await snapshot(page)), canvas);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
    await preview.getByText('MERGED ARTWORK', { exact: true }).waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${saved.imageModules[0].id}"]`).count(), 1);
    await page.screenshot({ path: `${output}/bento-merge-preview-${width}.png` });
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await expectReception(saved); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [width, gap] of [[1440, 32], [900, 64], [900, 0]]) test(`Bento cell borders resize neighbours directly at ${width}px with ${gap}px gutters`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  try {
    await generateBento(page, 1);
    const first = (await reception(page)).cells[0].id;
    await bentoCell(page, first).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.reception-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByLabel('Height (px)', { exact: true }).fill('480');
    await panel.getByLabel('Gutter (px)', { exact: true }).fill(String(gap));
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Add row below', exact: true }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    if (width === 900) {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const original = await reception(page), [, second, third] = original.cells;
    const otherCanvas = withoutReception(await snapshot(page));
    for (const [id, edge, axis] of [[first, 'right', 'x'], [second.id, 'left', 'x'], [first, 'bottom', 'y'], [third.id, 'top', 'y']]) {
      const box = await bentoCell(page, id).boundingBox();
      // Start just inside the visible cell border, away from the gutter centre.
      const point = { x: edge === 'right' ? box.x + box.width - 2 : edge === 'left' ? box.x + 2 : box.x + box.width / 3,
        y: edge === 'bottom' ? box.y + box.height - 2 : edge === 'top' ? box.y + 2 : box.y + box.height / 2 };
      const drag = async () => {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + (axis === 'x' ? 24 : 0), point.y + (axis === 'y' ? 24 : 0), { steps: 6 });
      };
      await page.mouse.move(point.x, point.y);
      assert.equal(await page.evaluate(p => getComputedStyle(document.elementFromPoint(p.x, p.y)).cursor, point), axis === 'x' ? 'col-resize' : 'row-resize');
      await drag();
      assert.deepEqual(await reception(page), original, 'drag previews do not save');
      assert.notDeepEqual(await bentoCell(page, id).boundingBox(), box, `${edge} border previews its new dimensions`);
      await page.keyboard.press('Escape'); await page.mouse.up();
      assert.deepEqual(await bentoCell(page, id).boundingBox(), box);
      await drag(); await page.mouse.up();
      const resized = await reception(page);
      assert.deepEqual(resized.cells, original.cells, 'resizing never swaps cell identities or contents');
      assert.deepEqual(resized.workbench.area, original.workbench.area, 'the outside bento size stays fixed');
      assert.equal(resized.cells.filter(cell => JSON.stringify(cellFrame(resized, cell.id)) !== JSON.stringify(cellFrame(original, cell.id))).length, axis === 'x' ? 2 : 3,
        'both sides resize, including every neighbour at the T junction');
      const imageId = original.imageModules[0].id;
      const imageFrame = value => {
        const image = value.imageModules.find(item => item.id === imageId);
        return { ...value.workbench.imageModules.find(item => item.id === imageId).position, width: image.width, height: image.height };
      };
      assert.deepEqual(imageFrame(resized), cellFrame(resized, first), 'contained artwork follows the resized cell');
      await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), original, 'one undo restores the entire gesture');
      await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), resized);
      if (edge === 'bottom') {
        await mkdir(output, { recursive: true });
        const seam = page.getByRole('separator', { name: 'Resize adjacent rows' });
        await seam.focus();
        const seamBox = await seam.boundingBox();
        await page.mouse.move(seamBox.x + seamBox.width / 2, seamBox.y + seamBox.height / 2);
        await page.screenshot({ path: `${output}/bento-cell-border-${width}-gap-${gap}.png` });
      }
      await editorCommand(page, 'Edit', 'Undo');
    }
    assert.deepEqual(withoutReception(await snapshot(page)), otherCanvas, 'ordinary canvas contents stay unchanged');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento cell buttons add native Image and Text directly, retain content when adding a cell, and render in preview', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 2);
    const before = await reception(page), id = before.cells[0].id;
    await bentoCell(page, id).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.reception-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    let value = await reception(page);
    assert.equal(value.imageModules.length, 1);
    assert.deepEqual(value.cells.find(cell => cell.id === id).members, [value.imageModules[0].id]);
    assert.deepEqual(value.workbench.imageModules[0].position, { left: cellFrame(value, id).left, top: cellFrame(value, id).top });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    await text.fill('BENTO INSCAPE');
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('BENTO INSCAPE'));
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    value = await reception(page);
    assert.equal(value.texts[0].visibility, 'PUBLIC');
    assert.deepEqual(new Set(value.cells.find(cell => cell.id === id).members), new Set([value.imageModules[0].id, value.texts[0].id]));
    const members = value.cells.find(cell => cell.id === id).members;
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    assert.deepEqual((await reception(page)).cells.find(cell => cell.id === id).members, members);
    await editorMenu(page, 'Bento').click();
    await page.screenshot({ path: `${output}/bento-artwork-menu-1440.png` });
    await page.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
    await preview.getByText('BENTO INSCAPE', { exact: true }).waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${value.imageModules[0].id}"]`).count(), 1);
    await page.screenshot({ path: `${output}/bento-artwork-preview.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Reception has no grid or snapping controls and preserves the ordinary canvas preferences', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = (await page.evaluate(() => window.nativeReceptionFixture.root.listWorkbenches()))[0].id;
    await selectEditorDocument(page, id);
    for (const label of ['Grid', 'Snap to grid', 'Snap to edges']) {
      await editorMenu(page, 'View').click();
      const item = page.getByRole('menuitemcheckbox', { name: label, exact: true });
      if (await item.getAttribute('aria-checked') !== 'true') await item.click(); else await page.keyboard.press('Escape');
    }
    await selectEditorDocument(page, 'reception');
    await editorMenu(page, 'View').click();
    assert.equal(await page.getByRole('menuitemcheckbox', { name: /Grid|Snap to/ }).count(), 0);
    await page.keyboard.press('Escape');
    await editorCommand(page, 'Edit', 'Settings');
    assert.equal(await page.getByRole('checkbox', { name: 'Grid snapping', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await generateBento(page, 2);
    const value = await reception(page);
    assert.equal(await page.locator('.workbench-alignment-grid').count(), 0);
    await selectEditorDocument(page, id);
    for (const label of ['Grid', 'Snap to grid', 'Snap to edges']) {
      await editorMenu(page, 'View').click();
      assert.equal(await page.getByRole('menuitemcheckbox', { name: label, exact: true }).getAttribute('aria-checked'), 'true');
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(await reception(page), value);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('generated arrangements carry existing artwork visibly and retain it when reducing the cell count', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const cellId = await rectangle(page, { x: 240, y: 180 }, { x: 1050, y: 850 });
    await cellMenu(page, cellId, 'Turn into cell');
    await dropArtwork(page, { x: 600, y: 410 });
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 1);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const before = await reception(page), imageId = before.imageModules[0].id;
    for (const count of [6, 1]) {
      await editorMenu(page, 'Bento').click();
      const dialog = page.getByRole('dialog', { name: 'Bento settings', exact: true });
      await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

      assert.equal(await dialog.getByLabel('Number of cells', { exact: true }).getAttribute('min'), '1');
      await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

      await dialog.getByLabel('Number of cells', { exact: true }).fill(String(count));
      await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
      await dialog.getByRole('button', { name: 'Close Bento', exact: true }).click();
      const saved = await reception(page);
      assert.equal(saved.cells.length, count);
      assert.deepEqual(saved.cells.find(cell => cell.id === cellId).members, [imageId]);
      assert.deepEqual(saved.imageModules[0].sides, before.imageModules[0].sides);
      const frame = saved.workbench.shapes.find(shape => shape.id === cellId).window;
      const position = saved.workbench.imageModules[0].position;
      await page.waitForFunction(({ cellId, imageId, frame, position, imageWidth }) => {
        const cell = document.querySelector(`[data-workbench-view-id="${cellId}"]`)?.getBoundingClientRect();
        const image = document.querySelector(`[data-workbench-view-id="${imageId}"]`)?.getBoundingClientRect();
        if (!cell || !image) return false;
        const scale = cell.width / frame.width;
        return Math.abs(image.width - imageWidth * scale) < 3 && Math.abs(image.left - cell.left - (position.left - frame.left) * scale) < 3;
      }, { cellId, imageId, frame, position, imageWidth: saved.imageModules[0].width });
      await page.screenshot({ path: `${output}/layout-with-artwork-${count}.png` });
    }
    await editorCommand(page, 'Edit', 'Undo'); assert.equal((await reception(page)).cells.length, 6);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('direct Reception entry accepts pointer clicks on controls outside the canvas after a cold load', { timeout: 90000 }, async () => {
  for (const width of [1440, 700]) {
    const { browser, page, errors } = await setup({ width, height: 1000 });
    try {
      const preview = editorMenu(page, 'Canvas');
      const documentLabel = page.getByRole('status', { name: 'Editing document', exact: true });
      assert.equal(await documentLabel.innerText(), 'Editing Reception');
      const indicator = await documentLabel.boundingBox();
      assert.ok(indicator.x >= 0 && indicator.x + indicator.width <= width, 'the active document remains visible at desktop widths');
      assert.equal(await documentLabel.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'Reception is readable in full');
      assert.equal(await preview.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), true, `the document controls receive the pointer at ${width}px`);
      await editorCommand(page, 'Canvas', 'Bento settings');
      await page.getByRole('dialog', { name: 'Bento settings', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close Bento', exact: true }).click();
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close workspace', exact: true }).click();
      await editorCommand(page, 'Canvas', 'Preview');
      await page.getByRole('region', { name: 'Reception responsive preview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
      await openSavedReception(page);
      await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
      await preview.waitFor();
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

async function rectangle(page, from = { x: 300, y: 230 }, to = { x: 780, y: 610 }) {
  const before = (await reception(page)).shapes.map(item => item.id);
  await page.locator('main[data-reception-editor]').focus();
  await page.keyboard.press('r');
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(ids => window.nativeReceptionFixture.root.getDraft().reception.shapes.some(item => !ids.includes(item.id)), before);
  return (await reception(page)).shapes.find(item => !before.includes(item.id)).id;
}
async function cellMenu(page, id, action) {
  const node = shape(page, id);
  const box = await node.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

async function dropArtwork(page, point, inspectPreview) {
  const toggle = page.getByRole('button', { name: 'Artwork library', exact: true });
  if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
  const card = page.getByRole('region', { name: 'Library workspace' }).getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[aria-label="ABYSSAL STUDY / INSCAPE STUDIES"]')?.getAttribute('aria-disabled') !== 'true');
  const start = await card.evaluate(node => {
    const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2;
    for (let y = Math.max(12, rect.y + 24); y < Math.min(innerHeight - 100, rect.bottom); y += 20)
      if (node.contains(document.elementFromPoint(x, y))) return { x, y };
    throw new Error('Library artwork has no exposed drag point');
  });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 20, { steps: 3 });
  await page.mouse.move(point.x, point.y, { steps: 14 });
  await page.getByText('Release to place Image', { exact: true }).waitFor();
  if (inspectPreview) await inspectPreview();
  await page.mouse.up();
}

for (const width of [1440, 900]) test(`Library fills an unselected Bento cell and deletion closes its neighbour's gap at ${width}px`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  const closeTools = async () => {
    const close = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    if (await close.isVisible()) await close.click();
  };
  const split = async (id, direction) => {
    await closeTools(); const box = await bentoCell(page, id).boundingBox();
    await bentoCell(page, id).click({ button: 'right', position: { x: 16, y: box.height / 2 } });
    await page.getByRole('menuitem', { name: `Split ${direction}ly`, exact: true }).click();
  };
  const assertImageFits = async id => {
    const value = await reception(page), image = value.imageModules[0], frame = cellFrame(value, id);
    assert.deepEqual(value.cells.find(cell => cell.id === id).members, [image.id]);
    assert.deepEqual(value.workbench.imageModules.find(item => item.id === image.id).position, { left: frame.left, top: frame.top });
    assert.equal(image.width, Math.round(frame.width)); assert.equal(image.height, Math.round(frame.height));
  };
  try {
    await mkdir(output, { recursive: true }); await generateBento(page, 1);
    const first = (await reception(page)).cells[0].id, canvas = withoutReception(await snapshot(page));
    await split(first, 'vertical'); const right = (await reception(page)).cells[1].id;
    await split(right, 'horizontal'); await split(first, 'horizontal'); await closeTools();
    // The last split selected the left cell; the drop must target the right cell itself.
    const target = await bentoCell(page, right).boundingBox();
    await dropArtwork(page, { x: target.x + 20, y: target.y + target.height / 2 }, async () => {
      await page.screenshot({ path: `${output}/bento-library-preview-${width}.png` });
    });
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 1);
    await assertImageFits(right);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click(); await closeTools();
    const beforeResize = await reception(page), divider = page.getByRole('separator', { name: 'Resize adjacent columns', exact: true }).first();
    await divider.focus(); await divider.press('ArrowRight'); await assertImageFits(right);
    assert.notDeepEqual(cellFrame(await reception(page), right), cellFrame(beforeResize, right));
    await editorCommand(page, 'Edit', 'Undo'); await assertImageFits(right);
    const beforeDelete = await reception(page), otherRow = beforeDelete.cells.filter(cell => cellFrame(beforeDelete, cell.id).top !== cellFrame(beforeDelete, first).top);
    await bentoCell(page, first).click({ position: { x: 16, y: 30 } });
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const name = beforeDelete.shapes.find(item => item.id === first).name;
    await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm layer deletion', exact: true }).click();
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.cells.length === 3);
    const filled = await reception(page); await assertImageFits(right);
    assert.equal(cellFrame(filled, right).left, cellFrame(beforeDelete, first).left);
    assert.equal(cellFrame(filled, right).width, cellFrame(beforeDelete, first).width + beforeDelete.bento.gap + cellFrame(beforeDelete, right).width);
    for (const cell of otherRow) assert.deepEqual(cellFrame(filled, cell.id), cellFrame(beforeDelete, cell.id));
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await page.screenshot({ path: `${output}/bento-delete-filled-${width}.png` });
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual((await reception(page)).cells, beforeDelete.cells); await assertImageFits(right);
    await editorCommand(page, 'Edit', 'Redo'); await assertImageFits(right);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual((await reception(page)).cells, filled.cells); await assertImageFits(right);
    assert.deepEqual(withoutReception(await snapshot(page)), canvas); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Library drops directly into a selected cell and onto its existing artwork without entering content editing', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await rectangle(page, { x: 240, y: 180 }, { x: 1050, y: 850 });
    await cellMenu(page, id, 'Turn into cell');
    await page.mouse.click(600, 410);
    assert.equal(await page.locator(`[data-editor-cell-surface="${id}"]`).count(), 1, 'the first drop hits the actual cell selection overlay');
    await dropArtwork(page, { x: 600, y: 410 });
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 1);
    let document = await reception(page);
    assert.deepEqual(document.cells[0].members, [document.imageModules[0].id]);
    assert.equal(await page.getByRole('button', { name: 'Back to cells', exact: true }).count(), 0, 'drop keeps the current cell-level editing scope');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const before = await reception(page);
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await dropArtwork(page, { x: 600, y: 410 });
    await page.getByText(/Image could not be saved|Artwork could not be placed/i).first().waitFor();
    assert.deepEqual(await reception(page), before, 'a failed drop creates neither an Image nor membership');
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await dropArtwork(page, { x: 600, y: 410 });
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 2);
    document = await reception(page);
    assert.deepEqual(document.cells[0].members, document.imageModules.map(item => item.id));
    assert.deepEqual(document.imageModules[0], before.imageModules[0], 'dropping at cell level adds a layer rather than altering an existing Image');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 1);
    assert.deepEqual((await reception(page)).cells, before.cells, 'one undo removes both the new Image and its membership');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 2);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual((await reception(page)).cells, document.cells);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Reception uses native Rectangle drawing and cell conversion with undo, reload and isolated saving', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const otherCanvas = withoutReception(await snapshot(page));
    assert.equal((await reception(page)).cells.length, 0);
    const id = await rectangle(page), drawn = await reception(page);
    await cellMenu(page, id, 'Turn into cell');
    const converted = await reception(page);
    assert.equal(converted.cells.length, 1);
    assert.equal(converted.cells[0].id, id);
    assert.deepEqual(converted.shapes, drawn.shapes, 'conversion keeps shape appearance and identity');
    assert.deepEqual(converted.workbench.shapes, drawn.workbench.shapes, 'conversion keeps drawn geometry');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.cells.length === 0);
    assert.deepEqual((await reception(page)).shapes, drawn.shapes, 'undo converts back without deleting the rectangle');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.cells.length === 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual((await reception(page)).cells, converted.cells);
    assert.deepEqual(withoutReception(await snapshot(page)), otherCanvas, 'native Reception editing leaves the ordinary canvas unchanged');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-rectangle-cell.png`, fullPage: true });
    await openSavedReception(page);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal((await reception(page)).cells[0].id, id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Cell settings save rounded corners with undo, clipping and reload at wide and narrow desktop widths', { timeout: 120000 }, async () => {
  for (const width of [1440, 900]) {
    const { browser, page, errors } = await setup({ width, height: 1000 });
    try {
      const otherCanvas = withoutReception(await snapshot(page));
      const id = await rectangle(page, { x: 220, y: 200 }, { x: 720, y: 650 });
      await cellMenu(page, id, 'Turn into cell');
      await cellMenu(page, id, 'Edit cell contents');
      const child = await rectangle(page, { x: 230, y: 210 }, { x: 390, y: 370 });
      await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
      await cellMenu(page, id, 'Bento settings');
      const radius = page.getByRole('spinbutton', { name: 'Corner radius (px)', exact: true });
      const before = await reception(page);
      await radius.fill('48'); await radius.press('Enter');
      assert.equal((await reception(page)).cells[0].radius, 48);
      assert.equal(await shape(page, id).locator('.shape-fill').evaluate(node => getComputedStyle(node).borderTopLeftRadius), '48px');
      assert.match(await page.locator(`[data-editor-cell="${id}"]`).first().evaluate(node => node.style.clipPath), /^path\(/u);
      await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('Control+z');
      assert.deepEqual(await reception(page), before, 'one undo restores the exact original Reception');
      assert.equal(await radius.inputValue(), '0');
      await page.keyboard.press('Control+Shift+z'); assert.equal(await radius.inputValue(), '48');
      for (const invalid of ['', '-1', '161']) {
        await radius.fill(invalid); await radius.press('Enter');
        await radius.fill('48');
        assert.equal((await reception(page)).cells[0].radius, 48);
      }
      await page.evaluate(() => window.nativeReceptionFixture.fail(true));
      await radius.fill('64'); await radius.press('Enter');
      await page.getByRole('alert').filter({ hasText: 'The Reception change could not be saved' }).waitFor();
      assert.equal(await radius.inputValue(), '64', 'failed settings remain a proposal with an error');
      assert.equal((await reception(page)).cells[0].radius, 48);
      await page.evaluate(() => window.nativeReceptionFixture.fail(false));
      await radius.fill('0'); await radius.press('Enter');
      assert.equal((await reception(page)).cells[0].radius, 0);
      await radius.fill('48'); await radius.press('Enter');
      const bounds = await radius.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'the control fits the desktop window');
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/cell-radius-settings-${width}.png`, fullPage: true });
      await editorCommand(page, 'Canvas', 'Preview');
      const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
      await preview.getByRole('button', { name: 'Desktop', exact: true }).click();
      assert.equal(await preview.locator(`[data-cell-id="${id}"]`).evaluate(node => getComputedStyle(node).borderRadius), '48px');
      assert.match(await preview.locator(`[data-layer-id="${child}"]`).evaluate(node => node.style.clipPath), /^path\(/u);
      await page.screenshot({ path: `${output}/cell-radius-preview-${width}.png`, fullPage: true });
      await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
      await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
      await cellMenu(page, id, 'Bento settings');
      assert.equal(await radius.inputValue(), '48');
      assert.deepEqual(withoutReception(await snapshot(page)), otherCanvas, 'Reception radius leaves the ordinary canvas untouched');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('one Editor switches Reception and canvas documents and reopens Reception from My Inscape without mixing layers', { timeout: 120000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const selector = editorMenu(page, 'Canvas');
    await selector.waitFor();
    assert.equal(await activeEditorDocument(page), 'reception');
    assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0);
    const canvasId = await page.evaluate(() => window.nativeReceptionFixture.root.getWorkbenchId());
    const originalCanvas = withoutReception(await snapshot(page));

    const cellId = await rectangle(page, { x: 300, y: 230 }, { x: 900, y: 720 });
    await cellMenu(page, cellId, 'Turn into cell');
    await cellMenu(page, cellId, 'Edit cell contents');
    const memberId = await rectangle(page, { x: 380, y: 320 }, { x: 600, y: 480 });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const authoredReception = await reception(page);
    assert.deepEqual(authoredReception.cells[0].members, [memberId]);

    await selectEditorDocument(page, canvasId);
    await shape(page, originalCanvas.shapes[0].id).waitFor();
    assert.match(await page.getByRole('status', { name: 'Editing document', exact: true }).innerText(), /^Editing canvas · /u);
    assert.equal(await page.locator('main[data-reception-editor]').count(), 0);
    assert.equal(await shape(page, cellId).count(), 0);
    assert.deepEqual(withoutReception(await snapshot(page)), originalCanvas, 'selecting the ordinary canvas preserves its original records');
    const beforeIds = (await snapshot(page)).shapes.map(item => item.id);
    await page.locator('main[data-canvas-context="canvas"]').focus();
    await page.keyboard.press('r');
    await page.mouse.move(300, 700); await page.mouse.down();
    await page.mouse.move(600, 830, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(ids => window.nativeReceptionFixture.root.getDraft().shapes.some(item => !ids.includes(item.id)), beforeIds);
    const authoredCanvas = withoutReception(await snapshot(page));
    const canvasShape = authoredCanvas.shapes.find(item => !beforeIds.includes(item.id));

    await selectEditorDocument(page, 'reception');
    await shape(page, cellId).waitFor();
    assert.equal(await page.getByRole('status', { name: 'Editing document', exact: true }).innerText(), 'Editing Reception');
    assert.equal(await shape(page, canvasShape.id).count(), 0);
    assert.deepEqual(await reception(page), authoredReception, 'switching back preserves Reception layers, membership and geometry');
    await openSavedReception(page);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await selector.waitFor();
    assert.equal(await activeEditorDocument(page), 'reception');
    await shape(page, memberId).waitFor();
    assert.deepEqual(await reception(page), authoredReception, 'My Inscape edits the same Reception document');
    await selectEditorDocument(page, canvasId);
    await shape(page, canvasShape.id).waitFor();
    assert.deepEqual(withoutReception(await snapshot(page)), authoredCanvas, 'Reception navigation never rewrites the canvas');

    await page.reload();
    await selector.waitFor();
    await page.waitForFunction(() => document.querySelector('[role="menubar"]')?.dataset.document === 'reception');
    assert.deepEqual(await reception(page), authoredReception, 'fresh Reception entry retains the same saved composition');
    assert.deepEqual(withoutReception(await snapshot(page)), authoredCanvas, 'fresh Reception entry preserves the separately saved canvas');
    await selectEditorDocument(page, canvasId);
    await shape(page, canvasShape.id).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('failed conversion keeps the native rectangle and current Reception intact', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await rectangle(page), before = await reception(page);
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await cellMenu(page, id, 'Turn into cell');
    await page.getByRole('alert').filter({ hasText: /could not be saved|could not be|unchanged/i }).first().waitFor();
    assert.deepEqual(await reception(page), before);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await cellMenu(page, id, 'Turn into cell');
    assert.equal((await reception(page)).cells[0].id, id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('native cell contents remain editable independently and travel with their parent', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await rectangle(page);
    await cellMenu(page, id, 'Turn into cell');
    await cellMenu(page, id, 'Edit cell contents');
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    const inner = await rectangle(page, { x: 360, y: 310 }, { x: 540, y: 440 });
    let document = await reception(page);
    assert.deepEqual(document.cells[0].members, [inner]);
    const original = document.workbench.shapes.find(item => item.id === inner).window;
    const outside = document.workbench.shapes.find(item => item.id === id).window;
    const node = shape(page, inner);
    const box = await node.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2 + 24, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(({ id, left }) => window.nativeReceptionFixture.root.getDraft().reception.workbench.shapes.find(item => item.id === id).window.left !== left, { id: inner, left: original.left });
    document = await reception(page);
    assert.deepEqual(document.workbench.shapes.find(item => item.id === id).window, outside, 'moving a child leaves its cell in place');
    assert.notDeepEqual(document.workbench.shapes.find(item => item.id === inner).window, original);
    assert.equal(await page.locator(`[data-editor-cell="${id}"]`).count() > 0, true, 'child uses the cell clipping boundary');
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    await page.locator(`[data-editor-cell-surface="${id}"]`).click();
    await page.getByRole('button', { name: '+ Cell', exact: true }).click();
    const before = await reception(page), other = before.cells.find(cell => cell.id !== id).id;
    const parentBox = await shape(page, id).boundingBox(), otherBox = await shape(page, other).boundingBox();
    const parentFrame = before.workbench.shapes.find(item => item.id === id).window;
    await page.mouse.move(parentBox.x + parentBox.width / 2, parentBox.y + parentBox.height / 2); await page.mouse.down();
    await page.mouse.move(otherBox.x + otherBox.width / 2, otherBox.y + otherBox.height / 2, { steps: 8 }); await page.mouse.up();
    document = await reception(page);
    const afterParent = document.workbench.shapes.find(item => item.id === id).window;
    const beforeChild = before.workbench.shapes.find(item => item.id === inner).window;
    const afterChild = document.workbench.shapes.find(item => item.id === inner).window;
    // Fitted cameras produce fractional world coordinates; compare movement
    // within floating-point precision rather than requiring identical bits.
    assert.ok(Math.abs(afterChild.left - (afterParent.left + (beforeChild.left - parentFrame.left) * afterParent.width / parentFrame.width)) < 1e-9);
    assert.ok(Math.abs(afterChild.top - (afterParent.top + (beforeChild.top - parentFrame.top) * afterParent.height / parentFrame.height)) < 1e-9);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-cell-layers.png`, fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('native Library Image and Text belong to the cell and render in Desktop and Phone preview', { timeout: 120000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await rectangle(page, { x: 240, y: 180 }, { x: 1050, y: 850 });
    await cellMenu(page, id, 'Turn into cell');
    await cellMenu(page, id, 'Edit cell contents');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const card = page.getByRole('region', { name: 'Library workspace' }).getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[aria-label="ABYSSAL STUDY / INSCAPE STUDIES"]')?.getAttribute('aria-disabled') !== 'true');
    const point = await card.evaluate(node => {
      const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2;
      for (let y = Math.max(12, rect.y + 24); y < Math.min(innerHeight - 100, rect.bottom); y += 20) {
        if (node.contains(document.elementFromPoint(x, y))) return { x, y };
      }
      throw new Error('Library artwork has no exposed drag point');
    });
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + 20, point.y + 20, { steps: 3 });
    await page.mouse.move(600, 410, { steps: 14 });
    await page.getByText('Release to place Image', { exact: true }).waitFor().catch(async error => {
      console.log('drop evidence', await page.evaluate(() => ({ hit: document.elementFromPoint(600,410)?.outerHTML.slice(0,1500), text: document.body.innerText })));
      await page.screenshot({ path: `${output}/native-drop-debug.png`, fullPage: true }); throw error;
    });
    await page.mouse.up();
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.imageModules.length === 1);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const closeTools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    if (await closeTools.isVisible()) await closeTools.click();
    await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('t');
    await page.mouse.click(320, 680);
    const text = page.getByRole('textbox', { name: 'Article text', exact: true }); await text.waitFor();
    await text.fill('Welcome to my Reception. This is a real Text layer.');
    if (await closeTools.isVisible()) await closeTools.click();
    await page.getByRole('tab', { name: 'Article settings', exact: true }).focus(); await page.keyboard.press('Enter');
    const inclusion = page.getByRole('checkbox', { name: 'Include in Reception', exact: true });
    if (!await inclusion.isChecked()) { await inclusion.focus(); await page.keyboard.press('Space'); }
    assert.equal(await page.getByRole('combobox', { name: 'Follow Display', exact: true }).count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Read as pages', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Select tool', exact: true }).focus(); await page.keyboard.press('Control+k');
    await page.getByRole('button', { name: 'Transform', exact: true }).click();
    for (const [label, value] of [['Height', '180'], ['Width', '660'], ['Y', '630']]) {
      const field = page.getByRole('spinbutton', { name: `Transform ${label}`, exact: true });
      await field.fill(value); await field.press('Enter');
    }
    await closeTools.click();
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('Welcome to my Reception.'));
    const document = await reception(page), imageId = document.imageModules[0].id, textId = document.texts[0].id;
    assert.deepEqual(new Set(document.cells[0].members), new Set([imageId, textId]));
    assert.match(document.imageModules[0].sides[0].asset.media.url, /abyssal_eye/);
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const closeText = page.getByRole('button', { name: 'Close Text tools', exact: true });
    if (await closeText.isVisible()) await closeText.click();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-image-text-editor.png`, fullPage: true });
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true }); await preview.waitFor();
    await preview.getByText('Welcome to my Reception. This is a real Text layer.', { exact: true }).waitFor().catch(async error => {
      console.log('preview evidence', await reception(page), await preview.innerText(), errors);
      await page.screenshot({ path: `${output}/native-preview-debug.png`, fullPage: true }); throw error;
    });
    assert.equal(await preview.locator(`[data-layer-id="${imageId}"]`).count(), 1);
    await page.screenshot({ path: `${output}/native-preview-desktop-1440.png`, fullPage: true });
    await preview.getByRole('button', { name: 'Phone', exact: true }).click();
    await preview.getByRole('button', { name: 'Phone layout settings', exact: true }).click();
    await preview.locator('.reception-document-canvas[data-mobile="true"]').waitFor();
    await preview.getByRole('combobox', { name: 'Preview cell', exact: true }).selectOption(id);
    await preview.getByRole('combobox', { name: 'Phone layer', exact: true }).selectOption(textId);
    await preview.getByRole('spinbutton', { name: 'Horizontal position', exact: true }).fill('20');
    await preview.getByRole('spinbutton', { name: 'Horizontal position', exact: true }).press('Enter');
    assert.deepEqual((await reception(page)).workbench, document.workbench, 'phone override preserves desktop geometry');
    assert.equal((await reception(page)).cells[0].mobile.placements[0].id, textId);
    await page.screenshot({ path: `${output}/native-preview-phone-390.png`, fullPage: true });
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal((await reception(page)).cells[0].mobile.placements[0].id, textId);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('new Reception Text appears above its Shape in preview while explicitly private Text stays excluded', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const cellId = await rectangle(page, { x: 240, y: 180 }, { x: 1050, y: 850 });
    await cellMenu(page, cellId, 'Turn into cell');
    await cellMenu(page, cellId, 'Edit cell contents');
    await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('t');
    await page.mouse.click(360, 300);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true }); await body.fill('NOMAD');
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('NOMAD'));
    const textId = (await reception(page)).texts[0].id;
    assert.equal((await reception(page)).texts[0].visibility, 'PUBLIC', 'plain T then typing includes new Reception Text');
    const closeTools = page.getByRole('button', { name: 'Close Text tools', exact: true });
    if (await closeTools.isVisible()) { await closeTools.focus(); await page.keyboard.press('Enter'); }
    await editorCommand(page, 'Canvas', 'Preview');
    let preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
    await preview.getByText('NOMAD', { exact: true }).waitFor();
    const textLayer = preview.locator(`[data-layer-id="${textId}"]`);
    assert.equal(await textLayer.evaluate(node => {
      const surface = node.parentElement.querySelector('.reception-document-cell-surface');
      return Boolean(surface.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    }), true, 'the published Text layer follows its Shape surface in paint order');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-text-included-preview.png`, fullPage: true });
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    const cellBox = await shape(page, cellId).boundingBox();
    await page.mouse.dblclick(cellBox.x + 30, cellBox.y + 30);
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Text tools', exact: true }).focus(); await page.keyboard.press('Enter');
    const sharedTools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    if (await sharedTools.isVisible()) await sharedTools.click();
    await page.getByRole('tab', { name: 'Article settings', exact: true }).focus(); await page.keyboard.press('Enter');
    const include = page.getByRole('checkbox', { name: 'Include in Reception', exact: true });
    assert.equal(await include.isChecked(), true);
    await include.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.texts[0].visibility === 'PRIVATE');
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).focus(); await page.keyboard.press('Enter');
    await editorCommand(page, 'Canvas', 'Preview');
    preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true }); await preview.waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${textId}"]`).count(), 0, 'explicitly private Text is absent from the public projection');
    assert.equal(await preview.getByText('NOMAD', { exact: true }).count(), 0);
    assert.match(JSON.stringify((await reception(page)).texts[0].article), /NOMAD/, 'hiding Text preserves its actual writing');
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal((await reception(page)).texts[0].visibility, 'PRIVATE', 'reopening the Editor never publishes previously private Text');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento keeps proposal count separate, preserves mixed cell style and scales desktop radius with its clip', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width: 1280, height: 800 });
  try {
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const create = panel.getByRole('button', { name: 'Create Bento', exact: true });
    assert.equal(await create.evaluate(node => {
      const r = node.getBoundingClientRect(); return r.bottom <= innerHeight && node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true, 'creation stays visible without scrolling on a laptop');
    await panel.getByLabel('Number of cells', { exact: true }).fill('2'); await create.click();
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    await panel.getByLabel('Number of cells', { exact: true }).fill('8');
    await panel.getByRole('button', { name: 'Current grid', exact: true }).click();
    await panel.getByLabel('Width (px)', { exact: true }).fill('1600');
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    assert.equal((await reception(page)).cells.length, 2);
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    assert.equal(await panel.getByLabel('Number of cells', { exact: true }).inputValue(), '8');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    const tools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    if (await tools.isVisible()) await tools.click();
    const ids = (await reception(page)).cells.map(cell => cell.id);
    for (const [index, radius] of [12, 64].entries()) {
      for (let i = 0; i < 7 && await tools.isVisible(); i++) await tools.click();
      await bentoCell(page, ids[index]).click(); await editorMenu(page, 'Bento').click();
      await panel.getByLabel('Selected cell radius (px)', { exact: true }).fill(String(radius));
      await panel.getByRole('button', { name: 'Apply cell radius', exact: true }).click();
      await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    }
    await editorMenu(page, 'Bento').click();
    assert.equal(await panel.getByLabel('Corner radius (px)', { exact: true }).getAttribute('placeholder'), 'Mixed');
    assert.equal(await panel.getByLabel('Corner radius (px)', { exact: true }).inputValue(), '');
    await panel.getByLabel('Width (px)', { exact: true }).fill('1440');
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    assert.deepEqual((await reception(page)).cells.map(cell => cell.radius), [12, 64]);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    for (let i = 0; i < 7 && await tools.isVisible(); i++) await tools.click();
    await bentoCell(page, ids[1]).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await backToCells(page);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true });
    await preview.getByRole('slider', { name: 'Preview width', exact: true }).fill('900');
    const cell = preview.locator(`[data-cell-id="${ids[1]}"]`);
    assert.equal(await cell.evaluate(node => getComputedStyle(node).borderRadius), '40px');
    assert.equal(await cell.locator('.shape-fill').evaluate(node => getComputedStyle(node).borderRadius), '40px');
    const member = (await reception(page)).cells[1].members[0];
    const clip = await preview.locator(`[data-layer-id="${member}"]`).evaluate(node => node.style.clipPath);
    assert.match(clip, /^path\(/u);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/mixed-radius-900.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
async function backToCells(page) {
  await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
}

test('Bento released buttons and failed capture restore preview and leave the next gesture usable', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 2);
    const before = await reception(page);
    const edge = page.getByRole('separator').first(), original = await edge.boundingBox();
    await page.evaluate(() => window.addEventListener('pointerdown', event => { window.bentoTestPointer = event.pointerId; }, { once: true, capture: true }));
    await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2); await page.mouse.down();
    assert.equal(await page.evaluate(() => Number.isInteger(window.bentoTestPointer)), true);
    await page.mouse.move(original.x + original.width / 2 + 35, original.y + original.height / 2 + 35, { steps: 4 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: window.bentoTestPointer, buttons: 0, clientX: 900, clientY: 600, bubbles: true })));
    await page.mouse.up();
    assert.deepEqual(await reception(page), before);
    assert.deepEqual(await edge.boundingBox(), original);
    await edge.evaluate(node => { node.setPointerCapture = () => { throw Error('Simulated capture failure'); }; });
    await edge.click();
    assert.deepEqual(await reception(page), before);
    await edge.evaluate(node => { delete node.setPointerCapture; });
    await edge.focus(); await edge.press('ArrowRight');
    assert.notDeepEqual(await reception(page), before);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('small empty cells explain Text limits and content-aware split is disabled before saving', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 1);
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    for (const label of ['Width (px)', 'Height (px)']) await panel.getByLabel(label, { exact: true }).fill('320');
    await panel.getByRole('button', { name: 'Apply settings', exact: true }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    const cell = (await reception(page)).cells[0].id;
    await bentoCell(page, cell).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await backToCells(page); await editorMenu(page, 'Bento').click();
    await panel.getByText('Split or merge this cell', { exact: true }).click();
    const split = panel.getByRole('button', { name: 'Split vertically', exact: true });
    assert.equal(await split.isDisabled(), true); assert.match(await split.getAttribute('title'), /Text needs a frame/);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo');
    await cellMenu(page, cell, 'Split vertically');
    await bentoCell(page, cell).click();
    const text = page.getByRole('button', { name: '+ Text', exact: true });
    assert.equal(await text.isDisabled(), true); assert.match(await text.getAttribute('title'), /180 × 100/);
    const toolbar = page.getByRole('toolbar', { name: 'Selected cell actions', exact: true });
    const r = await bentoCell(page, cell).boundingBox(), t = await toolbar.boundingBox();
    assert.ok(t.y + t.height <= r.y || t.y >= r.y + r.height, 'small cell keeps its contents free of action buttons');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/small-cell-limits.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
