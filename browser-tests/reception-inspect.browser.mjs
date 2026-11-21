import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/reception-inspect';

for (const width of [1440, 900]) test(`overflow follows the text frame and cell edges at ${width}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(origin + '/browser-tests/reception-inspect-fixture.html');
    await page.getByRole('button', { name: 'Read full text', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const group = page.locator('[data-cell-group="shape:mixed"]');
    const place = async ({ top, height = 600, cellHeight = 400, short = false, clipContent = true, fontSize = 20, textScale = 1 }) => {
      await page.evaluate(options => {
        const value = structuredClone(window.inspectionFixture.value);
        Object.assign(value.workbench.shapes.find(item => item.id === 'shape:mixed').window, { height: options.cellHeight });
        Object.assign(value.workbench.texts.find(item => item.id === 'text:long').window, { top: options.top, height: options.height });
        value.cells[0].clipContent = options.clipContent;
        const article = value.texts[0].article;
        Object.assign(article.appearance, { compact: true, fontSize: options.fontSize, lineHeight: 1.5, scale: options.textScale });
        article.content.content[0].content[0].text = options.short ? 'A short paragraph stays fully visible.'
          : 'A universe built from skeletal remains and malfunctioning machinery. '.repeat(40);
        window.inspectionFixture.replace(value);
      }, { top, height, cellHeight, short, clipContent, fontSize, textScale });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    };
    const measure = () => group.evaluate(node => {
      const cell = node.getBoundingClientRect(), layer = node.querySelector('[data-layer-id="text:long"]'), frame = layer.getBoundingClientRect();
      const excerpt = layer.querySelector('.reception-text-excerpt'), article = layer.querySelector('article'), p = article.querySelector('p');
      const cut = excerpt.getBoundingClientRect(), style = getComputedStyle(excerpt);
      const stops = [...style.maskImage.matchAll(/([\d.]+)px/g)].map(match => Number(match[1]));
      const range = document.createRange(); range.selectNodeContents(p);
      const lines = [...range.getClientRects()].filter(r => r.width && r.height);
      const visible = lines.filter(r => r.top >= Math.max(frame.top, cell.top) - 1 && r.bottom <= cut.bottom + 1);
      return { gap: cell.bottom - cut.bottom, height: cut.height,
        frameGap: frame.bottom - cut.bottom, mask: style.maskImage, fade: stops.at(-1) - stops.at(-2),
        line: parseFloat(getComputedStyle(p).lineHeight) * (Number(getComputedStyle(article).zoom) || 1),
        visible: visible.length, last: visible.at(-1)?.bottom, cut: cut.bottom, inkTop: lines[0].top - frame.top,
        dots: node.querySelectorAll('.reception-read-text').length };
    });
    for (const top of [48, 84, 0, 60]) {
      await place({ top });
      const saved = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
      const m = await measure();
      assert.ok(m.gap >= -1 && m.gap < m.line + 1, 'the excerpt uses every whole line above the cell edge: ' + JSON.stringify(m));
      assert.ok(Math.abs(m.cut - m.last) < 1.1, 'only complete lines survive');
      assert.ok(Math.abs(m.fade - m.line * 1.75) < 1, 'fade scales with typography');
      assert.ok(m.inkTop >= 0 && m.inkTop < m.line, 'the first line has not been moved');
      assert.equal(m.dots, 1);
      assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), saved, 'measurement never rewrites geometry or content');
    }
    await mkdir(output, { recursive: true });
    await group.screenshot({ path: `${output}/cell-edge-fade-${width}.png` });
    for (const fontSize of [16, 28]) {
      await place({ top: 48, height: 180, fontSize });
      const before = await measure();
      await place({ top: 210, height: 180, fontSize });
      const after = await measure();
      assert.ok(after.frameGap >= -1 && after.frameGap < after.line + 1, 'the last whole line reaches the text frame edge');
      assert.equal(after.visible, before.visible, 'moving the frame within the cell preserves all visible lines');
      assert.ok(Math.abs(after.height - before.height) < 1.1, 'the fade stays in the same place inside the text frame');
    }
    await place({ top: 48, fontSize: 28, textScale: 1.2 });
    const scaled = await measure();
    assert.ok(Math.abs(scaled.fade - scaled.line * 1.75) < 1, 'larger and scaled text uses its rendered line height');
    await place({ top: 310, short: true });
    const fitting = await measure();
    assert.equal(fitting.mask, 'none', 'a fitting paragraph is fully visible');
    assert.equal(fitting.dots, 0);
    for (const top of [80, 120]) {
      await place({ top, cellHeight: 170 });
      const small = await measure();
      assert.ok(small.visible >= (top === 80 ? 2 : 1), 'small cells preserve the complete lines they can fit: ' + JSON.stringify(small));
      assert.ok(small.fade > 0 && small.fade <= small.height / 2 + 1, 'the short excerpt retains a fully readable beginning');
    }
    await place({ top: -40 });
    const outside = await measure();
    assert.ok(outside.gap >= -1 && outside.gap < outside.line + 1, 'an above-cell text frame adds no negative margin');
    await place({ top: 80, cellHeight: 170, clipContent: false });
    const unclipped = await measure();
    assert.ok(unclipped.frameGap >= -1 && unclipped.frameGap < unclipped.line + 1, 'disabling cell clipping retains the authored text boundary');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1920, 900, 800, 390]) test(`introductory text uses its space and opens a compact scrollbar-free reader at ${width}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(origin + '/browser-tests/reception-inspect-fixture.html?preview=1');
    const trigger = page.getByRole('button', { name: 'Read full text', exact: true });
    await trigger.waitFor(); await page.evaluate(() => document.fonts.ready);
    const saved = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
    const cell = page.locator('[data-cell-id="shape:mixed"]');
    await trigger.scrollIntoViewIfNeeded();
    const before = await cell.boundingBox(), action = await trigger.boundingBox();
    assert.ok(Math.abs(before.x + before.width - action.x - action.width - 16) < 1);
    assert.ok(Math.abs(before.y + before.height - action.y - action.height - 16) < 1);
    assert.equal(await trigger.locator('.reception-read-dots > span').count(), 3);
    assert.equal(await page.getByRole('button', { name: /^Inspect / }).count(), 0);
    assert.equal(await page.locator('[data-cell-group="shape:short"] button').count(), 0, 'short copy has no reading action');
    const excerpt = await page.locator('[data-layer-id="text:long"]').evaluate(node => {
      const frame = node.getBoundingClientRect(), cut = node.querySelector('.reception-text-excerpt');
      const stops = [...getComputedStyle(cut).maskImage.matchAll(/([\d.]+)px/g)].map(match => Number(match[1]));
      return { unused: frame.height - cut.getBoundingClientRect().height, fade: stops.at(-1) - stops.at(-2),
        line: parseFloat(getComputedStyle(node.querySelector('article p')).lineHeight) };
    });
    assert.ok(excerpt.unused < 30, `no reserved button row: ${excerpt.unused}`);
    assert.ok(Math.abs(excerpt.fade - excerpt.line * 1.75) < 1, 'fade follows rendered line height');
    const gutters = await page.locator('.reception-document-preview-scroll, .reception-preview-content').evaluateAll(nodes => nodes.map(node => ({
      gutter: node.offsetWidth - node.clientWidth, scrollbar: getComputedStyle(node).scrollbarWidth, reserved: getComputedStyle(node).scrollbarGutter,
    })));
    assert.ok(gutters.every(node => node.gutter === 0 && node.scrollbar === 'none' && node.reserved === 'auto'));
    await page.screenshot({ path: `${output}/intro-${width}.png` });
    await page.evaluate(() => { window.introNodes = [...document.querySelectorAll('[data-cell-group], .reception-image, [data-layer-id] article')]; });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Full text' }), scroll = dialog.getByRole('region', { name: 'Article text' });
    await dialog.waitFor();
    const panel = await dialog.boundingBox(), text = await dialog.locator('article').boundingBox();
    assert.ok(panel.width <= width - 32 + 1);
    assert.ok(Math.abs(panel.width - text.width - 64) < 1, 'reader hugs its text plus 32px each side');
    assert.ok(Math.abs(panel.x + panel.width / 2 - width / 2) < 1);
    assert.equal(await dialog.locator('.reception-image').count(), 0);
    assert.equal(await scroll.evaluate(node => node.scrollHeight > node.clientHeight && getComputedStyle(node).scrollbarWidth === 'none' && node.offsetWidth === node.clientWidth), true);
    assert.equal(await scroll.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('PageDown');
    await page.waitForFunction(() => document.querySelector('.reception-reader-scroll').scrollTop > 100);
    await scroll.hover(); const priorScroll = await scroll.evaluate(node => node.scrollTop);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(previous => document.querySelector('.reception-reader-scroll').scrollTop > previous, priorScroll);
    await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
    const close = await dialog.getByRole('button', { name: 'Close reading view' }).boundingBox();
    assert.ok(close.y >= panel.y && close.y + close.height <= panel.y + panel.height);
    await scroll.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${output}/reader-${width}.png` });
    await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    assert.deepEqual(await cell.boundingBox(), before);
    await trigger.click(); await dialog.getByRole('button', { name: 'Close reading view' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.introNodes.every(node => node.isConnected)), true);
    assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('fixed-height fade-only text stays visible and multiple reading excerpts share one action', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto(origin + '/browser-tests/reception-inspect-fixture.html');
    await page.getByRole('button', { name: 'Read full text' }).waitFor();
    await page.evaluate(() => {
      const value = structuredClone(window.inspectionFixture.value), short = value.texts[1];
      short.article.appearance.compact = true;
      short.article.content.content[0].content[0].text = 'CHAPTER ZERO // ARRIVAL';
      value.cells[1].singleLine = true;
      Object.assign(value.workbench.texts.find(t => t.id === short.id).window, { left: 24, top: 424, width: 950, height: 52 });
      window.inspectionFixture.replace(value);
    });
    const short = page.locator('[data-cell-group="shape:short"]');
    await page.waitForFunction(() => document.querySelector('[data-layer-id="text:short"] article').textContent.includes('CHAPTER ZERO'));
    const saved = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
    for (const width of [1100, 900, 800, 700, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const layer = document.querySelector('[data-layer-id="text:short"]'), range = document.createRange();
        range.selectNodeContents(layer.querySelector('p'));
        return !layer.querySelector('[data-overflow]') && range.getBoundingClientRect().bottom <= layer.getBoundingClientRect().bottom + 1;
      });
      assert.equal(await short.locator('button').count(), 0, 'fade-only content never opens a reader');
      assert.ok(Math.abs((await short.boundingBox()).height - 100) < 1);
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), saved);
    // A second article in the same cell must not stack another ellipsis over it.
    await page.evaluate(() => {
      const value = structuredClone(window.inspectionFixture.value), second = structuredClone(value.texts[0]);
      second.id = 'text:second'; value.texts.push(second); value.cells[0].members.push(second.id); value.artworkLayers.push(second.id);
      const placement = structuredClone(value.workbench.texts.find(t => t.id === 'text:long')); placement.id = second.id; value.workbench.texts.push(placement);
      window.inspectionFixture.replace(value);
    });
    await page.locator('[data-layer-id="text:second"] [data-overflow]').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Read full text' }).count(), 1);
    await page.getByRole('button', { name: 'Read full text' }).click();
    assert.equal(await page.locator('.reception-text-reader article').count(), 2);
  } finally { await browser.close(); }
});

test('Human Underneath typography stays intact in the compact reading surface', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(origin + '/browser-tests/reception-inspect-fixture.html?preview=1');
    await page.getByRole('button', { name: 'Read full text' }).waitFor();
    await page.evaluate(() => {
      const value = structuredClone(window.inspectionFixture.value), article = value.texts[0].article;
      value.shapes[0].color = '#001421'; value.cells[0].radius = 8;
      article.appearance = { ...article.appearance, compact: false, fontSize: 18, lineHeight: 1.65 };
      article.title = 'Human Underneath'; article.appearance.titleFontSize = 32;
      const paragraph = (text, italic = false) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(italic ? { marks: [{ type: 'italic' }] } : {}) }] });
      article.content.content = [
        paragraph('A universe built out of skeletal remains and industrial machinery.', true),
        paragraph("The Underneath is a planet where humanity is the last thing that's sacred. In here, you are nothing more than any other creature sharing the same pitch-black sky."),
        paragraph("It's a place thick with grotesque monsters and an atmosphere of dread, where salvaged bodies become the modular pieces this very world is made of."),
        paragraph('Human Underneath is the entire body of work. It brings together the deliberate stories and illustrated pieces pulled from this place, along with you as the reader and whatever humanity is still left inside its inhabitants.'),
      ];
      window.inspectionFixture.replace(value);
    });
    for (const width of [1440, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole('button', { name: 'Read full text' }).click();
      const dialog = page.getByRole('dialog', { name: 'Full text' });
      await dialog.getByRole('heading', { name: 'Human Underneath' }).waitFor();
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.width < 700, 'large windows keep the reading surface close to the column');
      assert.equal(await dialog.locator('article p').count(), 4);
      assert.equal(await dialog.locator('article').evaluate(n => getComputedStyle(n).fontSize), '18px');
      await page.screenshot({ path: `${output}/human-underneath-reader-${width}.png` });
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      await page.screenshot({ path: `${output}/human-underneath-intro-${width}.png` });
    }
  } finally { await browser.close(); }
});

for (const width of [1440, 900]) test(`cell clipping reveals dots only for hidden ink, preserving the full text at ${width}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(origin + '/browser-tests/reception-inspect-fixture.html');
    await page.getByRole('button', { name: 'Read full text', exact: true }).waitFor();
    const copy = 'The Underneath is a planet where humanity is the last thing that is sacred. Every creature shares the same pitch-black sky. '.repeat(3).trim();
    await page.evaluate(copy => {
      const value = structuredClone(window.inspectionFixture.value);
      value.texts[0].article.content.content[0].content[0].text = copy;
      Object.assign(value.workbench.texts.find(item => item.id === 'text:long').window, { top: 40, height: 340 });
      window.inspectionFixture.replace(value);
    }, copy);
    await page.evaluate(() => document.fonts.ready);
    const group = page.locator('[data-cell-group="shape:mixed"]');
    const trigger = group.getByRole('button', { name: 'Read full text', exact: true });
    await trigger.waitFor({ state: 'detached' });
    const cuts = await group.evaluate(node => {
      const parent = node.getBoundingClientRect(), frame = node.querySelector('[data-layer-id="text:long"]').getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(node.querySelector('article p'));
      const ink = range.getBoundingClientRect(), scale = parent.height / 400;
      return { empty: Math.floor(((ink.bottom + frame.bottom) / 2 - parent.top) / scale),
        text: Math.floor(((ink.top + ink.bottom) / 2 - parent.top) / scale) };
    });
    const authored = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value.workbench.texts));
    const resize = async (height, clipContent = true) => {
      await page.evaluate(({ height, clipContent }) => {
        const value = structuredClone(window.inspectionFixture.value);
        value.workbench.shapes.find(item => item.id === 'shape:mixed').window.height = height;
        value.cells[0].clipContent = clipContent;
        window.inspectionFixture.replace(value);
      }, { height, clipContent });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value.workbench.texts)), authored, 'cell clip never rewrites the text frame');
    };
    await resize(cuts.empty);
    assert.equal(await trigger.count(), 0, 'cropping empty text-frame space creates no reading action');
    const emptyCut = await group.evaluate(node => {
      const cell = node.getBoundingClientRect(), text = node.querySelector('[data-layer-id="text:long"]').getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(node.querySelector('article p'));
      return text.bottom > cell.bottom + 1 && range.getBoundingClientRect().bottom < cell.bottom;
    });
    assert.equal(emptyCut, true, 'the authored green frame really extends below the cell');
    await resize(cuts.text);
    await trigger.waitFor();
    const cropped = await group.evaluate(node => {
      const cell = node.getBoundingClientRect(), excerpt = node.querySelector('.reception-text-excerpt');
      const r = excerpt.getBoundingClientRect(), style = getComputedStyle(excerpt);
      const stops = [...style.maskImage.matchAll(/([\d.]+)px/g)].map(match => Number(match[1]));
      return { gap: cell.bottom - r.bottom,
        fade: stops.at(-1) - stops.at(-2), mask: style.maskImage,
        line: parseFloat(getComputedStyle(node.querySelector('article')).lineHeight) };
    });
    assert.ok(cropped.gap >= -1 && cropped.gap < cropped.line + 1, JSON.stringify(cropped));
    assert.ok(cropped.fade > 0 && cropped.fade <= cropped.line * 1.75 + 1 && cropped.mask !== 'none', JSON.stringify(cropped));
    const parent = await group.boundingBox(), action = await trigger.boundingBox();
    assert.ok(Math.abs(parent.y + parent.height - action.y - action.height - 16) < 1);
    await page.screenshot({ path: `${output}/cell-edge-cropped-${width}.png` });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Full text', exact: true });
    await dialog.waitFor();
    assert.equal((await dialog.locator('article').textContent()).trim(), copy, 'the reader retains all text below the cell edge');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await resize(cuts.text, false);
    await trigger.waitFor({ state: 'detached' });
    await resize(400);
    await trigger.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
