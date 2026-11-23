import { editorCommand } from './fixtures/editor-menu.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-layer-order';
const probes = [[300, 280, 'image:art'], [900, 330, 'text:nomad'], [450, 350, 'shape:overlay'],
  [150, 350, 'shape:grid'], [165, 155, 'shape:grid']];
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Reception canvas follows the theme through transparent artwork without changing authored colours or saved data', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    const asset = url.hostname === 'raw.githubusercontent.com' && url.pathname.split('/public/')[1];
    return asset ? route.fulfill({ path: `public/${asset}` }) : route.abort();
  });
  try {
    await page.goto(`${origin}/browser-tests/reception-layer-order-fixture.html?session=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    const before = await page.evaluate(() => {
      const root = window.receptionLayerFixture.root, draft = root.getDraft();
      // An unset frame fill follows the shared environment. Explicit frame
      // colours are authored overrides and are covered by the frame-colour suite.
      const reception = { ...draft.reception, surface: null, shapes: draft.reception.shapes.map(shape =>
        shape.id === 'shape:cell' ? { ...shape, opacity: 0 } : shape) };
      if (!root.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: root.getGeneration(), recordHistory: false })) throw new Error('Could not seed transparency');
      return reception;
    });
    for (const mode of ['dark', 'light']) {
      await page.evaluate(mode => window.receptionLayerFixture.theme.setMode(mode), mode);
      await settle(page);
      const pixel = await page.locator('canvas[data-workbench-area]').evaluate(canvas =>
        [...canvas.getContext('2d').getImageData(canvas.width - 4, canvas.height - 4, 1, 1).data]);
      assert.deepEqual(pixel, mode === 'dark' ? [20, 20, 20, 255] : [222, 219, 211, 255], 'outside the frame uses the Studio surround');
    }
    await editorCommand(page, 'Canvas', 'Preview');
    const canvas = page.locator('.reception-document-canvas');
    await canvas.waitFor();
    await mkdir(output, { recursive: true });
    const checkTheme = async (mode, expected, view) => {
      await page.evaluate(mode => window.receptionLayerFixture.theme.setMode(mode), mode);
      await settle(page);
      const background = await canvas.evaluate(node => {
        const context = document.createElement('canvas').getContext('2d');
        context.fillStyle = getComputedStyle(node).backgroundColor; context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      });
      assert.deepEqual(background, mode === 'dark' ? [23, 23, 23, 255] : [222, 219, 211, 255]);
      const surround = page.locator(view === 'preview' ? '.reception-document-preview' : '.reception-page');
      assert.equal(await surround.evaluate(node => getComputedStyle(node).backgroundColor), expected);
      assert.equal(await canvas.locator('[data-cell-id="shape:cell"] .shape-fill').evaluate(node => getComputedStyle(node).opacity), '0');
      assert.equal(await canvas.locator('[data-layer-id="shape:backdrop"] .shape-fill').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(59, 22, 57)');
      assert.equal(await canvas.locator('.reception-image').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
      await page.screenshot({ path: `${output}/transparent-${view}-${mode}.png` });
    };
    for (const width of [1600, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkTheme('dark', 'rgb(23, 23, 23)', 'preview');
      await checkTheme('light', 'rgb(222, 219, 211)', 'preview');
    }
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Profile', exact: true }).click();
    await canvas.waitFor();
    for (const width of [1600, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkTheme('dark', 'rgb(23, 23, 23)', `public-${width}`);
      await checkTheme('light', 'rgb(222, 219, 211)', `public-${width}`);
    }
    const after = await page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    for (const key of ['surface', 'shapes', 'imageModules', 'texts', 'cells', 'artworkLayers']) assert.deepEqual(after[key], before[key]);
  } finally { await browser.close(); }
});

async function assertDocumentCentered(page, selector) {
  const geometry = await page.locator(selector).evaluate(host => {
    const canvas = host.querySelector('.reception-document-canvas').getBoundingClientRect();
    const viewport = host.getBoundingClientRect(), style = getComputedStyle(host);
    const top = viewport.top + parseFloat(style.paddingTop), height = host.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    return { y: canvas.y, expectedY: top + Math.max(0, (height - canvas.height) / 2),
      x: canvas.x, expectedX: viewport.left + host.clientLeft + parseFloat(style.paddingLeft)
        + (host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - canvas.width) / 2,
      width: canvas.width, height: canvas.height };
  });
  assert.ok(Math.abs(geometry.y - geometry.expectedY) < 1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.x - geometry.expectedX) < 1, JSON.stringify(geometry));
  return geometry;
}

test('Reception opens and returns Home centred without moving authored geometry; preview and public canvas centre safely', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width: 1760, height: 1100 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try {
    await page.goto(`${origin}/browser-tests/reception-layer-order-fixture.html?session=${crypto.randomUUID()}`);
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    const before = await page.evaluate(() => {
      const root = window.receptionLayerFixture.root, draft = root.getDraft();
      const reception = { ...draft.reception, workbench: { ...draft.reception.workbench, area: { left: 31, top: 240, width: 947, height: 575 } } };
      if (!root.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: root.getGeneration(), recordHistory: false })) throw new Error('Could not seed off-origin canvas');
      return reception;
    });
    await page.reload();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await settle(page);
    const readCamera = () => page.locator('main[data-reception-editor]').evaluate(host => {
      const area = host.querySelector('[data-workbench-area]'), [width, height] = area.dataset.workbenchArea.split('x').map(Number);
      const scale = +host.dataset.workbenchCameraScale, x = +host.dataset.workbenchCameraX, y = +host.dataset.workbenchCameraY;
      const controlsTop = host.querySelector('[data-workbench-toolbar]').getBoundingClientRect().top - host.getBoundingClientRect().top - 8;
      const menuBottom = host.querySelector('.editor-menu-bar').getBoundingClientRect().bottom - host.getBoundingClientRect().top;
      return { scale, x, y, cx: (+area.dataset.canvasLeft + width / 2) * scale + x,
        cy: (+area.dataset.canvasTop + height / 2) * scale + y, expectedX: host.clientWidth / 2, expectedY: (menuBottom + controlsTop) / 2 };
    });
    const initial = await readCamera();
    assert.equal(initial.scale, 1, 'entry never enlarges a small authored canvas');
    assert.ok(Math.abs(initial.cx - initial.expectedX) < 1 && Math.abs(initial.cy - initial.expectedY) < 1, JSON.stringify(initial));
    await page.getByRole('button', { name: 'Navigate Workbench', exact: true }).press('ArrowRight');
    await settle(page);
    const panned = await readCamera();
    assert.notEqual(panned.x, initial.x);
    await editorCommand(page, 'Canvas', 'Preview');
    await page.locator('.reception-document-canvas').waitFor(); await settle(page);
    const preview = await assertDocumentCentered(page, '.reception-preview-content');
    assert.equal(preview.width, 947); assert.equal(preview.height, 575);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/centred-preview.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click(); await settle(page);
    assert.deepEqual(await readCamera(), panned, 'preview return preserves the chosen camera');
    await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click(); await settle(page);
    assert.deepEqual(await readCamera(), initial, 'Home returns to the canvas rather than world origin');
    await page.screenshot({ path: `${output}/centred-editor.png` });
    await page.getByRole('button', { name: 'Back to Profile', exact: true }).click();
    await page.locator('.reception-document-canvas').waitFor(); await settle(page);
    const published = await assertDocumentCentered(page, '.reception-window-main');
    assert.equal(published.width, 947); assert.equal(published.height, 575);
    await page.screenshot({ path: `${output}/centred-public.png` });
    await page.setViewportSize({ width: 390, height: 600 }); await settle(page);
    await assertDocumentCentered(page, '.reception-window-main');
    const scroll = await page.locator('.reception-window-main').evaluate(node => {
      const before = node.scrollTop; node.scrollTop = node.scrollHeight;
      return { before, after: node.scrollTop };
    });
    assert.equal(scroll.before, 0); assert.ok(scroll.after > 0, 'tall phone composition remains reachable from top to bottom');
    await page.locator('.reception-window-main').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${output}/centred-phone.png` });
    const after = await page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    for (const key of ['area', 'shapes', 'imageModules', 'texts']) assert.deepEqual(after.workbench[key], before.workbench[key]);
    assert.deepEqual(after.artworkLayers, before.artworkLayers);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
