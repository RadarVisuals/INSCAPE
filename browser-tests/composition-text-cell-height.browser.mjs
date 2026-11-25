import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorCommand } from './fixtures/editor-menu.mjs';
import { openSharedTool, closeSharedTool } from './fixtures/shared-tools.mjs';

const origin = process.env.INSCAPE_TEST_ROOT, output = process.env.INSCAPE_BROWSER_OUTPUT;
const composition = page => page.evaluate(() => window.nativeCompositionFixture.root.getDraft().composition);
const ownerId = 'shape:tiling-top';
const frameOf = (value, id) => value.workbench[id.startsWith('text:') ? 'texts' : 'shapes'].find(item => item.id === id).window;
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1.5, message + ': ' + actual + ' vs ' + expected);
for (const width of [1440, 900]) test('the cell edge crops stationary text while the green frame stays independently editable at ' + width + 'px', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' }), errors = [];
    page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1&longText=1&positioning=1&session=' + crypto.randomUUID());
    const cell = page.getByRole('group', { name: 'Upper text bento cell', exact: true });
    await cell.waitFor(); await page.evaluate(() => document.fonts.ready);
    const initial = await composition(page), textId = initial.cells.find(cell => cell.id === ownerId).members[0];
    const text = page.locator('.text-window[data-workbench-view-id="' + textId + '"]');
    const assertBoundary = async () => {
      await page.waitForFunction(textId => {
        const node = document.querySelector('.text-window[data-workbench-view-id="' + textId + '"]');
        if (!node) return false;
        const box = node.getBoundingClientRect(), green = node.querySelector('.text-window-bounds').getBoundingClientRect();
        const scroll = node.querySelector('.text-module-scroll').getBoundingClientRect();
        return Math.abs(box.bottom - green.bottom) < 1.5 && Math.abs(scroll.bottom - green.bottom) < 1.5;
      }, textId);
    };
    const assertGap = async value => {
      await assertBoundary();
      const owner = frameOf(value, ownerId), frame = frameOf(value, textId);
      await page.waitForFunction(({ ownerId, textId, owner, frame }) => {
        const parent = document.querySelector('.shape-instance [data-workbench-view-id="' + ownerId + '"]').getBoundingClientRect();
        const box = document.querySelector('.text-window[data-workbench-view-id="' + textId + '"]').getBoundingClientRect();
        const gap = owner.top + owner.height - frame.top - frame.height;
        return Math.abs(parent.bottom - box.bottom - gap / owner.height * parent.height) < 1.5
          && Math.abs(box.height - frame.height / owner.height * parent.height) < 1.5;
      }, { ownerId, textId, owner, frame });
    };
    await assertGap(initial);
    await cell.click({ position: { x: 20, y: 20 } });
    const inspector = await openSharedTool(page, 'Inspector');
    const edge = page.getByRole('button', { name: 'Resize cell bottom', exact: true });
    const box = await edge.boundingBox();
    const originalTextBox = await text.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 55, { steps: 10 });
    await assertBoundary();
    const liveTextBox = await text.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) near(liveTextBox[key], originalTextBox[key], 'live cell resize leaves text ' + key + ' unchanged');
    assert.deepEqual(await composition(page), initial, 'live preview has not saved geometry yet');
    await page.mouse.up(); await assertGap(await composition(page));
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), initial);
    const cellHeight = inspector.getByRole('spinbutton', { name: 'Cell height', exact: true });
    for (const height of [240, 500]) {
      await cellHeight.fill(String(height)); await cellHeight.press('Tab');
      const saved = await composition(page), owner = frameOf(saved, ownerId), frame = frameOf(saved, textId);
      assert.equal(owner.height, height);
      assert.deepEqual(frame, frameOf(initial, textId), 'changing cell height leaves the full text frame untouched');
      assert.deepEqual(saved.texts, initial.texts);
      await assertGap(saved);
    }
    await closeSharedTool(page, 'Inspector');
    await cell.dblclick({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await text.locator('[contenteditable="true"]').click({ position: { x: 12, y: 12 } });
    await page.waitForFunction(textId => getComputedStyle(document.querySelector('.text-window[data-workbench-view-id="' + textId + '"] .text-window-bounds')).opacity === '1', textId);
    const controls = page.locator('.workbench-window-controls').filter({ has: page.locator('[data-workbench-view-id="' + textId + '"]') });
    const bottom = controls.getByRole('separator', { name: 'Resize Text from bottom', exact: true });
    const beforeTextResize = await composition(page), beforeFrame = frameOf(beforeTextResize, textId);
    await bottom.focus();
    for (let i = 0; i < 4; i++) await bottom.press('Alt+ArrowUp');
    const smaller = await composition(page);
    near(frameOf(smaller, textId).height, beforeFrame.height - 32, 'green bottom handle freely changes text height');
    assert.deepEqual(frameOf(smaller, ownerId), frameOf(beforeTextResize, ownerId), 'text resize leaves its cell alone');
    assert.deepEqual(smaller.texts, initial.texts);
    await assertGap(smaller);
    const handle = await bottom.boundingBox(), oldBox = await text.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 24, { steps: 6 });
    await assertBoundary();
    assert.ok((await text.boundingBox()).height < oldBox.height - 10, 'live text clipping follows its green handle');
    assert.deepEqual(await composition(page), smaller, 'text handle preview is unsaved');
    await page.keyboard.press('Escape'); await page.mouse.up();
    await assertGap(smaller); near((await text.boundingBox()).height, oldBox.height, 'Escape restores the frame');
    await editorCommand(page, 'Edit', 'Undo');
    near(frameOf(await composition(page), textId).height, beforeFrame.height - 24, 'Undo restores the preceding text height');
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual(await composition(page), smaller);
    const grip = controls.getByLabel('Move Text window', { exact: true });
    const gripBox = await grip.boundingBox();
    await page.mouse.move(gripBox.x + 10, gripBox.y + gripBox.height / 2);
    await page.mouse.down(); await page.mouse.move(gripBox.x + 10, gripBox.y + gripBox.height / 2 + 24, { steps: 6 });
    await assertBoundary();
    const movedBox = await text.boundingBox();
    assert.ok(movedBox.y > oldBox.y + 10, 'moving the text moves its actual clipping frame');
    near(movedBox.height, oldBox.height, 'moving the text does not stretch it to the cell bottom');
    await page.keyboard.press('Escape'); await page.mouse.up(); await assertGap(smaller);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/green-text-frame-' + width + '.png' });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click();
    const cellTools = await openSharedTool(page, 'Inspector');
    const finalHeight = cellTools.getByRole('spinbutton', { name: 'Cell height', exact: true });
    await finalHeight.fill('240'); await finalHeight.press('Tab');
    const cropped = await composition(page);
    assert.deepEqual(frameOf(cropped, textId), frameOf(smaller, textId), 'raising the cell edge past the text leaves its frame untouched');
    await assertGap(cropped);
    await closeSharedTool(page, 'Inspector');
    await cell.dblclick({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await text.locator('[contenteditable="true"]').click({ position: { x: 5, y: 5 } });
    await page.screenshot({ path: output + '/cell-crops-green-frame-' + width + '.png' });
    await page.reload(); await cell.waitFor();
    assert.deepEqual(await composition(page), cropped); await assertGap(cropped);
    await editorCommand(page, 'Canvas', 'Preview');
    const group = page.locator('[data-cell-group="' + ownerId + '"]');
    await group.getByRole('button', { name: 'Read full text', exact: true }).waitFor();
    const geometry = await group.evaluate((node, textId) => {
      const parent = node.getBoundingClientRect(), frame = node.querySelector('[data-layer-id="' + textId + '"]').getBoundingClientRect();
      const excerpt = node.querySelector('.composition-text-excerpt').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(node.querySelector('article p'));
      const top = Math.max(parent.top, frame.top), bottom = Math.min(parent.bottom, frame.bottom);
      const lines = [...range.getClientRects()].filter(r => r.width && r.height && r.top >= top - 1 && r.bottom <= bottom + 1);
      return { gapRatio: (parent.bottom - frame.bottom) / parent.height, excerptEnd: excerpt.bottom,
        expectedEnd: lines.at(-1)?.bottom ?? frame.top };
    }, textId);
    const owner = frameOf(cropped, ownerId), frame = frameOf(cropped, textId);
    assert.ok(Math.abs(geometry.gapRatio - (owner.top + owner.height - frame.top - frame.height) / owner.height) < .005);
    near(geometry.excerptEnd, geometry.expectedEnd, 'Preview includes every complete line above the clipping edge');
    await page.screenshot({ path: output + '/preview-text-frame-' + width + '.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 900]) test('selected Text handles follow zoom and pan without moving its authored frame at ' + width, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?tiling=1&positioning=1&session=' + crypto.randomUUID());
    const cell = page.getByRole('group', { name: 'Upper text bento cell', exact: true });
    await cell.waitFor(); await page.evaluate(() => document.fonts.ready);
    const saved = await composition(page), id = saved.cells.find(cell => cell.id === ownerId).members[0];
    const text = page.locator('.text-window[data-workbench-view-id="' + id + '"]');
    await cell.dblclick({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Back to cells', exact: true }).waitFor();
    await text.locator('[contenteditable="true"]').click({ position: { x: 5, y: 5 } });
    const controls = page.locator('.workbench-window-controls').filter({ has: page.locator('[data-workbench-view-id="' + id + '"]') });
    const checkHandles = async () => {
      const frame = await text.locator('.text-window-bounds').boundingBox();
      const marks = await controls.locator('[data-resize-edge]').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(), style = getComputedStyle(node, '::after');
        return { edge: node.dataset.resizeEdge, x: r.x + parseFloat(style.left) + parseFloat(style.width) / 2,
          y: r.y + parseFloat(style.top) + parseFloat(style.height) / 2, width: r.width, height: r.height };
      }));
      assert.equal(marks.length, 8);
      for (const mark of marks) {
        const x = frame.x + (mark.edge.includes('w') ? 0 : mark.edge.includes('e') ? frame.width : frame.width / 2);
        const y = frame.y + (mark.edge.includes('n') ? 0 : mark.edge.includes('s') ? frame.height : frame.height / 2);
        near(mark.x, x, mark.edge + ' mark aligns horizontally'); near(mark.y, y, mark.edge + ' mark aligns vertically');
        near(mark.width, 28, 'handle target keeps its screen width'); near(mark.height, 28, 'handle target keeps its screen height');
      }
    };
    await checkHandles();
    for (const zoom of [60, 40, 25, 55]) {
      await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill(String(zoom));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await checkHandles();
    }
    const board = page.locator('main.system-workflow').first(), beforePan = await text.boundingBox();
    await board.dispatchEvent('wheel', { deltaX: 35, deltaY: -25, bubbles: true, cancelable: true });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.notDeepEqual(await text.boundingBox(), beforePan, 'camera pan moves the visible Text');
    await checkHandles();
    // On a narrow window the Inspector covers the right corner; expose the
    // canvas before testing pointer input on the actual visible mark.
    await closeSharedTool(page, 'Inspector');
    await checkHandles();
    assert.deepEqual(await composition(page), saved, 'zoom and pan never change authored Text or cell geometry');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/zoomed-text-handles-' + width + '.png' });
    const handle = controls.getByRole('separator', { name: 'Resize Text from bottom', exact: true });
    await handle.focus(); await handle.press('Alt+ArrowDown');
    const resized = await composition(page);
    near(frameOf(resized, id).height, frameOf(saved, id).height + 8, 'resizing still uses authored coordinates after zoom');
    await checkHandles();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), saved);
    await checkHandles();
    const frame = await text.locator('.text-window-bounds').boundingBox();
    const point = { x: frame.x + frame.width, y: frame.y + frame.height };
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.dataset.resizeEdge, point), 'se', 'the visible corner receives pointer input');
    await page.keyboard.down('Alt'); await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + 11, point.y + 11, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const dragged = frameOf(await composition(page), id), original = frameOf(saved, id);
    near(dragged.width, original.width + 20, 'pointer resize converts zoomed width to authored units');
    near(dragged.height, original.height + 20, 'pointer resize converts zoomed height to authored units');
    await checkHandles();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await composition(page), saved);
    await checkHandles();
  } finally { await browser.close(); }
});
