import { undockWindow } from './fixtures/undock-window.mjs';
import { setBentoCellCount, bentoCellCount, setBentoFormat, addBentoCell, setCurrentBentoField, seedBentoGrid } from './fixtures/bento-layout.mjs';
import { openEditorMenu, editorMenu, activeEditorDocument, editorCommand, selectEditorDocument } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { openSharedTool, closeSharedTool } from './fixtures/shared-tools.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/composition-native-editor';
const snapshot = page => page.evaluate(() => window.nativeCompositionFixture.root.getDraft());
const otherDraft = page => page.evaluate(() => window.nativeCompositionFixture.root.readWorkbench('workbench:main').draft);
const composition = async page => (await snapshot(page));
const shape = (page, id) => page.locator(`.shape-instance [data-workbench-view-id="${id}"]`);
const profileFields = ({ profileAddress, draftVersion, identityPresentation, keeperDocks }) => ({ profileAddress, draftVersion, identityPresentation, keeperDocks });
const cellFrame = (value, id) => value.workbench.shapes.find(item => item.id === id).window;

for (const width of [1440, 900]) test(`Composition preview resizes with the browser and returns without editing (${width})`, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1&session=' + crypto.randomUUID());
    await page.getByRole('toolbar', { name: 'Creation tools' }).waitFor();
    const before = await snapshot(page);
    const history = () => page.evaluate(() => window.nativeCompositionFixture.root.getHistory());
    const previousHistory = await history();
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    const artwork = preview.locator('.composition-document-canvas');
    await artwork.locator('[data-cell-id]').first().waitFor();
    assert.equal(await preview.locator('[data-profile-header], [contenteditable=true]').count(), 0);
    assert.equal(await preview.getByRole('slider', { name: 'Preview width' }).count(), 0);
    assert.equal(await preview.getByRole('button', { name: 'Page appearance' }).count(), 0);
    for (const nextWidth of [800, 1200]) {
      await page.setViewportSize({ width: nextWidth, height: 800 });
      await page.waitForFunction(() => {
        const node = document.querySelector('dialog[open] .composition-document-canvas');
        const rect = node?.getBoundingClientRect();
        return rect?.width > 0 && rect.left >= -1 && rect.right <= innerWidth + 1;
      });
      assert.deepEqual(await snapshot(page), before);
    }
    await preview.getByRole('button', { name: 'Back to editing' }).click();
    await preview.waitFor({ state: 'hidden' });
    assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(await history(), previousHistory);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('marquee moves two cells together before and after grouping', async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1');
    const cells = page.locator('[data-editor-cell-surface]');
    await cells.first().waitFor();
    const before = await composition(page);
    const [left, top, bottom] = before.cells.map(cell => cell.id);
    const drag = async (x, y, dx, dy) => {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 8 });
      await page.mouse.up();
    };
    await drag(718, 190, 407, 549);
    assert.equal(await page.locator('[data-editor-cell-surface][data-selected]').count(), 2);
    const assertMoved = async original => {
      await drag(760, 280, 45, 30);
      const after = await composition(page);
      const delta = id => ['left', 'top'].map(k => cellFrame(after, id)[k] - cellFrame(original, id)[k]);
      assert.ok(delta(top).every(n => n > 0));
      assert.deepEqual(delta(bottom), delta(top));
      assert.deepEqual(delta(left), [0, 0]);
      await editorCommand(page, 'Edit', 'Undo');
      assert.deepEqual(await composition(page), original);
    };
    await assertMoved(before);
    await drag(718, 190, 407, 549);
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Group selected layers', exact: true }).click();
    await page.getByLabel('Group name').fill('Pair');
    await page.getByRole('button', { name: 'Create group' }).click();
    await closeSharedTool(page, 'Layers');
    await page.mouse.click(718, 190);
    await assertMoved(await composition(page));
    await page.mouse.dblclick(760, 280);
    assert.equal(await page.locator('[data-editor-cell-surface][data-selected]').count(), 1);
    const grouped = await composition(page);
    await drag(760, 280, 100, -40);
    const moved = await composition(page);
    assert.notDeepEqual(cellFrame(moved, top), cellFrame(grouped, top));
    assert.deepEqual(cellFrame(moved, bottom), cellFrame(grouped, bottom));
    const surface = page.locator(`[data-editor-cell-surface="${top}"]`);
    await surface.dblclick({ position: { x: 36, y: 30 } });
    await page.getByRole('button', { name: 'Back to cells' }).waitFor();
    await page.keyboard.press('Escape');
    await surface.waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('mixed marquee moves free artwork and cells from either surface', async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1');
    await page.locator('[data-editor-cell-surface]').first().waitFor();
    await page.evaluate(() => {
      const root = window.nativeCompositionFixture.root, draft = root.getDraft();
      draft.cells = draft.cells.filter(cell => !cell.members.includes(draft.imageModules[0].id));
      root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() });
    });
    const original = await composition(page);
    const drag = async (x, y, endX, endY) => {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 8 });
      await page.mouse.up();
    };
    for (const [x, y] of [[450, 400], [760, 280]]) {
      await drag(300, 190, 1140, 750);
      assert.equal(await page.locator('[data-editor-cell-surface][data-selected]').count(), 2);
      await drag(x, y, x + 45, y + 30);
      const moved = await composition(page);
      const image = value => value.workbench.imageModules[0].position;
      for (const axis of ['left', 'top']) {
        const delta = image(moved)[axis] - image(original)[axis];
        assert.ok(delta > 0);
        for (const { id } of original.cells)
          assert.equal(cellFrame(moved, id)[axis] - cellFrame(original, id)[axis], delta);
      }
      assert.deepEqual(moved.cells, original.cells);
      await editorCommand(page, 'Edit', 'Undo');
      assert.deepEqual(await composition(page), original);
    }
    await drag(300, 190, 1140, 750);
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Group selected layers', exact: true }).click();
    await page.getByLabel('Group name').fill('Mixed');
    await page.getByRole('button', { name: 'Create group' }).click();
    await closeSharedTool(page, 'Layers');
    await page.mouse.click(300, 190);
    await drag(450, 400, 495, 430);
    const grouped = await composition(page);
    assert.notDeepEqual(cellFrame(grouped, original.cells[0].id), cellFrame(original, original.cells[0].id));
    await editorCommand(page, 'Edit', 'Undo');
    await page.mouse.dblclick(450, 400);
    await drag(450, 400, 495, 430);
    const individual = await composition(page);
    assert.notDeepEqual(individual.workbench.imageModules, original.workbench.imageModules);
    assert.deepEqual(individual.workbench.shapes, original.workbench.shapes);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('free image drops directly onto the canvas cell with Undo', async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1');
    await page.locator('[data-editor-cell-surface]').first().waitFor();
    await page.evaluate(() => {
      const root = window.nativeCompositionFixture.root, draft = root.getDraft();
      draft.cells = draft.cells.filter(cell => !cell.members.includes(draft.imageModules[0].id));
      root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() });
    });
    const before = await composition(page), image = before.imageModules[0].id;
    await page.mouse.move(450, 400);
    await page.mouse.down();
    await page.mouse.move(820, 380, { steps: 8 });
    const target = await page.locator('[data-cell-drop]').getAttribute('data-editor-cell-surface', { timeout: 4000 });
    await page.mouse.up();
    const after = await composition(page);
    assert.ok(after.cells.find(cell => cell.id === target).members.includes(image));
    assert.notDeepEqual(after.workbench.imageModules, before.workbench.imageModules);
    assert.equal(await page.locator('[data-cell-drop]').count(), 0);
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await composition(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Layers releases and adopts the same image by drag, with Undo', async () => {
  const { browser, page } = await setup();
  try {
    await page.goto(`${origin}/browser-tests/composition-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    await page.locator('[data-editor-cell-surface]').first().waitFor();
    const initial = await composition(page), id = initial.imageModules[0].id;
    const source = initial.cells.find(cell => cell.members.includes(id));
    const target = initial.cells.find(cell => cell.id !== source.id);
    await openSharedTool(page, 'Layers');
    const layers = page.locator('.workbench-layers');
    const row = id => layers.locator(`[data-layer-id="${id}"]`);
    await row(source.id).getByRole('button', { name: /^Expand / }).click();
    const image = row(id);
    await image.getByRole('button', { name: /^Select / }).click();
    // Drop on the upper edge of a top-level row, outside the destination cell.
    await image.dragTo(row(target.id), { targetPosition: { x: 40, y: 2 } });
    const released = await composition(page);
    assert.ok(released.cells.every(cell => !cell.members.includes(id)));
    assert.deepEqual(released.workbench.imageModules, initial.workbench.imageModules);
    const topLevel = await layers.locator('.workbench-layers-list > div > [data-layer-id]').evaluateAll(rows => rows.map(row => row.dataset.layerId));
    assert.equal(topLevel[topLevel.indexOf(target.id) - 1], id);
    await image.dragTo(row(target.id));
    assert.ok((await composition(page)).cells.find(cell => cell.id === target.id).members.includes(id));
    const adopted = await composition(page);
    const list = layers.locator('.workbench-layers-list');
    const box = await list.boundingBox();
    await image.dragTo(list, { targetPosition: { x: 12, y: Math.floor(box.height) - 4 } });
    assert.ok((await composition(page)).cells.every(cell => !cell.members.includes(id)));
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await composition(page), adopted);
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await composition(page), released);
  } finally { await browser.close(); }
});

test('cell alignment toggles directly and positions the fitted image in Editor and Preview through Undo and reload', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(`${origin}/browser-tests/composition-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    const initial = await composition(page), image = initial.imageModules[0];
    const cell = initial.cells.find(item => item.members.includes(image.id));
    await bentoCell(page, cell.id).click({ position: { x: 16, y: 20 } });
    const inspector = await openCellInspector(page);
    const dot = inspector.getByRole('button', { name: 'Position bottom right', exact: true });
    await dot.click();
    const anchored = await composition(page);
    assert.equal(anchored.cells.find(item => item.id === cell.id).memberAnchors[0].alignY, 'bottom');
    assert.equal(await inspector.getByRole('button', { name: 'Release cell positioning', exact: true }).count(), 0);
    const paint = () => page.locator(`[data-image-artwork-id="${image.artwork.id}"] svg.image-module__artwork > image`);
    const assertBottom = async node => {
      await node.waitFor();
      await page.waitForFunction(node => Math.abs(node.y.baseVal.value + node.height.baseVal.value - node.ownerSVGElement.viewBox.baseVal.height) < .01, await node.elementHandle());
      return Number(await node.getAttribute('y'));
    };
    const bottom = await assertBottom(paint());
    assert.ok(bottom > 0, 'the fitted square moves to the bottom of its taller frame');
    await dot.click();
    assert.equal((await composition(page)).cells.find(item => item.id === cell.id).memberAnchors?.length || 0, 0);
    assert.ok(Number(await paint().getAttribute('y')) < bottom, 'free placement restores ordinary centred fitting');
    await editorCommand(page, 'Edit', 'Undo');
    await assertBottom(paint());
    await page.reload();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await assertBottom(paint());
    assert.deepEqual(await composition(page), anchored);
    await editorCommand(page, 'Canvas', 'Preview');
    await assertBottom(page.locator(`.composition-document-canvas [data-layer-id="${image.id}"] svg.image-module__artwork > image`));
    assert.deepEqual(await composition(page), anchored, 'preview does not rewrite the alignment');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});



for (const width of [1440, 900]) test(`Composition cell fill survives late window styles at ${width}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    await generateBento(page, 2);
    // The full application can load these shared styles after Shape's styles.
    // Exercise that order rather than relying on the fixture's eager imports.
    await page.addStyleTag({ url: `${origin}/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css` });
    for (const gap of [0, 12]) {
      await page.evaluate(gap => {
        const { root } = window.nativeCompositionFixture, draft = root.getDraft();
        draft.bento.gap = gap;
        draft.cells.forEach((cell, index) => Object.assign(
          draft.shapes.find(record => record.id === cell.id),
          { color: index ? '#000000' : '#cc2222', opacity: index ? 0.25 : 1 },
        ));
        if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Cannot save cell colours');
      }, gap);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const surfaces = await page.locator('.shape-instance[data-cell-owner] .shape-paint').evaluateAll(nodes => nodes.map(node => {
        const paint = node.getBoundingClientRect(), host = node.closest('.shape-window').getBoundingClientRect();
        const fill = getComputedStyle(node.querySelector('.shape-fill'));
        return { width: paint.width, height: paint.height, hostWidth: host.width, hostHeight: host.height,
          color: fill.color, opacity: fill.opacity };
      }));
      assert.equal(surfaces.length, 2);
      for (const surface of surfaces) {
        assert.ok(surface.width > 0 && surface.height > 0, 'cell paint must have visible area');
        assert.ok(Math.abs(surface.width - surface.hostWidth) < 1, 'paint fills cell width');
        assert.ok(Math.abs(surface.height - surface.hostHeight) < 1, 'paint fills cell height');
      }
      assert.deepEqual(surfaces.map(({ color, opacity }) => ({ color, opacity })),
        [{ color: 'rgb(204, 34, 34)', opacity: '1' }, { color: 'rgb(0, 0, 0)', opacity: '0.25' }]);
    }
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/cell-fill-late-styles-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

async function openCellInspector(page) {
  const inspector = await openSharedTool(page, 'Inspector');
  await inspector.getByRole('tablist', { name: 'Cell settings', exact: true }).getByRole('tab', { name: 'Cell', exact: true }).click();
  return inspector;
}
async function openCellColour(inspector, label) {
  const appearance = inspector.locator('[data-inspector-section="Color"]');
  if (!await appearance.evaluate(node => node.open)) await appearance.locator(':scope > summary').click();
  const picker = appearance.locator('.workbench-inspector-colour').filter({ hasText: new RegExp(`^${label}`) });
  if (!await picker.evaluate(node => node.open)) await picker.locator(':scope > summary').click();
  return picker;
}
async function openCellInnerLines(inspector) {
  const bento = inspector.locator('[data-inspector-section="Bento"]');
  if (!await bento.evaluate(node => node.open)) await bento.locator(':scope > summary').click();
  const lines = bento.locator('.workbench-inspector-inline').filter({ hasText: 'Inner-line style' });
  if (!await lines.evaluate(node => node.open)) await lines.locator(':scope > summary').click();
  const picker = lines.locator('.workbench-inspector-colour');
  if (!await picker.evaluate(node => node.open)) await picker.locator(':scope > summary').click();
  return lines;
}

test('deleting the edited cell then Undo leaves a consistent mode and explicit reentry authors members', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 1);
    const initial = await composition(page), id = initial.cells[0].id;
    await bentoCell(page, id).dblclick({ position: { x: 60, y: 120 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    const layers = await openSharedTool(page, 'Layers');
    await layers.getByRole('button', { name: `Delete ${initial.shapes.find(item => item.id === id).name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm layer deletion', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo');
    assert.equal(await page.getByRole('button', { name: 'Back to cells', exact: true }).count(), 0);
    await closeSharedTool(page, 'Layers');
    await bentoCell(page, id).dblclick({ position: { x: 60, y: 120 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await rectangle(page, undefined, undefined, id);
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().shapes.length === 2);
    const after = await composition(page);
    assert.deepEqual(after.cells[0].members, [after.shapes.find(item => item.id !== id).id]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Preview renders new Light Text with its authored contrast after theme changes', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width: 900, height: 900 });
  try {
    await generateBento(page, 1);
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    const id = (await composition(page)).cells[0].id;
    await bentoCell(page, id).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('Readable new text on the light cell.');
    await page.locator('main[data-composition-editor]').focus();
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().texts[0]?.article.content.content.length > 0);
    const appearance = (await composition(page)).texts[0].article.appearance;
    assert.equal(appearance.color, '#000000'); assert.equal(appearance.background, null);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    const viewport = preview.locator('.composition-document-viewport');
    await preview.locator('.composition-document-canvas:not([data-mobile])').waitFor();
    assert.equal(await preview.getByRole('slider', { name: 'Preview width' }).count(), 0);
    assert.ok((await viewport.boundingBox()).width > 0);
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await editorCommand(page, 'Edit', 'Settings'); await page.getByRole('button', { name: 'DARK', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    assert.deepEqual((await composition(page)).texts[0].article.appearance, appearance);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Inner lines form an open six-cell grid, follow resizing and agree in Editor and projected preview', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await mkdir(output, { recursive: true });
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await openEditorMenu(page, 'Bento');
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    await setBentoCellCount(panel, 6);
    for (const [name, value] of [['Width (px)', '1200'], ['Height (px)', '400'], ['Gutter (px)', '0'], ['Outer margin (px)', '0']])
      await setCurrentBentoField(panel, name, value);
    await panel.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await seedBentoGrid(page, 3, 2);
    for (const cell of (await composition(page)).cells) {
      await bentoCell(page, cell.id).click();
      const colour = await openCellInspector(page);
      const opacity = colour.locator('[data-inspector-section="Color"]').getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true });
      await opacity.fill('0'); await opacity.press('Enter');
      const width = colour.locator('[data-inspector-section="Color"]').getByRole('spinbutton', { name: 'Stroke width (px)', exact: true });
      await width.fill('6'); await width.press('Enter');
      await colour.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    }
    const before = await composition(page), otherCanvas = await otherDraft(page);
    const lines = page.locator('.composition-bento-line-layer .composition-inner-lines path');
    await openEditorMenu(page, 'Bento');
    await panel.getByLabel('Show inner lines', { exact: true }).check();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.deepEqual((await composition(page)).innerLines, { color: '#ebece7', width: 1, opacity: 1 }, 'checkboxes save immediately and survive closing');
    assert.equal(await lines.count(), 1);
    await openEditorMenu(page, 'Bento');
    await panel.getByLabel('Show inner lines', { exact: true }).uncheck();
    await panel.getByLabel('Show inner lines', { exact: true }).check();
    await panel.getByLabel('Show outer frame', { exact: true }).uncheck();
    assert.equal(await panel.locator('input[type="color"]').count(), 0);
    const saved = await composition(page);
    assert.deepEqual(saved, { ...before, showFrame: false, innerLines: { color: '#ebece7', width: 1, opacity: 1 } });
    assert.equal(saved.workbench.area.width, 1200);
    assert.equal(saved.workbench.area.height, 400, 'the generated layout uses the authored Bento height');
    const expected = 'M400,0V400 M800,0V400 M0,200H1200';
    assert.equal(await lines.getAttribute('d'), expected);
    assert.equal(await page.locator('.shape-instance[data-cell-owner] .shape-outline').count(), 0);
    await panel.getByLabel('Gutter (px)', { exact: true }).fill('40');
    assert.notEqual(await lines.getAttribute('d'), expected, 'lines follow temporary gutter geometry');
    assert.deepEqual(await composition(page), saved);
    await panel.getByLabel('Gutter (px)', { exact: true }).press('Escape');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.equal(await lines.getAttribute('d'), expected);
    await bentoCell(page, (await composition(page)).cells[0].id).click();
    const divider = page.getByRole('button', { name: 'Resize cell right', exact: true });
    await divider.focus(); await divider.press('ArrowRight');
    assert.notEqual(await lines.getAttribute('d'), expected);
    await editorCommand(page, 'Edit', 'Undo'); assert.equal(await lines.getAttribute('d'), expected);
    await editorCommand(page, 'Edit', 'Undo'); assert.equal((await composition(page)).showFrame, true);
    await editorCommand(page, 'Edit', 'Undo'); assert.equal(await lines.count(), 0);
    assert.equal(await page.locator('.shape-instance[data-cell-owner] .shape-outline').count(), 6);
    await editorCommand(page, 'Edit', 'Redo');
    await editorCommand(page, 'Edit', 'Redo');
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), saved); assert.equal(await lines.getAttribute('d'), expected);
    await bentoCell(page, saved.cells[0].id).click();
    let colour = await openCellInspector(page);
    const innerLines = await openCellInnerLines(colour);
    const strokeWidth = innerLines.getByRole('spinbutton', { name: 'Stroke width (px)', exact: true });
    await strokeWidth.fill('2'); await strokeWidth.press('Enter');
    const hex = innerLines.getByRole('textbox', { name: 'Color colour', exact: true });
    await hex.fill('c86432'); await hex.press('Enter');
    assert.equal(await lines.getAttribute('stroke'), '#c86432');
    const opacity = innerLines.getByRole('spinbutton', { name: 'Stroke opacity (%)', exact: true });
    await opacity.fill('1'); await opacity.press('Enter');
    assert.equal(Number(await lines.getAttribute('stroke-opacity')), (await composition(page)).innerLines.opacity);
    assert.ok((await composition(page)).innerLines.opacity < 1);
    await opacity.fill('100'); await opacity.press('Enter');
    const beforeGesture = await composition(page), hue = innerLines.getByRole('slider', { name: 'Colour hue', exact: true });
    const hueBox = await hue.boundingBox();
    await page.mouse.move(hueBox.x + hueBox.width / 2, hueBox.y + 4); await page.mouse.down();
    await page.mouse.move(hueBox.x + hueBox.width - 4, hueBox.y + hueBox.height / 2);
    assert.deepEqual(await composition(page), beforeGesture, 'hue movement is temporary until release');
    assert.notEqual(await lines.getAttribute('stroke'), beforeGesture.innerLines.color);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await composition(page), beforeGesture); assert.equal(await lines.getAttribute('stroke'), beforeGesture.innerLines.color);
    await hue.focus(); await hue.press('ArrowRight');
    assert.notEqual((await composition(page)).innerLines.color, beforeGesture.innerLines.color);
    await colour.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual((await composition(page)).innerLines, beforeGesture.innerLines);
    assert.deepEqual((await composition(page)).shapes, before.shapes, 'editing shared strokes does not edit cell fills or their saved outlines');
    for (const [width, theme] of [[1440, 'DARK'], [900, 'LIGHT']]) {
      await page.setViewportSize({ width, height: 1000 });
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: theme, exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
      colour = await openCellInspector(page);
      const field = (await openCellInnerLines(colour)).getByRole('textbox', { name: 'Color colour', exact: true });
      await field.fill(theme === 'DARK' ? 'ebece7' : '171717'); await field.press('Enter');
      await page.screenshot({ path: `${output}/inner-lines-colour-wheel-${width}.png` });
      await colour.getByRole('button', { name: 'Close Inspector', exact: true }).click();
      assert.equal(await lines.evaluate(node => getComputedStyle(node).stroke), theme === 'DARK' ? 'rgb(235, 236, 231)' : 'rgb(23, 23, 23)');
      await openEditorMenu(page, 'Bento');
      const box = await panel.getByLabel('Show inner lines', { exact: true }).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width && box.y + box.height <= 1000);
      await page.screenshot({ path: `${output}/inner-lines-editor-${width}.png` });
      await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
      await editorCommand(page, 'Canvas', 'Preview');
      const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
      const paint = preview.locator('.composition-inner-lines path');
      const edges = await preview.locator('.composition-document-canvas').evaluate(node => {
        const canvas = node.getBoundingClientRect();
        const cells = [...node.querySelectorAll('.composition-document-cell')].map(cell => cell.getBoundingClientRect())
          .sort((a, b) => a.top - b.top || a.left - b.left);
        if (cells.length !== 6) throw Error('Expected the complete six-cell grid');
        return [cells[0].right - canvas.left, cells[0].top - canvas.top, cells[5].bottom - canvas.top,
          cells[1].right - canvas.left, cells[0].top - canvas.top, cells[5].bottom - canvas.top,
          cells[0].left - canvas.left, cells[0].bottom - canvas.top, cells[5].right - canvas.left]
          .map(edge => edge * node.offsetWidth / canvas.width);
      });
      const path = await paint.getAttribute('d');
      assert.match(path, /^M[^MVH]+V[^MVH]+ M[^MVH]+V[^MVH]+ M[^MVH]+H[^MVH]+$/u);
      const coordinates = path.match(/-?\d+(?:\.\d+)?/gu).map(Number);
      assert.equal(coordinates.length, edges.length);
      coordinates.forEach((value, index) => assert.ok(Math.abs(value - edges[index]) < .02,
        'preview strokes meet the actual painted cell edges, including fractional canvas origins'));
      const paintedWidth = await preview.locator('.composition-document-canvas').evaluate(node => node.offsetWidth);
      const scale = paintedWidth / saved.workbench.area.width;
      assert.ok(Math.abs(Number(await paint.getAttribute('stroke-width')) - 2 * scale) < .00001, 'stroke width follows the actual preview scale');
      assert.equal(await preview.locator('.shape-outline').count(), 0);
      assert.equal(await preview.locator('.composition-document-canvas').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await page.screenshot({ path: `${output}/inner-lines-preview-${width}.png` });
      await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    }
    await openEditorMenu(page, 'Bento');
    await panel.getByLabel('Show inner lines', { exact: true }).uncheck();
    assert.equal(await lines.count(), 0);
    assert.equal(await page.locator('.shape-instance[data-cell-owner] .shape-outline').count(), 6);
    assert.deepEqual((await composition(page)).shapes, before.shapes);
    assert.deepEqual(await otherDraft(page), otherCanvas);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Wireframe outlines and the optional outer frame save through native controls, undo, reload and preview', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width: 1440, height: 1000 });
  try {
    await mkdir(output, { recursive: true });
    await generateBento(page, 4);
    const original = await composition(page), id = original.cells[0].id;
    const otherCanvas = await otherDraft(page);
    await bentoCell(page, id).click();
    const color = await openCellInspector(page);
    const opacity = color.locator('[data-inspector-section="Color"]').getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true });
    await opacity.fill('0'); await opacity.press('Enter');
    assert.equal((await composition(page)).shapes.find(item => item.id === id).opacity, 0);
    const outline = await openCellColour(color, 'Stroke');
    const width = color.locator('[data-inspector-section="Color"]').getByRole('spinbutton', { name: 'Stroke width (px)', exact: true });
    await width.fill('4'); await width.press('Enter');
    const hex = outline.getByRole('textbox', { name: 'Color colour', exact: true });
    await hex.fill('d5f75d'); await hex.press('Enter');
    const outlined = await composition(page), record = outlined.shapes.find(item => item.id === id);
    assert.deepEqual(record.outline, { width: 4, color: '#d5f75d', opacity: 1 });
    assert.deepEqual(outlined.workbench, original.workbench);
    const stroke = shape(page, id).locator('.shape-outline');
    assert.equal(await stroke.evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await shape(page, id).locator('.shape-fill').evaluate(node => getComputedStyle(node).opacity), '0');
    await page.screenshot({ path: `${output}/wireframe-color-1440.png` });
    await color.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const frame = panel.getByRole('checkbox', { name: 'Show outer frame', exact: true });
    await frame.uncheck();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.deepEqual(await composition(page), { ...outlined, showFrame: false }, 'the frame choice saves immediately');
    await openEditorMenu(page, 'Bento'); assert.equal(await frame.isChecked(), false);
    const frameless = await composition(page);
    assert.deepEqual(frameless, { ...outlined, showFrame: false });
    assert.equal(await page.locator('canvas[data-workbench-area]').getAttribute('data-show-frame'), 'false');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), outlined);
    assert.equal(await page.locator('canvas[data-workbench-area]').getAttribute('data-show-frame'), 'true');
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), frameless);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), frameless);
    for (const viewportWidth of [1440, 1024]) {
      await page.setViewportSize({ width: viewportWidth, height: 1000 });
      await openEditorMenu(page, 'Bento');
      const checkboxBounds = await frame.boundingBox();
      assert.ok(checkboxBounds.x >= 0 && checkboxBounds.x + checkboxBounds.width <= viewportWidth);
      assert.equal(await frame.isChecked(), false);
      await page.screenshot({ path: `${output}/wireframe-bento-${viewportWidth}.png` });
      await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
      await editorCommand(page, 'Canvas', 'Preview');
      const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
      const canvas = preview.locator('.composition-document-canvas');
      assert.equal(await canvas.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      const outlinePaint = preview.locator(`[data-cell-id="${id}"] .shape-outline`);
      assert.match(await outlinePaint.evaluate(node => getComputedStyle(node).boxShadow), /4px.*inset|inset.*4px/u);
      assert.equal(await preview.locator(`[data-cell-id="${id}"] .shape-fill`).evaluate(node => getComputedStyle(node).opacity), '0');
      await page.screenshot({ path: `${output}/wireframe-preview-${viewportWidth}.png` });
      await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    }
    assert.deepEqual(await otherDraft(page), otherCanvas);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
async function generateBento(page, count = 6) {
  await openEditorMenu(page, 'Bento');
  const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
  await panel.getByRole('button', { name: 'New layout', exact: true }).click();

  await setBentoCellCount(panel, count);
  await panel.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
  await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
  const sidebar = page.getByRole('button', { name: 'Inscape menu', exact: true });
  if (await sidebar.getAttribute('aria-expanded') === 'true') await sidebar.click();
  const tools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
  while (await tools.count()) await tools.first().click();
}
const bentoCell = (page, id) => page.locator(`.composition-bento-cell[data-editor-cell-surface="${id}"]`);

async function openSavedComposition(page) {
  const menu = await openEditorMenu(page);
  await menu.getByRole('menuitemcheckbox', { name: 'Profile', exact: true }).click();
}

async function setup(viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack || error.message); });
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  try {
    await page.goto(`${origin}/browser-tests/composition-native-editor-fixture.html?session=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
  } catch (error) { await browser.close(); throw error; }
  return { browser, page, errors };
}

for (const [width, theme] of [[1440, 'DARK'], [900, 'LIGHT']]) test(`Composition layer transfer and Contents order share saved ownership at ${width}`, { timeout: 120000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    await generateBento(page, 2);
    if (theme === 'LIGHT') {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: theme, exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const initial = await composition(page), [source, target] = initial.cells.map(cell => cell.id);
    await page.evaluate(source => {
      const root = window.nativeCompositionFixture.root, draft = root.getDraft(), value = draft;
      const box = value.workbench.shapes.find(item => item.id === source).window;
      for (const [index, name] of ['Transfer A', 'Transfer B'].entries()) {
        const id = `shape:transfer-${index}`;
        value.shapes.push({ ...value.shapes[0], id, name, color: index ? '#5b88cf' : '#c86432' });
        value.workbench.shapes.push({ id, open: true, window: { left: box.left + 30 + index * 40, top: box.top + 30, width: 100, height: 80 } });
        value.artworkLayers.push(id); value.cells.find(cell => cell.id === source).members.push(id);
      }
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Fixture layers could not be saved');
    }, source);
    let layers = await openSharedTool(page, 'Layers');
    const sourceName = initial.shapes.find(item => item.id === source).name;
    await layers.getByRole('button', { name: `Expand ${sourceName}`, exact: true }).click();
    await layers.getByRole('button', { name: 'Select Transfer A', exact: true }).click();
    await layers.getByRole('button', { name: 'Bring layers to front', exact: true }).click();
    const layerOrder = await layers.locator('.workbench-layer-children .workbench-layer-name').allTextContents();
    await layers.getByRole('button', { name: `Select ${sourceName}`, exact: true }).click();
    let inspector = await openCellInspector(page);
    await inspector.getByRole('tab', { name: 'Contents', exact: true }).click();
    assert.deepEqual(await inspector.locator('.workbench-inspector-member').allTextContents(), layerOrder);
    await inspector.getByRole('button', { name: 'Select Transfer A', exact: true }).click();
    layers = await openSharedTool(page, 'Layers');
    const before = await composition(page);
    const member = layers.locator('[data-layer-id="shape:transfer-0"]');
    await member.dragTo(layers.locator(`[data-layer-id="${target}"]`));
    const moved = await composition(page);
    assert.deepEqual(moved.cells.find(cell => cell.id === target).members, ['shape:transfer-0']);
    assert.deepEqual(moved.cells.find(cell => cell.id === source).members, ['shape:transfer-1']);
    assert.deepEqual(moved.shapes, before.shapes);
    assert.ok(await member.getByRole('button', { name: 'Select Transfer A' }).evaluate(node => document.activeElement === node));
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), before);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), moved);
    await layers.getByRole('button', { name: 'Select Transfer A', exact: true }).click();
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await member.dragTo(layers.locator(`[data-layer-id="${source}"]`), { targetPosition: { x: 42, y: 2 } });
    assert.deepEqual(await composition(page), moved);
    assert.match(await layers.getByRole('alert').innerText(), /could not be saved/);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await member.dragTo(layers.locator(`[data-layer-id="${source}"]`), { targetPosition: { x: 42, y: 2 } });
    const released = await composition(page);
    assert.equal(released.cells.some(cell => cell.members.includes('shape:transfer-0')), false);
    assert.deepEqual(cellFrame(released, 'shape:transfer-0'), cellFrame(moved, 'shape:transfer-0'));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/cell-transfer-${width}.png`, fullPage: true });
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), released); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Cell numeric fields preserve untouched precision and recover saved values after rounding, cancel and failure', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 2);
    const initial = await composition(page), id = initial.cells[0].id;
    await page.evaluate(id => {
      const root = window.nativeCompositionFixture.root, draft = root.getDraft();
      draft.cells.find(cell => cell.id === id).radius = 12.345678;
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Fixture radius could not be saved');
    }, id);
    await bentoCell(page, id).click();
    const inspector = await openCellInspector(page), radius = inspector.getByRole('spinbutton', { name: 'Cell corner radius (px)', exact: true });
    const before = await composition(page);
    await radius.focus(); await radius.press('Tab'); assert.deepEqual(await composition(page), before);
    await radius.fill('24'); await radius.press('Escape'); assert.deepEqual(await composition(page), before);
    assert.equal(await radius.inputValue(), '12.346');
    const size = inspector.getByRole('spinbutton', { name: 'Cell width', exact: true }), originalWidth = cellFrame(before, id).width;
    await size.fill(String(originalWidth - .2)); await size.press('Enter');
    assert.equal(Number(await size.inputValue()), cellFrame(await composition(page), id).width);
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    const saved = await composition(page);
    await radius.fill('30'); await radius.press('Enter');
    assert.deepEqual(await composition(page), saved); assert.equal(await radius.inputValue(), '12.346');
    assert.match(await inspector.getByRole('alert').innerText(), /could not be saved/);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await radius.fill('24'); await radius.press('Enter');
    assert.equal((await composition(page)).cells.find(cell => cell.id === id).radius, 24);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});




