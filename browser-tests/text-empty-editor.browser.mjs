import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const saved = page => page.evaluate(() => window.savedDraft());

for (const width of [1600, 390]) test(`empty writing area is discoverable without authoring placeholder content at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mkdir('.browser-test-runtime', { recursive: true });
    await mountTextToolsFixture(page, origin);
    for (const background of ['#000000', '#ffffff', null]) {
      await page.evaluate(async ({ background, width }) => {
        const draft = window.savedDraft(), article = draft.texts[0].article;
        article.title = '';
        article.content = { type: 'doc', content: [{ type: 'paragraph' }] };
        article.appearance = { ...article.appearance, background, color: background === '#ffffff' ? '#111111' : '#ffffff' };
        draft.workbench.texts[0].window = { left: 24, top: 120, width: width === 390 ? 342 : 1100, height: 740 };
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
      }, { background, width });
      await mountTextToolsFixture(page, origin);
      const write = page.getByRole('button', { name: 'Write', exact: true });
      if (await write.count()) { await write.focus(); await page.keyboard.press('Enter'); }
      const close = page.getByRole('button', { name: 'Close Text tools', exact: true });
      if (await close.isVisible()) await close.click();
      const win = page.locator('.text-window'), body = win.getByRole('textbox', { name: 'Article text', exact: true });
      const hint = win.getByText('Start writing…', { exact: true });
      await page.locator('main.system-workflow').focus(); await settle(page);
      const before = await saved(page);
      assert.equal(await hint.isVisible(), true, 'an unfocused empty article identifies the writing area');
      assert.equal(await body.evaluate(node => node.contains(document.activeElement)), false);
      const geometry = await body.boundingBox();
      assert.ok(geometry.height >= 64 && geometry.x >= 0 && geometry.x + geometry.width <= width, 'the whole empty writing target fits the viewport');
      assert.equal(await win.getByRole('region', { name: 'Article content', exact: true }).evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'the writing viewport has no horizontal overflow');
      const labelContrast = await hint.evaluate(node => {
        const luminance = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const style = getComputedStyle(node), ink = luminance(style.color), panel = luminance(style.backgroundColor);
        return (Math.max(ink, panel) + .05) / (Math.min(ink, panel) + .05);
      });
      assert.ok(labelContrast >= 4.5, `the writing hint is readable on every authored background: ${labelContrast}`);
      await page.screenshot({ path: `.browser-test-runtime/text-empty-${width}-${background?.slice(1) || 'transparent'}.png` });
      assert.deepEqual(await saved(page), before, 'showing the guide never saves article changes');
      await body.click({ position: { x: 30, y: 12 } });
      assert.equal(await body.evaluate(node => node === document.activeElement), true, 'clicking the hint reaches the real editor');
      assert.equal(await hint.isVisible(), false, 'the hint clears the caret while writing');
      await page.screenshot({ path: `.browser-test-runtime/text-empty-focused-${width}-${background?.slice(1) || 'transparent'}.png` });
      await page.keyboard.type('My own text'); await settle(page);
      assert.equal(await hint.count(), 0);
      assert.equal((await saved(page)).texts[0].article.content.content[0].content[0].text, 'My own text');
      assert.deepEqual((await saved(page)).texts[0].article.appearance, before.texts[0].article.appearance);
      await body.press('Control+z'); await page.locator('main.system-workflow').focus(); await settle(page);
      assert.equal(await hint.isVisible(), true, 'undoing the text restores the empty writing guide');
      assert.doesNotMatch(JSON.stringify((await saved(page)).texts[0].article), /Start writing/);
      await win.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
      assert.equal(await hint.isVisible(), false, 'Read never shows editor guides');
      await mountTextToolsFixture(page, origin, { visitor: true });
      assert.equal(await page.getByText('Start writing…', { exact: true }).count(), 0, 'public presentation contains no editing hint');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('empty Display text and Focus writing share the same temporary writing guide', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    await mountTextToolsFixture(page, origin, { displayTextCount: 1 });
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const target = page.getByRole('button', { name: 'Select Display article 1', exact: true });
    await target.focus(); await page.keyboard.press('Enter');
    const body = target.getByRole('textbox', { name: 'Article text', exact: true }); await body.waitFor();
    await page.locator('main.system-workflow').focus();
    assert.equal(await target.getByText('Start writing…', { exact: true }).isVisible(), true);
    const before = await saved(page);
    await page.locator('.text-tools-window').getByRole('button', { name: 'Focus writing', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).focus();
    assert.equal(await dialog.getByText('Start writing…', { exact: true }).isVisible(), true);
    assert.deepEqual(await saved(page), before);
    await dialog.getByRole('textbox', { name: 'Article text', exact: true }).fill('A Display story');
    assert.equal(await dialog.getByText('Start writing…', { exact: true }).count(), 0);
    await dialog.getByRole('button', { name: 'Return to composition', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await body.innerText(), 'A Display story');
    assert.deepEqual((await saved(page)).workbench, before.workbench);
    assert.deepEqual((await saved(page)).texts, before.texts);
  } finally { await browser.close(); }
});
