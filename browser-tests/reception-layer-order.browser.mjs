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
      const controlsTop = Math.min(host.querySelector('.workbench-view-controls').getBoundingClientRect().top,
        host.querySelector('[data-workbench-toolbar]').getBoundingClientRect().top) - host.getBoundingClientRect().top - 8;
      return { scale, x, y, cx: (+area.dataset.canvasLeft + width / 2) * scale + x,
        cy: (+area.dataset.canvasTop + height / 2) * scale + y, expectedX: host.clientWidth / 2, expectedY: controlsTop / 2 };
    });
    const initial = await readCamera();
    assert.equal(initial.scale, 1, 'entry never enlarges a small authored canvas');
    assert.ok(Math.abs(initial.cx - initial.expectedX) < 1 && Math.abs(initial.cy - initial.expectedY) < 1, JSON.stringify(initial));
    await page.getByRole('button', { name: 'Navigate Workbench', exact: true }).press('ArrowRight');
    await settle(page);
    const panned = await readCamera();
    assert.notEqual(panned.x, initial.x);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
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
    await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
    await page.getByRole('button', { name: 'Reception', exact: true }).click();
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
      const node = document.elementFromPoint(point.x, point.y)?.closest(native ? '[data-workbench-view-id]' : '[data-layer-id], [data-cell-id]');
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
    return { padding: style.padding, fontSize: style.fontSize, lineHeight: style.lineHeight, background: surface.backgroundColor, transform: body.transform };
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
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('[data-layer-id="text:nomad"] .text-document').waitFor();
    await assertPaint(page, false);
    assert.deepEqual(await textPaint(page, false), nativeText, 'shared padding, font and surface match the native Text');
    assert.deepEqual(await textPaint(page, false, 'text:rotated'), nativeRotatedText, 'authored padding, colored surface and quarter-turn match native Text');
    assert.equal(await page.locator('.reception-document-canvas [data-layer-id="text:private"]').count(), 0);
    assert.deepEqual(await page.locator('.reception-document-canvas > [data-layer-id], .reception-document-canvas > [data-cell-id]').evaluateAll(nodes => nodes.map(node => node.dataset.layerId || node.dataset.cellId)), before.artworkLayers.filter(id => id !== 'text:private'));
    await page.screenshot({ path: `${output}/preview.png` });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
    await page.getByRole('button', { name: 'Reception', exact: true }).click();
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
