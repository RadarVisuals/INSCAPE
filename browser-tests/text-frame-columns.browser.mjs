import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
const words = 'An illustrated world grows through the stories we tell. The words continue from one column into the next, leaving the artwork room to breathe. ';
async function seed(page, { columns = 2, width = 720, height = 290, scale = 1, display = false } = {}) {
  await mountTextToolsFixture(page, origin, { displayTextCount: display ? 1 : 0 });
  await page.evaluate(async ({ columns, width, height, scale, words, display }) => {
    const draft = window.savedDraft();
    const article = draft.texts[0].article;
    article.title = 'Stories from underneath';
    article.appearance = { background: '#101111', color: '#ffffff', frame: false, opacity: 1, fontSize: 16, columns, columnGap: 24, scale,
      padding: { top: 16, right: 24, bottom: 20, left: 24 } };
    article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: words.repeat(7) }] }];
    draft.workbench.texts[0].window = { left: 24, top: 100, width, height };
    if (display) {
      const placement = draft.grids.flatMap(grid => grid.placements).find(item => item.text?.article);
      placement.text.article = structuredClone(article); placement.text.article.title = 'Display article 1';
      placement.columnSpan = 20; placement.rowSpan = 10;
      draft.workbench.display.window = { left: 24, top: 650, width: 1050, height: 590.625 };
    }
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  }, { columns, width, height, scale, words, display });
  await mountTextToolsFixture(page, origin); await settle(page);
}
const measure = locator => locator.evaluate(body => {
  const bounds = body.getBoundingClientRect(), style = getComputedStyle(body), count = Number(style.columnCount);
  const factor = bounds.width / body.clientWidth;
  const page = body.closest('.text-editor-page, article.text-document'), frame = body.closest('[data-text-frame]');
  const columnWidth = (bounds.width - (count - 1) * parseFloat(style.columnGap) * factor) / count;
  const glyphs = [], walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let left = 0, visible = 0, cut = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (let index = 0; index < node.length; index++) {
      const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
      const r = range.getBoundingClientRect();
      glyphs.push([r.left - bounds.left, r.top - bounds.top, r.width, r.height].map(value => Math.round(value * 10) / 10));
      if (r.left < bounds.left + columnWidth + 1) left++;
      if (r.left >= bounds.left - 1 && r.right <= bounds.right + 1) {
        visible++; if (r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1) cut++;
      }
    }
  }
  return { left, visible, cut, glyphs, count, height: body.clientHeight, width: body.clientWidth,
    scrollWidth: body.scrollWidth, scrollHeight: body.scrollHeight, text: body.textContent,
    bottomGap: frame ? frame.getBoundingClientRect().bottom - bounds.bottom - parseFloat(getComputedStyle(page).paddingBottom) * factor : null };
});
const bodyIn = page => page.locator('.text-window .text-editor-content');
async function assertPainted(page, body) {
  const png = await body.screenshot();
  const ink = await page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) count++;
    return count;
  }, png.toString('base64'));
  assert.ok(ink > 100, `white text is actually painted over the black article background: ${ink} pixels`);
}
async function resizeHeight(page, delta) {
  const handle = page.getByRole('separator', { name: 'Resize Text from bottom', exact: true });
  await handle.focus();
  const box = await handle.boundingBox();
  await page.keyboard.down('Alt'); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + delta, { steps: 12 });
  await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
}

