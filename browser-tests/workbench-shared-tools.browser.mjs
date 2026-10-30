import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { separateLayers } from './fixtures/shared-tools.mjs';
import { settlePlaywrightAnimationFrames } from './playwright-browser-adapter.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/workbench-shared-tools';
const saved = page => page.evaluate(() => window.savedDraft());
const rows = page => page.locator('.workbench-layer-row').evaluateAll(nodes => nodes.map(node => node.dataset.layerId));
const undo = async page => { await page.locator('.system-workflow').focus(); await page.keyboard.press('Control+z'); };
async function fixture(page, options = {}) {
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${file}` }) });
  });
  await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html`);
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  await page.evaluate(async options => {
    const { layersDraft } = await import('/browser-tests/fixtures/artwork-layers.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const draft = layersDraft();
    if (options.closed) draft.workbench.imageModules[0].open = false;
    if (options.outside) draft.workbench.imageModules[0].position.left = 2400;
    if (options.carbon) draft.appearance.menuSurfaceId = 'carbon';
    if (options.writing) draft.texts[0].article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Native Text deletion' }] }] };
    if (options.many) for (let i = 0; i < 18; i++) {
      const id = `shape:extra-${i}`;
      draft.shapes.push({ ...draft.shapes[0], id, name: `Landscape study ${i + 1}` });
      draft.workbench.shapes.push({ ...draft.workbench.shapes[0], id, open: false }); draft.artworkLayers.push(id);
    }
    if (options.grouped) draft.artworkLayers = ['shape:landscape', 'text:mist', { id: 'composition:person', name: 'Person', children: ['image:body', 'image:eyes'] }];
    window.leaveEditor(); localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile), JSON.stringify(draft));
  }, options);
  await page.reload();
  await page.getByRole('button', { name: options.grouped ? 'Select Person' : 'Select Eyes', exact: true }).waitFor();
  await page.locator('[data-workbench-artwork]').first().waitFor();
  await separateLayers(page);
}

