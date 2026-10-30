import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function exposeText(page) {
  const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  if (await collapse.count()) await collapse.click();
  const info = page.getByRole('button', { name: 'Close Info', exact: true });
  if (await info.count()) { await info.focus(); await info.press('Enter'); }
  const saved = await page.evaluate(() => window.savedDraft());
  await page.locator('main.system-workflow').focus();
  const x = page.viewportSize().width / 2;
  await page.mouse.move(x, 780); await page.keyboard.down('Space'); await page.mouse.down();
  await page.mouse.move(x + 300, 880, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
  assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'camera setup preserves the authored Text frame');
}

for (const width of [1440, 700]) test(`Rejected Library drop onto Read mode Text does not report an error in Display at ${width}px`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await mountTextToolsFixture(page, origin);
    await exposeText(page);
    await page.getByRole('button', { name: 'Read', exact: true }).click();
    const before = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('region', { name: 'Library workspace' }).waitFor();
    const resizeLibrary = page.getByRole('button', { name: 'Resize Library', exact: true });
    if (await resizeLibrary.count()) await resizeLibrary.press('Home');
    const card = page.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
    const source = await card.boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + 35); await page.mouse.down();
    const drop = await page.locator('.text-module-scroll').first().evaluate(node => {
      const rect = node.getBoundingClientRect();
      for (const yRatio of [.1,.25,.5,.75,.9]) for (const xRatio of [.1,.25,.5,.75,.9]) {
        const x=rect.x+rect.width*xRatio,y=rect.y+rect.height*yRatio;
        if (node.contains(document.elementFromPoint(x,y))) return {x,y};
      }
      return {x:rect.x+80,y:rect.y+80};
    });
    await page.screenshot({ path: `.browser-test-runtime/library-read-target-${width}.png` });
    assert.equal(await page.locator('.text-module-scroll').first().evaluate((node,p)=>node.contains(document.elementFromPoint(p.x,p.y)),drop),true,'drop lands on the Read-mode Text');
    await page.mouse.move(drop.x, drop.y, { steps: 12 }); await page.mouse.up();
    await page.getByRole('region', { name: 'Library workspace' }).getByText('This module cannot accept artwork here.', { exact: true }).waitFor();
    assert.equal(await page.locator('.system-workflow__drop-feedback[data-visible]').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), before);
    await page.screenshot({ path: `.browser-test-runtime/library-scoped-drop-feedback-${width}.png` });
  } finally { await browser.close(); }
});

for (const zoom of [1, .75]) test(`Library inserts at the drop point without replacing selected text at ${zoom * 100}%`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await exposeText(page);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true }), tools = page.locator('.text-tools-window');
    const lines = Array.from({ length: 18 }, (_, index) => `Paragraph ${index + 1}. Keep this written passage intact.`);
    await body.fill(lines[0]);
    for (const line of lines.slice(1)) { await body.press('End'); await body.press('Enter'); await page.keyboard.insertText(line); }
    await body.locator('p').first().evaluate(node => {
      const range = document.createRange(); range.setStart(node.firstChild, 0); range.setEnd(node.firstChild, 9);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }); await settle(page);
    await tools.getByRole('button', { name: 'Link', exact: true }).click();
    await tools.getByLabel('Link URL', { exact: true }).fill('https://example.com/article');
    await tools.getByRole('button', { name: 'Apply link', exact: true }).click();
    assert.equal(await body.locator('a').innerText(), 'Paragraph');
    assert.equal(await body.locator('a').getAttribute('href'), 'https://example.com/article');
    assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.content.content[0].content[0].marks[0].attrs.href), 'https://example.com/article');
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await setWorkbenchZoom(page, zoom);
    await body.focus(); await body.press('Control+A');
    const before = await page.evaluate(() => window.savedDraft().texts[0].article.content);
    await page.locator('.text-module-scroll').first().evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Resize Library', exact: true }).press('Home');
    const card = page.getByRole('region', { name: 'Library workspace' }).getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
    await card.scrollIntoViewIfNeeded();
    const source = await card.boundingBox(), target = await body.locator('p').last().boundingBox();
    const drop = { x: target.x + target.width - 12, y: target.y + 2 };
    assert.equal(await body.locator('p').last().evaluate((node,p)=>node.contains(document.elementFromPoint(p.x,p.y)),drop),true,'the final paragraph is exposed beside Library');
    await page.mouse.move(source.x + source.width / 2, source.y + 35); await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 12 }); await page.mouse.up();
    await body.locator('figure').waitFor().catch(async error => {
      await page.screenshot({ path: `.browser-test-runtime/text-library-failed-${zoom}.png` });
      console.log({ source, target, errors, hit: await page.evaluate(({ x, y }) => document.elementFromPoint(x + 2, y + 2)?.outerHTML.slice(0, 300), target) });
      throw error;
    });
    await settle(page);
    const after = await page.evaluate(() => window.savedDraft().texts[0].article.content);
    assert.equal(await page.locator('.text-save-error').count(), 0);
    const text = node => (node.text || '') + (node.content || []).map(text).join('');
    assert.equal(text(after), text(before), 'a Library drop preserves all selected writing');
    assert.ok(after.content.findIndex(node => node.type === 'artwork') >= 16, 'inserts near the final paragraph, not at the old selection');
    assert.deepEqual(after.content[0], before.content[0], 'the link and first paragraph remain intact');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await body.focus(); await body.press('Control+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), before, 'one undo removes only the artwork insertion');
    await body.press('Control+Shift+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article.content), after);
    await page.screenshot({ path: `.browser-test-runtime/text-library-insertion-${zoom}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
