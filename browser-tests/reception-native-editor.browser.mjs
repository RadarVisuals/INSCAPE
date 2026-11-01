import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-native-editor';
const snapshot = page => page.evaluate(() => window.nativeReceptionFixture.root.getDraft());
const reception = async page => (await snapshot(page)).reception;
const shape = (page, id) => page.locator(`.shape-instance [data-workbench-view-id="${id}"]`);
const withoutReception = ({ reception: _reception, ...draft }) => draft;

async function openSavedReception(page) {
  await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
  await page.getByRole('button', { name: 'Reception', exact: true }).click();
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

test('direct Reception entry accepts pointer clicks on controls outside the canvas after a cold load', { timeout: 90000 }, async () => {
  for (const width of [1440, 700]) {
    const { browser, page, errors } = await setup({ width, height: 1000 });
    try {
      const preview = page.getByRole('button', { name: 'Preview', exact: true });
      assert.equal(await preview.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), true, `the document controls receive the pointer at ${width}px`);
      await page.getByRole('button', { name: 'Canvas size', exact: true }).click();
      await page.getByRole('group', { name: 'Canvas size controls', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
      await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
      await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close workspace', exact: true }).click();
      await preview.click();
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
  await node.click({ button: 'right' });
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

async function dropArtwork(page, point) {
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
  await page.mouse.up();
}

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

test('one Editor switches Reception and canvas documents and reopens Reception from My Inscape without mixing layers', { timeout: 120000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const selector = page.getByRole('combobox', { name: 'Active document', exact: true });
    await selector.waitFor();
    assert.equal(await selector.inputValue(), 'reception');
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

    await selector.selectOption(canvasId);
    await shape(page, originalCanvas.shapes[0].id).waitFor();
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

    await selector.selectOption('reception');
    await shape(page, cellId).waitFor();
    assert.equal(await shape(page, canvasShape.id).count(), 0);
    assert.deepEqual(await reception(page), authoredReception, 'switching back preserves Reception layers, membership and geometry');
    await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await selector.waitFor();
    assert.equal(await selector.inputValue(), 'reception');
    await shape(page, memberId).waitFor();
    assert.deepEqual(await reception(page), authoredReception, 'My Inscape edits the same Reception document');
    await selector.selectOption(canvasId);
    await shape(page, canvasShape.id).waitFor();
    assert.deepEqual(withoutReception(await snapshot(page)), authoredCanvas, 'Reception navigation never rewrites the canvas');

    await page.reload();
    await selector.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Active document"]')?.value === 'reception');
    assert.deepEqual(await reception(page), authoredReception, 'fresh Reception entry retains the same saved composition');
    assert.deepEqual(withoutReception(await snapshot(page)), authoredCanvas, 'fresh Reception entry preserves the separately saved canvas');
    await selector.selectOption(canvasId);
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
    const before = await reception(page), parentBox = await shape(page, id).boundingBox();
    await page.mouse.move(parentBox.x + 70, parentBox.y + 70); await page.mouse.down();
    await page.mouse.move(parentBox.x + 118, parentBox.y + 94, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(({ id, left }) => window.nativeReceptionFixture.root.getDraft().reception.workbench.shapes.find(item => item.id === id).window.left !== left, { id, left: outside.left });
    document = await reception(page);
    const afterParent = document.workbench.shapes.find(item => item.id === id).window;
    const beforeChild = before.workbench.shapes.find(item => item.id === inner).window;
    const afterChild = document.workbench.shapes.find(item => item.id === inner).window;
    // Fitted cameras produce fractional world coordinates; compare movement
    // within floating-point precision rather than requiring identical bits.
    assert.ok(Math.abs((afterChild.left - beforeChild.left) - (afterParent.left - outside.left)) < 1e-9);
    assert.ok(Math.abs((afterChild.top - beforeChild.top) - (afterParent.top - outside.top)) < 1e-9);
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
    const closeTools = page.locator('.workbench-tool-dock .workbench-tool-panel-close');
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
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
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
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true }); await preview.waitFor();
    await preview.getByText('Welcome to my Reception. This is a real Text layer.', { exact: true }).waitFor().catch(async error => {
      console.log('preview evidence', await reception(page), await preview.innerText(), errors);
      await page.screenshot({ path: `${output}/native-preview-debug.png`, fullPage: true }); throw error;
    });
    assert.equal(await preview.locator(`[data-layer-id="${imageId}"]`).count(), 1);
    await page.screenshot({ path: `${output}/native-preview-desktop-1440.png`, fullPage: true });
    await preview.getByRole('button', { name: 'Phone', exact: true }).click();
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
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
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
    const sharedTools = page.locator('.workbench-tool-dock .workbench-tool-panel-close');
    if (await sharedTools.isVisible()) await sharedTools.click();
    await page.getByRole('tab', { name: 'Article settings', exact: true }).focus(); await page.keyboard.press('Enter');
    const include = page.getByRole('checkbox', { name: 'Include in Reception', exact: true });
    assert.equal(await include.isChecked(), true);
    await include.focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => window.nativeReceptionFixture.root.getDraft().reception.texts[0].visibility === 'PRIVATE');
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    preview = page.getByRole('region', { name: 'Reception responsive preview', exact: true }); await preview.waitFor();
    assert.equal(await preview.locator(`[data-layer-id="${textId}"]`).count(), 0, 'explicitly private Text is absent from the public projection');
    assert.equal(await preview.getByText('NOMAD', { exact: true }).count(), 0);
    assert.match(JSON.stringify((await reception(page)).texts[0].article), /NOMAD/, 'hiding Text preserves its actual writing');
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal((await reception(page)).texts[0].visibility, 'PRIVATE', 'reopening the Editor never publishes previously private Text');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
