import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const bodyFor = win => win.getByRole('textbox', { name: 'Article text', exact: true });
const article = (page, index = 0) => page.evaluate(index => window.savedDraft().texts[index].article, index);
const flatten = article => article.content.content.filter(node => node.type !== 'artwork').map(node => (node.content || []).map(child => child.text || '').join(''));

async function seed(page, textCount = 1) {
  await mountTextToolsFixture(page, origin, { textCount });
  await page.evaluate(async () => {
    const draft = window.savedDraft();
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    draft.texts[0].article.title = 'Moon title stays unchanged';
    draft.texts[0].article.content.content = [
      { type: 'paragraph', content: [
        { type: 'text', text: '🌙 ' },
        { type: 'text', text: 'Mo', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'on', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' moon MOON ' },
        { type: 'text', text: 'untouched link', marks: [{ type: 'link', attrs: { href: 'https://example.com/article', target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null } }] },
        { type: 'text', text: ' a.b' },
      ] },
      { type: 'paragraph', content: [{ type: 'text', text: 'edge' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'boundary' }] },
      { type: 'artwork', attrs: { asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), alt: 'Moon image description', caption: 'Moon caption stays unchanged' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'after artwork' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'hard' }, { type: 'hardBreak' }, { type: 'text', text: 'break' }] },
    ];
    // Seed the same optional defaults emitted by Tiptap, so exact undo assertions
    // compare authored behavior rather than first-edit schema normalization.
    for (const record of draft.texts) for (const node of record.article.content.content) {
      if (node.type === 'paragraph') node.attrs = { textAlign: null, spaceBefore: null, spaceAfter: null, lineHeight: null };
    }
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  });
  await mountTextToolsFixture(page, origin, { textCount });
}

