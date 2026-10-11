import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const saved = page => page.evaluate(() => window.savedDraft());
const bodyIn = owner => owner.getByRole('textbox', { name: 'Article text', exact: true });
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const focusedTitle = 'Writing in a quieter room — illustrated field notes about the changing light, the shapes we remember, and the stories hidden between them';

async function seedLongArticle(page) {
  await mountTextToolsFixture(page, origin);
  await page.evaluate(async () => {
    const draft = window.savedDraft();
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    draft.texts[0].article.content.content = Array.from({ length: 20 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `Field note ${index + 1}. An illustrated article needs enough room to write, read and refine the words beside its artwork. The story continues beyond the first screen.` }] }));
    draft.texts[0].article.content.content.splice(4, 0, { type: 'artwork', attrs: { asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), alt: 'Field study', caption: 'A preserved illustrated study' } });
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  });
  await mountTextToolsFixture(page, origin);
}

for (const width of [1440, 390]) test(`focused writing preserves editor identity, history, article and geometry at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, reducedMotion: 'reduce' }); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seedLongArticle(page);
    if (width === 1440) await setWorkbenchZoom(page, .75);
    const win = page.locator('.text-window'), tools = page.locator('.text-tools-window');
    const before = await saved(page), originalBody = await bodyIn(win).elementHandle();
    const originalText = await originalBody.innerText();
    await bodyIn(win).focus(); await bodyIn(win).press('Control+End');
    await tools.getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.evaluate(node => node.matches(':modal')), true, 'native dialog isolates background interaction');
    const bounds = await dialog.boundingBox();
    assert.ok(Math.abs(bounds.width - width) < 1 && Math.abs(bounds.height - 1000) < 1, `focus surface escapes Workbench zoom: ${JSON.stringify(bounds)}`);
    const body = bodyIn(dialog);
    const caretVisible = await body.evaluate(node => {
      const selection = getSelection();
      if (!selection?.rangeCount) return false;
      const caret = selection.getRangeAt(0).getBoundingClientRect();
      const viewport = node.closest('.text-focus-scroll').getBoundingClientRect();
      return caret.top >= viewport.top && caret.bottom <= viewport.bottom;
    });
    assert.equal(caretVisible, true, 'opening focus writing reveals the existing end-of-article caret');
    assert.equal(await body.evaluate((node, previous) => node === previous, originalBody), true, 'the existing editor moves without remounting');
    assert.equal(await page.getByRole('textbox', { name: 'Article text', exact: true }).count(), 1);
    assert.deepEqual(await saved(page), before, 'entering focus mode does not author content or geometry');
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(node => node.contains(document.activeElement) || document.activeElement === document.body), true, 'native dialog prevents Tab from reaching background controls');
    }
    const title = dialog.getByRole('textbox', { name: 'Article title', exact: true });
    await title.fill(focusedTitle);
    assert.equal(await title.evaluate(node => node.scrollHeight <= node.clientHeight + 1), true, 'long title wraps without hidden lines');
    await title.press('Enter');
    assert.equal(await body.evaluate(node => node === document.activeElement), true);
    await body.press('Control+End'); await page.keyboard.type(' Added in focus mode.'); await settle(page);
    assert.equal((await saved(page)).texts[0].article.title, focusedTitle);
    assert.match(await body.innerText(), /Added in focus mode\.$/);
    assert.deepEqual((await saved(page)).workbench, before.workbench);
    const scroll = dialog.locator('.text-focus-scroll');
    await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; }); await settle(page);
    assert.equal(await scroll.evaluate(node => node.scrollHeight > node.clientHeight && Math.abs(node.scrollHeight - node.scrollTop - node.clientHeight) < 2), true, 'long article reaches its end');
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'focus surface stays within viewport width');
    assert.equal(await scroll.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'article has no horizontal overflow');
    await scroll.evaluate(node => { node.scrollTop = 0; }); await settle(page);
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: `.browser-test-runtime/text-focus-writing-${width}.png` });
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).click();
    await dialog.waitFor({ state: 'detached' }); await settle(page);
    assert.equal(await bodyIn(win).evaluate((node, previous) => node === previous, originalBody), true);
    assert.equal(await tools.getByRole('button', { name: 'Focus writing', exact: true }).evaluate(node => node === document.activeElement), true, 'return restores trigger focus');
    await tools.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
    assert.equal(await bodyIn(win).innerText(), originalText, 'history survives focus mode exit');
    assert.equal((await saved(page)).texts[0].article.title, focusedTitle, 'body undo does not erase separate title edit');
    assert.deepEqual((await saved(page)).workbench, before.workbench);
    assert.deepEqual((await saved(page)).texts[0].article.content.content.find(node => node.type === 'artwork'), before.texts[0].article.content.content.find(node => node.type === 'artwork'));
    await tools.getByRole('button', { name: 'Focus writing', exact: true }).click();
    await bodyIn(dialog).focus(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await tools.getByRole('button', { name: 'Focus writing', exact: true }).evaluate(node => node === document.activeElement), true);
    await tools.getByRole('button', { name: 'Focus writing', exact: true }).click();
    await bodyIn(dialog).focus(); await page.keyboard.press('Control+f'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await tools.getByRole('textbox', { name: 'Find in article', exact: true }).evaluate(node => node === document.activeElement), true, 'find returns to the usable shared inspector');
    await tools.getByRole('button', { name: 'Close search', exact: true }).click();
    await win.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.getByRole('button', { name: 'Focus writing', exact: true }).count(), 0, 'Read does not expose writing mode');
    await mountTextToolsFixture(page, origin, { visitor: true });
    assert.equal(await page.getByRole('button', { name: 'Focus writing', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('transparent light text retains readable focus background without changing authored appearance', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page, origin);
    await page.evaluate(async () => {
      const draft = window.savedDraft();
      draft.texts[0].article.appearance.background = null;
      draft.texts[0].article.appearance.color = '#ffffff';
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
    });
    await mountTextToolsFixture(page, origin);
    const before = await saved(page);
    await page.locator('.text-tools-window').getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const ratio = await bodyIn(dialog).evaluate(node => {
      const rgb = value => value.match(/[\d.]+/g)?.map(Number) || [];
      const luminance = values => values.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      const foreground = luminance(rgb(getComputedStyle(node).color));
      let cursor = node, background;
      while (cursor) {
        const color = rgb(getComputedStyle(cursor).backgroundColor);
        if (color.length >= 3 && (color.length === 3 || color[3] > .99)) { background = luminance(color); break; }
        cursor = cursor.parentElement;
      }
      if (background === undefined) return 0;
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    assert.ok(ratio >= 4.5, `light text has a readable temporary background: ${ratio}`);
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).click(); await settle(page);
    assert.deepEqual(await saved(page), before);
  } finally { await browser.close(); }
});

test('failed local saving remains visible in focused writing and recoverable after returning', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } }); page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page, origin);
    const before = await saved(page), tools = page.locator('.text-tools-window');
    await tools.getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await page.evaluate(() => { window.failSave = true; });
    await bodyIn(dialog).fill('Unsaved focus writing must remain recoverable.'); await settle(page);
    assert.equal(await dialog.getByRole('alert').isVisible(), true, 'save failure remains visible while inspector is hidden');
    assert.deepEqual(await saved(page), before, 'failed writing never claims a successful stored change');
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    assert.equal(await bodyIn(page.locator('.text-window')).innerText(), 'Unsaved focus writing must remain recoverable.');
    await page.evaluate(() => { window.failSave = false; });
    await tools.getByRole('button', { name: 'Retry local save', exact: true }).click(); await settle(page);
    assert.equal((await saved(page)).texts[0].article.content.content[0].content[0].text, 'Unsaved focus writing must remain recoverable.');
    assert.equal(await tools.getByRole('alert').count(), 0);
    assert.deepEqual((await saved(page)).workbench, before.workbench);
  } finally { await browser.close(); }
});

test('Display text uses the same focused editor without changing placement or other articles', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page, origin, { displayTextCount: 1 });
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const target = page.getByRole('button', { name: 'Select Display article 1', exact: true });
    await target.focus(); await page.keyboard.press('Enter'); await bodyIn(target).waitFor();
    const before = await saved(page), original = await bodyIn(target).elementHandle();
    const placement = draft => draft.grids.flatMap(grid => grid.placements).find(item => item.kind === 'text');
    const geometry = item => ({ column: item.column, row: item.row, columnSpan: item.columnSpan, rowSpan: item.rowSpan, rotation: item.rotation, locked: item.locked });
    await page.locator('.text-tools-window').getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await bodyIn(dialog).evaluate((node, previous) => node === previous, original), true);
    await bodyIn(dialog).fill('Focused writing inside a Display.');
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    const after = await saved(page);
    assert.equal(placement(after).text.article.content.content[0].content[0].text, 'Focused writing inside a Display.');
    assert.deepEqual(geometry(placement(after)), geometry(placement(before)));
    assert.deepEqual(after.texts, before.texts);
    assert.deepEqual(after.workbench, before.workbench);
    assert.equal(await original.evaluate(node => node.isConnected), true, 'original Display editor remains mounted on return');
  } finally { await browser.close(); }
});
