import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const width of [1440, 390]) test(`line spacing and long illustrated text remain editable and reachable at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.evaluate(async () => {
      const draft = window.savedDraft(), article = draft.texts[0].article;
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      article.title = 'An illustrated field journal';
      article.content.content = [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Looking a little longer' }] },
        ...Array.from({ length: 18 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Paragraph ${i + 1}. The space between these shapes is part of the composition. We watch the light change, collect the details, and return to them in the next drawing.` }] })),
      ];
      article.content.content.splice(4, 0, { type: 'artwork', attrs: { asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), alt: 'Illustrated study', caption: 'Field study — light and form.' } });
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
    });
    await mountTextToolsFixture(page, origin);
    const tools = page.locator('.text-tools-window'), win = page.locator('.text-window');
    const body = win.getByRole('textbox', { name: 'Article text', exact: true });
    const scope = name => tools.getByRole('group', { name: 'Formatting target' }).getByRole('button', { name, exact: true });
    const setNumber = async (name, value) => { const field = tools.getByRole('spinbutton', { name, exact: true }); await field.fill(String(value)); await field.press('Enter'); await settle(page); };
    const line = node => node.evaluate(n => getComputedStyle(n).lineHeight);
    await scope('Document').click(); await setNumber('Document line spacing', 2);
    assert.equal(await line(body.locator('p').first()), '32px');
    const titleLineHeight = await line(win.getByLabel('Article title', { exact: true }));
    await setNumber('Document line spacing', 2.1);
    assert.equal(await line(win.getByLabel('Article title', { exact: true })), titleLineHeight, 'body spacing leaves title leading alone');
    await setNumber('Document line spacing', 2);
    await scope('Selection').click();
    await tools.locator('.text-inspector-advanced summary').click();
    await body.focus(); await body.locator('p').first().evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }); await settle(page);
    await setNumber('Paragraph line spacing', 1.25);
    assert.equal(await line(body.locator('p').first()), '20px');
    assert.equal(await line(body.locator('p').nth(1)), '32px');
    const field = tools.getByRole('spinbutton', { name: 'Paragraph line spacing', exact: true });
    await field.fill('2.8'); await field.press('Escape'); await body.focus();
    assert.equal(await line(body.locator('p').first()), '20px');
    await setNumber('Paragraph line spacing', 4);
    assert.equal(await line(body.locator('p').first()), '20px', 'invalid values never author');
    await body.press('Control+A'); await settle(page);
    assert.equal(await field.getAttribute('placeholder'), 'Mixed');
    await setNumber('Paragraph line spacing', 1.8);
    assert.equal(await body.locator('p').evaluateAll(nodes => nodes.every(n => n.style.lineHeight === '1.8')), true);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await line(body.locator('p').first()), '20px');
    assert.equal(await line(body.locator('p').nth(1)), '32px');
    await tools.getByRole('button', { name: 'Use inherited paragraph line spacing', exact: true }).click();
    assert.equal(await line(body.locator('p').first()), '32px');
    await scope('Document').click(); await tools.getByRole('button', { name: 'Use default document line spacing', exact: true }).click();
    assert.equal(await line(body.locator('p').first()), '26.4px');
    await setNumber('Document line spacing', 1.9);
    const savedArticle = await page.evaluate(() => window.savedDraft().texts[0].article);
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const readable = async () => {
      const scroll = win.locator('.text-authoring-viewport:not([hidden]) .text-module-scroll, .text-module-scroll').filter({ visible: true }).first();
      await scroll.evaluate(n => { n.scrollTop = n.scrollHeight; }); await settle(page);
      assert.equal(await scroll.evaluate(n => n.scrollHeight > n.clientHeight && Math.abs(n.scrollHeight - n.scrollTop - n.clientHeight) < 2), true);
      assert.equal(await scroll.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true, 'article fits its width');
    };
    await readable();
    // Resizing must reflow real content without rewriting it or losing the end.
    await win.locator('.is-e').focus(); await page.keyboard.press('Alt+ArrowLeft'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article), savedArticle);
    await readable();
    await win.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
    await readable();
    assert.equal(await line(win.locator('article p').first()), '30.4px');
    await page.screenshot({ path: `.browser-test-runtime/text-long-article-${width}.png` });
    await mountTextToolsFixture(page, origin);
    assert.equal(await line(page.locator('.text-window article p').first()), '30.4px');
    assert.equal(await page.locator('.text-window article figcaption').innerText(), 'Field study — light and form.');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