test('shared Transform and Color follow selection, save one gesture, cancel, undo and exclude Image', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { carbon: true, writing: true }); await mkdir(output, { recursive: true });
    const panel = page.getByRole('region', { name: 'Transform and Color', exact: true });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    assert.equal(await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).inputValue(), '540');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).fill('480');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).press('Enter');
    assert.equal((await saved(page)).workbench.shapes[0].window.width, 480);
    await undo(page);
    await page.waitForFunction(() => document.querySelector('[aria-label="Transform Width"]')?.value === '540');
    await panel.getByRole('tab', { name: 'Color', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#336699');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).shapes[0].color, '#336699');
    const beforeDrag = await saved(page);
    const wheel = await panel.locator('.ds-studio-colour-wheel').boundingBox();
    await page.mouse.move(wheel.x + wheel.width / 2, wheel.y + 7); await page.mouse.down();
    await page.mouse.move(wheel.x + wheel.width - 7, wheel.y + wheel.height / 2, { steps: 8 });
    assert.deepEqual(await saved(page), beforeDrag, 'live preview does not save intermediate colors');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await saved(page), beforeDrag);
    await page.mouse.move(wheel.x + wheel.width / 2, wheel.y + 7); await page.mouse.down();
    await page.mouse.move(wheel.x + wheel.width - 7, wheel.y + wheel.height / 2, { steps: 8 }); await page.mouse.up();
    assert.notEqual((await saved(page)).shapes[0].color, '#336699');
    await undo(page); assert.equal((await saved(page)).shapes[0].color, '#336699');
    await page.screenshot({ path: `${output}/color-carbon.png` });
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    assert.equal(await panel.getByRole('tab', { name: 'Color', exact: true }).getAttribute('aria-selected'), 'true');
    await panel.getByText('Images have no color settings.', { exact: true }).waitFor();
    assert.equal(await panel.locator('input').count(), 0);
    await panel.getByRole('tab', { name: 'Transform', exact: true }).click();
    await panel.getByRole('spinbutton', { name: 'Transform X', exact: true }).fill('401');
    await panel.getByRole('spinbutton', { name: 'Transform X', exact: true }).press('Enter');
    assert.equal((await saved(page)).workbench.imageModules.find(item => item.id === 'image:eyes').position.left, 401);
    await page.screenshot({ path: `${output}/transform-carbon.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Text Color preserves words, caret, mixed marks and typing history; document targets stay explicit', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { writing: true }); await mkdir(output, { recursive: true });
    const panel = page.getByRole('region', { name: 'Transform and Color', exact: true });
    // The fixture's Eyes layer covers the text caret; hide it through the UI
    // so returning to the article exercises a real pointer interaction.
    await page.getByRole('button', { name: 'Hide Eyes in editor', exact: true }).click();
    await page.getByRole('button', { name: 'Select Mist', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    await text.focus(); await text.press('Control+End'); await text.press('!');
    await settlePlaywrightAnimationFrames(page);
    await text.press('Control+Home');
    for (let i = 0; i < 'Native '.length; i++) await text.press('Shift+ArrowRight');
    await page.waitForFunction(() => getSelection()?.toString() === 'Native ');
    assert.equal(await page.evaluate(() => window.getSelection()?.toString()), 'Native ');
    await panel.getByRole('tab', { name: 'Color', exact: true }).click();
    await panel.getByRole('combobox', { name: 'Color target', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Color target"]')?.selectedOptions[0]?.textContent === 'Selected text');
    assert.equal(await panel.getByRole('combobox', { name: 'Color target', exact: true }).inputValue(), 'body');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#ff0000');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    const colored = (await saved(page)).texts[0].article.content;
    assert.equal(colored.content[0].content[0].text, 'Native ');
    assert.equal(colored.content[0].content[0].marks[0].attrs.color, '#ff0000');
    assert.equal(colored.content[0].content[1].marks, undefined);
    await text.focus(); await text.press('Control+a');
    await panel.getByRole('tab', { name: 'Transform', exact: true }).click();
    await panel.getByRole('tab', { name: 'Color', exact: true }).click();
    await panel.getByText('Mixed colors', { exact: true }).waitFor();
    const beforeDrag = (await saved(page)).texts[0].article;
    const wheel = await panel.locator('.ds-studio-colour-wheel').boundingBox();
    await page.mouse.move(wheel.x + wheel.width / 2, wheel.y + 7); await page.mouse.down();
    await page.mouse.move(wheel.x + wheel.width - 7, wheel.y + wheel.height / 2, { steps: 8 });
    assert.deepEqual((await saved(page)).texts[0].article, beforeDrag);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual((await saved(page)).texts[0].article, beforeDrag);
    await text.focus(); await text.press('Control+z');
    assert.equal((await saved(page)).texts[0].article.content.content[0].content.some(item => item.marks?.some(mark => mark.attrs?.color)), false, 'one native Undo restores the original mixed range');
    await text.press('Control+z'); assert.equal(await text.innerText(), 'Native Text deletion', 'preview restoration preserves earlier typing history');
    await settlePlaywrightAnimationFrames(page);
    await text.press('Control+End');
    await page.waitForFunction(() => {
      const selection = getSelection(), editor = document.querySelector('[aria-label="Article text"]');
      return editor?.contains(selection?.anchorNode) && selection.isCollapsed
        && selection.anchorOffset === 'Native Text deletion'.length;
    });
    await page.waitForFunction(() => document.querySelector('[aria-label="Color target"]')?.selectedOptions[0]?.textContent === 'Text at cursor');
    const caret = await text.evaluate(() => getSelection().getRangeAt(0).getBoundingClientRect().toJSON());
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#336699');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    // Resume at the same visible caret as a user would. Locator.press on an
    // unfocused contenteditable resets selection before sending the key.
    await page.mouse.click(caret.right + 1, caret.top + caret.height / 2);
    await page.keyboard.press('!');
    const last = (await saved(page)).texts[0].article.content.content[0].content.at(-1);
    assert.equal(last.text, '!'); assert.equal(last.marks[0].attrs.color, '#336699');
    await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('title');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#224466');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).texts[0].article.appearance.titleColor, '#224466');
    const beforeReset = (await saved(page)).texts[0].article;
    const reset = panel.getByRole('button', { name: 'Use default text color', exact: true });
    assert.match(await reset.getAttribute('title'), /article’s default text color/);
    await reset.click();
    const afterReset = (await saved(page)).texts[0].article;
    assert.equal(afterReset.appearance.titleColor, undefined);
    assert.deepEqual(afterReset.content, beforeReset.content, 'title reset preserves selected-text colours');
    await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('background');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#c0c0c0');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).texts[0].article.appearance.background, '#c0c0c0');
    await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('h1');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#669933');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).texts[0].article.appearance.textStyles.h1.color, '#669933');
    await page.screenshot({ path: `${output}/color-text-mist.png` });
    await page.setViewportSize({ width: 760, height: 540 });
    await panel.getByRole('combobox', { name: 'Color target', exact: true }).selectOption('body');
    const box = await panel.boundingBox(); assert.ok(box.x >= 8 && box.x + box.width <= 752 && box.y + box.height <= 492);
    assert.equal(await panel.locator('.workbench-tools-body').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.screenshot({ path: `${output}/color-text-narrow.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('tool recovery, retarget cancellation, storage failure and geometry at camera zoom', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { closed: true });
    let panel = page.getByRole('region', { name: 'Transform and Color', exact: true });
    await page.getByRole('button', { name: 'Select Body', exact: true }).click();
    await panel.getByRole('button', { name: 'Open artwork', exact: true }).click();
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).waitFor();
    await panel.getByRole('button', { name: 'Close Transform', exact: true }).click();
    await page.keyboard.press('Control+k');
    await page.getByRole('button', { name: 'Transform', exact: true }).click();
    await panel.waitFor();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await panel.getByRole('tab', { name: 'Color', exact: true }).click();
    const original = await saved(page), wheel = await panel.locator('.ds-studio-colour-wheel').boundingBox();
    await page.mouse.move(wheel.x + wheel.width / 2, wheel.y + 7); await page.mouse.down();
    await page.mouse.move(wheel.x + wheel.width - 7, wheel.y + wheel.height / 2, { steps: 8 });
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).focus();
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).press('Enter'); await page.mouse.up();
    assert.deepEqual((await saved(page)).shapes, original.shapes, 'retargeting cancels the originating preview');
    await panel.getByText('Images have no color settings.', { exact: true }).waitFor();
    await panel.getByRole('tab', { name: 'Transform', exact: true }).click();
    await page.evaluate(() => { window.normalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw Error('full'); return window.normalSetItem.call(this, key, value);
    }; });
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).fill('310');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).press('Enter');
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').width, 260);
    await panel.getByRole('alert').first().waitFor();
    await page.evaluate(() => { Storage.prototype.setItem = window.normalSetItem; });
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).fill('310');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).press('Enter');
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').width, 310);
    const imageActions = page.getByRole('navigation', { name: 'Image actions', exact: true });
    for (const action of ['Rotate', 'Mirror horizontal', 'Mirror vertical']) {
      assert.equal(await panel.getByRole('button', { name: action, exact: true }).count(), 0);
      await imageActions.getByRole('button', { name: action, exact: true }).click();
    }
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').sides[0].transform.quarterTurns, 1);
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').sides[0].transform.mirrorX, true);
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').sides[0].transform.mirrorY, true);
    await page.locator('.system-workflow').focus(); await page.keyboard.press('Control+-');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).fill('320');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).press('Enter');
    await panel.getByRole('spinbutton', { name: 'Transform Y', exact: true }).fill('345.25');
    await panel.getByRole('spinbutton', { name: 'Transform Y', exact: true }).press('Enter');
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').width, 320);
    assert.equal((await saved(page)).workbench.imageModules.find(item => item.id === 'image:eyes').position.top, 345.25);
    await page.reload(); await separateLayers(page);
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    assert.equal(await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).inputValue(), '320');
    assert.equal(await panel.getByRole('spinbutton', { name: 'Transform Y', exact: true }).inputValue(), '345.25');
    await page.setViewportSize({ width: 760, height: 620 });
    for (const action of ['Rotate', 'Mirror horizontal', 'Mirror vertical', 'Crop']) {
      const button = imageActions.getByRole('button', { name: action, exact: true });
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 760 && box.y >= 0 && box.y + box.height <= 620,
        `${action} stays reachable in the narrow Image toolbar`);
    }
    await page.screenshot({ path: `${output}/image-toolbar-narrow.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
