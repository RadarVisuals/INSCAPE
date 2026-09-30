import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
const near = (a, b, label) => assert.ok(Math.abs(a - b) < .1, `${label}: ${a} / ${b}`);
async function seed(page, options = {}) {
  await page.evaluate(async options => {
    const draft = window.savedDraft(), article = draft.texts[0].article;
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    article.title = options.title ?? '     ARCHIVE 01'; article.font = options.font || 'sora';
    article.appearance = { background: '#101111', frame: false, opacity: 1, fontSize: 14, color: '#ffffff', scale: options.scale || 1,
      ...(options.columns ? { columns: options.columns, columnGap: options.columnGap ?? 24 } : {}),
      ...(options.padding ? { padding: options.padding } : {}), ...(options.compact ? { compact: true } : {}) };
    if (options.lineHeight) article.appearance.lineHeight = options.lineHeight;
    article.content.content = [
      { type: 'artwork', attrs: { asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), alt: 'Skull study', caption: 'Underneath  the archive' } },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'GALLOWMAW' }] },
      ...['Every Gallowmaw is born with a second skull developing inside the first.  As it grows, the space that contains it becomes insufficient. The deformity gradually forces the original skull apart.',
        'A Gallowmaw cannot remain in this form indefinitely, and most do not survive what follows.',
        'Scattered records describe a substance believed to slow the growth of the inner skull considerably.  A handful of accounts suggest it may have stopped the process altogether, though the preparations used are poorly documented.',
        'The subsequent condition of the treated specimens is largely absent from these records.'].map(text => ({ type: 'paragraph', attrs: { textAlign: 'justify-left' }, content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] })),
      { type: 'paragraph', content: [{ type: 'text', text: 'Repeated   spaces\nA new line: office, first, affinity.' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: 'Final line.' }] },
    ];
    if (options.typography) {
      article.appearance.titleLetterSpacing = .1;
      article.content.content[1].content[0].marks = [{ type: 'textStyle', attrs: { fontSize: 32, letterSpacing: .12 } }];
      const paragraph = article.content.content[2], text = paragraph.content[0].text;
      paragraph.content = [{ type: 'text', text: text.slice(0, 15), marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: 10, letterSpacing: .2 } }] },
        { type: 'text', text: text.slice(15), marks: [{ type: 'bold' }] }];
    }
    if (options.spacing) {
      article.appearance.titleGap = 7;
      article.content.content[1].attrs = { ...article.content.content[1].attrs, spaceBefore: 14, spaceAfter: 9 };
      article.content.content[2].attrs = { ...article.content.content[2].attrs, spaceBefore: 5, spaceAfter: 24 };
      article.content.content.at(-1).attrs = { spaceBefore: 0, spaceAfter: 12 };
    }
    if (options.lineHeight) {
      article.content.content[1].attrs = { ...article.content.content[1].attrs, lineHeight: 1.1 };
      article.content.content[2].attrs = { ...article.content.content[2].attrs, lineHeight: 2.4 };
    }
    draft.workbench.texts[0].window = { left: 32, top: 100, width: options.width || 360, height: 850 };
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  }, options);
  await mountTextToolsFixture(page, origin);
  if (await page.getByRole('button', { name: 'Write', exact: true }).count()) {
    await page.getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
  }
  await page.locator('.text-editor-content img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await settle(page);
}
const measure = (page, write) => page.evaluate(write => {
  const root = document.querySelector(write ? '.text-editor-content' : '.text-window article.text-document > div');
  const outer = document.querySelector('.text-window').getBoundingClientRect();
  const rect = node => { const r = node.getBoundingClientRect(); return [r.x - outer.x, r.y - outer.y, r.width, r.height]; };
  const text = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const node = walk.currentNode;
    for (let i = 0; i < node.length; i++) { const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1); text.push([node.textContent[i], ...rect(range)]); }
  }
  const title = document.querySelector(write ? '.text-editor-page .text-document-title' : 'article .text-document-title');
  return { text, title: title ? rect(title) : null, images: [...root.querySelectorAll('img')].map(rect),
    blocks: [...root.querySelectorAll('p,h2,figcaption')].map(rect) };
}, write);
function compare(write, read) {
  for (const key of ['title', 'images', 'blocks', 'text']) {
    if (write[key] === null) { assert.equal(read[key], null); continue; }
    const a = write[key].flat(), b = read[key].flat();
    assert.equal(a.length, b.length, `${key} count`);
    a.forEach((v, i) => typeof v === 'number' ? near(v, b[i], `${key}[${i}]`) : assert.equal(v, b[i]));
  }
}