async function assertPaint(page, native) {
  const hits = await page.evaluate(({ probes, native }) => {
    const owner = document.querySelector(native ? '[data-workbench-view-id="shape:cell"]' : '[data-cell-id="shape:cell"]');
    const rect = owner.getBoundingClientRect(), scale = rect.width / 1040;
    return probes.map(([x, y]) => {
      const point = { x: rect.left + (x - 160) * scale, y: rect.top + (y - 150) * scale };
      const node = document.elementsFromPoint(point.x, point.y).map(hit => hit.closest(native ? '[data-workbench-view-id]' : '[data-layer-id], [data-cell-id]')).find(Boolean);
      return native ? node?.dataset.workbenchViewId : node?.dataset.layerId || node?.dataset.cellId;
    });
  }, { probes, native });
  assert.deepEqual(hits.slice(0, 3), probes.slice(0, 3).map(item => item[2]), `${native ? 'Editor' : 'Reader'} preserves interleaved layers`);
  // Native Grid paint is pointer-transparent. Neither its empty gaps nor the
  // owner's rectangular interaction target may expose the clipped child.
  assert.ok(hits.slice(3).every(id => id !== 'image:art'), 'the image is clipped at the cell edge and rounded corner');
}
async function textPaint(page, native, id = 'text:nomad') {
  const surface = page.locator(native ? `[data-workbench-view-id="${id}"]` : `.reception-document-canvas [data-layer-id="${id}"]`);
  await surface.locator('.text-editor-page:visible, .text-document:visible').first().waitFor();
  return surface.evaluate(node => {
    const article = [...node.querySelectorAll('.text-editor-page, .text-document')].find(candidate => candidate.checkVisibility());
    if (!article) throw new Error('No visible text surface to compare');
    const style = getComputedStyle(article), surface = getComputedStyle(node), bodyNode = node.querySelector('.text-module-body');
    // Untransformed reader excerpts use ArticleView directly. Rotated Text
    // retains the native transform body and must still match its matrix.
    const body = bodyNode ? getComputedStyle(bodyNode) : null;
    const matrix = !body || body.transform === 'none' ? null : new DOMMatrixReadOnly(body.transform);
    // Native camera zoom changes the paint dimensions. Compare the quarter-turn
    // and proportional centering, rather than unscaled translation pixels.
    const transform = matrix ? [matrix.a, matrix.b, matrix.c, matrix.d,
      Math.round(matrix.e / parseFloat(body.width) * 1000) / 1000,
      Math.round(matrix.f / parseFloat(body.height) * 1000) / 1000] : 'none';
    return { padding: style.padding, fontSize: style.fontSize, lineHeight: style.lineHeight, background: surface.backgroundColor, transform };
  });
}

