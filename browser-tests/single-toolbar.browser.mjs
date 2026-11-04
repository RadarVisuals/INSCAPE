import test from 'node:test';
import { artworkCommand, artworkMenu } from './fixtures/artwork-menu.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorCommand, editorMenu, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/single-toolbar';
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath: browserExecutable, headless: true }); });
test.after(async () => { await browser?.close(); });
const draft = page => page.evaluate(() => window.readToolChromeDraft());
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const width of [1440, 1000]) {
  test(`object menu shares actions, orders layers and chooses overlapping objects (${width}px)`, { timeout: 45000 }, async () => {
    const { page, errors } = await mount(width);
    try {
      const initial = await draft(page), shapeId = initial.shapes[0].id;
      for (const id of [initial.imageModules[0].id, shapeId]) {
        const menu = await artworkMenu(page, id);
        assert.deepEqual((await menu.locator(':scope > button').allTextContents()).slice(0, 3), ['Duplicate', 'Layer order›', 'Delete']);
        await page.keyboard.press('Escape');
        assert.equal(await menu.count(), 0);
        assert.equal(await page.locator(`[data-workbench-view-id="${id}"]`).evaluate(node => node.contains(document.activeElement)), true);
      }
      await artworkCommand(page, shapeId, 'Duplicate');
      const copied = await draft(page), copyId = copied.shapes.at(-1).id;
      await artworkCommand(page, copyId, 'Send to back');
      assert.equal((await draft(page)).artworkLayers[0], copyId);
      const menu = await artworkMenu(page, shapeId);
      await menu.getByRole('menuitem', { name: 'Select object here', exact: true }).click();
      await menu.getByRole('menuitem', { name: 'Shape — Shape 1 copy', exact: true }).click();
      await page.getByRole('menu', { name: 'Shape 1 copy actions', exact: true }).waitFor();
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/object-menu-${width}.png` });
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      assert.deepEqual((await draft(page)).shapes, initial.shapes, 'the chosen underlying object is deleted, not its neighbour');
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
      assert.deepEqual((await draft(page)).shapes, copied.shapes);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('Text uses the same object menu with saved duplication, failure recovery, deletion and undo', { timeout: 45000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await mountTextToolsFixture(page, origin);
    const before = await page.evaluate(() => window.savedDraft()), id = before.texts[0].id;
    await page.evaluate(() => { window.failSave = true; });
    await artworkCommand(page, id, 'Duplicate');
    await page.getByRole('alert').filter({ hasText: 'The Text copy could not be saved.' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), before);
    await page.evaluate(() => { window.failSave = false; });
    await artworkCommand(page, id, 'Duplicate');
    const copied = await page.evaluate(() => window.savedDraft()), copyId = copied.texts.at(-1).id;
    assert.equal(copied.texts.length, 2);
    assert.deepEqual(copied.texts[1].article, before.texts[0].article);
    await artworkCommand(page, copyId, 'Delete');
    assert.deepEqual((await page.evaluate(() => window.savedDraft())).texts, before.texts);
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    assert.deepEqual((await page.evaluate(() => window.savedDraft())).texts, copied.texts);
    await mountTextToolsFixture(page, origin);
    assert.deepEqual((await page.evaluate(() => window.savedDraft())).texts, copied.texts);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
async function mount(width = 1440, theme = 'carbon') {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=actions&theme=${theme}`);
  await page.locator('.image-module__canvas').first().focus();
  await setEditorSidebarOpen(page, false);
  await editorCommand(page, 'View', 'Focus selection');
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

for (const [width, theme] of [[1440, 'carbon'], [1000, 'mist']]) {
  test(`seven tools and Image operations in their panel (${width}px ${theme})`, { timeout: 45000 }, async () => {
    const { page, errors } = await mount(width, theme);
    try {
      const bar = page.getByRole('toolbar', { name: 'Creation tools', exact: true });
      assert.deepEqual(await bar.locator(':scope > button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))),
        ['Select tool', 'Hand tool', 'Text tool', 'Shapes', 'Artwork library', 'Layers', 'Add module']);
      const bounds = await bar.boundingBox();
      assert.ok(bounds.height <= 44 && bounds.x >= 0 && bounds.x + bounds.width <= width);
      const image = await openSharedTool(page, 'Image');
      await button(image, 'Fit inside').click();
      const fitted = await draft(page);
      assert.equal(fitted.imageModules[0].sides[0].crop, null);
      await button(image, 'Rotate').click();
      assert.equal((await draft(page)).imageModules[0].sides[0].transform.quarterTurns, 1);
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
      assert.deepEqual(await draft(page), fitted);
      await button(image, 'Crop').click();
      const zoom = image.getByRole('slider', { name: 'Crop zoom' });
      await zoom.fill('2'); await zoom.focus(); await zoom.press('ArrowRight');
      assert.equal(await zoom.evaluate(node => node === document.activeElement), true);
      assert.deepEqual(await draft(page), fitted, 'crop preview never saves');
      await zoom.press('Escape');
      assert.equal(await zoom.count(), 0);
      assert.equal(await image.isVisible(), true);
      assert.equal(await image.locator('button:focus').count(), 1, 'cancel restores a control in the same panel');
      assert.deepEqual(await draft(page), fitted);
      await button(image, 'Crop').click(); await zoom.fill('2');
      await button(image, 'Done').click();
      assert.notDeepEqual(await draft(page), fitted);
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
      assert.deepEqual(await draft(page), fitted, 'one Undo restores the crop');
      assert.equal((await bar.boundingBox()).height, bounds.height);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/image-panel-${theme}-${width}.png` });
      await button(image, 'Crop').click(); await zoom.fill('2');
      await page.screenshot({ path: `${output}/crop-panel-${theme}-${width}.png` });
      await button(image, 'Cancel').click();
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('command search works from Edit and keyboard with the drawing toolbar hidden', { timeout: 45000 }, async () => {
  const { page, errors } = await mount(800, 'mist');
  try {
    const saved = await draft(page);
    const trigger = button(page, 'Layers'); await trigger.focus(); await trigger.press('Control+k');
    const search = page.getByRole('dialog', { name: 'Search commands', exact: true });
    const input = search.getByRole('textbox', { name: 'Search commands', exact: true });
    await input.waitFor();
    assert.equal(await search.locator('.artwork-action-controls, input[type=range]').count(), 0);
    await input.fill('image settings'); await input.press('Enter');
    assert.equal(await page.getByRole('tab', { name: 'Image', exact: true }).getAttribute('aria-selected'), 'true');
    await editorMenu(page, 'Tools').click();
    await page.getByRole('menuitemcheckbox', { name: 'Drawing toolbar', exact: true }).click();
    assert.equal(await page.getByRole('toolbar', { name: 'Creation tools' }).count(), 0);
    await editorCommand(page, 'Edit', 'Search commands'); await input.waitFor();
    await input.press('Escape');
    assert.equal(await editorMenu(page, 'Edit').evaluate(node => node === document.activeElement), true);
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+k'); await input.waitFor();
    await input.fill('artwork info'); await input.press('Enter');
    assert.equal(await page.getByRole('tab', { name: 'Info', exact: true }).getAttribute('aria-selected'), 'true');
    assert.deepEqual(await draft(page), saved, 'search and panel navigation never change the composition');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('changing target cancels Image crop and exposes Shape actions in its object menu', { timeout: 45000 }, async () => {
  const { page, errors } = await mount();
  try {
    const image = await openSharedTool(page, 'Image');
    const before = await draft(page);
    await button(image, 'Crop').click(); await image.getByRole('slider', { name: 'Crop zoom' }).fill('2');
    await page.locator('.shape-window header').first().focus();
    const shape = await openSharedTool(page, 'Shape');
    assert.equal(await shape.getByRole('slider', { name: 'Crop zoom' }).count(), 0);
    assert.equal(await shape.locator('.artwork-action-controls').count(), 0);
    await artworkCommand(page, before.shapes[0].id, 'Duplicate');
    assert.equal((await draft(page)).shapes.length, before.shapes.length + 1);
    await artworkCommand(page, (await draft(page)).shapes.at(-1).id, 'Delete');
    assert.equal((await draft(page)).shapes.length, before.shapes.length);
    assert.deepEqual((await draft(page)).imageModules, before.imageModules);
    await page.locator('.image-module__canvas').first().focus(); await openSharedTool(page, 'Image');
    assert.equal(await image.getByRole('slider', { name: 'Crop zoom' }).count(), 0, 'returning does not resume the abandoned crop');
    const source = page.locator('.system-workflow__placement').first();
    await source.focus(); await source.press('Enter'); await settle(page);
    const display = page.locator('[data-context-tools]');
    await button(display, 'In place').click();
    assert.equal((await draft(page)).grids[0].placements[0].inspectionMode, 'IN_PLACE');
    const initialRotation = (await draft(page)).grids[0].placements[0].transform.quarterTurns;
    await button(display, 'Rotate').click();
    assert.equal((await draft(page)).grids[0].placements[0].transform.quarterTurns, (initialRotation + 1) % 4);
    const rotated = await draft(page);
    await button(display, 'Crop').click();
    const zoom = display.getByRole('slider', { name: 'Crop zoom' }); await zoom.fill('2');
    await button(display, 'Cancel').click(); assert.deepEqual(await draft(page), rotated);
    await mkdir(output, { recursive: true }); await settle(page);
    const bounds = await page.locator('[data-context-tools] .context-toolbar').boundingBox();
    const controls = await page.locator('[data-context-tools] .artwork-action-controls').boundingBox();
    assert.ok(controls.y + controls.height <= bounds.y + bounds.height, 'Display actions fit their window after crop');
    await page.screenshot({ path: `${output}/display-panel-carbon.png` });
    assert.equal(await page.locator('[data-context-action-bars]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
