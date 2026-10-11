import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('a delayed backup read is discarded when Text tools switch articles', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page, origin, { textCount: 2 });
    const tools = page.locator('.text-tools-window'), windows = page.locator('.text-window');
    // Focus activation is the same keyboard path used to target a second Text.
    await windows.first().getByRole('button', { name: 'Text tools', exact: true }).focus();
    if (!await tools.count()) await page.keyboard.press('Enter');
    await tools.getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Document', exact: true }).click();
    await tools.locator('.text-backup-controls summary').click();
    const before = await page.evaluate(() => window.savedDraft().texts);
    await page.evaluate(() => {
      const original = File.prototype.text;
      File.prototype.text = async function () {
        const text = await original.call(this);
        await new Promise(resolve => { window.finishBackupRead = resolve; });
        return text;
      };
    });
    await tools.getByLabel('Open article backup', { exact: true }).setInputFiles({ name: 'article.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before[0].article)) });
    await page.waitForFunction(() => Boolean(window.finishBackupRead));
    await windows.nth(1).getByRole('button', { name: 'Text tools', exact: true }).focus();
    await page.evaluate(() => window.finishBackupRead()); await settle(page);
    assert.equal(await tools.getByRole('button', { name: 'Replace article with backup', exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts), before);
    await windows.first().getByRole('button', { name: 'Text tools', exact: true }).focus(); await settle(page);
    assert.equal(await tools.getByRole('button', { name: 'Replace article with backup', exact: true }).count(), 0);
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`article styles, outline and portable recovery at ${width}px`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 }); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.evaluate(async () => {
      const draft = window.savedDraft(), article = draft.texts[0].article;
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      article.title = 'A field journal';
      const heading = text => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
      article.content.content = [heading('First study'),
        ...Array.from({ length: 20 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Paragraph ${i + 1}. Observing the light in a changing landscape. Shapes and shadows become an illustrated memory.` }] })),
        heading('Last study'), { type: 'paragraph', content: [{ type: 'text', text: 'End of the journal.' }] },
        { type: 'artwork', attrs: { asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), alt: 'Study', caption: 'A remembered landscape' } },
      ];
      article.content.content[0].content.push({ type: 'text', text: ' small', marks: [{ type: 'textStyle', attrs: { fontSize: 13 } }] });
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
    });
    await mountTextToolsFixture(page, origin);
    const tools = page.locator('.text-tools-window'), win = page.locator('.text-window');
    const body = win.getByRole('textbox', { name: 'Article text', exact: true });
    const scope = name => tools.getByRole('group', { name: 'Formatting target' }).getByRole('button', { name, exact: true });
    const number = async (name, value) => { const field = tools.getByRole('spinbutton', { name, exact: true }); await field.fill(String(value)); await field.press('Enter'); await settle(page); };
    const style = (locator, property) => locator.evaluate((node, property) => getComputedStyle(node)[property], property);
    await scope('Document').click(); await tools.locator('.text-style-controls summary').click();
    await tools.getByLabel('Article style', { exact: true }).selectOption('h2');
    await number('Style text size', 32); await number('Style line spacing', 1.5); await number('Style tracking', .02);
    await tools.getByLabel('Style font', { exact: true }).selectOption('Inscape Article Literata');
    await tools.getByLabel('Style colour', { exact: true }).fill('#aabbcc'); await settle(page);
    assert.equal(await style(body.locator('h2').last(), 'color'), 'rgb(170, 187, 204)');
    assert.ok((await style(body.locator('h2').last(), 'fontFamily')).includes('Inscape Article Literata'));
    assert.equal(await style(body.locator('h2').first(), 'fontSize'), '32px');
    assert.equal(await style(body.locator('h2').last(), 'lineHeight'), '48px');
    assert.equal(await style(body.locator('h2 span').first(), 'fontSize'), '13px', 'inline override survives role change');
    assert.equal(await style(win.getByLabel('Article title', { exact: true }), 'fontSize'), '28px');
    await tools.getByLabel('Article style', { exact: true }).selectOption('caption'); await number('Style text size', 12);
    assert.equal(await style(body.locator('figcaption'), 'fontSize'), '12px');
    await tools.getByLabel('Article style', { exact: true }).selectOption('h2');
    await tools.getByRole('button', { name: 'Use automatic style size', exact: true }).click();
    assert.equal(await style(body.locator('h2').first(), 'fontSize'), '21.6px'); await number('Style text size', 32);
    await page.screenshot({ path: `.browser-test-runtime/text-article-styles-${width}.png` });
    await scope('Selection').click(); await tools.locator('.text-article-outline summary').click();
    const outline = tools.getByRole('navigation', { name: 'Article outline', exact: true });
    const frame = await win.boundingBox();
    await outline.getByRole('button', { name: 'Last study', exact: true }).click(); await settle(page);
    assert.equal(await body.evaluate(node => node.contains(getSelection().anchorNode) && getSelection().anchorNode.parentElement.closest('h2')?.textContent === 'Last study'), true);
    assert.equal(await win.locator('.text-module-scroll').first().evaluate(node => node.scrollTop > 100), true);
    assert.deepEqual(await win.boundingBox(), frame, 'outline navigation does not move the module');
    await tools.getByLabel('Paragraph style', { exact: true }).selectOption('paragraph'); await settle(page);
    assert.equal(await outline.getByRole('button').count(), 1, 'changing heading type updates the outline');
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.equal(await outline.getByRole('button').count(), 2);
    await outline.getByRole('button', { name: 'Last study', exact: true }).click();
    await page.keyboard.type('Changed '); await settle(page);
    assert.equal(await outline.getByRole('button', { name: 'Changed Last study', exact: true }).count(), 1);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.equal(await outline.getByRole('button', { name: 'Last study', exact: true }).count(), 1);
    await page.screenshot({ path: `.browser-test-runtime/text-article-outline-${width}.png` });
    await scope('Document').click(); await tools.locator('.text-style-controls summary').click();
    await tools.locator('.text-backup-controls summary').click();
    const saved = await page.evaluate(() => window.savedDraft().texts[0]);
    const downloading = page.waitForEvent('download'); await tools.getByRole('button', { name: 'Download article backup', exact: true }).click();
    const download = await downloading, backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(backup, saved.article);
    const file = tools.getByLabel('Open article backup', { exact: true });
    await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
    await tools.getByText('Choose a valid INSCAPE article JSON backup.').waitFor();
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0]), saved);
    const restored = { ...backup, title: 'Restored field journal' };
    const upload = () => file.setInputFiles({ name: 'article.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) });
    await upload(); await tools.getByRole('button', { name: 'Cancel backup', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0]), saved);
    await upload(); await tools.getByRole('button', { name: 'Replace article with backup', exact: true }).click(); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0]), { ...saved, article: restored });
    // A pending file cannot silently replace text edited after it was opened.
    await upload(); await win.getByLabel('Article title', { exact: true }).fill('New work');
    await tools.getByRole('button', { name: 'Replace article with backup', exact: true }).click();
    await tools.getByText('The article changed. Choose the backup again before replacing it.').waitFor();
    assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.title), 'New work');
    await page.evaluate(() => { window.failSave = true; });
    await win.getByLabel('Article title', { exact: true }).fill('Unsaved but recoverable'); await settle(page);
    assert.equal(await file.isDisabled(), true);
    const failureDownload = page.waitForEvent('download'); await tools.getByRole('button', { name: 'Download article backup', exact: true }).click();
    const failedBackup = JSON.parse(await readFile(await (await failureDownload).path(), 'utf8'));
    assert.equal(failedBackup.title, 'Unsaved but recoverable');
    assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.title), 'New work');
    await page.evaluate(() => { window.failSave = false; }); await tools.getByRole('button', { name: 'Retry local save', exact: true }).click();
    assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.title), failedBackup.title);
    assert.equal(await tools.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.screenshot({ path: `.browser-test-runtime/text-article-backup-${width}.png` });
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await win.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await style(win.locator('article h2').first(), 'fontSize'), '32px');
    assert.equal(await style(win.locator('article figcaption'), 'fontSize'), '12px');
    await mountTextToolsFixture(page, origin, { visitor: true });
    assert.equal(await style(page.locator('.text-window article h2').first(), 'fontSize'), '32px');
    assert.equal(await style(page.locator('.text-window article figcaption'), 'fontSize'), '12px');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
