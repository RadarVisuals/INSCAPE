import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, detachTool } from './fixtures/shared-tools.mjs';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/image-tools';
const saved = page => page.evaluate(() => window.savedDraft());
const undo = async page => { await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); };
const panelFor = (page, name) => page.locator('.workbench-tool-dock').filter({ has: page.getByRole('tab', { name, exact: true }) });
async function drag(page, handle, dx, dy) {
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up();
}

test('Image settings use the shared dock while side edits, publication choice, toolbar and recovery stay module-owned', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page);
    assert.deepEqual(await page.getByRole('tablist', { name: 'Artwork tools' }).getByRole('tab').allTextContents(), ['Layers', 'Transform', 'Color', 'Image', 'Shape', 'FX', 'Info']);
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    await openSharedTool(page, 'Image');
    const original = await saved(page), image = panelFor(page, 'Image');
    assert.equal(await page.locator('[data-context-tools]').isVisible(), false, 'old Properties window is replaced, not duplicated');
    assert.equal(await page.getByRole('combobox', { name: 'When dropping from Library', exact: true }).count(), 1);
    await image.getByRole('combobox', { name: 'When dropping from Library' }).selectOption('replace');
    assert.deepEqual(await saved(page), original, 'choosing a future drop mode is temporary');
    const include = image.getByRole('checkbox', { name: 'Include Image in publication', exact: true });
    await include.uncheck();
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').visibility, 'PRIVATE');
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:body').visibility, 'PUBLIC');
    await undo(page); await include.waitFor(); assert.equal(await include.isChecked(), true);
    await image.getByRole('button', { name: 'Remove current Image side', exact: true }).click();
    assert.equal((await saved(page)).imageModules[1].sides.length, 1);
    await undo(page); assert.equal((await saved(page)).imageModules[1].sides.length, 2);
    await page.evaluate(() => { window.savedSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw Error('full'); return window.savedSetItem.call(this, key, value);
    }; });
    await image.getByRole('button', { name: 'Remove current Image side', exact: true }).click();
    await image.getByRole('alert').waitFor();
    assert.equal(await page.locator('[data-context-action-bars]').getByRole('alert').count(), 0, 'a settings error is shown once at its own controls');
    assert.equal((await saved(page)).imageModules[1].sides.length, 2);
    await page.evaluate(() => { Storage.prototype.setItem = window.savedSetItem; });
    await image.getByRole('button', { name: 'Remove current Image side', exact: true }).click();
    assert.equal((await saved(page)).imageModules[1].sides.length, 1); await undo(page);
    const actions = page.getByRole('navigation', { name: 'Image actions', exact: true });
    for (const name of ['Rotate', 'Mirror horizontal', 'Mirror vertical', 'Crop']) {
      assert.equal(await image.getByRole('button', { name, exact: true }).count(), 0);
      await actions.getByRole('button', { name, exact: true }).waitFor();
    }
    await actions.getByRole('button', { name: 'Crop', exact: true }).click();
    await image.getByText('Finish or cancel the crop in the toolbar.').waitFor();
    await page.locator('[data-context-action-bars]').getByRole('button', { name: 'Cancel', exact: true }).click();
    await image.getByRole('combobox', { name: 'When dropping from Library' }).waitFor();
    // Selecting another artwork follows selection without changing the active tab.
    await page.locator('[data-image-module="image:body"] .image-module__canvas').click({ position: { x: 20, y: 20 } });
    assert.equal(await page.getByRole('tab', { name: 'Image', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await image.getByRole('combobox', { name: 'When dropping from Library' }).inputValue(), 'append');
    await page.locator('[data-image-module="image:eyes"] .image-module__canvas').click({ position: { x: 220, y: 160 } });
    assert.equal(await image.getByRole('combobox', { name: 'When dropping from Library' }).inputValue(), 'replace');
    await page.screenshot({ path: `${output}/image-mist-docked.png` });
    await image.getByRole('button', { name: 'Close Image', exact: true }).click();
    await openSharedTool(page, 'Image');
    assert.equal(await image.getByRole('combobox', { name: 'When dropping from Library' }).inputValue(), 'replace');
    await detachTool(page, 'Image');
    await drag(page, image.locator('.workbench-tool-panel-grip'), -230, 15);
    await drag(page, image.locator('[data-edge="se"]'), -40, -250);
    await page.screenshot({ path: `${output}/image-mist-independent.png` });
    await page.getByRole('tab', { name: 'Image', exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Dock with Layers, Transform, Color, Shape, FX and Info', exact: true }).click();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    await page.getByRole('tab', { name: 'Layers', exact: true }).click();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await openSharedTool(page, 'Image');
    await image.getByText('Select one Image to edit its settings.').waitFor();
    assert.equal(await image.getByRole('combobox').count(), 0, 'another module cannot keep editing the previous Image');
    assert.deepEqual((await saved(page)).imageModules, original.imageModules);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Image tools remain reachable in a compact Carbon dock and recover a closed Image', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 760, height: 620 }, reducedMotion: 'reduce' });
    await mountToolDockFixture(page, { carbon: true, closed: true });
    await page.getByRole('button', { name: 'Select Body', exact: true }).click();
    const image = await openSharedTool(page, 'Image');
    await image.getByText('Open this Image to edit its settings.').waitFor();
    await image.getByRole('button', { name: 'Open artwork', exact: true }).click();
    await image.getByRole('combobox', { name: 'When dropping from Library' }).waitFor();
    await drag(page, image.locator('[data-edge="w"]'), 40, 0);
    const bounds = await image.boundingBox();
    for (const control of [image.getByRole('button', { name: 'Close Image', exact: true }), image.getByRole('combobox'), image.getByRole('checkbox'), image.getByRole('tab', { name: 'Image', exact: true })]) {
      const box = await control.boundingBox();
      assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width && box.y + box.height <= bounds.y + bounds.height, 'controls fit within the resized dock');
    }
    assert.equal(await image.locator('.workbench-tools-body').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.screenshot({ path: `${output}/image-carbon-narrow.png` });
  } finally { await browser.close(); }
});
