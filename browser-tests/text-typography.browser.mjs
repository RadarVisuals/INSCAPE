import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
async function selectText(page, body, text) {
  await body.focus();
  await body.evaluate((root, text) => {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const node = walk.currentNode, offset = node.textContent.indexOf(text);
      if (offset < 0) continue;
      const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + text.length);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); return;
    }
    throw Error(`Missing selection: ${text}`);
  }, text);
  await settle(page);
}
async function setNumber(page, name, value) {
  const tools = page.locator('.text-tools-window');
  await tools.getByRole('tab', { name: 'Text', exact: true }).click();
  await tools.getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: name.startsWith('Title') ? 'Title' : 'Selection', exact: true }).click();
  if (name.startsWith('Paragraph') || name === 'Selected text tracking') {
    const advanced = tools.locator('.text-inspector-advanced');
    if (!await advanced.getAttribute('open').then(value => value !== null)) await advanced.locator('summary').click();
  }
  const field = page.getByRole('spinbutton', { name, exact: true });
  await field.fill(String(value)); await settle(page);
  assert.equal(await field.evaluate(node => node === document.activeElement), true, 'live formatting retains input focus without Enter');
}
const styleOf = locator => locator.evaluate(node => { const s = getComputedStyle(node); return [s.fontSize, s.letterSpacing, s.color]; });