test('frame height fills columns sequentially, preserves text and reports excess content through resize and reload', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    const savedArticle = await page.evaluate(() => window.savedDraft().texts[0].article);
    const editor = await bodyIn(page).elementHandle();
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const short = await measure(bodyIn(page));
    assert.ok(short.scrollWidth > short.width, 'short frame retains excess text in additional clipped columns');
    assert.equal(short.cut, 0, 'frame breaks between complete lines');
    assert.ok(Math.abs(short.bottomGap) < 1, `body uses the full frame height inside authored padding: ${short.bottomGap}`);
    await page.locator('.text-window .text-frame-overflow').waitFor();
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/text-columns-short-1440.png' });
    await resizeHeight(page, 470);
    const tall = await measure(bodyIn(page));
    assert.ok(tall.left > short.left, `growing height moves more text into the first column: ${short.left} → ${tall.left}`);
    assert.equal(tall.visible, tall.glyphs.length, 'all content fits the enlarged frame');
    assert.equal(tall.cut, 0);
    assert.equal(await page.locator('.text-frame-overflow').count(), 0);
    assert.equal(await bodyIn(page).evaluate((node, original) => node === original, editor), true, 'resizing keeps editor and history');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article), savedArticle, 'resize never rewrites article content or settings');
    await page.screenshot({ path: '.browser-test-runtime/text-columns-tall-1440.png' });
    await resizeHeight(page, -470);
    const shrunk = await measure(bodyIn(page));
    assert.deepEqual(shrunk.glyphs, short.glyphs, 'returning to the original height restores exact line breaks');
    await page.locator('.text-window .text-frame-overflow').waitFor();
    assert.deepEqual(await page.locator('.text-window [data-text-frame]').evaluate(node => {
      node.scrollTop = 999; node.scrollLeft = 999; return [node.scrollTop, node.scrollLeft];
    }), [0, 0], 'composition clips overflow instead of scrolling it');
    await page.getByRole('button', { name: 'Read', exact: true }).click(); await settle(page);
    assert.deepEqual((await measure(page.locator('.text-window article > .text-document-body'))).glyphs, short.glyphs);
    await assertPainted(page, page.locator('.text-window article > .text-document-body'));
    await mountTextToolsFixture(page, origin, { visitor: true }); await settle(page);
    assert.deepEqual((await measure(page.locator('.text-window article > .text-document-body'))).glyphs, short.glyphs);
    await assertPainted(page, page.locator('.text-window article > .text-document-body'));
    assert.equal(await page.locator('.text-frame-overflow').count(), 0, 'visitor sees the authored frame, not an editing warning');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article), savedArticle);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('narrow three-column frames support scaling, full-content Focus writing and return without losing their bounds', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } }); page.setDefaultTimeout(10000);
    await seed(page, { columns: 3, width: 600, height: 360, scale: 1.2 });
    await setWorkbenchZoom(page, .5); await settle(page);
    const original = await bodyIn(page).elementHandle(), before = await measure(bodyIn(page));
    const geometry = await page.evaluate(() => window.savedDraft().workbench);
    assert.equal(before.count, 3); assert.equal(before.cut, 0);
    assert.ok(Math.abs(before.bottomGap) < 1, 'article and camera scaling preserve the authored bottom padding');
    await page.locator('.text-window .text-frame-overflow').waitFor();
    await page.locator('.text-tools-window').getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'), body = dialog.getByRole('textbox', { name: 'Article text', exact: true });
    await body.waitFor(); await settle(page);
    assert.equal(await body.evaluate((node, previous) => node === previous, original), true);
    assert.equal(await body.textContent(), before.text, 'Focus writing retains the complete oversized article');
    await body.focus(); await page.keyboard.press('Control+End'); await page.keyboard.type(' THE END.'); await settle(page);
    assert.equal(await body.evaluate(node => {
      const r = getSelection().getRangeAt(0).getBoundingClientRect(), viewport = node.closest('.text-focus-scroll').getBoundingClientRect();
      return r.top >= viewport.top - 1 && r.bottom <= viewport.bottom + 1;
    }), true, 'the end remains visible and editable in Focus writing');
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).click(); await settle(page);
    assert.equal(await bodyIn(page).evaluate((node, previous) => node === previous, original), true);
    const after = await measure(bodyIn(page));
    assert.equal(after.height, before.height); assert.equal(after.left, before.left); assert.match(after.text, / THE END\.$/);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().workbench), geometry);
    await page.locator('.text-window .text-frame-overflow').waitFor();
    const tools = page.locator('.text-tools-window');
    await tools.getByRole('tab', { name: 'Layout', exact: true }).click();
    await tools.getByLabel('Text columns', { exact: true }).selectOption('1'); await settle(page);
    assert.equal(await page.locator('.text-window [data-text-frame]').count(), 0);
    assert.equal(await page.locator('.text-window .text-frame-overflow').count(), 0);
    assert.equal(await page.locator('.text-window .text-module-scroll').evaluate(node => {
      node.scrollTop = node.scrollHeight; return node.scrollTop > 0;
    }), true, 'switching to one column restores continuous scrolling');
    await tools.getByLabel('Text columns', { exact: true }).selectOption('3'); await settle(page);
    assert.deepEqual((await measure(bodyIn(page))).glyphs, after.glyphs, 'switching back restores frame flow');
    assert.equal(await page.locator('.text-window .text-module-scroll').evaluate(node => node.scrollTop), 0);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await page.screenshot({ path: '.browser-test-runtime/text-columns-short-390.png' });
  } finally { await browser.close(); }
});

test('Display uses the same bounded column flow in authoring and public reading', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } }); page.setDefaultTimeout(10000);
    await seed(page, { display: true });
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const target = page.getByRole('button', { name: 'Select Display article 1', exact: true });
    await target.focus(); await page.keyboard.press('Enter');
    const body = target.getByRole('textbox', { name: 'Article text', exact: true }); await body.waitFor(); await settle(page);
    const write = await measure(body);
    assert.ok(write.scrollWidth > write.width); assert.equal(write.cut, 0);
    await target.locator('.text-frame-overflow').waitFor();
    await page.screenshot({ path: '.browser-test-runtime/text-columns-display-write.png' });
    await mountTextToolsFixture(page, origin, { visitor: true }); await settle(page);
    const read = await measure(page.locator('.display-text-content article > .text-document-body'));
    assert.deepEqual(read.glyphs, write.glyphs);
    await assertPainted(page, page.locator('.display-text-content article > .text-document-body'));
    assert.equal(await page.locator('.text-frame-overflow').count(), 0);
    await page.screenshot({ path: '.browser-test-runtime/text-columns-display-visitor.png' });
  } finally { await browser.close(); }
});