test('Reception Editor, preview and public reader preserve interleaved global layers, cell clips and native Text appearance', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width: 1760, height: 1100 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  try {
    await page.goto(`${origin}/browser-tests/reception-layer-order-fixture.html?session=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await page.locator('[data-workbench-view-id="text:nomad"] article.text-document:visible').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await assertPaint(page, true);
    const nativeText = await textPaint(page, true);
    const nativeRotatedText = await textPaint(page, true, 'text:rotated');
    assert.notEqual(nativeRotatedText.transform, 'none');
    const before = await page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    assert.equal(await page.locator('[data-workbench-view-id="text:private"]').count(), 1);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/editor.png` });
    await editorCommand(page, 'Canvas', 'Preview');
    await page.locator('[data-layer-id="text:nomad"] .text-document').waitFor();
    await assertPaint(page, false);
    assert.deepEqual(await textPaint(page, false), nativeText, 'the cell preserves the text layerâ€™s authored padding, font and surface');
    assert.deepEqual(await textPaint(page, false, 'text:rotated'), nativeRotatedText, 'authored padding, colored surface and quarter-turn match native Text');
    assert.equal(await page.locator('.reception-document-canvas [data-layer-id="text:private"]').count(), 0);
    assert.deepEqual(await page.locator('.reception-document-canvas [data-layer-id], .reception-document-canvas [data-cell-id]').evaluateAll(nodes => nodes
      .sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex))
      .map(node => node.dataset.layerId || node.dataset.cellId)), before.artworkLayers.filter(id => id !== 'text:private'));
    await page.screenshot({ path: `${output}/preview.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Profile', exact: true }).click();
    await page.locator('[data-layer-id="text:nomad"] .text-document').waitFor();
    await assertPaint(page, false);
    assert.deepEqual(await textPaint(page, false), nativeText);
    assert.deepEqual(await textPaint(page, false, 'text:rotated'), nativeRotatedText);
    assert.equal(await page.locator('.reception-document-canvas [data-layer-id="text:private"]').count(), 0);
    await page.screenshot({ path: `${output}/public.png` });
    await page.getByRole('button', { name: 'Open canvas', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open canvas');
    const after = await page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    const composition = ({ workbench, ...document }) => ({ ...document, workbench: Object.fromEntries(
      ['area', 'shapes', 'imageModules', 'texts'].map(key => [key, workbench[key]])) });
    assert.deepEqual(composition(after), composition(before), 'viewing does not reorder, reparent or reposition saved content');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('Layers thumbnails and locks work for free and cell artwork after reload', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('**/abyssal_eye/full.webp', serveTransparentThumbnail);
    await page.goto(`${origin}/browser-tests/reception-layer-order-fixture.html?session=${crypto.randomUUID()}`);
    await page.evaluate(() => {
      const { root } = window.receptionLayerFixture, draft = root.getDraft();
      const frame = draft.reception.workbench.shapes.find(shape => shape.id === 'shape:overlay').window;
      Object.assign(frame, { left: 500, top: 790 });
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Could not position the test shape');
    });
    let layers = await openSharedTool(page, 'Layers');
    const button = name => layers.getByRole('button', { name, exact: true });
    const saved = () => page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    const before = await saved();
    await button('Lock White overlay').click();
    await button('Select White overlay').click();
    const shape = page.locator('aside[data-workbench-view-id="shape:overlay"]');
    await shape.click();
    await page.keyboard.press('Alt+ArrowRight');
    const frame = await shape.boundingBox();
    await page.mouse.move(frame.x + 2, frame.y + 2); await page.mouse.down();
    await page.mouse.move(frame.x + 42, frame.y + 32, { steps: 5 }); await page.mouse.up();
    assert.deepEqual((await saved()).workbench.shapes, before.workbench.shapes);
    await button('Hide White overlay in editor').click();
    assert.equal(await button('Unlock White overlay').getAttribute('aria-pressed'), 'true');
    if (await button('Expand Artwork cell').count()) await button('Expand Artwork cell').click();
    await button('Lock Layered artwork').click();
    assert.deepEqual((await saved()).cells[0].lockedMembers, ['image:art']);
    assert.equal(await button('Select Layered artwork').locator('img').count(), 1);
    assert.equal((await button('Select White overlay').locator('.workbench-layer-thumb').boundingBox()).width, 24);
    await page.reload();
    layers = await openSharedTool(page, 'Layers');
    await button('Unlock White overlay').click();
    if (await button('Expand Artwork cell').count()) await button('Expand Artwork cell').click();
    await button('Unlock Layered artwork').click();
    assert.deepEqual((await saved()).workbench, before.workbench);
  } finally { await browser.close(); }
});

const serveTransparentThumbnail = route => route.fulfill({ contentType: 'image/svg+xml',
  body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="3" fill="red"/></svg>' });

for (const width of [1440, 900]) test(`Layers selects and ungroups an entire composition across a Bento cell boundary at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('**/abyssal_eye/full.webp', serveTransparentThumbnail);
    await page.goto(`${origin}/browser-tests/reception-layer-order-fixture.html?session=${crypto.randomUUID()}`);
    const layers = await openSharedTool(page, 'Layers');
    const button = name => layers.getByRole('button', { name, exact: true });
    const saved = () => page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    const before = await saved();
    if (await button('Expand Artwork cell').count()) await button('Expand Artwork cell').click();
    await button('Select Layered artwork').click();
    await button('Select White overlay').click({ modifiers: ['Shift'] });
    await button('Group selected layers').click();
    await layers.getByLabel('Group name').fill('Across the cell');
    await button('Create group').click();
    const grouped = await saved();
    const group = grouped.artworkLayers.find(layer => layer.name === 'Across the cell');
    assert.deepEqual(group.children, ['image:art', 'shape:overlay']);
    if (width === 1440) {
      const stack = page.locator(`[data-workbench-stack="${group.id}"]`);
      await button('Stack Across the cell').click();
      await stack.waitFor();
      const imageSample = button('Select Across the cell').locator('.workbench-layer-image');
      await imageSample.locator('img').evaluate(img => img.decode());
      assert.equal(await imageSample.locator('svg').count(), 0, 'transparent stack artwork has no image icon behind it');
      const folded = await saved();
      const storedGroup = folded.artworkLayers.find(layer => layer.id === group.id);
      assert.ok(storedGroup.stackPosition);
      assert.deepEqual({ ...folded, artworkLayers: folded.artworkLayers.map(layer => layer.id === group.id ? group : layer) }, grouped);
      const grip = stack.getByRole('button', { name: 'Move Across the cell group' });
      const rect = await grip.boundingBox();
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const drag = async () => {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + 80, y + 45, { steps: 8 });
        assert.deepEqual(await saved(), folded, 'drag preview does not write the draft');
      };
      await drag(); await page.keyboard.press('Escape'); await page.mouse.up();
      assert.deepEqual(await saved(), folded);
      await drag(); await page.mouse.up();
      const relocated = await saved();
      const position = relocated.artworkLayers.find(layer => layer.id === group.id).stackPosition;
      assert.ok(position.left > storedGroup.stackPosition.left && position.top > storedGroup.stackPosition.top);
      assert.deepEqual(relocated, { ...folded, artworkLayers: folded.artworkLayers.map(layer =>
        layer.id === group.id ? { ...layer, stackPosition: position } : layer) });
      await editorCommand(page, 'Edit', 'Undo');
      assert.deepEqual(await saved(), folded);
      await editorCommand(page, 'Edit', 'Redo');
      assert.deepEqual(await saved(), relocated);
      await page.reload();
      await stack.waitFor();
      assert.deepEqual(await saved(), relocated);
      for (const id of group.children)
        await page.locator(`[data-workbench-view-id="${id}"][data-workbench-group-hidden]`).waitFor({ state: 'attached' });
      await stack.getByRole('button', { name: 'Open Across the cell group' }).click();
      for (const id of group.children)
        await page.locator(`[data-workbench-view-id="${id}"][data-workbench-group-presented]`).waitFor();
      assert.equal(await page.locator('[data-workbench-view-id="image:art"]').evaluate(node => getComputedStyle(node).clipPath), 'none');
      const openGroup = page.getByRole('group', { name: 'Open Workbench group' });
      await openGroup.getByRole('button', { name: 'Back', exact: true }).click();
      await stack.waitFor();
      assert.deepEqual(await saved(), relocated);
      await openSharedTool(page, 'Layers');
      await button('Unstack Across the cell').click();
      assert.deepEqual(await saved(), grouped);
      await editorCommand(page, 'Edit', 'Undo');
      await stack.waitFor();
      assert.deepEqual(await saved(), relocated);
      await editorCommand(page, 'Edit', 'Redo');
      assert.deepEqual(await saved(), grouped);
    }
    const selectGroup = button('Select Across the cell');
    assert.equal(await selectGroup.count(), 1);
    await button('Select Free Grid').click();
    await selectGroup.click();
    assert.equal(await selectGroup.getAttribute('aria-description'), '2 layers inside');
    assert.equal(await button('Ungroup selected group').isEnabled(), true);
    await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).press('Alt+ArrowRight');
    const moved = await saved();
    assert.deepEqual(moved.cells, grouped.cells);
    assert.deepEqual(moved.workbench.texts, grouped.workbench.texts);
    assert.deepEqual(moved.workbench.shapes.filter(item => item.id !== 'shape:overlay'),
      grouped.workbench.shapes.filter(item => item.id !== 'shape:overlay'), 'the containing cell stays put');
    const left = doc => doc.workbench.shapes.find(item => item.id === 'shape:overlay').window.left;
    const delta = left(moved) - left(grouped);
    assert.ok(delta > 0);
    assert.equal(moved.workbench.imageModules[0].position.left - grouped.workbench.imageModules[0].position.left, delta);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await saved(), grouped);
    await selectGroup.click();
    await selectGroup.press('Delete');
    const groupRow = layers.locator(`[data-layer-id="${group.id}"]`);
    await groupRow.getByText('Delete 2 layers?', { exact: true }).waitFor();
    await groupRow.getByRole('button', { name: 'Cancel layer deletion' }).click();
    const cellImage = layers.locator('[data-layer-key="shape:cell/image:art"]');
    await cellImage.getByRole('button', { name: 'Select Layered artwork' }).click();
    await layers.getByText('Across the cell \u203a Layered artwork', { exact: true }).waitFor();
    assert.equal(await button('Ungroup selected group').isEnabled(), false);
    await selectGroup.click();
    await button('Ungroup selected group').click();
    const ungrouped = await saved();
    assert.deepEqual(ungrouped.artworkLayers, before.artworkLayers);
    for (const value of [grouped, ungrouped]) {
      assert.deepEqual(value.cells, before.cells);
      for (const key of ['imageModules', 'texts', 'shapes']) assert.deepEqual(value.workbench[key], before.workbench[key]);
    }
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual((await saved()).artworkLayers, grouped.artworkLayers);
    await selectGroup.click();
    assert.equal(await button('Ungroup selected group').isEnabled(), true);
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual((await saved()).artworkLayers, ungrouped.artworkLayers);
    assert.equal(await selectGroup.count(), 0);
  } finally { await browser.close(); }
});