for (const width of [1440, 900]) test(`invalid Composition numeric input explains its range without saving at ${width}px`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    if (width === 900) {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    await generateBento(page, 2);
    const id = (await composition(page)).cells[0].id;
    await bentoCell(page, id).click();
    const inspector = await openCellInspector(page);
    const radius = inspector.getByRole('spinbutton', { name: 'Cell corner radius (px)', exact: true });
    const shown = await radius.inputValue(), original = await snapshot(page);
    const history = () => page.evaluate(() => window.nativeCompositionFixture.root.getHistory());
    const initialHistory = await history();
    for (const invalid of ['161', '-1', '']) {
      await radius.fill(invalid); await radius.press('Tab');
      assert.equal(await radius.getAttribute('aria-invalid'), 'true');
      assert.equal(await radius.inputValue(), invalid, 'Invalid text stays available to correct or cancel');
      assert.equal(await radius.evaluate(node => document.getElementById(node.getAttribute('aria-describedby'))?.textContent), 'Enter a number from 0 to 160.');
      assert.deepEqual(await snapshot(page), original);
      assert.deepEqual(await history(), initialHistory, 'Invalid input adds no history operation');
      if (invalid === '161') {
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: `${output}/cell-number-invalid-${width}.png` });
        assert.equal(await inspector.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      }
      await radius.press('Escape');
      assert.equal(await radius.inputValue(), shown);
      assert.equal(await radius.getAttribute('aria-invalid'), null);
      assert.equal(await inspector.getByRole('alert').count(), 0);
      assert.deepEqual(await snapshot(page), original);
    }
    await radius.fill('161'); await radius.press('Tab');
    await radius.fill('24'); await radius.press('Enter');
    assert.equal(await radius.getAttribute('aria-invalid'), null);
    assert.equal((await composition(page)).cells.find(cell => cell.id === id).radius, 24);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original);
    await editorCommand(page, 'Edit', 'Redo');
    assert.equal((await composition(page)).cells.find(cell => cell.id === id).radius, 24);
    await page.reload(); await bentoCell(page, id).waitFor();
    assert.equal((await composition(page)).cells.find(cell => cell.id === id).radius, 24);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Composition layout generator previews without saving, applies native cells and supports undo, reload and failure recovery', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await mkdir(output, { recursive: true });
    const original = await snapshot(page);
    await openEditorMenu(page, 'Bento');
    const dialog = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Width (px)', { exact: true }).inputValue(), '1440');
    assert.equal(await dialog.getByLabel('Height (px)', { exact: true }).inputValue(), '900');
    assert.equal(await dialog.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(43, 43, 43)');
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await setBentoCellCount(dialog, 10);
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
    await openEditorMenu(page, 'Bento');
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await setBentoCellCount(dialog, 10);
    assert.equal(await dialog.getByRole('spinbutton', { name: /radius/i }).count(), 0);
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

    await setBentoCellCount(dialog, 0);
    assert.equal(await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await setBentoCellCount(dialog, 10);
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await dialog.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await composition(page), original);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await dialog.getByRole('button', { name: 'Close Bento', exact: true }).click();
    const saved = await composition(page);
    assert.equal(saved.cells.length, 10);
    saved.cells.forEach((cell, index) => {
      assert.equal(cell.radius, 0);
      assert.deepEqual(saved.workbench.shapes.find(item => item.id === cell.id).window, proposal[index]);
    });
    assert.deepEqual(profileFields(await snapshot(page)), profileFields(original));
    await shape(page, saved.cells[0].id).waitFor({ state: 'visible' });
    await page.screenshot({ path: `${output}/layout-applied-900-light.png` });
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await composition(page), original);
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual(await composition(page), saved);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), saved);
    await openEditorMenu(page, 'Bento');
    await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

    await setBentoCellCount(dialog, 4);
    await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await dialog.getByRole('button', { name: 'Close Bento', exact: true }).click();
    assert.equal((await composition(page)).cells.length, 4);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), saved);
    await editorCommand(page, 'Canvas', 'Preview');
    await page.getByRole('dialog', { name: 'Composition preview', exact: true }).waitFor();
    await page.screenshot({ path: `${output}/layout-preview-900-light.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    const id = (await page.evaluate(() => window.nativeCompositionFixture.root.listWorkbenches()))[0].id;
    await selectEditorDocument(page, id);
    await openEditorMenu(page, 'Canvas');
    assert.equal(await page.getByRole('menuitem', { name: 'Generate cell layout', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('replacing a zero-gap layout preserves hidden frames and inner lines and stays in New layout', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 4);
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await setCurrentBentoField(panel, 'Gutter (px)', 0);
    await panel.getByLabel('Show outer frame', { exact: true }).uncheck();
    await panel.getByLabel('Show inner lines', { exact: true }).check();
    await panel.getByLabel('Show inner lines', { exact: true }).uncheck();
    const before = await composition(page);
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    await setBentoCellCount(panel, 6);
    await panel.getByLabel('Gutter (px)', { exact: true }).fill('0');
    await panel.getByRole('button', { name: 'Replace layout', exact: true }).click();
    assert.equal(await panel.getByRole('button', { name: 'New layout', exact: true }).getAttribute('aria-pressed'), 'true');
    const replaced = await composition(page);
    assert.equal(replaced.cells.length, 6);
    assert.equal(replaced.bento.gap, 0);
    assert.equal(replaced.showFrame, false);
    assert.deepEqual(replaced.innerLines, before.innerLines);
    assert.equal(await page.locator('.composition-bento-line-layer .composition-inner-lines path').count(), 0);
    assert.equal(await page.locator('canvas[data-workbench-area]').getAttribute('data-show-frame'), 'false');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), before);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), replaced);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), replaced);
    await openEditorMenu(page, 'Bento');
    assert.equal(await panel.getByLabel('Show inner lines', { exact: true }).isChecked(), false);
    assert.equal(await panel.getByLabel('Show outer frame', { exact: true }).isChecked(), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento previous variants and start formats remain temporary and restore the exact proposal', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 4);
    const before = await composition(page);
    await openEditorMenu(page, 'Bento');
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
      await setBentoFormat(page, panel, name);
      assert.equal(await panel.getByLabel('Width (px)', { exact: true }).inputValue(), width);
      assert.equal(await panel.getByLabel('Height (px)', { exact: true }).inputValue(), height);
      assert.deepEqual(await composition(page), before);
    }
    await panel.getByRole('button', { name: 'Current grid', exact: true }).click();
    await setBentoFormat(page, panel, 'Square');
    const resized = await composition(page);
    assert.equal(resized.workbench.area.width, before.workbench.area.width, 'the frame still contains its full-width authored grid');
    assert.equal(resized.workbench.area.height, 1080);
    assert.deepEqual(resized.workbench.shapes, before.workbench.shapes);
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    assert.equal(await previous.isDisabled(), false, 'applying size does not lose previous variants');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento gutter and radius preview while typing, Escape cancels, and each accepted field saves one reversible edit', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 2);
    await bentoCell(page, (await composition(page)).cells[0].id).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.composition-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const before = await composition(page), id = before.cells[0].id, initialBox = await bentoCell(page, id).boundingBox();
    const artwork = page.locator(`[data-workbench-view-id="${before.imageModules[0].id}"]`), imageBox = await artwork.boundingBox();
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const gap = panel.getByLabel('Gutter (px)', { exact: true });
    const radius = panel.getByLabel('Corner radius for all cells (px)', { exact: true });
    const neighbour = bentoCell(page, before.cells[1].id);
    const separation = async () => {
      const a = await bentoCell(page, id).boundingBox(), b = await neighbour.boundingBox();
      return Math.max(b.x - a.x - a.width, a.x - b.x - b.width, b.y - a.y - a.height, a.y - b.y - b.height);
    };
    const originalGap = await separation();
    await gap.fill('40');
    assert.ok(await separation() > originalGap, 'the preview increases the distance between cells');
    const previewBox = await bentoCell(page, id).boundingBox(), previewImage = await artwork.boundingBox();
    assert.ok(Math.abs((previewImage.x - previewBox.x) - (imageBox.x - initialBox.x)) <= 1);
    assert.ok(Math.abs((previewImage.y - previewBox.y) - (imageBox.y - initialBox.y)) <= 1);
    assert.deepEqual(await composition(page), before, 'focused spacing is only a preview');
    await gap.press('Escape');
    assert.deepEqual(await bentoCell(page, id).boundingBox(), initialBox);
    await radius.fill('32');
    await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('.composition-bento-cell')).borderRadius) > 0);
    assert.match(await artwork.evaluate(node => node.style.clipPath), /^path\(/u);
    assert.deepEqual(await composition(page), before, 'focused radius is only a preview');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/bento-live-artwork.png` });
    await radius.press('Escape');
    assert.equal(await bentoCell(page, id).evaluate(node => getComputedStyle(node).borderRadius), '0px');
    assert.deepEqual(await artwork.boundingBox(), imageBox);
    await gap.fill('40');
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await gap.press('Enter');
    await panel.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await bentoCell(page, id).boundingBox(), initialBox);
    assert.deepEqual(await composition(page), before);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await setCurrentBentoField(panel, 'Gutter (px)', 40);
    const afterGap = await composition(page);
    assert.equal(afterGap.bento.gap, 40);
    await setCurrentBentoField(panel, 'Corner radius for all cells (px)', 32);
    const after = await composition(page);
    assert.ok(after.cells.every(cell => cell.radius === 32));
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), afterGap);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), before);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), afterGap);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), after);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), after);
    await openEditorMenu(page, 'Bento');
    await gap.fill('60'); await gap.press('Escape');
    const canvasId = (await page.evaluate(() => window.nativeCompositionFixture.root.listWorkbenches()))[0].id;
    await selectEditorDocument(page, canvasId); await selectEditorDocument(page, 'workbench:cell-study');
    assert.deepEqual(await composition(page), after);
    assert.equal(await page.locator('.composition-bento-overlay[data-previewing]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento additions grow the canvas and preserve cell sizes with Undo and reload', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 1);
    const first = (await composition(page)).cells[0].id;
    await bentoCell(page, first).click();
    await addBentoCell(page);
    const row = await composition(page);
    await addBentoCell(page);
    const added = await composition(page);
    assert.deepEqual(added.workbench.area, { ...row.workbench.area, width: row.workbench.area.width + 320 + row.bento.gap });
    for (const cell of row.cells) {
      assert.deepEqual(cellFrame(added, cell.id), cellFrame(row, cell.id));
    }
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await addBentoCell(page, 'bottom');
    const taller = await composition(page);
    assert.deepEqual(taller.workbench.area, { ...added.workbench.area, height: added.workbench.area.height + cellFrame(taller, taller.cells.at(-1).id).height + added.bento.gap });
    for (const cell of added.cells) assert.deepEqual(cellFrame(taller,cell.id),cellFrame(added,cell.id));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/bento-followup-1440-dark.png` });
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), added);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), taller);
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.setViewportSize({ width: 900, height: 800 });
    await openEditorMenu(page, 'Bento');
    assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth && node.getBoundingClientRect().bottom <= innerHeight), true);
    for (const label of ['Previous layout', 'Replace layout']) {
      await panel.getByRole('button', { name: 'New layout', exact: true }).click();
      const button = panel.getByRole('button', { name: label, exact: true });
      await button.scrollIntoViewIfNeeded();
      assert.equal(await button.evaluate(node => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
      }), true, `${label} stays reachable in a narrow computer window`);
    }
    await page.screenshot({ path: `${output}/bento-followup-900-light-bottom.png` });
    await panel.getByRole('button', { name: /^Format:/u }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/bento-followup-900-light.png` });
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), taller); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento free placement and independent handles preview without saving, cancel cleanly, and commit one reversible operation', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 4);
    const original = await composition(page), [first, second] = original.cells;
    const a = await bentoCell(page, first.id).boundingBox(), b = await bentoCell(page, second.id).boundingBox();
    await page.keyboard.down('Shift');
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width + original.bento.gap * b.width / cellFrame(original, second.id).width / 2, b.y + b.height / 2, { steps: 6 });
    assert.deepEqual(await composition(page), original, 'insertion preview is temporary');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await composition(page), original);
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width + original.bento.gap * b.width / cellFrame(original, second.id).width / 2, b.y + b.height / 2, { steps: 6 });
    const planned = await Promise.all(original.cells.map(async cell => [cell.id, await bentoCell(page, cell.id).boundingBox()]));
    await page.mouse.up();
    const inserted = await composition(page);
    await page.keyboard.up('Shift');
    assert.ok(cellFrame(inserted, first.id).left > cellFrame(original, first.id).left);
    for (const cell of original.cells) {
      assert.equal(cellFrame(inserted, cell.id).width, cellFrame(original, cell.id).width);
      assert.equal(cellFrame(inserted, cell.id).height, cellFrame(original, cell.id).height);
    }
    assert.deepEqual(inserted.cells.map(cell => [cell.id, cell.members]), original.cells.map(cell => [cell.id, cell.members]));
    for (const [id, plannedFrame] of planned) {
      const accepted = await bentoCell(page, id).boundingBox();
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(accepted[key] - plannedFrame[key]) < 1,
        'release accepts the complete preview, including pushed neighbours');
    }
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original);
    await bentoCell(page, first.id).click();
    const seam = page.getByRole('button', { name: 'Resize cell right', exact: true });
    const box = await seam.boundingBox(), vertical = true;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const move = async () => {
      await page.keyboard.down('Shift');
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x + (vertical ? 27 : 0), point.y + (vertical ? 0 : 27), { steps: 8 });
    };
    await move(); assert.deepEqual(await composition(page), original);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); await page.keyboard.up('Shift');
    assert.deepEqual(await composition(page), original, 'blur cancels independent resize previews');
    await move(); await page.mouse.up(); await page.keyboard.up('Shift');
    const resized = await composition(page);
    assert.ok(cellFrame(resized, first.id).width > cellFrame(original, first.id).width);
    for (const cell of original.cells.filter(c => c.id !== first.id)) {
      assert.equal(cellFrame(resized, cell.id).width, cellFrame(original, cell.id).width);
      assert.equal(cellFrame(resized, cell.id).height, cellFrame(original, cell.id).height);
    }
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), resized);
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await seam.focus(); await page.keyboard.press(vertical ? 'ArrowRight' : 'ArrowDown');
    const failure = page.locator('.composition-bento-error');
    await failure.waitFor();
    // A pending camera/layout save is flushed before the cell change. Either
    // rejected save must stop the operation without touching accepted geometry.
    assert.match(await failure.innerText(), /^(?:The change could not be saved\. Your saved work is unchanged\.|Save the current edit before changing the bento\.)\s*Dismiss$/u);
    if ((await failure.innerText()).startsWith('Save the current edit'))
      await page.getByRole('alert').filter({ hasText: 'Your workspace layout could not be saved' }).waitFor();
    assert.deepEqual(await composition(page), resized);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await failure.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await bentoCell(page, first.id).click();
    await addBentoCell(page);
    assert.equal((await composition(page)).cells.length, 5);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), resized);
    await bentoCell(page, first.id).click();
    assert.equal(await page.locator('.composition-bento-cell-handle').count(), 8, 'selected cell has eight independent handles');
    await page.screenshot({ path: `${output}/bento-direct-controls-1440.png` });
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), resized);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


