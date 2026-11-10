import { editorMenu } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { separateLayers, openSharedTool, sharedToolPanel, sharedToolTab, chooseSharedColorTarget, openSharedColorPicker } from './fixtures/shared-tools.mjs';
import { settlePlaywrightAnimationFrames } from './playwright-browser-adapter.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/workbench-shared-tools';
const saved = page => page.evaluate(() => window.savedDraft());
const rows = page => page.locator('.workbench-layer-row').evaluateAll(nodes => nodes.map(node => node.dataset.layerId));
const undo = async page => { await page.locator('.system-workflow').focus(); await page.keyboard.press('Control+z'); };
async function beginColourDrag(page) {
  const field = (await openSharedColorPicker(page)).getByRole('group', { name: 'Colour saturation and value', exact: true });
  await field.scrollIntoViewIfNeeded();
  const box = await field.boundingBox();
  await page.mouse.move(box.x + box.width * .25, box.y + box.height * .25); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .75, box.y + box.height * .5, { steps: 8 });
}
async function fixture(page, options = {}) {
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${file}` }) });
  });
  await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html`);
  await editorMenu(page, 'Canvas').waitFor();
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

test('Workbench pipette follows Shape/Text targets and opacity entry commits once with undo', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.drops = [];
      window.EyeDropper = class { open({ signal }) { return new Promise(resolve => window.drops.push({ signal, resolve })); } };
    });
    await fixture(page, { writing: true });
    const panel = sharedToolPanel(page);
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await openSharedTool(page, 'Color');
    let picker = (await openSharedColorPicker(page, 'Fill')).getByRole('button', { name: 'Pick color from screen', exact: true });
    const original = await saved(page);
    await picker.click();
    await page.evaluate(() => window.drops.at(-1).resolve({ sRGBHex: '#336699' }));
    await page.waitForFunction(() => window.savedDraft().shapes[0].color === '#336699');
    assert.deepEqual(await panel.locator('.ds-colour-channels input').evaluateAll(nodes => nodes.map(node => node.value)), ['210', '50', '40']);
    await undo(page); assert.deepEqual((await saved(page)).shapes, original.shapes);
    const opacity = panel.getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true });
    await opacity.fill('35');
    assert.equal((await saved(page)).shapes[0].opacity, 1, 'typing does not save before confirmation');
    const chosen = Number(await opacity.inputValue()) / 100;
    assert.ok(chosen > .2 && chosen < .5);
    await opacity.press('Enter'); assert.equal((await saved(page)).shapes[0].opacity, chosen);
    await undo(page); assert.equal((await saved(page)).shapes[0].opacity, 1, 'one undo restores opacity');
    await opacity.fill('70'); await opacity.press('Escape');
    assert.equal((await saved(page)).shapes[0].opacity, 1);
    await opacity.focus(); await opacity.press('ArrowDown'); await opacity.press('Enter');
    assert.equal((await saved(page)).shapes[0].opacity, .99);
    await undo(page); assert.equal((await saved(page)).shapes[0].opacity, 1);
    await picker.click();
    await page.getByRole('button', { name: 'Select Mist', exact: true }).click();
    assert.equal(await page.evaluate(() => window.drops.at(-1).signal.aborted), true);
    await page.evaluate(() => window.drops.at(-1).resolve({ sRGBHex: '#ff0000' }));
    assert.deepEqual((await saved(page)).shapes, original.shapes);
    picker = (await chooseSharedColorTarget(page, 'title')).getByRole('button', { name: 'Pick color from screen', exact: true });
    await picker.click(); await page.evaluate(() => window.drops.at(-1).resolve({ sRGBHex: '#336699' }));
    await page.waitForFunction(() => window.savedDraft().texts[0].article.appearance.titleColor === '#336699');
    await undo(page); assert.equal((await saved(page)).texts[0].article.appearance.titleColor, original.texts[0].article.appearance.titleColor);
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const hex = (await openSharedColorPicker(page, 'Fill')).getByRole('textbox', { name: 'Color colour', exact: true });
    await hex.fill('336699'); await hex.press('Tab');
    await mkdir(output, { recursive: true });
    await page.locator('.system-workflow').focus();
    await panel.screenshot({ path: `${output}/shared-color-layout.png` });
    await page.setViewportSize({ width: 760, height: 540 });
    assert.equal(await panel.locator('.workbench-inspector').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await panel.screenshot({ path: `${output}/shared-color-layout-narrow.png` });
  } finally { await browser.close(); }
});