test('clicking a small sub-label preserves the target and joined lines can be separated before spacing', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const shape of ['paragraphs', 'hardBreak', 'newline']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountTextToolsFixture(page, origin);
      await page.evaluate(async shape => {
        const draft = window.savedDraft(), article = draft.texts[0].article;
        article.title = 'NOMAD';
        const label = { type: 'text', text: 'HUMAN UNDERNEATH', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: 10, color: '#aabbcc' } }] };
        const sentence = { type: 'text', text: 'Nomad is an inversion. A name turned inside out.' };
        article.content.content = shape === 'paragraphs' ? [{ type: 'paragraph', content: [label] }, { type: 'paragraph', content: [sentence] }]
          : [{ type: 'paragraph', content: [label, ...(shape === 'hardBreak' ? [{ type: 'hardBreak' }] : []), { ...sentence, text: (shape === 'newline' ? '\n' : '') + sentence.text }] }];
        article.content.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Existence is loud and crowded with expectations.' }] });
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
      }, shape);
      await mountTextToolsFixture(page, origin);
      const body = page.getByRole('textbox', { name: 'Article text', exact: true });
      const label = body.locator('span').filter({ hasText: 'HUMAN UNDERNEATH' });
      await label.click();
      await page.locator('.text-inspector-advanced summary').click();
      const separate = page.getByRole('button', { name: 'Separate this line', exact: true });
      assert.equal(await separate.count(), shape === 'paragraphs' ? 0 : 1);
      await setNumber(page, 'Paragraph space after', 24);
      assert.equal(await body.locator('p').first().evaluate(n => n.style.paddingBottom), '24px');
      if (shape !== 'paragraphs') {
        assert.match(await body.locator('p').first().innerText(), /HUMAN UNDERNEATH[\s\S]+Nomad is an inversion/);
        if (shape === 'hardBreak') await page.screenshot({ path: '.browser-test-runtime/text-line-shared-wide.png' });
        await separate.click(); await settle(page);
        assert.equal(await separate.count(), 0);
        assert.equal(await body.locator('p').count(), 3);
        assert.equal(await body.locator('p').nth(0).innerText(), 'HUMAN UNDERNEATH');
        assert.equal(await body.locator('p').nth(1).innerText(), 'Nomad is an inversion. A name turned inside out.');
        assert.deepEqual(await body.locator('p').evaluateAll(nodes => nodes.map(n => n.style.paddingBottom)), ['0px', '24px', '']);
        assert.equal((await styleOf(label))[0], '10px'); assert.equal((await styleOf(label))[2], 'rgb(170, 187, 204)');
        assert.equal(await label.locator('strong').count(), 1);
        const before = await body.locator('p').nth(1).evaluate(n => n.getBoundingClientRect().top);
        await setNumber(page, 'Paragraph space after', 36);
        const after = await body.locator('p').nth(1).evaluate(n => n.getBoundingClientRect().top);
        assert.ok(Math.abs(after - before - 36) < .1, 'spacing now opens below the label');
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        assert.equal(await body.locator('p').count(), 2);
        await page.getByRole('button', { name: 'Redo', exact: true }).click();
        await page.getByRole('button', { name: 'Redo', exact: true }).click();
        assert.deepEqual(await body.locator('p').evaluateAll(nodes => nodes.map(n => n.style.paddingBottom)), ['36px', '24px', '']);
        if (shape === 'hardBreak') {
          await page.getByRole('button', { name: 'Undo', exact: true }).click();
          await page.getByRole('button', { name: 'Undo', exact: true }).click();
          await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
          await separate.scrollIntoViewIfNeeded(); await separate.focus();
          const tools = page.locator('.text-tools-window'), box = await tools.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= 390.5);
          assert.equal(await tools.locator('.text-controls-body').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
          await page.screenshot({ path: '.browser-test-runtime/text-line-shared-narrow.png' });
          await page.getByRole('button', { name: 'Redo', exact: true }).click();
          await page.getByRole('button', { name: 'Redo', exact: true }).click();
          await page.setViewportSize({ width: 1440, height: 1100 });
        }
      } else assert.equal(await body.locator('p').nth(1).evaluate(n => n.style.paddingBottom), '', 'clicking the label does not target the next paragraph');
      await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
      await mountTextToolsFixture(page, origin);
      const checkReader = async () => {
        const paragraphs = page.locator('.text-window article p');
        assert.equal(await paragraphs.nth(0).innerText(), 'HUMAN UNDERNEATH');
        assert.equal(await paragraphs.nth(1).innerText(), 'Nomad is an inversion. A name turned inside out.');
        assert.equal(await paragraphs.nth(0).evaluate(n => n.style.paddingBottom), shape === 'paragraphs' ? '24px' : '36px');
      };
      await checkReader(); await mountTextToolsFixture(page, origin, { visitor: true }); await checkReader();
      if (shape === 'hardBreak') await page.screenshot({ path: '.browser-test-runtime/text-line-separated-visitor.png' });
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('selected size and tracking author a sub-label, preserve other text, undo, reset and match Read/Visitor after reload', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await page.getByRole('textbox', { name: 'Article title', exact: true }).fill('THE UNDERNEATH');
    await body.fill('ARCHIVE // 01'); await body.press('End'); await body.press('Enter');
    await page.keyboard.insertText('A paragraph with selected words and ordinary text.');
    await selectText(page, body, 'ARCHIVE // 01');
    await page.getByLabel('Selected text font', { exact: true }).selectOption('Inscape Article Mono');
    await page.getByLabel('Selected text colour', { exact: true }).fill('#aabbcc');
    await setNumber(page, 'Selected text size', 10);
    await setNumber(page, 'Selected text tracking', .2);
    const label = body.locator('span').filter({ hasText: 'ARCHIVE // 01' });
    assert.deepEqual(await styleOf(label), ['10px', '2px', 'rgb(170, 187, 204)']);
    assert.equal(await body.locator('p').nth(1).locator('span').count(), 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal((await styleOf(label))[1], 'normal', 'one undo removes only tracking');
    assert.equal((await styleOf(label))[0], '10px');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.equal((await styleOf(label))[1], '2px');
    await setNumber(page, 'Title tracking', .12);
    assert.equal(await page.getByLabel('Article title', { exact: true }).evaluate(n => getComputedStyle(n).letterSpacing), '3.36px');

    await selectText(page, body, 'selected words');
    await setNumber(page, 'Selected text size', 24);
    const words = body.locator('span').filter({ hasText: 'selected words' });
    assert.equal((await styleOf(words))[0], '24px');
    await setNumber(page, 'Selected text tracking', .08);
    assert.equal((await styleOf(words))[1], '1.92px');
    const field = page.getByRole('spinbutton', { name: 'Selected text size', exact: true });
    await field.fill('999'); assert.equal((await styleOf(words))[0], '24px');
    await field.press('Enter'); assert.equal((await styleOf(words))[0], '24px');
    await field.fill(''); await field.pressSequentially('2'); await settle(page);
    assert.equal(await field.inputValue(), '2'); assert.equal((await styleOf(words))[0], '24px', 'an incomplete number does not overwrite the last valid size');
    await field.pressSequentially('8'); await settle(page);
    assert.equal((await styleOf(words))[0], '28px', 'completing a number applies immediately');
    await field.press('ArrowUp'); await settle(page);
    assert.equal((await styleOf(words))[0], '29px', 'spinner keys apply immediately');
    await field.press('Escape'); assert.equal((await styleOf(words))[0], '24px');
    await field.fill('48'); await field.press('Escape'); await body.focus(); assert.equal((await styleOf(words))[0], '24px');
    const tracking = page.getByLabel('Selected text tracking', { exact: true });
    await tracking.fill(''); await tracking.pressSequentially('-'); await field.focus(); await settle(page);
    assert.equal((await styleOf(words))[1], '1.92px', 'an unfinished negative number does not clear tracking on blur');

    await selectText(page, body, 'selected words');
    await page.getByRole('button', { name: 'Use inherited text size', exact: true }).click();
    assert.equal((await styleOf(words))[0], '16px'); assert.equal((await styleOf(words))[1], '1.28px');
    await page.getByRole('button', { name: 'Use inherited text tracking', exact: true }).click();
    assert.equal(await body.locator('p').nth(1).locator('span').count(), 0, 'reset removes only empty marks');
    // An explicit zero survives unrelated FontFamily/Color cleanup commands.
    await selectText(page, body, 'ordinary'); await setNumber(page, 'Selected text tracking', 0);
    assert.equal(await body.locator('span').filter({ hasText: 'ordinary' }).evaluate(n => n.style.letterSpacing), '0em', 'explicit zero renders immediately');
    await page.getByLabel('Selected text font', { exact: true }).selectOption('Inscape Sora');
    await page.getByLabel('Selected text font', { exact: true }).selectOption('');
    const zero = body.locator('span').filter({ hasText: 'ordinary' });
    assert.equal(await zero.evaluate(n => n.style.letterSpacing), '0em');
    await page.getByRole('button', { name: 'Use inherited text tracking', exact: true }).click();

    await body.focus(); await body.press('Control+A'); await settle(page);
    assert.equal(await field.getAttribute('placeholder'), 'Mixed'); assert.equal(await field.inputValue(), '');
    const mixedContent = await page.evaluate(() => window.savedDraft().texts[0].article.content);
    await field.fill('36'); await settle(page);
    assert.equal((await styleOf(label))[0], '36px');
    await field.press('Escape'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), mixedContent, 'Escape restores mixed sizes, colours and fonts');
    await setNumber(page, 'Paragraph space after', 30);
    assert.deepEqual(await body.locator('p').evaluateAll(nodes => nodes.map(n => n.style.paddingBottom)), ['30px', '30px']);
    await page.getByLabel('Paragraph space after', { exact: true }).press('Escape'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), mixedContent, 'paragraph spacing also restores the original blocks');
    await selectText(page, body, 'ARCHIVE // 01');
    const saved = await page.evaluate(() => window.savedDraft().texts[0].article);
    assert.equal(saved.content.content[0].content[0].marks.find(m => m.type === 'textStyle').attrs.fontSize, 10);
    assert.equal(saved.appearance.fontSize, 16);
    assert.equal(saved.appearance.titleLetterSpacing, .12);
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/text-typography-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    const tools = page.locator('.text-tools-window'), box = await tools.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390.5);
    assert.equal(await tools.locator('.text-controls-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await field.scrollIntoViewIfNeeded(); await field.fill('30'); await settle(page);
    assert.equal((await styleOf(label))[0], '30px');
    assert.equal(await field.evaluate(node => node === document.activeElement), true);
    await page.screenshot({ path: '.browser-test-runtime/text-typography-narrow.png' });
    await field.press('Escape'); assert.equal((await styleOf(label))[0], '10px');
    await page.setViewportSize({ width: 1440, height: 1100 }); await settle(page);
    await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
    const checkReader = async () => {
      const label = page.locator('.text-window article p span').filter({ hasText: 'ARCHIVE // 01' });
      assert.deepEqual(await styleOf(label), ['10px', '2px', 'rgb(170, 187, 204)']);
      assert.equal(await page.locator('.text-window article .text-document-title').evaluate(n => getComputedStyle(n).letterSpacing), '3.36px');
    };
    await checkReader(); await mountTextToolsFixture(page, origin); await checkReader();
    await mountTextToolsFixture(page, origin, { visitor: true }); await checkReader();
    assert.equal(await page.getByLabel('Selected text size', { exact: true }).count(), 0);
    await page.screenshot({ path: '.browser-test-runtime/text-typography-visitor.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('typography targets a Display heading and stays scoped when Text tools switch articles', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin, { displayTextCount: 2 });
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const first = page.getByRole('button', { name: 'Select Display article 1', exact: true });
    await first.focus(); await page.keyboard.press('Enter');
    const body = first.getByRole('textbox', { name: 'Article text', exact: true });
    await body.fill('ARCHIVE HEADING'); await body.press('Control+A');
    await page.getByLabel('Paragraph style', { exact: true }).selectOption('2');
    await setNumber(page, 'Selected text size', 32); await setNumber(page, 'Selected text tracking', .1);
    await setNumber(page, 'Paragraph space before', 6); await setNumber(page, 'Paragraph space after', 18);
    assert.deepEqual(await body.locator('h2').evaluate(n => [getComputedStyle(n).paddingTop, getComputedStyle(n).paddingBottom]), ['6px', '18px']);
    assert.equal((await styleOf(body.locator('h2 span')))[0], '32px');
    assert.equal((await styleOf(body.locator('h2 span')))[1], '3.2px');
    await page.getByLabel('Selected text size', { exact: true }).fill('999');
    const second = page.getByRole('button', { name: 'Select Display article 2', exact: true });
    await second.focus(); await page.keyboard.press('Enter');
    const other = second.getByRole('textbox', { name: 'Article text', exact: true });
    await other.fill('Separate article'); await other.press('Control+A');
    assert.equal(await page.getByLabel('Selected text size', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('Paragraph space after', { exact: true }).inputValue(), '');
    await setNumber(page, 'Selected text size', 18);
    const articles = await page.evaluate(() => window.savedDraft().grids.flatMap(grid => grid.placements).filter(p => p.kind === 'text').map(p => p.text.article));
    assert.equal(articles.find(a => a.title === 'Display article 1').content.content[0].content[0].marks.find(m => m.type === 'textStyle').attrs.fontSize, 32);
    assert.equal(articles.find(a => a.title === 'Display article 2').content.content[0].content[0].marks.find(m => m.type === 'textStyle').attrs.fontSize, 18);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('title and paragraph gaps control the Nomad layout, undo, reset and persist through Read and Visitor', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await page.getByLabel('Article title', { exact: true }).fill('NOMAD');
    await body.fill('HUMAN UNDERNEATH'); await body.press('End'); await body.press('Enter');
    await page.keyboard.insertText('Nomad is an inversion. A name turned inside out.'); await body.press('Enter');
    await page.keyboard.insertText('Existence is loud and crowded with expectations. You are constantly trapped in the performance of who you are supposed to be.');
    await selectText(page, body, 'HUMAN UNDERNEATH'); await setNumber(page, 'Selected text size', 10);
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    const point = async index => body.locator('p').nth(index).evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node); return range.getBoundingClientRect().top;
    });
    await setNumber(page, 'Title gap', 0); const top = await point(0);
    await setNumber(page, 'Title gap', 8); assert.ok(Math.abs((await point(0)) - top - 8) < .1);
    await setNumber(page, 'Title gap', 28);
    assert.ok(Math.abs((await point(0)) - top - 28) < .1);
    await page.getByLabel('Title gap', { exact: true }).press('Escape'); await settle(page);
    assert.ok(Math.abs((await point(0)) - top - 8) < .1, 'Escape also restores document appearance fields');
    // A collapsed cursor is enough to change the containing paragraph.
    await body.focus(); await body.press('Control+Home'); await body.press('ArrowRight'); await settle(page);
    await setNumber(page, 'Paragraph space after', 0); const zeroAfter = await point(1);
    await setNumber(page, 'Paragraph space after', 32); assert.ok(Math.abs((await point(1)) - zeroAfter - 32) < .1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.ok(Math.abs((await point(1)) - zeroAfter) < .1);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await selectText(page, body, 'Nomad is an inversion. A name turned inside out.');
    const before = await point(1); await setNumber(page, 'Paragraph space before', 5);
    assert.ok(Math.abs((await point(1)) - before - 5) < .1, 'before adds to preceding after');
    await setNumber(page, 'Paragraph space after', 12);
    const unchanged = await body.locator('p').nth(2).evaluate(n => n.getAttribute('style'));
    assert.ok(!unchanged?.includes('padding'), 'unselected paragraph keeps its defaults');
    const control = page.getByLabel('Paragraph space before', { exact: true });
    await control.fill('70'); await control.press('Escape'); await body.focus();
    assert.equal(await body.locator('p').nth(1).evaluate(n => n.style.paddingTop), '5px');
    await control.fill('513'); await control.press('Enter');
    assert.equal(await body.locator('p').nth(1).evaluate(n => n.style.paddingTop), '5px');
    await body.focus(); await body.press('Control+A'); await settle(page);
    assert.equal(await control.getAttribute('placeholder'), 'Mixed');
    await setNumber(page, 'Paragraph space before', 0);
    assert.deepEqual(await body.locator('p').evaluateAll(nodes => nodes.map(n => n.style.paddingTop)), ['0px', '0px', '0px']);
    await control.press('Escape'); await settle(page);
    assert.deepEqual(await body.locator('p').evaluateAll(nodes => nodes.map(n => n.style.paddingTop)), ['', '5px', ''], 'Escape restores mixed paragraph spacing');
    await setNumber(page, 'Paragraph space before', 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await body.locator('p').evaluateAll(nodes => nodes.map(n => n.style.paddingTop)), ['', '5px', '']);
    await selectText(page, body, 'Nomad is an inversion. A name turned inside out.');
    await page.getByRole('button', { name: 'Use automatic paragraph space before', exact: true }).click();
    assert.equal(await body.locator('p').nth(1).evaluate(n => n.style.paddingTop), '');
    await setNumber(page, 'Paragraph space before', 5);
    const saved = await page.evaluate(() => window.savedDraft().texts[0].article);
    assert.equal(saved.appearance.titleGap, 8);
    assert.equal(saved.content.content[0].attrs.spaceAfter, 32);
    assert.equal(saved.content.content[1].attrs.spaceBefore, 5);
    assert.equal(saved.content.content[2].attrs.spaceBefore, null);
    await page.screenshot({ path: '.browser-test-runtime/text-spacing-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    await control.scrollIntoViewIfNeeded(); await control.focus();
    const tools = page.locator('.text-tools-window'), box = await tools.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390.5);
    assert.equal(await tools.locator('.text-controls-body').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    await page.screenshot({ path: '.browser-test-runtime/text-spacing-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1100 }); await settle(page);
    await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
    const checkReader = async () => {
      const root = page.locator('.text-window article');
      assert.equal(await root.locator('.text-document-title').evaluate(n => getComputedStyle(n).marginBottom), '8px');
      assert.deepEqual(await root.locator('p').evaluateAll(nodes => nodes.map(n => [n.style.paddingTop, n.style.paddingBottom])), [['', '32px'], ['5px', '12px'], ['', '']]);
    };
    await checkReader(); await mountTextToolsFixture(page, origin); await checkReader();
    await mountTextToolsFixture(page, origin, { visitor: true }); await checkReader();
    await page.screenshot({ path: '.browser-test-runtime/text-spacing-visitor.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