test('illustrated Text has matching title, glyph positions and line breaks in Write and Read', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.25 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    for (const options of [{}, { font: 'literata', width: 640 }, { font: 'plex', title: 'A long title that wraps onto several lines at this width' },
      { font: 'cormorant', scale: 1.2, padding: { top: 8, left: 12, right: 36, bottom: 0 } }, { font: 'mono', compact: true, title: '' },
      { columns: 2, columnGap: 32, width: 760, title: 'Archive in two columns' }, { columns: 3, width: 760, title: 'Archive in three columns' },
      { typography: true, width: 600 }, { spacing: true, width: 640 }, { spacing: true, compact: true, width: 640 },
      { spacing: true, columns: 2, width: 760 }, { lineHeight: 2, width: 600 }, { lineHeight: 1.4, compact: true, width: 600 }]) {
      await seed(page, options);
      if (options.font === 'literata') await setWorkbenchZoom(page, .5);
      await page.getByRole('button', { name: 'Close Text tools', exact: true }).click(); await settle(page);
      const before = await measure(page, true);
      if (!options.font) await page.screenshot({ path: '.browser-test-runtime/text-parity-write.png' });
      await page.getByRole('button', { name: 'Read', exact: true }).click();
      await page.locator('article img').evaluateAll(images => Promise.all(images.map(img => img.decode()))); await settle(page);
      compare(before, await measure(page, false));
      if (!options.font) await page.screenshot({ path: '.browser-test-runtime/text-parity-read.png' });
      if (!options.font) {
        await mountTextToolsFixture(page, origin, { visitor: true });
        await page.locator('article img').evaluateAll(images => Promise.all(images.map(img => img.decode()))); await settle(page);
        compare(before, await measure(page, false));
        assert.equal(await page.getByRole('button', { name: 'Write', exact: true }).count(), 0);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('selection colour and title alignment/colour persist, undo and render after reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await body.fill('Colour this fragment and leave the rest alone.'); await settle(page);
    await body.evaluate(node => { const range = document.createRange(); range.setStart(node.querySelector('p').firstChild, 0); range.setEnd(node.querySelector('p').firstChild, 6); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
    await settle(page);
    await page.getByLabel('Selected text colour', { exact: true }).fill('#ff8800');
    assert.equal(await body.locator('span').innerText(), 'Colour');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await body.locator('span').count(), 0);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Title', exact: true }).click();
    await page.getByRole('button', { name: 'Align title right', exact: true }).click();
    await page.getByLabel('Title colour', { exact: true }).fill('#9876ff');
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Layout', exact: true }).click();
    await page.getByLabel('Text columns', { exact: true }).selectOption('2');
    await page.getByLabel('Text column gap', { exact: true }).fill('32');
    const check = async write => {
      const title = page.locator(write ? '.text-editor-page .text-document-title' : 'article .text-document-title');
      assert.deepEqual(await title.evaluate(n => [getComputedStyle(n).textAlign, getComputedStyle(n).color]), ['right', 'rgb(152, 118, 255)']);
      assert.equal(await page.locator(write ? '.text-editor-content span' : 'article p span').evaluate(n => getComputedStyle(n).color), 'rgb(255, 136, 0)');
    };
    await check(true); await page.getByRole('button', { name: 'Read', exact: true }).click(); await check(false);
    await mountTextToolsFixture(page, origin); await check(false);
    const article = await page.evaluate(() => window.savedDraft().texts[0].article);
    assert.equal(article.appearance.titleAlignment, 'right'); assert.equal(article.appearance.titleColor, '#9876ff');
    assert.equal(article.appearance.columns, 2); assert.equal(article.appearance.columnGap, 32);
    await page.getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Title', exact: true }).click();
    await page.getByRole('button', { name: 'Use document title colour', exact: true }).click();
    assert.equal(await page.getByLabel('Article title', { exact: true }).evaluate(n => getComputedStyle(n).color), 'rgb(255, 255, 255)');
    await body.focus(); await body.press('Control+Home'); await body.press('ArrowRight');
    await body.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node.querySelector('span')); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
    await settle(page);
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Selection', exact: true }).click();
    await page.getByRole('button', { name: 'Use document text colour', exact: true }).click();
    assert.equal(await body.locator('span').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('column text remains reachable when Read as pages is enabled', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    await mountTextToolsFixture(page, origin);
    await page.evaluate(async () => {
      const d = window.savedDraft(), article = d.texts[0].article;
      article.title = 'Paged columns'; article.appearance.columns = 2;
      article.content.content = Array.from({ length: 24 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `Paragraph ${index + 1}. The archive keeps its stories, memories and fragments in the same reading order.` }] }));
      article.content.content.splice(12, 0, { type: 'pageBreak' });
      d.workbench.texts[0].window = { left: 32, top: 100, width: 650, height: 500 };
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(d.profileAddress), JSON.stringify(d));
    });
    await mountTextToolsFixture(page, origin);
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Layout', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Read as pages', exact: true }).check();
    await page.getByRole('button', { name: 'Read', exact: true }).click(); await settle(page);
    const seen = new Set(); let pageCount = 0;
    for (;;) {
      const chars = await page.locator('.text-page-viewport').evaluate(viewport => {
        const v = viewport.getBoundingClientRect(), chars = [];
        viewport.querySelectorAll('p').forEach((p, index) => {
          const text = p.firstChild;
          for (let i = 0; i < text.length; i++) {
            const range = document.createRange(); range.setStart(text, i); range.setEnd(text, i + 1);
            if ([...range.getClientRects()].some(r => r.width > 0 && r.right > v.left && r.left < v.right && r.top >= v.top - 1 && r.bottom <= v.bottom + 1)) chars.push(`${index}:${i}`);
          }
        });
        return chars;
      });
      chars.forEach(char => seen.add(char)); pageCount++;
      const next = page.getByRole('button', { name: 'Next text page', exact: true });
      if (!await next.count() || !await next.isEnabled()) break;
      assert.ok(pageCount < 30, 'pagination converges'); await next.click(); await settle(page);
    }
    const count = await page.locator('.text-page-viewport p').evaluateAll(nodes => nodes.reduce((sum, p) => sum + p.textContent.length, 0));
    assert.ok(pageCount > 1); assert.equal(seen.size, count, 'all authored characters appear on a reading page');
    await page.screenshot({ path: '.browser-test-runtime/text-column-pages.png' });
  } finally { await browser.close(); }
});