test('shared Transform and Color follow selection, save one gesture, cancel, undo and switch to Image controls', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { carbon: true, writing: true }); await mkdir(output, { recursive: true });
    const panel = sharedToolPanel(page);
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await openSharedTool(page, 'Transform');
    assert.equal(await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).inputValue(), '540');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).fill('480');
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).press('Enter');
    assert.equal((await saved(page)).workbench.shapes[0].window.width, 480);
    await undo(page);
    await page.waitForFunction(() => document.querySelector('[aria-label="Transform Width"]')?.value === '540');
    await openSharedTool(page, 'Color');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#336699');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).shapes[0].color, '#336699');
    const beforeDrag = await saved(page);
    await beginColourDrag(page);
    assert.deepEqual(await saved(page), beforeDrag, 'live preview does not save intermediate colors');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await saved(page), beforeDrag);
    await beginColourDrag(page); await page.mouse.up();
    assert.notEqual((await saved(page)).shapes[0].color, '#336699');
    await undo(page); assert.equal((await saved(page)).shapes[0].color, '#336699');
    await page.screenshot({ path: `${output}/color-carbon.png` });
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    assert.equal(await sharedToolTab(page, 'Inspector').getAttribute('aria-selected'), 'true');
    await panel.getByRole('group', { name: 'Image fit', exact: true }).waitFor();
    assert.equal(await panel.getByRole('textbox', { name: 'Color colour', exact: true }).count(), 0, 'Image selection removes the previous Color controls');
    await openSharedTool(page, 'Transform');
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
    const panel = sharedToolPanel(page);
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
    await openSharedTool(page, 'Color');
    await panel.getByRole('button', { name: /^Color target:/ }).waitFor();
    await page.waitForFunction(() => document.querySelector('button[aria-label="Color target: Selected text"]'));
    assert.equal(await panel.getByRole('button', { name: /^Color target:/ }).getAttribute('aria-label'), 'Color target: Selected text');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#ff0000');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    const colored = (await saved(page)).texts[0].article.content;
    assert.equal(colored.content[0].content[0].text, 'Native ');
    assert.equal(colored.content[0].content[0].marks[0].attrs.color, '#ff0000');
    assert.equal(colored.content[0].content[1].marks, undefined);
    await text.focus(); await text.press('Control+a');
    await openSharedTool(page, 'Transform');
    await openSharedTool(page, 'Color');
    await panel.getByText('Mixed colors', { exact: true }).waitFor();
    const beforeDrag = (await saved(page)).texts[0].article;
    await beginColourDrag(page);
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
    await page.waitForFunction(() => document.querySelector('button[aria-label="Color target: Text at cursor"]'));
    const caret = await text.evaluate(() => getSelection().getRangeAt(0).getBoundingClientRect().toJSON());
    await openSharedColorPicker(page);
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#336699');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    // Resume at the same visible caret as a user would. Locator.press on an
    // unfocused contenteditable resets selection before sending the key.
    await page.mouse.click(caret.right + 1, caret.top + caret.height / 2);
    await page.keyboard.press('!');
    const last = (await saved(page)).texts[0].article.content.content[0].content.at(-1);
    assert.equal(last.text, '!'); assert.equal(last.marks[0].attrs.color, '#336699');
    await chooseSharedColorTarget(page, 'title');
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
    await chooseSharedColorTarget(page, 'background');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#c0c0c0');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).texts[0].article.appearance.background, '#c0c0c0');
    await chooseSharedColorTarget(page, 'h1');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#669933');
    await panel.getByRole('textbox', { name: 'Color colour', exact: true }).press('Tab');
    assert.equal((await saved(page)).texts[0].article.appearance.textStyles.h1.color, '#669933');
    await page.screenshot({ path: `${output}/color-text-mist.png` });
    await page.setViewportSize({ width: 760, height: 540 });
    await chooseSharedColorTarget(page, 'body');
    const box = await panel.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 760 && box.y + box.height <= 540);
    assert.equal(await panel.locator('.workbench-inspector').evaluate(node => node.scrollWidth <= node.clientWidth), true);
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
    let panel = sharedToolPanel(page);
    await page.getByRole('button', { name: 'Select Body', exact: true }).click();
    await panel.getByRole('button', { name: 'Open artwork', exact: true }).click();
    await panel.getByRole('spinbutton', { name: 'Transform Width', exact: true }).waitFor();
    await panel.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await page.keyboard.press('Control+k');
    await page.getByRole('button', { name: 'Transform', exact: true }).click();
    await panel.waitFor();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await openSharedTool(page, 'Color');
    const original = await saved(page);
    await beginColourDrag(page);
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).focus();
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).press('Enter'); await page.mouse.up();
    assert.deepEqual((await saved(page)).shapes, original.shapes, 'retargeting cancels the originating preview');
    await panel.getByRole('group', { name: 'Image fit', exact: true }).waitFor();
    assert.equal(await panel.getByRole('textbox', { name: 'Color colour', exact: true }).count(), 0, 'Image selection removes the previous Color controls');
    await openSharedTool(page, 'Transform');
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
    const imageActions = panel.getByRole('group', { name: 'Image transforms', exact: true });
    for (const action of ['Rotate', 'Mirror horizontal', 'Mirror vertical']) {
      assert.equal(await panel.getByRole('button', { name: action, exact: true }).count(), 1);
      await imageActions.getByRole('button', { name: action, exact: true }).click();
    }
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').artwork.transform.quarterTurns, 1);
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').artwork.transform.mirrorX, true);
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').artwork.transform.mirrorY, true);
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
      const button = panel.getByRole('button', { name: action, exact: true });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 760 && box.y >= 0 && box.y + box.height <= 620,
        `${action} stays reachable in the narrow Inspector`);
    }
    await page.screenshot({ path: `${output}/image-toolbar-narrow.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
