import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const width of [1440, 390]) test(`writing, clipboard and artwork editing at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
    page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    const tools = page.locator('.text-tools-window');
    await body.fill('Keep my writing'); await body.press('Control+A');
    const paste = data => body.evaluate((node, data) => {
      const clipboardData = new DataTransfer(); for (const [type, value] of Object.entries(data)) clipboardData.setData(type, value);
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, data);
    await paste({ 'text/html': '<img src="https://example.invalid/image.png">' });
    assert.equal(await body.innerText(), 'Keep my writing');
    await paste({ 'text/plain': 'First\rSecond\r\n\nLast', 'text/html': '<b>unwanted HTML</b>' }); await settle(page);
    assert.deepEqual(await body.locator('p').allTextContents(), ['First', 'Second', '', 'Last']);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await body.innerText(), 'Keep my writing');
    await tools.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.deepEqual(await body.locator('p').allTextContents(), ['First', 'Second', '', 'Last']);
    await body.focus(); await body.press('Control+End'); await body.press('Enter');
    await body.press('Control+B'); await page.keyboard.type('New bold sentence'); await body.press('Control+B');
    assert.equal(await body.locator('strong').last().innerText(), 'New bold sentence');
    await page.evaluate(async () => {
      const draft = window.savedDraft();
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      draft.texts[0].article.content.content = [
        { type: 'paragraph', content: [{ type: 'text', text: 'Before the artwork' }] },
        { type: 'artwork', attrs: { asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), alt: 'Original alternative text', caption: 'Original caption' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'After the artwork' }] },
      ];
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
    });
    await mountTextToolsFixture(page, origin);
    if (width === 1440) {
      const original = await page.evaluate(() => window.savedDraft().texts[0].article.content);
      await body.locator('.text-artwork-editor img').dragTo(body.locator('p').first(), { targetPosition: { x: 1, y: 1 } }); await settle(page);
      assert.equal((await page.evaluate(() => window.savedDraft().texts[0].article.content.content))[0].type, 'artwork');
      await tools.getByRole('button', { name: 'Undo', exact: true }).click();
      const restored = await page.evaluate(() => window.savedDraft().texts[0].article.content);
      assert.deepEqual(restored.content.map(node => node.type), original.content.map(node => node.type));
      assert.deepEqual(restored.content[1], original.content[1]);
      assert.deepEqual(restored.content.filter(node => node.type === 'paragraph').map(node => node.content), original.content.filter(node => node.type === 'paragraph').map(node => node.content));
    }
    // Keyboard selects the atomic artwork without having to hit a small image.
    await body.focus(); await body.press('Control+Home'); await body.press('End'); await body.press('ArrowDown');
    await body.locator('.text-artwork-editor').evaluate(node => node.scrollIntoView({ block: 'center' }));
    // On narrow screens the inspector covers the article; native editor selection
    // can still be set by a keyboard move from the preceding paragraph.
    if (!await tools.getByRole('region', { name: 'Selected artwork' }).count()) {
      await body.locator('p').first().evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node); range.collapse(false);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      }); await body.press('ArrowRight');
    }
    await tools.getByLabel('Caption', { exact: true }).fill('Authored caption');
    await tools.getByLabel('Alternative text', { exact: true }).fill('Authored description');
    const before = await page.evaluate(() => window.savedDraft().texts[0].article.content);
    await tools.getByRole('button', { name: 'Move artwork up', exact: true }).click(); await settle(page);
    const moved = await page.evaluate(() => window.savedDraft().texts[0].article.content);
    assert.deepEqual(moved.content, [before.content[1], before.content[0], before.content[2]]);
    assert.equal(await tools.getByRole('button', { name: 'Move artwork up', exact: true }).isDisabled(), true);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), before);
    await tools.getByRole('button', { name: 'Move artwork down', exact: true }).click(); await settle(page);
    assert.equal((await page.evaluate(() => window.savedDraft().texts[0].article.content.content))[2].type, 'artwork');
    await page.screenshot({ path: `.browser-test-runtime/text-writing-artwork-${width}.png` });
    await tools.getByRole('button', { name: 'Remove artwork', exact: true }).click();
    assert.equal(await body.locator('figure').count(), 0);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await body.locator('figcaption').innerText(), 'Authored caption');
    await mountTextToolsFixture(page, origin, { visitor: true });
    assert.equal(await page.locator('.text-window figcaption').innerText(), 'Authored caption');
    assert.equal(await page.locator('.text-window img').getAttribute('alt'), 'Authored description');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
