import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorCommand } from './fixtures/editor-menu.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5173';
const output = '.browser-test-runtime/composition-text-resize';
const snapshot = page => page.evaluate(() => window.nativeCompositionFixture.root.getDraft().composition);
const frame = value => value.workbench.texts[0].window;
const near = (a, b, message, tolerance = .001) => assert.ok(Math.abs(a - b) <= tolerance, message + ': ' + a + ' vs ' + b);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function checkLines(page) {
  await settle(page);
  const metrics = await page.locator('.text-module-scroll[data-text-excerpt]').evaluate(node => {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node), scale = box.height / node.clientHeight;
    const cellId = node.closest('[data-editor-cell]').dataset.editorCell;
    const cell = document.querySelector('[data-editor-cell-surface="' + cellId + '"]').getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(node.querySelector('article.text-document p'));
    const available = Math.min(box.bottom, cell.bottom), top = Math.max(box.top, cell.top);
    const rects = [...range.getClientRects()].filter(r => r.height && r.width);
    const visible = rects.filter(r => r.top >= top - scale && r.bottom <= available + scale);
    const last = visible.sort((a, b) => b.bottom - a.bottom)[0];
    const stops = [...style.maskImage.matchAll(/([\d.]+)px/g)].map(match => Number(match[1]));
    const cut = box.top + stops.at(-1) * scale;
    const leading = parseFloat(style.clipPath.slice(6)) * scale;
    return { cut, available, last: last?.bottom, line: last?.height, leading,
      firstTop: Math.min(...rects.map(r => r.top)), boxTop: box.top, cellTop: cell.top, scale, mask: style.maskImage };
  });
  assert.notEqual(metrics.mask, 'none');
  near(metrics.cut, metrics.last, 'fade ends at the last complete line inside the frame and cell', metrics.scale + .2);
  assert.ok(metrics.available - metrics.cut < metrics.line * 1.5, 'space below the fade cannot fit another line');
  if (metrics.cellTop <= metrics.boxTop) near(metrics.leading, 0, 'the first line stays visible');
  return metrics;
}

for (const width of [1440, 900]) for (const aligned of [true, false])
test('Bento Text stays on-axis with whole-line clipping at ' + width + (aligned ? ' aligned' : ' free'), { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' }), errors = [];
    page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/browser-tests/composition-native-editor-fixture.html?textAxes=1&session=' + crypto.randomUUID() + (aligned ? '' : '&freeText=1'));
    await page.getByRole('group', { name: 'Text cell bento cell', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const original = await snapshot(page), before = frame(original), text = page.locator('.text-window[data-workbench-view-id="' + original.texts[0].id + '"]');
    const inkBefore = await checkLines(page), domBefore = await text.boundingBox();
    await page.getByRole('group', { name: 'Text cell bento cell', exact: true }).click({ position: { x: 20, y: 20 } });
    const divider = await page.getByRole('button', { name: 'Resize cell left', exact: true }).boundingBox();
    await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2); await page.mouse.down();
    await page.mouse.move(divider.x + divider.width / 2 + 45, divider.y + divider.height / 2, { steps: 10 });
    assert.deepEqual(await snapshot(page), original, 'live resize does not save');
    await settle(page); const preview = await text.boundingBox();
    near(preview.y, domBefore.y, 'horizontal preview never drifts downward', 1);
    near(preview.height, domBefore.height, 'horizontal preview retains text height', 1);
    const inkDuring = await checkLines(page); near(inkDuring.firstTop, inkBefore.firstTop, 'the actual letters remain at the same height', 1);
    await page.mouse.up(); const resized = await snapshot(page);
    near(frame(resized).top, before.top, 'saved text top'); near(frame(resized).height, before.height, 'saved text height');
    assert.ok(frame(resized).left > before.left); assert.ok(frame(resized).width < before.width);
    assert.deepEqual(resized.texts, original.texts, 'article and typography remain authored');
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await snapshot(page), original);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await snapshot(page), resized);
    await checkLines(page);
    const upper = await page.getByRole('button', { name: 'Resize cell top', exact: true }).boundingBox();
    const cell = page.getByRole('group', { name: 'Text cell bento cell', exact: true }), cellBox = await cell.boundingBox();
    const parent = resized.workbench.shapes.find(s => s.id === resized.cells[1].id).window, scale = cellBox.width / parent.width;
    const beforeVertical = await text.boundingBox();
    await page.mouse.move(upper.x + upper.width / 2, upper.y + upper.height / 2); await page.mouse.down();
    await page.mouse.move(upper.x + upper.width / 2, upper.y + upper.height / 2 + 230 * scale, { steps: 12 });
    await settle(page); near((await text.boundingBox()).x, beforeVertical.x, 'vertical preview never drifts sideways', 1);
    await page.mouse.up(); const vertical = await snapshot(page);
    near(frame(vertical).left, frame(resized).left, 'vertical resize keeps text x'); near(frame(vertical).width, frame(resized).width, 'vertical resize keeps text width');
    near(frame(vertical).height, frame(resized).height, 'the cell does not shorten the text frame');
    await checkLines(page);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/text-' + width + (aligned ? '-aligned' : '-free') + '.png' });
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await snapshot(page), resized);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await snapshot(page), vertical);
    await page.reload(); await page.locator('.text-module-scroll[data-text-excerpt]').waitFor();
    assert.deepEqual(await snapshot(page), vertical); await checkLines(page); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