test('a free shape and two cells share canvas selection, Layers transfers and durable drag-out history', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/browser-tests/reception-layer-order-fixture.html?session=' + crypto.randomUUID());
    const saved = () => page.evaluate(() => window.receptionLayerFixture.root.getDraft().reception);
    const id = 'shape:overlay', cell = 'shape:cell';
    await page.evaluate(() => {
      const root = window.receptionLayerFixture.root, draft = root.getDraft(), doc = draft.reception;
      const boxes = { 'shape:cell': [480, 240, 250, 230], 'shape:source': [800, 240, 250, 230], 'shape:overlay': [460, 560, 90, 70] };
      doc.shapes = doc.shapes.filter(shape => boxes[shape.id]);
      doc.workbench.shapes = doc.workbench.shapes.filter(shape => boxes[shape.id]).map(shape => {
        const [left, top, width, height] = boxes[shape.id];
        return { ...shape, window: { left, top, width, height } };
      });
      doc.cells = doc.cells.map(({ id, mobile }) => ({ id, mobile, members: [] }));
      doc.artworkLayers = Object.keys(boxes);
      doc.imageModules = []; doc.texts = []; doc.workbench.imageModules = []; doc.workbench.texts = [];
      delete doc.links;
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Could not seed two cells');
    });
    const shape = page.locator('aside[data-workbench-view-id="shape:overlay"]');
    await shape.click();
    const layers = await openSharedTool(page, 'Layers');
    const row = layers.getByRole('button', { name: 'Select White overlay', exact: true });
    assert.equal(await row.getAttribute('aria-pressed'), 'true');
    await row.click();
    const move = layers.getByRole('combobox', { name: 'Move selected layers' });
    await move.selectOption(cell);
    const inside = await saved();
    assert.deepEqual(inside.cells.find(item => item.id === cell).members, [id]);
    await move.selectOption('free');
    const released = await saved();
    assert.deepEqual(released.workbench.shapes, inside.workbench.shapes);
    assert.ok(released.cells.every(item => !item.members.includes(id)));
    await move.selectOption(cell);
    await row.click();
    const bounds = await shape.boundingBox();
    const cellBox = await page.locator('aside[data-workbench-view-id="shape:cell"]').boundingBox();
    const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await page.mouse.move(centre.x, centre.y); await page.mouse.down();
    await page.mouse.move(cellBox.x + cellBox.width - 5, centre.y, { steps: 8 }); await page.mouse.up();
    const partial = await saved();
    assert.deepEqual(partial.cells, inside.cells, 'pointer inside the source keeps the cell assignment');
    const frame = doc => doc.workbench.shapes.find(item => item.id === id).window;
    const cellFrame = inside.workbench.shapes.find(item => item.id === cell).window;
    assert.ok(frame(partial).left + frame(partial).width > cellFrame.left + cellFrame.width);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await saved(), inside);
    await row.click();
    const box = await shape.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x, y + 260, { steps: 12 }); await page.mouse.up();
    const outside = await saved();
    assert.ok(outside.cells.every(item => !item.members.includes(id)), 'empty canvas releases the layer');
    assert.ok(frame(outside).top > frame(inside).top + 150);
    assert.equal(frame(outside).width, frame(inside).width);
    assert.equal(frame(outside).height, frame(inside).height);
    assert.deepEqual(outside.artworkLayers, inside.artworkLayers);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await saved(), inside);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await saved(), outside);
    await page.reload(); await row.waitFor();
    assert.deepEqual(await saved(), outside);
  } finally { await browser.close(); }
});
