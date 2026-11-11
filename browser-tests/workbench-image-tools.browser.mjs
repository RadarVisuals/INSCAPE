import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, sharedToolPanel, sharedToolTab } from './fixtures/shared-tools.mjs';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/image-tools';
const saved = page => page.evaluate(() => window.savedDraft());
const undo = async page => { await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); };
const fitControl = panel => panel.getByRole('button', { name: 'Fit inside', exact: true });
async function drag(page, handle, dx, dy) {
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up();
}

test('Image settings use the shared dock while publication choice, toolbar and recovery stay module-owned', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page);
    assert.deepEqual(await page.getByRole('tablist', { name: 'Artwork tools' }).getByRole('tab').evaluateAll(nodes => nodes.map(node => node.dataset.toolTab || node.textContent)), ['Layers', 'Library', 'Inspector']);
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    await openSharedTool(page, 'Image');
    const original = await saved(page), image = sharedToolPanel(page);
    assert.equal(await sharedToolTab(page, 'Inspector').innerText(), 'Image · Eyes');
    assert.equal(await page.locator('[data-context-tools]').isVisible(), false, 'old Properties window is replaced, not duplicated');
    assert.equal(await image.getByRole('button', { name: /^When dropping from Library:/ }).count(), 0);
    await fitControl(image).waitFor();
    assert.deepEqual(await saved(page), original, 'opening settings does not edit content');
    await openSharedTool(page, 'Info');
    await image.getByRole('article', { name: 'Artwork metadata', exact: true }).getByRole('heading', { name: original.imageModules[1].artwork.asset.name, exact: true }).waitFor();
    assert.equal(await image.getByRole('tab').count(), 1, 'Image controls and source information share one Inspector');
    assert.deepEqual(await saved(page), original, 'source information never edits the Image');
    const include = image.getByRole('checkbox', { name: 'Include Image in publication', exact: true });
    await include.uncheck();
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:eyes').visibility, 'PRIVATE');
    assert.equal((await saved(page)).imageModules.find(item => item.id === 'image:body').visibility, 'PUBLIC');
    await undo(page); await include.waitFor(); assert.equal(await include.isChecked(), true);
    await page.evaluate(() => { window.savedSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw Error('full'); return window.savedSetItem.call(this, key, value);
    }; });
    await include.click(); await image.getByRole('alert').waitFor();
    assert.equal(await include.isChecked(), true, 'failed persistence keeps the authored publication choice');
    assert.deepEqual((await saved(page)).imageModules, original.imageModules);
    await page.evaluate(() => { Storage.prototype.setItem = window.savedSetItem; });
    await include.uncheck(); assert.equal((await saved(page)).imageModules[1].visibility, 'PRIVATE'); await undo(page);
    const actions = image.getByRole('group', { name: 'Image transforms', exact: true });
    for (const name of ['Rotate', 'Mirror horizontal', 'Mirror vertical']) {
      assert.equal(await image.getByRole('button', { name, exact: true }).count(), 1);
      await actions.getByRole('button', { name, exact: true }).waitFor();
    }
    await image.getByRole('button', { name: 'Fill canvas', exact: true }).click();
    assert.deepEqual((await saved(page)).imageModules[1].artwork.crop, { x: .5, y: .5, zoom: 1 });
    assert.deepEqual((await saved(page)).workbench, original.workbench, 'fit choice preserves frame geometry');
    await image.getByRole('button', { name: 'Fit inside', exact: true }).click();
    assert.equal((await saved(page)).imageModules[1].artwork.crop, null);
    await undo(page); await undo(page);
    await image.getByRole('button', { name: 'Crop', exact: true }).click();
    const crop = image.getByRole('region', { name: 'Crop Image', exact: true });
    const zoom = crop.getByRole('slider', { name: 'Crop zoom' });
    await zoom.focus(); await zoom.press('ArrowRight');
    assert.deepEqual((await saved(page)).imageModules, original.imageModules, 'crop changes remain a preview until committed');
    await crop.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual((await saved(page)).imageModules, original.imageModules, 'cancelling crop preserves the Image');
    await fitControl(image).waitFor();
    // Selecting another artwork follows selection without changing the active tab.
    await page.locator('[data-image-module="image:body"] .image-module__canvas').focus();
    assert.equal(await sharedToolTab(page, 'Inspector').getAttribute('aria-selected'), 'true');
    assert.equal(await fitControl(image).isEnabled(), true);
    await page.locator('[data-image-module="image:eyes"] .image-module__canvas').focus();
    assert.equal(await fitControl(image).isEnabled(), true);
    await page.screenshot({ path: `${output}/image-mist-docked.png` });
    await image.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await openSharedTool(page, 'Image');
    assert.equal(await fitControl(image).isEnabled(), true);
    await drag(page, image.locator('.workbench-tool-panel-grip'), -230, 15);
    await drag(page, image.locator('[data-edge="se"]'), -40, -250);
    await page.screenshot({ path: `${output}/image-mist-independent.png` });
    await sharedToolTab(page, 'Inspector').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Dock with Layers', exact: true }).click();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    await page.getByRole('tab', { name: 'Layers', exact: true }).click();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await openSharedTool(page, 'Inspector');
    assert.equal(await sharedToolTab(page, 'Inspector').innerText(), 'Shape · Landscape');
    await openSharedTool(page, 'Color');
    await image.getByRole('textbox', { name: 'Color colour', exact: true }).waitFor();
    assert.equal(await fitControl(image).count(), 0, 'another module cannot keep editing the previous Image');
    assert.equal(await image.getByRole('button', { name: 'Crop', exact: true }).count(), 0);
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
    await fitControl(image).waitFor();
    await drag(page, image.locator('[data-edge="w"]'), 40, 0);
    const bounds = await image.boundingBox();
    for (const control of [image.getByRole('button', { name: 'Close Inspector', exact: true }), fitControl(image), image.getByRole('checkbox'), sharedToolTab(page, 'Inspector')]) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width && box.y >= bounds.y && box.y + box.height <= bounds.y + bounds.height, 'each control remains reachable within the resized dock');
    }
    assert.equal(await image.locator('.workbench-inspector').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.screenshot({ path: `${output}/image-carbon-narrow.png` });
  } finally { await browser.close(); }
});