for (const width of [1440, 390]) test(`article search and replacement preserve content and undo at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    const win = page.locator('.text-window'), body = bodyFor(win), tools = page.locator('.text-tools-window');
    const baseline = await article(page);
    await body.focus(); await body.press('Control+f');
    const query = tools.getByRole('textbox', { name: 'Find in article', exact: true });
    const replacement = tools.getByRole('textbox', { name: 'Replace with', exact: true });
    await query.waitFor();
    assert.equal(await query.evaluate(node => document.activeElement === node), true, 'editor shortcut focuses search');
    assert.equal(await tools.getByRole('button', { name: 'Replace all', exact: true }).isDisabled(), true);
    await query.fill('moon'); await settle(page);
    assert.equal((await body.locator('.text-search-match').allTextContents()).join('').toLowerCase(), 'moonmoonmoon', 'case-insensitive matches can cross inline marks');
    const active = () => body.locator('.text-search-match--active').evaluateAll(nodes => nodes.map(node => node.textContent).join(''));
    assert.equal((await active()).toLowerCase(), 'moon');
    await tools.getByRole('button', { name: 'Next match', exact: true }).click();
    assert.equal(await active(), 'moon');
    await tools.getByRole('button', { name: 'Previous match', exact: true }).click();
    assert.equal(await active(), 'Moon');
    await replacement.fill('Sun');
    await tools.getByRole('button', { name: 'Replace match', exact: true }).click(); await settle(page);
    assert.equal(flatten(await article(page))[0], '🌙 Sun moon MOON untouched link a.b');
    assert.equal(await body.locator('strong').innerText(), 'Sun', 'replacement inherits first matched character formatting');
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.deepEqual(await article(page), baseline, 'single replacement has a complete independent undo');
    await query.fill('moon'); await replacement.fill('Star');
    await tools.getByRole('button', { name: 'Replace all', exact: true }).click(); await settle(page);
    const replaced = await article(page);
    assert.equal(flatten(replaced)[0], '🌙 Star Star Star untouched link a.b');
    assert.equal(replaced.title, baseline.title);
    assert.deepEqual(replaced.content.content.find(node => node.type === 'artwork'), baseline.content.content.find(node => node.type === 'artwork'));
    assert.equal(await body.locator('a').getAttribute('href'), 'https://example.com/article');
    assert.equal(await body.locator('a').innerText(), 'untouched link');
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.deepEqual(await article(page), baseline, 'replace all is one undo step');
    for (const term of ['edgeboundary', 'boundaryafter artwork', 'hardbreak', 'Moon caption', 'not present']) {
      await query.fill(term); await settle(page);
      assert.equal(await body.locator('.text-search-match').count(), 0, `does not match ${term}`);
      assert.equal(await tools.getByRole('button', { name: 'Replace match', exact: true }).isDisabled(), true);
      assert.equal(await tools.getByRole('button', { name: 'Replace all', exact: true }).isDisabled(), true);
    }
    await query.fill('a.b'); await settle(page);
    assert.equal(await body.locator('.text-search-match').innerText(), 'a.b', 'search input is literal, not a regular expression');
    await query.fill(''); await settle(page);
    assert.equal(await body.locator('.text-search-match').count(), 0);
    assert.deepEqual(await article(page), baseline, 'search state never enters authored content');
    await query.fill('moon'); await settle(page);
    await mkdir('.browser-test-runtime', { recursive: true });
    await tools.screenshot({ path: `.browser-test-runtime/text-search-${width}.png` });
    assert.equal(await tools.locator('.text-controls-body').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await win.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter'); await settle(page);
    assert.deepEqual(await article(page), baseline, 'Read never changes saved content');
    assert.equal(await page.locator('.text-search-match:visible').count(), 0, 'search decorations do not leak into Read');
    await mountTextToolsFixture(page, origin, { visitor: true });
    assert.equal(await page.getByRole('textbox', { name: 'Find in article', exact: true }).count(), 0);
    assert.equal(await page.locator('.text-search-match').count(), 0);
    assert.equal(await page.locator('.text-window figcaption').innerText(), 'Moon caption stays unchanged');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('search remains scoped to its editor across module changes and native find elsewhere', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.setDefaultTimeout(10000);
    await seed(page, 2);
    const tools = page.locator('.text-tools-window'), wins = page.locator('.text-window');
    const first = bodyFor(wins.nth(0)), second = bodyFor(wins.nth(1));
    const firstBefore = await article(page), secondBefore = await article(page, 1);
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await first.focus(); await first.press('Control+f');
    await tools.getByRole('textbox', { name: 'Find in article', exact: true }).fill('moon');
    await tools.getByRole('textbox', { name: 'Replace with', exact: true }).fill('Wrong article');
    await second.focus(); await second.press('Control+f'); await settle(page);
    await tools.getByRole('textbox', { name: 'Find in article', exact: true }).fill('Body');
    await tools.getByRole('textbox', { name: 'Replace with', exact: true }).fill('Updated');
    await tools.getByRole('button', { name: 'Replace all', exact: true }).click(); await settle(page);
    assert.deepEqual(await article(page), firstBefore);
    assert.equal(flatten(await article(page, 1))[0], 'Updated 2');
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.deepEqual(await article(page, 1), secondBefore);
    const outsidePrevented = await wins.nth(1).getByRole('textbox', { name: 'Article title', exact: true }).evaluate(node => {
      node.focus(); const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
      node.dispatchEvent(event); return event.defaultPrevented;
    });
    assert.equal(outsidePrevented, false, 'native find is not intercepted outside the editor body');
    await first.focus(); await first.press('Control+f');
    const query = tools.getByRole('textbox', { name: 'Find in article', exact: true });
    await query.fill('moon'); await settle(page);
    assert.equal((await first.locator('.text-search-match').allTextContents()).join('').toLowerCase(), 'moonmoonmoon');
    assert.deepEqual(await article(page), firstBefore);
  } finally { await browser.close(); }
});

test('oversized replacement preserves live and saved text and permits a corrected replacement', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page, origin);
    const body = bodyFor(page.locator('.text-window')), tools = page.locator('.text-tools-window');
    const text = 'x '.repeat(110).trim();
    await body.fill(text); await settle(page);
    const before = await article(page);
    await body.press('Control+f');
    await tools.getByRole('textbox', { name: 'Find in article', exact: true }).fill('x');
    const replacement = tools.getByRole('textbox', { name: 'Replace with', exact: true });
    await replacement.fill('y'.repeat(2000));
    await tools.getByRole('button', { name: 'Replace all', exact: true }).click(); await settle(page);
    assert.equal(await body.innerText(), text, 'rejected oversized edit leaves live document intact');
    assert.match(await tools.getByRole('alert').innerText(), /192 KiB/);
    assert.deepEqual(await article(page), before, 'rejected oversized edit leaves saved document intact');
    await replacement.fill('word');
    await tools.getByRole('button', { name: 'Replace all', exact: true }).click(); await settle(page);
    assert.equal(await body.innerText(), 'word '.repeat(110).trim());
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.deepEqual(await article(page), before);
    const numerous = 'x '.repeat(1001).trim();
    await body.fill(numerous); await settle(page);
    const beforeBounded = await article(page);
    await body.press('Control+f');
    await tools.getByRole('textbox', { name: 'Find in article', exact: true }).fill('x');
    await replacement.fill('z');
    await tools.getByRole('button', { name: 'Replace all', exact: true }).click(); await settle(page);
    assert.match(await tools.getByRole('alert').innerText(), /1,000 matches/);
    assert.equal(await body.innerText(), numerous, 'match limit never applies a partial replacement');
    assert.deepEqual(await article(page), beforeBounded);
    await tools.getByRole('button', { name: 'Replace match', exact: true }).click(); await settle(page);
    assert.equal(await body.innerText(), `z ${'x '.repeat(1000).trim()}`, 'single replacement remains available');
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.deepEqual(await article(page), beforeBounded, 'rejected edit creates no extra undo step');
  } finally { await browser.close(); }
});