const alignFourCells = page => seedBentoGrid(page, 2, 2);

for (const width of [1440, 900]) test(`Bento merges preserve artwork, history and keyboard access at ${width}px`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  // Native presentations may enumerate windows in record order. Authored paint
  // order is the separate artworkLayers list and must remain byte-for-byte intact.
  const normalizeWindows = value => ({ ...value, workbench: { ...value.workbench,
    ...Object.fromEntries(['shapes', 'texts', 'imageModules'].map(key => [key, [...(value.workbench[key] || [])].sort((a, b) => a.id.localeCompare(b.id))])) } });
  const expectComposition = async value => assert.deepEqual(normalizeWindows(await composition(page)), normalizeWindows(value));
  const closeTools = async () => {
    const close = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    while (await close.count()) await close.first().click();
  };
  const command = async (id, group, label) => {
    await closeTools();
    const box = await bentoCell(page, id).boundingBox();
    await bentoCell(page, id).click({ button: 'right', position: { x: 16, y: box.height / 2 } });
    await page.getByRole('menuitem', { name: group, exact: true }).click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
  };
  try {
    await generateBento(page, 4);
    if (width === 900) {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const ids = await alignFourCells(page);
    const [first, , below] = ids, canvas = profileFields(await snapshot(page));
    await bentoCell(page, first).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.composition-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click(); await closeTools();
    await bentoCell(page, below).click();
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('MERGED ARTWORK');
    await page.locator('main[data-composition-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeCompositionFixture.root.getDraft().texts).includes('MERGED ARTWORK'));
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click(); await closeTools();
    const before = await composition(page);
    assert.equal(before.cells.length, 4);
    await command(first, 'Merge cell', 'Below');
    const merged = await composition(page), members = before.cells.filter(cell => [first, below].includes(cell.id)).flatMap(cell => cell.members);
    assert.equal(merged.cells.length, 3);
    assert.deepEqual(merged.cells.find(cell => cell.id === first).members, members);
    assert.deepEqual(merged.imageModules, before.imageModules); assert.deepEqual(merged.texts, before.texts);
    assert.deepEqual(merged.workbench.imageModules, before.workbench.imageModules); assert.deepEqual(merged.workbench.texts, before.workbench.texts);
    await editorCommand(page, 'Edit', 'Undo'); await expectComposition(before);
    await editorCommand(page, 'Edit', 'Redo'); await expectComposition(merged);
    await bentoCell(page, first).focus(); await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Merge cell', exact: true }).focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('menuitem', { name: 'Above', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('menuitem', { name: 'Right', exact: true }).isEnabled(), true);
    const menu = await page.locator('.workbench-object-menu').boundingBox();
    assert.ok(menu.x >= 0 && menu.y >= 0 && menu.x + menu.width <= width && menu.y + menu.height <= 900);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/bento-merge-menu-${width}.png` });
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('menuitem', { name: 'Split cell', exact: true }).count(), 0);
    await page.getByRole('menuitem', { name: 'Merge cell', exact: true }).focus(); await page.keyboard.press('ArrowRight');
    await page.getByRole('menuitem', { name: 'Right', exact: true }).focus(); await page.keyboard.press('Enter');
    const joined = await composition(page); assert.equal(joined.cells.length, 1);
    assert.deepEqual(joined.cells[0].members, members);
    await editorCommand(page, 'Edit', 'Undo'); await expectComposition(merged);
    await editorCommand(page, 'Edit', 'Redo'); await expectComposition(joined);
    await editorCommand(page, 'Edit', 'Undo'); await expectComposition(merged);
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await command(first, 'Merge cell', 'Right');
    await page.getByRole('alert').filter({ hasText: 'The change could not be saved' }).waitFor();
    await expectComposition(merged); // Failed storage does not partially merge cells.
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await command(first, 'Merge cell', 'Right');
    const saved = await composition(page);
    assert.deepEqual(profileFields(await snapshot(page)), canvas);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    await preview.getByText('MERGED ARTWORK', { exact: true }).waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${saved.imageModules[0].id}"]`).count(), 1);
    await page.screenshot({ path: `${output}/bento-merge-preview-${width}.png` });
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await expectComposition(saved); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [width, gap] of [[1440, 32], [900, 64], [900, 0]]) test(`Bento cell borders resize neighbours directly at ${width}px with ${gap}px gutters`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  try {
    await generateBento(page, 1);
    const first = (await composition(page)).cells[0].id;
    await bentoCell(page, first).click();
    await addBentoCell(page);
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.composition-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await setCurrentBentoField(panel, 'Height (px)', 480);
    await setCurrentBentoField(panel, 'Gutter (px)', gap);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await bentoCell(page, first).click();
    await addBentoCell(page, 'bottom');
    if (width === 900) {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const original = await composition(page), [, second, third] = original.cells;
    const otherCanvas = await otherDraft(page);
    for (const [id, edge, axis] of [[first, 'right', 'x'], [second.id, 'left', 'x'], [first, 'bottom', 'y'], [third.id, 'top', 'y']]) {
      await bentoCell(page, id).click();
      const box = await bentoCell(page, id).boundingBox();
      const grip = await page.getByRole('button', { name: 'Resize cell ' + edge, exact: true }).boundingBox();
      const point = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
      const drag = async () => {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.keyboard.down('Shift');
        try { await page.mouse.move(point.x + (axis === 'x' ? 24 : 0), point.y + (axis === 'y' ? 24 : 0), { steps: 6 }); } finally { await page.keyboard.up('Shift'); }
      };
      await page.mouse.move(point.x, point.y);
      assert.equal(await page.evaluate(p => getComputedStyle(document.elementFromPoint(p.x, p.y)).cursor, point), axis === 'x' ? 'ew-resize' : 'ns-resize');
      await drag();
      assert.deepEqual(await composition(page), original, 'drag previews do not save');
      assert.notDeepEqual(await bentoCell(page, id).boundingBox(), box, `${edge} border previews its new dimensions`);
      await page.keyboard.press('Escape'); await page.mouse.up();
      assert.deepEqual(await bentoCell(page, id).boundingBox(), box);
      await drag(); await page.mouse.up();
      const resized = await composition(page);
      assert.deepEqual(resized.cells, original.cells, 'resizing never swaps cell identities or contents');
      for (const cell of original.cells.filter(c => c.id !== id)) {
        assert.equal(cellFrame(resized,cell.id).width,cellFrame(original,cell.id).width);
        assert.equal(cellFrame(resized,cell.id).height,cellFrame(original,cell.id).height);
      }
      const imageId = original.imageModules[0].id;
      const imageFrame = value => {
        const image = value.imageModules.find(item => item.id === imageId);
        return { ...value.workbench.imageModules.find(item => item.id === imageId).position, width: image.width, height: image.height };
      };
      assert.deepEqual(imageFrame(resized), cellFrame(resized, resized.cells.find(cell => cell.members.includes(imageId)).id), 'contained artwork follows the resized cell');
      await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original, 'one undo restores the entire gesture');
      await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), resized);
      if (edge === 'bottom') {
        await mkdir(output, { recursive: true });
        const seam = page.getByRole('button', { name: 'Resize cell bottom', exact: true });
        await seam.focus();
        const seamBox = await seam.boundingBox();
        await page.mouse.move(seamBox.x + seamBox.width / 2, seamBox.y + seamBox.height / 2);
        await page.screenshot({ path: `${output}/bento-cell-border-${width}-gap-${gap}.png` });
      }
      await editorCommand(page, 'Edit', 'Undo');
    }
    assert.deepEqual(await otherDraft(page), otherCanvas, 'ordinary canvas contents stay unchanged');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento cell buttons add native Image and Text directly, retain content when adding a cell, and render in preview', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 2);
    const before = await composition(page), id = before.cells[0].id;
    await bentoCell(page, id).click();
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.composition-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'detached' });
    let value = await composition(page);
    assert.equal(value.imageModules.length, 1);
    assert.deepEqual(value.cells.find(cell => cell.id === id).members, [value.imageModules[0].id]);
    assert.deepEqual(value.workbench.imageModules[0].position, { left: cellFrame(value, id).left, top: cellFrame(value, id).top });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    await text.fill('BENTO INSCAPE');
    await page.locator('main[data-composition-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeCompositionFixture.root.getDraft().texts).includes('BENTO INSCAPE'));
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    value = await composition(page);
    assert.equal(value.texts[0].visibility, 'PUBLIC');
    assert.deepEqual(new Set(value.cells.find(cell => cell.id === id).members), new Set([value.imageModules[0].id, value.texts[0].id]));
    const members = value.cells.find(cell => cell.id === id).members;
    await addBentoCell(page);
    const grown = await composition(page);
    for (const key of ['texts', 'imageModules']) assert.deepEqual(grown[key], value[key]);
    assert.deepEqual(cellFrame(grown, id), cellFrame(value, id));
    for (const key of ['texts', 'imageModules']) assert.deepEqual(grown.workbench[key], value.workbench[key]);
    assert.deepEqual((await composition(page)).cells.find(cell => cell.id === id).members, members);
    await openEditorMenu(page, 'Bento');
    await page.screenshot({ path: `${output}/bento-artwork-menu-1440.png` });
    await page.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    await preview.getByText('BENTO INSCAPE', { exact: true }).waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${value.imageModules[0].id}"]`).count(), 1);
    await page.screenshot({ path: `${output}/bento-artwork-preview.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Studio canvas color applies inside the frame and resets to Charcoal light', async () => {
  const { browser, page, errors } = await setup();
  try {
    await openEditorMenu(page, 'Settings');
    await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
    const canvas = page.locator('[data-workbench-area]');
    const pixels = () => canvas.evaluate(node => {
      const ctx = node.getContext('2d');
      const read = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
      return [read(node.width / 2, node.height / 2), read(1, 1)];
    });
    const original = await pixels(), draft = await composition(page);
    const input = page.getByLabel('Canvas color', { exact: true });
    assert.equal(await page.locator('main.system-workflow').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(222, 219, 211)');
    await input.fill('#205677');
    assert.deepEqual(await pixels(), [[32, 86, 119, 255], original[1]]);
    await page.reload();
    await openEditorMenu(page, 'Settings');
    assert.equal(await input.inputValue(), '#205677');
    await page.getByRole('button', { name: 'Reset canvas color' }).click();
    assert.deepEqual(await pixels(), original);
    assert.deepEqual(await composition(page), draft);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('loose-layer grid snapping is shared between View and Settings on a canvas with cells', async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1');
    await page.locator('[data-editor-cell-surface]').first().waitFor();
    const original = await composition(page);
    const snap = page.getByRole('menuitemcheckbox', { name: 'Snap to grid', exact: true });
    await openEditorMenu(page, 'View');
    const initial = await snap.getAttribute('aria-checked') === 'true';
    await snap.click();
    await openEditorMenu(page, 'Settings');
    const checkbox = page.getByRole('checkbox', { name: 'Grid snapping', exact: true });
    assert.equal(await checkbox.isChecked(), !initial);
    await checkbox.setChecked(initial);
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.reload();
    await openEditorMenu(page, 'View');
    assert.equal(await snap.getAttribute('aria-checked'), String(initial));
    assert.deepEqual(await composition(page), original);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Alt inverts grid snapping while moving artwork inside a cell', async () => {
  const { browser, page } = await setup();
  try {
    const positions = [];
    for (const [enabled, alt] of [[true, false], [true, true], [false, false], [false, true]]) {
      await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1&session=' + crypto.randomUUID());
      await page.locator('[data-editor-cell-surface]').first().waitFor();
      await openEditorMenu(page, 'Settings');
      await page.getByRole('checkbox', { name: 'Grid snapping', exact: true }).setChecked(enabled);
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
      const before = await composition(page);
      const image = before.imageModules[0].id;
      const owner = before.cells.find(cell => cell.members.includes(image)).id;
      await page.locator(`[data-editor-cell-surface="${owner}"]`).dblclick({ position: { x: 115, y: 147 } });
      await page.mouse.move(450, 400);
      await page.mouse.down();
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(461, 409, { steps: 5 });
      await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
      const after = await composition(page);
      const position = value => value.workbench.imageModules.find(item => item.id === image).position;
      assert.notDeepEqual(position(after), position(before));
      assert.ok(after.cells.find(cell => cell.id === owner).members.includes(image));
      positions.push(position(after));
    }
    assert.notDeepEqual(positions[0], positions[1]);
    assert.deepEqual(positions[0], positions[3]);
    assert.deepEqual(positions[1], positions[2]);
  } finally { await browser.close(); }
});

test('generated arrangements carry existing artwork visibly and retain it when reducing the cell count', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const cellId = await rectangle(page, { x: 240, y: 180 }, { x: 1050, y: 850 });
    await cellMenu(page, cellId, 'Turn into cell');
    await dropArtwork(page, { x: 600, y: 410 });
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 1);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const before = await composition(page), imageId = before.imageModules[0].id;
    for (const count of [6, 1]) {
      await openEditorMenu(page, 'Bento');
      const dialog = page.getByRole('dialog', { name: 'Bento settings', exact: true });
      await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

      for (const label of ['Columns', 'Rows']) assert.equal(await dialog.getByLabel(label, { exact: true }).getAttribute('min'), '1');
      await dialog.getByRole('button', { name: 'New layout', exact: true }).click();

      await setBentoCellCount(dialog, count);
      await dialog.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
      await dialog.getByRole('button', { name: 'Close Bento', exact: true }).click();
      const saved = await composition(page);
      assert.equal(saved.cells.length, count);
      assert.deepEqual(saved.cells.find(cell => cell.id === cellId).members, [imageId]);
      assert.deepEqual(saved.imageModules[0].artwork, before.imageModules[0].artwork);
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
    await editorCommand(page, 'Edit', 'Undo'); assert.equal((await composition(page)).cells.length, 6);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('direct Composition entry accepts pointer clicks on controls outside the canvas after a cold load', { timeout: 90000 }, async () => {
  for (const width of [1440, 700]) {
    const { browser, page, errors } = await setup({ width, height: 1000 });
    try {
      const preview = editorMenu(page, 'Canvas');
      const documentLabel = page.locator('.editor-workspace-name');
      assert.equal(await activeEditorDocument(page), 'workbench:cell-study');
      await openEditorMenu(page, 'Tools');
      const tools = page.getByRole('menu', { name: 'Tools options' });
      await tools.waitFor();
      assert.equal(await tools.getByRole('menuitem', { name: 'Groups', exact: true }).count(), 1);
      await page.keyboard.press('Escape');
      const indicator = await documentLabel.boundingBox();
      assert.ok(indicator.x >= 0 && indicator.x + indicator.width <= width, 'the active document remains visible at desktop widths');
      assert.equal(await documentLabel.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'Composition is readable in full');
      assert.equal(await preview.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), true, `the document controls receive the pointer at ${width}px`);
      await editorCommand(page, 'Tools', 'Bento settings');
      await page.getByRole('dialog', { name: 'Bento settings', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close Bento', exact: true }).click();
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close Library', exact: true }).click();
      await editorCommand(page, 'Canvas', 'Preview');
      await page.getByRole('dialog', { name: 'Composition preview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
      await openSavedComposition(page);
      await page.getByRole('button', { name: 'Studio', exact: true }).click();
      await preview.waitFor();
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

async function rectangle(page, from = { x: 300, y: 230 }, to = { x: 780, y: 610 }, withinCell) {
  // These scenarios deliberately draw at specified screen coordinates. Clear
  // the default docked tools through their controls before using that area.
  const tools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
  while (await tools.count()) await tools.first().click();
  if (await undockWindow(page, 'Navigator')) {
    const grip = await page.getByRole('button', { name: 'Move Navigator window', exact: true }).boundingBox();
    const viewport = page.viewportSize();
    await page.mouse.move(grip.x + 20, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(viewport.width - 80, viewport.height - 80, { steps: 8 }); await page.mouse.up();
  }
  if (withinCell) {
    const box = await shape(page, withinCell).boundingBox();
    from = { x: box.x + 10, y: box.y + 10 };
    to = { x: box.x + box.width * .5, y: box.y + box.height * .5 };
  }
  const before = (await composition(page)).shapes.map(item => item.id);
  await page.locator('main[data-composition-editor]').focus();
  await page.keyboard.press('r');
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(ids => window.nativeCompositionFixture.root.getDraft().shapes.some(item => !ids.includes(item.id)), before);
  return (await composition(page)).shapes.find(item => !before.includes(item.id)).id;
}
async function cellMenu(page, id, action, child) {
  const node = shape(page, id);
  const box = await node.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.getByRole('menuitem', { name: action, exact: true }).click();
  if (child) await page.getByRole('menuitem', { name: child, exact: true }).click();
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
    while (await close.count()) await close.first().click();
  };
  const assertImageFits = async id => {
    const value = await composition(page), image = value.imageModules[0], frame = cellFrame(value, id);
    assert.deepEqual(value.cells.find(cell => cell.id === id).members, [image.id]);
    assert.deepEqual(value.workbench.imageModules.find(item => item.id === image.id).position, { left: frame.left, top: frame.top });
    assert.equal(image.width, Math.round(frame.width)); assert.equal(image.height, Math.round(frame.height));
  };
  try {
    await mkdir(output, { recursive: true }); await generateBento(page, 4);
    const [first, right, , deleted] = await alignFourCells(page), canvas = profileFields(await snapshot(page));
    await closeTools(); await bentoCell(page, first).click({ position: { x: 16, y: 30 } });
    // The selected left cell must not take a drop aimed at its right neighbour.
    const target = await bentoCell(page, right).boundingBox();
    await dropArtwork(page, { x: target.x + 20, y: target.y + target.height / 2 }, async () => {
      await page.screenshot({ path: `${output}/bento-library-preview-${width}.png` });
    });
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 1);
    await assertImageFits(right);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click(); await closeTools();
    await bentoCell(page, right).click();
    const beforeResize = await composition(page), divider = page.getByRole('button', { name: 'Resize cell right', exact: true });
    await divider.focus(); await divider.press('ArrowRight'); await assertImageFits(right);
    assert.notDeepEqual(cellFrame(await composition(page), right), cellFrame(beforeResize, right));
    await editorCommand(page, 'Edit', 'Undo'); await assertImageFits(right);
    const beforeDelete = await composition(page), otherColumn = beforeDelete.cells.filter(cell => cellFrame(beforeDelete, cell.id).left !== cellFrame(beforeDelete, right).left);
    // Deleting a sibling leaves the filled cell and its artwork untouched.
    await bentoCell(page, deleted).click({ position: { x: 16, y: 30 } });
    await openEditorMenu(page, 'Tools');
    await page.getByRole('menuitemcheckbox', { name: 'Layers', exact: true }).click();
    const name = beforeDelete.shapes.find(item => item.id === deleted).name;
    await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm layer deletion', exact: true }).click();
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().cells.length === 3);
    const filled = await composition(page); await assertImageFits(right);
    assert.equal(cellFrame(filled, right).top, cellFrame(beforeDelete, right).top);
    assert.equal(cellFrame(filled, right).height, cellFrame(beforeDelete, right).height);
    assert.equal(cellFrame(filled, right).left, cellFrame(beforeDelete, right).left);
    assert.equal(cellFrame(filled, right).width, cellFrame(beforeDelete, right).width);
    for (const cell of otherColumn) assert.deepEqual(cellFrame(filled, cell.id), cellFrame(beforeDelete, cell.id));
    await openEditorMenu(page, 'Tools');
    await page.getByRole('menuitemcheckbox', { name: 'Layers', exact: true }).click();
    await page.screenshot({ path: `${output}/bento-delete-filled-${width}.png` });
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual((await composition(page)).cells, beforeDelete.cells); await assertImageFits(right);
    await editorCommand(page, 'Edit', 'Redo'); await assertImageFits(right);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual((await composition(page)).cells, filled.cells); await assertImageFits(right);
    assert.deepEqual(profileFields(await snapshot(page)), canvas); assert.deepEqual(errors, []);
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
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 1);
    let document = await composition(page);
    assert.deepEqual(document.cells[0].members, [document.imageModules[0].id]);
    assert.equal(await page.getByRole('button', { name: 'Back to cells', exact: true }).count(), 0, 'drop keeps the current cell-level editing scope');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const before = await composition(page);
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await dropArtwork(page, { x: 600, y: 410 });
    await page.getByText(/Image could not be saved|Artwork could not be placed/i).first().waitFor();
    assert.deepEqual(await composition(page), before, 'a failed drop creates neither an Image nor membership');
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await dropArtwork(page, { x: 600, y: 410 });
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 2);
    document = await composition(page);
    assert.deepEqual(document.cells[0].members, document.imageModules.map(item => item.id));
    assert.deepEqual(document.imageModules[0], before.imageModules[0], 'dropping at cell level adds a layer rather than altering an existing Image');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    await page.locator('main[data-composition-editor]').focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 1);
    assert.deepEqual((await composition(page)).cells, before.cells, 'one undo removes both the new Image and its membership');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 2);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual((await composition(page)).cells, document.cells);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Composition uses native Rectangle drawing and cell conversion with undo, reload and isolated saving', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const otherCanvas = await otherDraft(page);
    assert.equal((await composition(page)).cells.length, 0);
    const id = await rectangle(page), drawn = await composition(page);
    await cellMenu(page, id, 'Turn into cell');
    const converted = await composition(page);
    assert.equal(converted.cells.length, 1);
    assert.equal(converted.cells[0].id, id);
    assert.deepEqual(converted.shapes, drawn.shapes, 'conversion keeps shape appearance and identity');
    assert.deepEqual(converted.workbench.shapes, drawn.workbench.shapes, 'conversion keeps drawn geometry');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().cells.length === 0);
    assert.deepEqual((await composition(page)).shapes, drawn.shapes, 'undo converts back without deleting the rectangle');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().cells.length === 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual((await composition(page)).cells, converted.cells);
    assert.deepEqual(await otherDraft(page), otherCanvas, 'native Composition editing leaves the ordinary canvas unchanged');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-rectangle-cell.png`, fullPage: true });
    await openSavedComposition(page);
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal((await composition(page)).cells[0].id, id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Cell settings save rounded corners with undo, clipping and reload at wide and narrow desktop widths', { timeout: 120000 }, async () => {
  for (const width of [1440, 900]) {
    const { browser, page, errors } = await setup({ width, height: 1000 });
    try {
      const otherCanvas = await otherDraft(page);
      const id = await rectangle(page, { x: 220, y: 200 }, { x: 720, y: 650 });
      await cellMenu(page, id, 'Turn into cell');
      await cellMenu(page, id, 'Edit cell contents');
      const child = await rectangle(page, undefined, undefined, id);
      await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
      await bentoCell(page, id).click();
      const inspector = await openCellInspector(page);
      const radius = inspector.getByRole('spinbutton', { name: 'Cell corner radius (px)', exact: true });
      const before = await composition(page);
      await radius.fill('48'); await radius.press('Enter');
      assert.equal((await composition(page)).cells[0].radius, 48);
      const paintedWidth = (await shape(page, id).boundingBox()).width;
      const paintedRadius = await shape(page, id).locator('.shape-fill').evaluate(node => parseFloat(getComputedStyle(node).borderTopLeftRadius));
      assert.ok(Math.abs(paintedRadius - 48 * paintedWidth / cellFrame(before, id).width) < 0.1, 'the radius follows the actual camera scale');
      assert.match(await page.locator(`[data-editor-cell="${id}"]`).first().evaluate(node => node.style.clipPath), /^path\(/u);
      await page.locator('main[data-composition-editor]').focus(); await page.keyboard.press('Control+z');
      assert.deepEqual(await composition(page), before, 'one undo restores the exact original Composition');
      assert.equal(await radius.inputValue(), '0');
      await page.keyboard.press('Control+Shift+z'); assert.equal(await radius.inputValue(), '48');
      for (const invalid of ['', '-1', '161']) {
        await radius.fill(invalid); await radius.press('Enter');
        await radius.fill('48');
        assert.equal((await composition(page)).cells[0].radius, 48);
      }
      await page.evaluate(() => window.nativeCompositionFixture.fail(true));
      await radius.fill('64'); await radius.press('Enter');
      await page.getByRole('alert').filter({ hasText: 'The change could not be saved' }).waitFor();
      assert.equal(await radius.inputValue(), '48', 'failed settings show the saved value alongside the error');
      assert.equal((await composition(page)).cells[0].radius, 48);
      await page.evaluate(() => window.nativeCompositionFixture.fail(false));
      await radius.fill('0'); await radius.press('Enter');
      assert.equal((await composition(page)).cells[0].radius, 0);
      await radius.fill('48'); await radius.press('Enter');
      const bounds = await radius.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'the control fits the desktop window');
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/cell-radius-settings-${width}.png`, fullPage: true });
      await editorCommand(page, 'Canvas', 'Preview');
      const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
      const previewCell = preview.locator(`[data-cell-id="${id}"]`), previewWidth = await previewCell.evaluate(node => node.offsetWidth);
      const previewRadius = await previewCell.evaluate(node => parseFloat(getComputedStyle(node).borderRadius));
      assert.ok(Math.abs(previewRadius - 48 * previewWidth / cellFrame(before, id).width) < 0.1, 'the preview radius follows its projected cell size');
      assert.match(await preview.locator(`[data-layer-id="${child}"]`).evaluate(node => node.style.clipPath), /^path\(/u);
      await page.screenshot({ path: `${output}/cell-radius-preview-${width}.png`, fullPage: true });
      await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
      await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
      await bentoCell(page, id).click(); await openCellInspector(page);
      assert.equal(await radius.inputValue(), '48');
      assert.deepEqual(await otherDraft(page), otherCanvas, 'Composition radius leaves the ordinary canvas untouched');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test('one Editor switches Composition and canvas documents and reopens Composition from Works without mixing layers', { timeout: 120000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const selector = editorMenu(page, 'Canvas');
    await selector.waitFor();
    assert.equal(await activeEditorDocument(page), 'workbench:cell-study');
    assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0);
    const canvasId = 'workbench:main';
    const originalCanvas = await otherDraft(page);

    const cellId = await rectangle(page, { x: 300, y: 230 }, { x: 900, y: 720 });
    await cellMenu(page, cellId, 'Turn into cell');
    await cellMenu(page, cellId, 'Edit cell contents');
    const memberId = await rectangle(page, undefined, undefined, cellId);
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const authoredComposition = await composition(page);
    assert.deepEqual(authoredComposition.cells[0].members, [memberId]);

    await selectEditorDocument(page, canvasId);
    await shape(page, originalCanvas.shapes[0].id).waitFor();
    assert.equal(await activeEditorDocument(page), canvasId);
    assert.equal(await page.locator('main[data-composition-editor]').count(), 1);
    assert.equal(await shape(page, cellId).count(), 0);
    assert.deepEqual(await snapshot(page), originalCanvas, 'selecting the ordinary canvas preserves its original records');
    const beforeIds = (await snapshot(page)).shapes.map(item => item.id);
    await page.locator('main[data-canvas-context="composition"]').focus();
    await page.keyboard.press('r');
    await page.mouse.move(300, 700); await page.mouse.down();
    await page.mouse.move(600, 830, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(ids => window.nativeCompositionFixture.root.getDraft().shapes.some(item => !ids.includes(item.id)), beforeIds);
    const authoredCanvas = await snapshot(page);
    const canvasShape = authoredCanvas.shapes.find(item => !beforeIds.includes(item.id));

    await selectEditorDocument(page, 'workbench:cell-study');
    await shape(page, cellId).waitFor();
    assert.equal(await activeEditorDocument(page), 'workbench:cell-study');
    assert.equal(await shape(page, canvasShape.id).count(), 0);
    assert.deepEqual(await composition(page), authoredComposition, 'switching back preserves Composition layers, membership and geometry');
    await openSavedComposition(page);
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    await selector.waitFor();
    assert.equal(await activeEditorDocument(page), 'workbench:cell-study');
    await shape(page, memberId).waitFor();
    assert.deepEqual(await composition(page), authoredComposition, 'Works reopens the same Composition document');
    await selectEditorDocument(page, canvasId);
    await shape(page, canvasShape.id).waitFor();
    assert.deepEqual(await otherDraft(page), authoredCanvas, 'Composition navigation never rewrites the canvas');

    await page.reload();
    await selector.waitFor();
    await selectEditorDocument(page, 'workbench:cell-study');
    assert.deepEqual(await composition(page), authoredComposition, 'fresh Composition entry retains the same saved composition');
    assert.deepEqual(await otherDraft(page), authoredCanvas, 'fresh Composition entry preserves the separately saved canvas');
    await selectEditorDocument(page, canvasId);
    await shape(page, canvasShape.id).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('failed conversion keeps the native rectangle and current Composition intact', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const id = await rectangle(page), before = await composition(page);
    await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await cellMenu(page, id, 'Turn into cell');
    await page.getByRole('alert').filter({ hasText: /could not be saved|could not be|unchanged/i }).first().waitFor();
    assert.deepEqual(await composition(page), before);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await cellMenu(page, id, 'Turn into cell');
    assert.equal((await composition(page)).cells[0].id, id);
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
    const inner = await rectangle(page, undefined, undefined, id);
    let document = await composition(page);
    assert.deepEqual(document.cells[0].members, [inner]);
    const original = document.workbench.shapes.find(item => item.id === inner).window;
    const outside = document.workbench.shapes.find(item => item.id === id).window;
    const node = shape(page, inner);
    const box = await node.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2 + 24, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(({ id, left }) => window.nativeCompositionFixture.root.getDraft().workbench.shapes.find(item => item.id === id).window.left !== left, { id: inner, left: original.left });
    document = await composition(page);
    assert.deepEqual(document.workbench.shapes.find(item => item.id === id).window, outside, 'moving a child leaves its cell in place');
    assert.notDeepEqual(document.workbench.shapes.find(item => item.id === inner).window, original);
    assert.equal(await page.locator(`[data-editor-cell="${id}"]`).count() > 0, true, 'child uses the cell clipping boundary');
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    await page.locator(`[data-editor-cell-surface="${id}"]`).click();
    await addBentoCell(page, 'bottom', id);
    const before = await composition(page), other = before.cells.find(cell => cell.id !== id).id;
    const parentBox = await shape(page, id).boundingBox(), otherBox = await shape(page, other).boundingBox();
    const parentFrame = before.workbench.shapes.find(item => item.id === id).window;
    await page.mouse.move(parentBox.x + parentBox.width / 2, parentBox.y + parentBox.height / 2); await page.mouse.down();
    await page.mouse.move(otherBox.x + otherBox.width / 2, otherBox.y + otherBox.height / 2, { steps: 8 }); await page.mouse.up();
    document = await composition(page);
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

test('native Library Image and Text belong to the cell and render across preview sizes', { timeout: 120000 }, async () => {
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
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().imageModules.length === 1);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const closeTools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    while (await closeTools.count()) await closeTools.first().click();
    await page.locator('main[data-composition-editor]').focus(); await page.keyboard.press('t');
    const textTarget = await shape(page, id).boundingBox();
    await page.mouse.click(textTarget.x + textTarget.width / 4, textTarget.y + textTarget.height * 0.7);
    const text = page.getByRole('textbox', { name: 'Article text', exact: true }); await text.waitFor();
    await text.fill('Welcome to my Composition. This is a real Text layer.');
    while (await closeTools.count()) await closeTools.first().click();
    await openSharedTool(page, 'Inspector');
    const inclusion = page.getByRole('checkbox', { name: 'Include in publication', exact: true });
    if (!await inclusion.isChecked()) { await inclusion.focus(); await page.keyboard.press('Space'); }
    assert.equal(await page.getByRole('combobox', { name: 'Follow Display', exact: true }).count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Read as pages', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Select tool', exact: true }).focus(); await page.keyboard.press('Control+k');
    await page.getByRole('button', { name: 'Transform', exact: true }).click();
    for (const [label, value] of [['Height', '180'], ['Width', '660'], ['Y', '630']]) {
      const field = page.getByRole('spinbutton', { name: `Transform ${label}`, exact: true });
      await field.fill(value); await field.press('Enter');
    }
    await closeSharedTool(page, 'Inspector');
    await page.locator('main[data-composition-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeCompositionFixture.root.getDraft().texts).includes('Welcome to my Composition.'));
    const document = await composition(page), imageId = document.imageModules[0].id, textId = document.texts[0].id;
    assert.deepEqual(new Set(document.cells[0].members), new Set([imageId, textId]));
    assert.match(document.imageModules[0].artwork.asset.media.url, /abyssal_eye/);
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const closeText = page.getByRole('button', { name: 'Close Inspector', exact: true });
    if (await closeText.isVisible()) await closeText.click();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-image-text-editor.png`, fullPage: true });
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true }); await preview.waitFor();
    await preview.getByText('Welcome to my Composition. This is a real Text layer.', { exact: true }).waitFor().catch(async error => {
      console.log('preview evidence', await composition(page), await preview.innerText(), errors);
      await page.screenshot({ path: `${output}/native-preview-debug.png`, fullPage: true }); throw error;
    });
    assert.equal(await preview.locator(`[data-layer-id="${imageId}"]`).count(), 1);
    await page.screenshot({ path: `${output}/native-preview-desktop-1440.png`, fullPage: true });
    await page.setViewportSize({ width: 900, height: 900 });
    await preview.locator(`[data-layer-id="${imageId}"]`).waitFor();
    assert.deepEqual(await composition(page), document, 'viewing a resized composition preserves the artwork');
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), document);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('new Composition Text appears above its Shape in preview while explicitly private Text stays excluded', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const cellId = await rectangle(page, { x: 240, y: 180 }, { x: 1050, y: 850 });
    await cellMenu(page, cellId, 'Turn into cell');
    await cellMenu(page, cellId, 'Edit cell contents');
    await page.locator('main[data-composition-editor]').focus(); await page.keyboard.press('t');
    const cell = await shape(page, cellId).boundingBox();
    await page.mouse.click(cell.x + cell.width * .4, cell.y + cell.height * .4);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true }); await body.fill('NOMAD');
    await page.locator('main[data-composition-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeCompositionFixture.root.getDraft().texts).includes('NOMAD'));
    const textId = (await composition(page)).texts[0].id;
    assert.equal((await composition(page)).texts[0].visibility, 'PUBLIC', 'plain T then typing includes new Composition Text');
    const closeTools = page.getByRole('button', { name: 'Close Inspector', exact: true });
    if (await closeTools.isVisible()) { await closeTools.focus(); await page.keyboard.press('Enter'); }
    await editorCommand(page, 'Canvas', 'Preview');
    let preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    await preview.getByText('NOMAD', { exact: true }).waitFor();
    const textLayer = preview.locator(`[data-layer-id="${textId}"]`);
    assert.equal(await textLayer.evaluate(node => {
      const surface = node.closest('.composition-cell-group').querySelector('.composition-document-cell-surface');
      return Boolean(surface.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
    }), true, 'the published Text layer follows its Shape surface in paint order');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/native-text-included-preview.png`, fullPage: true });
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    const cellBox = await shape(page, cellId).boundingBox();
    await page.mouse.dblclick(cellBox.x + 30, cellBox.y + 30);
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await body.click();
    const sharedTools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    while (await sharedTools.count()) await sharedTools.first().click();
    await openSharedTool(page, 'Inspector');
    const include = page.getByRole('checkbox', { name: 'Include in publication', exact: true });
    assert.equal(await include.isChecked(), true);
    await include.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => window.nativeCompositionFixture.root.getDraft().texts[0].visibility === 'PRIVATE');
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).focus(); await page.keyboard.press('Enter');
    await editorCommand(page, 'Canvas', 'Preview');
    preview = page.getByRole('dialog', { name: 'Composition preview', exact: true }); await preview.waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${textId}"]`).count(), 0, 'explicitly private Text is absent from the public projection');
    assert.equal(await preview.getByText('NOMAD', { exact: true }).count(), 0);
    assert.match(JSON.stringify((await composition(page)).texts[0].article), /NOMAD/, 'hiding Text preserves its actual writing');
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal((await composition(page)).texts[0].visibility, 'PRIVATE', 'reopening the Editor never publishes previously private Text');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento keeps proposal count separate, preserves mixed cell style and scales desktop radius with its clip', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width: 1280, height: 800 });
  try {
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const create = panel.getByRole('button', { name: 'Create Bento', exact: true });
    assert.equal(await create.evaluate(node => {
      const r = node.getBoundingClientRect(); return r.bottom <= innerHeight && node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true, 'creation stays visible without scrolling on a laptop');
    await setBentoCellCount(panel, 2); await create.click();
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    await setBentoCellCount(panel, 8);
    await panel.getByRole('button', { name: 'Current grid', exact: true }).click();
    await setCurrentBentoField(panel, 'Width (px)', 1600);
    assert.equal((await composition(page)).cells.length, 2);
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    assert.equal(await bentoCellCount(panel), 8);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    const tools = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
    while (await tools.count()) await tools.first().click();
    await seedBentoGrid(page, 2, 1);
    const ids = (await composition(page)).cells.map(cell => cell.id);
    for (const [index, radius] of [12, 64].entries()) {
      while (await tools.count()) await tools.first().click();
      await bentoCell(page, ids[index]).click();
      const inspector = await openCellInspector(page);
      const field = inspector.getByRole('spinbutton', { name: 'Cell corner radius (px)', exact: true });
      await field.fill(String(radius)); await field.press('Enter');
      await closeSharedTool(page, 'Inspector');
    }
    await openEditorMenu(page, 'Bento');
    assert.equal(await panel.getByLabel('Corner radius for all cells (px)', { exact: true }).getAttribute('placeholder'), 'Per cell');
    assert.equal(await panel.getByLabel('Corner radius for all cells (px)', { exact: true }).inputValue(), '');
    await setCurrentBentoField(panel, 'Width (px)', 1440);
    assert.deepEqual((await composition(page)).cells.map(cell => cell.radius), [12, 64]);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    while (await tools.count()) await tools.first().click();
    await bentoCell(page, ids[1]).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await backToCells(page);
    // Deliberately exercise the fully inset case. The generator and the default
    // text size can otherwise place this layer across the rounded boundary.
    await page.evaluate(id => {
      const { root } = window.nativeCompositionFixture, draft = root.getDraft(), value = draft;
      const owner = value.workbench.shapes.find(item => item.id === id).window;
      const cell = value.cells.find(item => item.id === id);
      value.workbench.texts.find(item => item.id === cell.members[0]).window = {
        left: owner.left + 80, top: owner.top + 80, width: 180, height: 60,
      };
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Could not position the text fixture');
    }, ids[1]);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    await page.setViewportSize({ width: 900, height: 1000 });
    const cell = preview.locator(`[data-cell-id="${ids[1]}"]`);
    const expectedRadius = 64 * (await cell.evaluate(node => node.offsetWidth)) / cellFrame(await composition(page), ids[1]).width;
    for (const element of [cell, cell.locator('.shape-fill')]) {
      assert.ok(Math.abs(await element.evaluate(node => parseFloat(getComputedStyle(node).borderRadius)) - expectedRadius) < 0.2);
    }
    const member = (await composition(page)).cells[1].members[0];
    const inset = await preview.locator(`[data-layer-id="${member}"]`).evaluate(node => {
      const owner = node.closest('.composition-cell-group').querySelector('[data-cell-id]');
      const cell = owner.getBoundingClientRect(), text = node.getBoundingClientRect();
      return { clip: node.style.clipPath, radius: parseFloat(getComputedStyle(owner).borderRadius) * cell.width / owner.offsetWidth, clearance: Math.min(text.left - cell.left, text.top - cell.top,
        cell.right - text.right, cell.bottom - text.bottom) };
    });
    assert.ok(inset.clearance >= inset.radius - 1, 'the text lies wholly inside the clear part of the rounded cell: ' + JSON.stringify(inset));
    assert.equal(inset.clip, '', 'inset text needs no second rounded clip');
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
    const before = await composition(page);
    const edge = page.getByRole('button', { name: 'Resize Bento bottom right', exact: true }), original = await edge.boundingBox();
    await page.evaluate(() => window.addEventListener('pointerdown', event => { window.bentoTestPointer = event.pointerId; }, { once: true, capture: true }));
    await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2); await page.mouse.down();
    assert.equal(await page.evaluate(() => Number.isInteger(window.bentoTestPointer)), true);
    await page.mouse.move(original.x + original.width / 2 + 35, original.y + original.height / 2 + 35, { steps: 4 });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: window.bentoTestPointer, buttons: 0, clientX: 900, clientY: 600, bubbles: true })));
    await page.mouse.up();
    assert.deepEqual(await composition(page), before);
    assert.deepEqual(await edge.boundingBox(), original);
    await edge.evaluate(node => { node.setPointerCapture = () => { throw Error('Simulated capture failure'); }; });
    await edge.click();
    assert.deepEqual(await composition(page), before);
    await edge.evaluate(node => { delete node.setPointerCapture; });
    await edge.focus(); await edge.press('ArrowRight');
    assert.notDeepEqual(await composition(page), before);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('adding beside a filled cell supports Text below the standalone article width', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 1);
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    for (const label of ['Width (px)', 'Height (px)']) await setCurrentBentoField(panel, label, 320);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    const cell = (await composition(page)).cells[0].id;
    await bentoCell(page, cell).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await backToCells(page);
    await bentoCell(page, cell).click();
    await addBentoCell(page);
    await bentoCell(page, cell).click();
    const text = page.getByRole('button', { name: '+ Text', exact: true });
    assert.equal(await text.isEnabled(), true);
    const toolbar = page.getByRole('toolbar', { name: 'Selected cell actions', exact: true });
    const r = await bentoCell(page, cell).boundingBox(), t = await toolbar.boundingBox();
    assert.ok(t.y + t.height <= r.y || t.y >= r.y + r.height, 'small cell keeps its contents free of action buttons');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/small-cell-limits.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('cropped preview fills aligned cells as the browser resizes', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1&session=' + crypto.randomUUID());
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    const ids = await page.evaluate(() => {
      const { root } = window.nativeCompositionFixture, draft = root.getDraft(), value = draft;
      const image = value.imageModules[0], cell = value.cells.find(cell => cell.members.includes(image.id));
      const frame = value.workbench.shapes.find(item => item.id === cell.id).window;
      image.width = frame.width; image.height = frame.height; image.artwork.crop = { x: .6, y: .4, zoom: 1.2 };
      value.workbench.imageModules.find(item => item.id === image.id).position = { left: frame.left, top: frame.top };
      cell.memberAnchors = [{ members: [image.id], alignX: 'center', alignY: 'center', paddingX: 0, paddingY: 0 }];
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Crop fixture did not save');
      return { image: image.id, cell: cell.id };
    });
    const saved = await composition(page);
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    for (const width of [1440, 900, 600, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await preview.locator('.workbench-overview-preview').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const geometry = await preview.evaluate((node, ids) => {
        const image = [...node.querySelectorAll('[data-layer-id]')].find(el => el.dataset.layerId === ids.image).getBoundingClientRect();
        const cell = node.querySelector(`[data-cell-id="${ids.cell}"]`).getBoundingClientRect();
        return { image: { x: image.x, y: image.y, width: image.width, height: image.height }, cell: { x: cell.x, y: cell.y, width: cell.width, height: cell.height }, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      }, ids);
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(geometry.image[key] - geometry.cell[key]) < 1, key + ' matches cell at ' + width);
      assert.equal(geometry.overflow, false);
      if ([900, 1440].includes(width)) { await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/responsive-crop-' + width + '.png' }); }
    }
    assert.deepEqual(await composition(page), saved, 'viewing never changes authored geometry or crop');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


for (const [width, theme] of [[1440, 'DARK'], [900, 'LIGHT']]) test(`Composition frame colors persist through Undo, reload and preview at ${width}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    await generateBento(page, 2);
    if (theme === 'LIGHT') {
      await editorCommand(page, 'Edit', 'Settings');
      await page.getByRole('button', { name: theme, exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const before = await composition(page);
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    for (const [label, hex] of [['Frame line', 'ff5500'], ['Frame fill', '112233']]) {
      const button = panel.getByRole('button', { name: `${label} color`, exact: true });
      await button.click();
      const picker = page.getByRole('dialog', { name: `${label} color`, exact: true });
      await picker.getByRole('textbox', { name: 'Color colour', exact: true }).fill(hex);
      await picker.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
      await picker.press('Escape'); await picker.waitFor({ state: 'hidden' });
      await page.waitForFunction(node => node.getAttribute('aria-expanded') === 'false', await button.elementHandle());
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
    }
    await panel.getByRole('button', { name: 'Current grid', exact: true }).click();
    assert.equal(await panel.locator('details').count(), 0, 'color pickers no longer expand inside Bento');
    await panel.getByRole('button', { name: 'Frame fill color', exact: true }).click();
    const fillPicker = page.getByRole('dialog', { name: 'Frame fill color', exact: true });
    await fillPicker.getByRole('spinbutton', { name: 'Frame fill opacity (%)', exact: true }).fill('0');
    await fillPicker.getByRole('spinbutton', { name: 'Frame fill opacity (%)', exact: true }).press('Tab');
    assert.equal((await composition(page)).surfaceOpacity, 0);
    await panel.getByRole('button', { name: 'Frame line color', exact: true }).click();
    await fillPicker.waitFor({ state: 'hidden' });
    const linePicker = page.getByRole('dialog', { name: 'Frame line color', exact: true });
    await panel.getByRole('spinbutton', { name: 'Width (px)', exact: true }).click();
    await linePicker.waitFor({ state: 'hidden' });
    await panel.getByRole('spinbutton', { name: 'Outer frame radius (px)', exact: true }).fill('32');
    await panel.getByRole('spinbutton', { name: 'Outer frame radius (px)', exact: true }).press('Tab');
    const saved = await composition(page);
    assert.equal(saved.frameColor, '#ff5500'); assert.equal(saved.surface, '#112233'); assert.equal(saved.backgroundColor, before.backgroundColor);
    assert.deepEqual(saved.cells, before.cells); assert.deepEqual(saved.workbench, before.workbench);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo');
    assert.equal((await composition(page)).frameRadius ?? 0, 0);
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual(await composition(page), saved);
    await page.reload();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), saved);
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByLabel('Canvas color', { exact: true }).fill('#345678');
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    assert.deepEqual(await composition(page), saved, 'Studio canvas color is a local preference');
    await editorCommand(page, 'Canvas', 'Preview');
    const canvas = page.locator('.composition-document-canvas'); await canvas.waitFor();
    const style = await canvas.evaluate(node => {
      const paint = document.createElement('canvas'); paint.width = paint.height = 1;
      const ctx = paint.getContext('2d'); ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1);
      const fill = [...ctx.getImageData(0, 0, 1, 1).data];
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = getComputedStyle(node).outlineColor; ctx.fillRect(0, 0, 1, 1);
      return { fill, line: [...ctx.getImageData(0, 0, 1, 1).data] };
    });
    assert.deepEqual(style, { fill: [0, 0, 0, 0], line: [255, 85, 0, 255] });
    assert.ok(await canvas.evaluate(node => parseFloat(getComputedStyle(node).borderRadius) > 0));
    assert.notEqual(await page.getByRole('dialog', { name: 'Composition preview' }).evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(52, 86, 120)', 'the studio canvas surround stays outside the visitor preview');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/frame-colors-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('cell grain coverage previews above content, survives zero fill, and switches back to fill-only through Undo', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(`${origin}/browser-tests/composition-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    const initial = await composition(page), image = initial.imageModules[0];
    const id = initial.cells.find(cell => cell.members.includes(image.id)).id;
    await bentoCell(page, id).click({ position: { x: 16, y: 20 } });
    const inspector = await openCellInspector(page), fx = inspector.locator('[data-inspector-section="FX"]');
    await inspector.getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true }).fill('0');
    await inspector.getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true }).press('Enter');
    if (!await fx.evaluate(node => node.open)) await fx.locator(':scope > summary').click();
    const check = fx.getByRole('checkbox', { name: 'Grain over entire cell', exact: true });
    assert.equal(await check.isChecked(), true);
    const strength = fx.getByRole('spinbutton', { name: 'Grain (%)', exact: true });
    await strength.fill('80'); await strength.press('Enter');
    const grain = page.locator(`.composition-cell-grain-layer [data-cell-grain="${id}"]`);
    await grain.waitFor();
    assert.equal(Number(await grain.evaluate(node => getComputedStyle(node).opacity)), .8);
    assert.equal(await page.locator(`.shape-instance[data-cell-owner="${id}"] .module-surface-grain`).count(), 0);
    await check.uncheck(); await grain.waitFor({ state: 'hidden' });
    await page.locator(`.shape-instance[data-cell-owner="${id}"] .module-surface-grain`).waitFor();
    await editorCommand(page, 'Edit', 'Undo'); await grain.waitFor();
    const saved = await composition(page);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), saved); await grain.waitFor();
    await editorCommand(page, 'Canvas', 'Preview');
    await page.locator(`.composition-document-canvas [data-cell-grain="${id}"]`).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 900]) test(`typing retains divider geometry; resize refreshes limits and Undo preserves text at ${width}px`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  try {
    await generateBento(page, 2);
    const first = (await composition(page)).cells[0].id;
    await bentoCell(page, first).click();
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    await text.fill('Retain this article through geometry edits.');
    await backToCells(page);
    const before = await composition(page);
    await bentoCell(page, first).click();
    const divider = page.getByRole('button', { name: 'Resize cell right', exact: true });
    await divider.press('ArrowRight');
    const resized = await composition(page);
    assert.equal(cellFrame(resized, first).width, cellFrame(before, first).width + 1);
    assert.deepEqual(resized.texts, before.texts);
    assert.deepEqual(resized.cells, before.cells);
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await composition(page), before);
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual(await composition(page), resized);
    await editorCommand(page, 'Canvas', 'Preview');
    await page.getByRole('dialog', { name: 'Composition preview', exact: true }).getByText('Retain this article through geometry edits.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [width, theme] of [[1440, 'DARK'], [900, 'LIGHT']]) test(`new cell Text starts spacious with restrained selection chrome at ${width}px ${theme}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 900 });
  try {
    await generateBento(page, 1);
    if (theme === 'LIGHT') {
      await editorCommand(page, 'Edit', 'Settings'); await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    const cell = (await composition(page)).cells[0].id, other = profileFields(await snapshot(page));
    await bentoCell(page, cell).click(); await page.getByRole('button', { name: '+ Text', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true }); await text.waitFor();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await text.evaluate(node => node === document.activeElement), true, 'new empty Text is ready to type');
    assert.equal(await page.locator('.text-editor-placeholder').isVisible(), true, 'the empty prompt stays readable at the cursor');
    assert.equal(await text.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
    const created = await composition(page), record = created.texts.at(-1), frame = created.workbench.texts.find(x => x.id === record.id).window;
    assert.equal(frame.width, 560); assert.equal(frame.height, 160);
    assert.equal(record.article.appearance.fontSize, 28);
    assert.equal(created.cells.find(x => x.id === cell).fitText?.includes(record.id) || false, false);
    const host = page.locator(`.text-window[data-workbench-view-id="${record.id}"]`);
    const chrome = await host.evaluate(node => {
      const bounds = getComputedStyle(node.querySelector('.text-window-bounds'));
      const probe = document.createElement('span'); probe.style.color = 'var(--editor-accent)'; node.append(probe); const accent = getComputedStyle(probe).color; probe.remove();
      return { border: bounds.borderColor, accent, shadow: bounds.boxShadow };
    });
    assert.equal(chrome.border, chrome.accent); assert.equal(chrome.shadow, 'none');
    const grip = page.getByRole('separator', { name: 'Resize Text window', exact: true });
    const handle = await grip.evaluate(node => { const style = getComputedStyle(node, '::after'); return { radius: style.borderRadius, border: style.borderColor }; });
    assert.equal(handle.radius, '50%'); assert.equal(handle.border, chrome.accent);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/text-start-${width}-${theme}.png` });
    const words = 'I feel out of place here. I cannot remember being anywhere else. '.repeat(3);
    await page.keyboard.insertText(words);
    await page.waitForFunction(words => window.nativeCompositionFixture.root.getDraft().texts.some(t => JSON.stringify(t.article.content).includes(words)), words);
    assert.deepEqual((await composition(page)).workbench.texts.find(x => x.id === record.id).window, frame, 'typing keeps the useful line width');
    assert.deepEqual(profileFields(await snapshot(page)), other);
    await editorCommand(page, 'Edit', 'Undo');
    assert.equal(JSON.stringify((await composition(page)).texts.find(x => x.id === record.id).article.content).includes(words), false);
    await editorCommand(page, 'Edit', 'Redo');
    assert.equal(JSON.stringify((await composition(page)).texts.find(x => x.id === record.id).article.content).includes(words), true);
    await grip.focus(); await grip.press('ArrowRight');
    assert.equal(await grip.evaluate(node => node === document.activeElement), true, 'resize retains keyboard focus');
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual((await composition(page)).workbench.texts.find(x => x.id === record.id).window, frame);
    const accepted = await composition(page); await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), accepted);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


for (const width of [1440, 900]) test(`full-height side columns retain working dividers and outer frame drag resizes are reversible (${width})`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    await generateBento(page, 4); await seedBentoGrid(page, 2, 2);
    const original = await composition(page), first = original.cells[0].id;
    await bentoCell(page, first).click();
    await addBentoCell(page);
    const added = await composition(page), column = added.cells.at(-1), frame = cellFrame(added, column.id);
    assert.equal(frame.width, 320); assert.equal(frame.height, original.workbench.area.height - original.bento.padding * 2);
    for (const cell of original.cells) assert.deepEqual(cellFrame(added, cell.id), cellFrame(original, cell.id));
    await bentoCell(page, column.id).click();
    const divider = page.getByRole('button', { name: 'Resize cell left', exact: true });
    await divider.focus(); await divider.press('ArrowLeft');
    assert.notDeepEqual(await composition(page), added, 'the new column has an independent resize handle');
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), added);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original);
    if (width === 900) await page.getByRole('switch', { name: 'Dark mode' }).uncheck();
    const label = page.getByLabel('Bento dimensions', { exact: true });
    const dimensions = area => Math.round(area.width) + ' \u00d7 ' + Math.round(area.height) + ' px';
    const assertGap = async () => {
      const outer = await page.locator('.workbench-area-frame').boundingBox(), resize = await page.locator('.composition-bento-frame-handles').boundingBox();
      for (const gap of [outer.x - resize.x, outer.y - resize.y, resize.x + resize.width - outer.x - outer.width, resize.y + resize.height - outer.y - outer.height])
        assert.ok(Math.abs(gap - 12) < 1, 'resize outline stays 12 screen pixels outside the authored frame');
      const text = await label.boundingBox(); assert.ok(text.y + text.height < resize.y, 'dimensions sit above the top-right edge');
    };
    assert.equal(await label.innerText(), dimensions(original.workbench.area)); await assertGap();
    const handle = page.getByRole('button', { name: 'Resize Bento bottom right', exact: true });
    const box = await handle.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const drag = async () => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 30, { steps: 8 }); };
    await drag(); assert.deepEqual(await composition(page), original, 'frame preview does not save');
    assert.notEqual(await label.innerText(), dimensions(original.workbench.area), 'dimensions update during the unsaved drag'); await assertGap();
    await page.keyboard.press('Escape'); await page.mouse.up(); assert.deepEqual(await composition(page), original);
    assert.equal(await label.innerText(), dimensions(original.workbench.area));
    await drag(); await page.mouse.up();
    const resized = await composition(page);
    assert.equal(await label.innerText(), dimensions(resized.workbench.area)); await assertGap();
    assert.ok(resized.workbench.area.width > original.workbench.area.width);
    assert.ok(resized.workbench.area.height > original.workbench.area.height);
    assert.equal(resized.workbench.area.left, original.workbench.area.left);
    assert.equal(resized.workbench.area.top, original.workbench.area.top);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), resized);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/bento-outer-resize-' + width + '.png' });
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await composition(page), resized);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('deleting populated cells removes their rendered contents and restores them together with Undo', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1&session=' + crypto.randomUUID());
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    const original = await composition(page), canvas = profileFields(await snapshot(page));
    const cells = [original.cells.find(cell => cell.members.includes(original.imageModules[0].id)), original.cells.find(cell => cell.members.includes(original.texts[0].id))];
    for (const [index, cell] of cells.entries()) {
      const layers = await openSharedTool(page, 'Layers');
      const name = original.shapes.find(item => item.id === cell.id).name;
      await layers.getByRole('button', { name: 'Delete ' + name, exact: true }).click();
      await page.getByRole('button', { name: 'Confirm layer deletion', exact: true }).click();
      const after = await composition(page), removed = [cell.id, ...cell.members];
      for (const key of ['imageModules', 'texts', 'shapes']) {
        assert.equal(after[key].some(item => removed.includes(item.id)), false);
        assert.equal(after.workbench[key].some(item => removed.includes(item.id)), false);
      }
      for (const id of removed) assert.equal(await page.locator('[data-workbench-view-id="' + id + '"]').count(), 0);
      assert.deepEqual(profileFields(await snapshot(page)), canvas);
      await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), original);
      await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), after);
      if (index === 0) { await editorCommand(page, 'Edit', 'Undo'); }
      else { await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor(); assert.deepEqual(await composition(page), after); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Bento sliders preview live, commit once, cancel safely and retain exact values', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await generateBento(page, 4);
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const fields = [['Gap', 'gap'], ['Spacing', 'padding'], ['Cell radius', 'radius'], ['Frame radius', 'frameRadius']];
    for (const [label, key] of fields) {
      const before = await composition(page), slider = panel.getByRole('slider', { name: label, exact: true });
      const box = await slider.boundingBox();
      await page.mouse.move(box.x + box.width * .25, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width * .3, box.y + box.height / 2, { steps: 4 });
      assert.deepEqual(await composition(page), before, label + ' preview must not save');
      if (key === 'frameRadius') assert.ok(parseFloat(await page.locator('.workbench-area-frame').evaluate(node => getComputedStyle(node).borderTopLeftRadius)) > 0, 'frame corner previews live');
      await page.keyboard.press('Escape'); await page.mouse.up();
      assert.equal(await panel.isVisible(), true); assert.deepEqual(await composition(page), before);
      await slider.focus(); await slider.press('ArrowRight');
      const after = await composition(page); assert.notDeepEqual(after, before);
      await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), before, label + ' is one Undo step');
      await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), after);
    }
    const radiusNumber = panel.getByRole('spinbutton', { name: 'Outer frame radius (px)', exact: true }), beforeEmpty = await composition(page), acceptedRadius = await radiusNumber.inputValue();
    await radiusNumber.fill(''); await radiusNumber.press('Escape');
    assert.deepEqual(await composition(page), beforeEmpty, 'clearing and cancelling exact radius keeps accepted state');
    assert.equal(await radiusNumber.inputValue(), acceptedRadius);
    const beforeDrag = await composition(page), gap = panel.getByRole('slider', { name: 'Gap', exact: true }), bounds = await gap.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height / 2); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .35, bounds.y + bounds.height / 2, { steps: 6 });
    assert.deepEqual(await composition(page), beforeDrag); const draggedValue = Number(await gap.inputValue());
    await page.mouse.up(); const afterDrag = await composition(page); assert.equal(afterDrag.bento.gap, draggedValue);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), beforeDrag, 'a pointer drag commits in one Undo step');
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await composition(page), afterDrag);
    const exact = panel.getByRole('spinbutton', { name: 'Outer margin (px)', exact: true });
    await exact.fill('36'); await exact.press('Enter'); assert.equal((await composition(page)).bento.padding, 36);
    await page.mouse.move(900, 800); await panel.getByRole('button', { name: 'Move Bento panel', exact: true }).click();
    await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/bento-sliders.png' });
    const accepted = await composition(page); await page.evaluate(() => window.nativeCompositionFixture.fail(true));
    await panel.getByRole('slider', { name: 'Gap', exact: true }).press('ArrowRight');
    await panel.getByRole('alert').waitFor(); assert.deepEqual(await composition(page), accepted);
    await page.evaluate(() => window.nativeCompositionFixture.fail(false));
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor(); assert.deepEqual(await composition(page), accepted);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [width, cellFirst] of [[1440, false], [900, true]]) test(`one Studio document keeps linked text, pages, Keeper and groups with cells at ${width}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup({ width, height: 1000 });
  try {
    const ids = await page.evaluate(async cellFirst => {
      const root = window.nativeCompositionFixture.root, profile = root.getProfileAddress();
      const { addShape } = await import('/src/shapes/shapeSession.js');
      const { addTextModule, changeTextFrames } = await import('/src/text/textSession.js');
      const { addKeeperDock } = await import('/src/keeper/keeperSession.js');
      const { openWorkbenchIndex } = await import('/src/systemWorkflow/workbenchIndexSession.js');
      const { editWorkbenchGroups } = await import('/src/systemWorkflow/workbenchGroupSession.js');
      const cell = addShape(root, profile, { position: { left: 1100, top: 32 }, size: { width: 280, height: 240 } });
      const makeCell = () => {
        const next = root.getDraft(); next.cells = [{ id: cell, members: [], mobile: { columns: 2, height: 240 } }];
        if (!root.commitCompletedOperation(next, { expectedGeneration: root.getGeneration() })) throw Error('First cell failed');
      };
      if (cellFirst) makeCell();
      const linked = addTextModule(root, profile, { window: { left: 32, top: 32, width: 320, height: 360 } });
      const pages = addTextModule(root, profile, { window: { left: 744, top: 32, width: 320, height: 360 } });
      let draft = root.getDraft(); draft.workbench.area = { left: 0, top: 0, width: 1440, height: 900 };
      draft.shapes.find(item => item.id === cell).visibility = 'PUBLIC';
      for (const record of draft.texts) {
        record.visibility = 'PUBLIC'; record.article.title = record.id === linked ? 'Linked story' : 'Paged story';
        record.article.appearance = { ...record.article.appearance, compact: true, fontSize: 18 };
        record.article.content = { type: 'doc', content: Array.from({ length: 28 }, (_, i) => ({ type: 'paragraph', content: [
          { type: 'text', text: `Paragraph ${i + 1}. These words continue across the authored frames while the artwork keeps its position.` }
        ] })) };
      }
      draft.texts.find(item => item.id === pages).pagination = 'pages';
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Text fixture failed');
      draft = root.getDraft();
      changeTextFrames(root, profile, draft.texts.find(item => item.id === linked), draft.workbench.texts.find(item => item.id === linked),
        [{ id: 'text-frame:continued', window: { left: 388, top: 32, width: 320, height: 360 } }]);
      addKeeperDock(root, profile); openWorkbenchIndex(root, profile);
      editWorkbenchGroups(root, profile, { type: 'create', name: 'Mixed layers', memberIds: [cell, linked] });
      if (!cellFirst) makeCell();
      return { linked, pages, cell };
    }, cellFirst);
    await page.getByRole('complementary', { name: 'Index — Destinations', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Keeper settings', exact: true }).waitFor();
    await page.locator(`[data-text-id="${ids.linked}"]`).getByRole('button', { name: 'Add linked Text frame', exact: true }).waitFor();
    const before = await snapshot(page);
    assert.equal(before.workbenchGroups[0].name, 'Mixed layers');
    await editorCommand(page, 'Canvas', 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    await page.waitForFunction(() => document.querySelector('dialog[open] [data-layer-id="text-frame:continued"] .text-flow-visible')?.textContent.trim().length > 0);
    const linked = preview.locator(`[data-layer-id="${ids.linked}"] .text-flow-visible`);
    const continued = preview.locator('[data-layer-id="text-frame:continued"] .text-flow-visible');
    assert.match(await linked.innerText(), /Linked story/);
    assert.doesNotMatch(await continued.innerText(), /Linked story/);
    const paginated = preview.locator(`[data-layer-id="${ids.pages}"]`);
    await paginated.getByRole('button', { name: 'Next text page', exact: true }).click();
    assert.match(await paginated.getByRole('navigation', { name: 'Text pages' }).innerText(), /2\s*\//);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/studio-unified-reading-${width}.png` });
    await preview.getByRole('button', { name: 'Back to editing', exact: true }).click();
    assert.deepEqual(await snapshot(page), before);
    await page.evaluate(() => { const root = window.nativeCompositionFixture.root, next = root.getDraft(); next.cells = [];
      if (!root.commitCompletedOperation(next, { expectedGeneration: root.getGeneration(), historyLabel: 'Remove last cell' })) throw Error('Cell removal failed'); });
    await page.locator(`[data-text-id="${ids.linked}"]`).getByRole('button', { name: 'Add linked Text frame', exact: true }).waitFor();
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await snapshot(page), before);
    await page.reload(); await editorMenu(page).waitFor();
    assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
