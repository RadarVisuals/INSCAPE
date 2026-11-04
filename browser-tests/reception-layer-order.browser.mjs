import { editorCommand, editorOverview, editorDestination } from './fixtures/editor-menu.mjs';
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
      // A retained canvas surface must not override the shared environment.
      // The transparent cell exposes it; the authored purple backdrop stays.
      const reception = { ...draft.reception, surface: '#ffffff', shapes: draft.reception.shapes.map(shape =>
        shape.id === 'shape:cell' ? { ...shape, opacity: 0 } : shape) };
      if (!root.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: root.getGeneration(), recordHistory: false })) throw new Error('Could not seed transparency');
      return reception;
    });
    await editorCommand(page, 'Canvas', 'Preview');
    const canvas = page.locator('.reception-document-canvas');
    await canvas.waitFor();
    await mkdir(output, { recursive: true });
    const checkTheme = async (mode, expected, view) => {
      await page.evaluate(async mode => (await import('/src/interfaceTheme.js')).interfaceTheme.setMode(mode), mode);
      await settle(page);
      assert.equal(await canvas.evaluate(node => getComputedStyle(node).backgroundColor), expected);
      assert.equal(await canvas.locator('[data-cell-id="shape:cell"] .shape-fill').evaluate(node => getComputedStyle(node).opacity), '0');
      assert.equal(await canvas.locator('[data-layer-id="shape:backdrop"] .shape-fill').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(59, 22, 57)');
      assert.equal(await canvas.locator('.reception-image').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
      await page.screenshot({ path: `${output}/transparent-${view}-${mode}.png` });
    };
    await checkTheme('dark', 'rgb(23, 23, 23)', 'preview');
    await checkTheme('light', 'rgb(222, 219, 211)', 'preview');
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await editorOverview(page);
    await editorDestination(page, 'Reception');
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
      x: canvas.x, expectedX: viewport.left + viewport.width / 2 - canvas.width / 2, width: canvas.width, height: canvas.height };
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
    const preview = await assertDocumentCentered(page, '.reception-document-preview-scroll');
    assert.equal(preview.width, 947); assert.equal(preview.height, 575);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/centred-preview.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click(); await settle(page);
    assert.deepEqual(await readCamera(), panned, 'preview return preserves the chosen camera');
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click(); await settle(page);
    assert.deepEqual(await readCamera(), initial, 'Home returns to the canvas rather than world origin');
    await page.screenshot({ path: `${output}/centred-editor.png` });
    await editorOverview(page);
    await editorDestination(page, 'Reception');
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
  return page.locator(native ? `[data-workbench-view-id="${id}"]` : `.reception-document-canvas [data-layer-id="${id}"]`).evaluate(node => {
    const article = node.querySelector('.text-editor-page, .text-document');
    const style = getComputedStyle(article), surface = getComputedStyle(node), body = getComputedStyle(node.querySelector('.text-module-body'));
    const matrix = body.transform === 'none' ? null : new DOMMatrixReadOnly(body.transform);
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
    await page.locator('[data-workbench-view-id="text:nomad"] .text-editor-page').waitFor();
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
    assert.deepEqual(await textPaint(page, false), nativeText, 'shared padding, font and surface match the native Text');
    assert.deepEqual(await textPaint(page, false, 'text:rotated'), nativeRotatedText, 'authored padding, colored surface and quarter-turn match native Text');
    assert.equal(await page.locator('.reception-document-canvas [data-layer-id="text:private"]').count(), 0);
    assert.deepEqual(await page.locator('.reception-document-canvas > [data-layer-id], .reception-document-canvas > [data-cell-id]').evaluateAll(nodes => nodes.map(node => node.dataset.layerId || node.dataset.cellId)), before.artworkLayers.filter(id => id !== 'text:private'));
    await page.screenshot({ path: `${output}/preview.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await editorOverview(page);
    await editorDestination(page, 'Reception');
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
