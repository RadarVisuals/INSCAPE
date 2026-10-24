import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, hideModuleTools } from './fixtures/shared-tools.mjs';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/tool-docking';
const saved = page => page.evaluate(() => window.savedDraft());
const dock = (page, tab) => page.locator('.workbench-tool-dock').filter({ has: page.getByRole('tab', { name: tab, exact: true }) });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const groups = page => page.locator('.workbench-tool-dock').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)));
async function drag(page, source, point, cancel) {
  const box = await source.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  if (cancel === 'escape') await page.keyboard.press('Escape');
  if (cancel === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
}
async function dockTab(page, from, to) {
  const box = await tab(page, to).boundingBox();
  await drag(page, tab(page, from), { x: box.x + box.width - 3, y: box.y + box.height / 2 });
}

const pane = (page, name) => page.locator('.workbench-dock-pane').filter({ has: tab(page, name) });
const paneTabs = page => page.locator('.workbench-dock-pane').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)));

test('stacked panels share one movable frame, resize independently, detach and reopen in place', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page); await hideModuleTools(page); await mkdir(output, { recursive: true });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const before = await saved(page), box = await dock(page, 'Layers').boundingBox();
    await drag(page, tab(page, 'Color'), { x: box.x + box.width / 2, y: box.y + box.height - 16 }, 'escape');
    assert.equal(await page.locator('.workbench-dock-pane').count(), 1);
    // Capture the actual drop affordance, then commit at the lower edge.
    const source = await tab(page, 'Color').boundingBox();
    await page.mouse.move(source.x + 12, source.y + 16); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 16, { steps: 10 });
    assert.equal(await pane(page, 'Layers').getAttribute('data-drop-side'), 'below');
    await dock(page, 'Layers').screenshot({ path: `${output}/stack-drop-preview.png` });
    await page.mouse.up();
    assert.deepEqual(await paneTabs(page), [['Layers', 'Transform'], ['Color']]);
    assert.equal(await page.getByRole('tabpanel', { name: 'Layers', exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('tabpanel', { name: 'Color', exact: true }).isVisible(), true);
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    const combined = dock(page, 'Layers'), frame = await combined.boundingBox();
    await drag(page, combined.locator('[data-edge="se"]'), { x: frame.x + frame.width, y: frame.y + 700 });
    const separator = page.getByRole('separator', { name: 'Resize Layers and Color panels', exact: true });
    const split = await separator.boundingBox(), outer = await combined.boundingBox();
    await drag(page, separator, { x: split.x + 60, y: outer.y + 280 });
    const height = (await pane(page, 'Layers').boundingBox()).height;
    assert.ok(Math.abs(height - 280) < 3);
    const stable = await combined.boundingBox(), boundary = await separator.boundingBox();
    await drag(page, separator, { x: boundary.x + 40, y: boundary.y + 60 }, 'escape');
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).height - height) < 1);
    await drag(page, separator, { x: boundary.x + 40, y: boundary.y + 60 }, 'blur');
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).height - height) < 1);
    await separator.focus(); await separator.press('ArrowDown');
    assert.ok((await pane(page, 'Layers').boundingBox()).height > height + 6);
    await separator.press('ArrowUp');
    assert.deepEqual(await combined.boundingBox(), stable);
    const grip = combined.locator('.workbench-tool-panel-grip').last(), handle = await grip.boundingBox();
    await drag(page, grip, { x: handle.x - 180, y: handle.y + 8 });
    const moved = await combined.boundingBox();
    assert.ok(moved.x < stable.x - 100);
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).width - (await pane(page, 'Color').boundingBox()).width) < 1);
    await page.getByRole('button', { name: 'Close Color', exact: true }).click();
    assert.equal(await page.locator('.workbench-dock-pane').count(), 1);
    await openSharedTool(page, 'Color');
    assert.deepEqual(await paneTabs(page), [['Layers', 'Transform'], ['Color']]);
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).height - height) < 2);
    await tab(page, 'Color').click(); // Pointer use clears keyboard focus without changing the artwork selection.
    await combined.screenshot({ path: `${output}/stacked-mist-wide.png` });
    await drag(page, tab(page, 'Color'), { x: 460, y: 120 });
    assert.equal(await page.locator('.workbench-tool-dock').count(), 2);
    const target = await pane(page, 'Layers').boundingBox();
    await drag(page, tab(page, 'Color'), { x: target.x + 80, y: target.y + 3 });
    assert.deepEqual(await paneTabs(page), [['Color'], ['Layers', 'Transform']]);
    await dockTab(page, 'Color', 'Transform');
    assert.equal(await page.locator('.workbench-dock-pane').count(), 1);
    assert.deepEqual(await saved(page), before, 'all layout operations stay outside authored state');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('keyboard stacking, whole-dock stacking and narrow scrolling retain every panel', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { carbon: true }); await hideModuleTools(page);
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const before = await saved(page);
    await tab(page, 'Color').focus(); await tab(page, 'Color').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Dock below Layers and Transform', exact: true }).press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Color');
    await tab(page, 'Transform').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Detach Transform', exact: true }).press('Enter');
    const other = await dock(page, 'Transform').boundingBox();
    await drag(page, dock(page, 'Layers').locator('.workbench-tool-panel-grip').first(), { x: other.x + 80, y: other.y + other.height - 16 });
    assert.deepEqual(await paneTabs(page), [['Transform'], ['Layers'], ['Color']]);
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    await page.setViewportSize({ width: 760, height: 540 });
    const color = page.getByRole('spinbutton', { name: 'Color opacity', exact: true });
    await color.scrollIntoViewIfNeeded();
    const field = await color.boundingBox(), frame = await dock(page, 'Layers').boundingBox();
    assert.ok(field.y + field.height <= frame.y + frame.height + 1);
    assert.equal(await page.locator('.workbench-dock-pane').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth)), true);
    await dock(page, 'Layers').screenshot({ path: `${output}/stacked-carbon-narrow.png` });
    for (const name of ['Color', 'Layers', 'Transform']) await page.getByRole('button', { name: `Close ${name === 'Layers' ? 'Workbench Layers' : name}`, exact: true }).click();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 0);
    await openSharedTool(page, 'Color'); await openSharedTool(page, 'Transform');
    await page.locator('[data-workbench-toolbar]').getByRole('button', { name: 'Layers', exact: true }).click();
    assert.deepEqual(await paneTabs(page), [['Transform'], ['Layers'], ['Color']]);
    assert.deepEqual(await saved(page), before);
    await page.reload();
    await tab(page, 'Layers').waitFor();
    assert.deepEqual(await paneTabs(page), [['Transform'], ['Layers'], ['Color']], 'layout survives reload');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('three tools detach, regroup, reorder, move as a dock and recover without authoring edits', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { carbon: true }); await hideModuleTools(page); await mkdir(output, { recursive: true });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const before = await saved(page);
    assert.deepEqual(await groups(page), [['Layers', 'Transform', 'Color']]);
    await drag(page, tab(page, 'Color'), { x: 650, y: 112 }, 'escape');
    assert.deepEqual(await groups(page), [['Layers', 'Transform', 'Color']]);
    await drag(page, tab(page, 'Color'), { x: 650, y: 112 }, 'blur');
    assert.deepEqual(await groups(page), [['Layers', 'Transform', 'Color']]);
    await drag(page, tab(page, 'Color'), { x: 650, y: 112 });
    assert.equal((await groups(page)).length, 2);
    await drag(page, tab(page, 'Transform'), { x: 300, y: 140 });
    assert.equal((await groups(page)).length, 3);
    assert.equal(await page.locator('.workbench-dock-tabs button:focus-visible').count(), 0, 'pointer docking leaves no keyboard outline');
    await page.screenshot({ path: `${output}/three-independent-carbon.png` });
    await dockTab(page, 'Color', 'Transform');
    assert.deepEqual(await dock(page, 'Color').getByRole('tab').allTextContents(), ['Transform', 'Color']);
    const pair = dock(page, 'Color'), oldFrame = await pair.boundingBox();
    await drag(page, pair.locator('.workbench-tool-panel-grip'), { x: oldFrame.x + oldFrame.width - 80, y: oldFrame.y + 90 });
    const moved = await pair.boundingBox();
    assert.notEqual(moved.y, oldFrame.y);
    assert.deepEqual(await pair.getByRole('tab').allTextContents(), ['Transform', 'Color']);
    const layerHeader = await tab(page, 'Layers').boundingBox();
    await drag(page, pair.locator('.workbench-tool-panel-grip'), { x: layerHeader.x + 20, y: layerHeader.y + 18 });
    assert.equal((await groups(page)).length, 1, 'the entire dock can join another dock');
    assert.equal((await groups(page))[0].length, 3);
    await tab(page, 'Layers').click();
    const all = dock(page, 'Layers');
    const frame = await all.boundingBox();
    await drag(page, all.locator('.workbench-tool-panel-grip'), { x: frame.x - 150, y: frame.y + 120 }, 'escape');
    assert.deepEqual(await all.boundingBox(), frame);
    await drag(page, tab(page, 'Layers'), { x: 600, y: 160 });
    await dockTab(page, 'Layers', 'Color');
    assert.equal((await groups(page)).length, 1);
    for (const name of ['Layers', 'Transform', 'Color']) {
      await tab(page, name).click();
      await page.getByRole('button', { name: `Close ${name === 'Layers' ? 'Workbench Layers' : name}`, exact: true }).click();
    }
    assert.equal(await page.locator('.workbench-tool-dock').count(), 0);
    await openSharedTool(page, 'Color');
    await openSharedTool(page, 'Transform');
    await page.locator('[data-workbench-toolbar]').getByRole('button', { name: 'Layers', exact: true }).click();
    assert.equal((await groups(page)).length, 1);
    await page.setViewportSize({ width: 760, height: 540 });
    await tab(page, 'Color').click();
    const narrow = await dock(page, 'Color').boundingBox();
    assert.ok(narrow.x >= 8 && narrow.x + narrow.width <= 752 && narrow.y + narrow.height <= 492);
    const opacity = page.getByRole('spinbutton', { name: 'Color opacity', exact: true });
    await opacity.scrollIntoViewIfNeeded();
    const fieldBox = await opacity.boundingBox();
    assert.ok(fieldBox.y + fieldBox.height <= narrow.y + narrow.height, 'lower controls remain reachable inside a short dock');
    assert.equal(await dock(page, 'Color').locator('.workbench-tools-body').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await dock(page, 'Color').locator('.workbench-tools-body').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${output}/docked-carbon-narrow.png` });
    assert.deepEqual(await saved(page), before, 'docking, moving and tool visibility never save artwork');
    await drag(page, tab(page, 'Color'), { x: 120, y: 200 });
    const grip = dock(page, 'Color').locator('.workbench-tool-panel-grip');
    const box = await grip.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 15); await page.mouse.down(); await page.mouse.move(box.x + 25, box.y + 25);
    await page.evaluate(() => window.leaveEditor()); await page.mouse.up();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('keyboard docking keeps text selection, color history and the three independent tool targets', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { writing: true }); await hideModuleTools(page);
    await page.getByRole('button', { name: 'Select Mist', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    await text.focus(); await text.press('Control+Home'); await text.press('Control+Shift+ArrowRight');
    await page.waitForFunction(() => window.getSelection()?.toString() === 'Native ');
    await tab(page, 'Color').focus(); await tab(page, 'Color').press('Enter');
    // Wait for the editor's selection transaction before docking its controls.
    const target = page.getByRole('combobox', { name: 'Color target', exact: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="Color target"]')?.selectedOptions[0]?.textContent === 'Selected text');
    assert.equal(await target.inputValue(), 'body');
    await tab(page, 'Color').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Detach Color', exact: true }).press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Color');
    assert.equal(await target.locator('option:checked').textContent(), 'Selected text');
    const field = page.getByRole('textbox', { name: 'Color colour', exact: true });
    await field.fill('#aa3344'); await field.press('Tab');
    let content = (await saved(page)).texts[0].article.content.content[0].content;
    assert.equal(content[0].text, 'Native '); assert.equal(content[0].marks[0].attrs.color, '#aa3344');
    assert.equal(content[1].marks, undefined);
    await tab(page, 'Color').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Dock with Layers and Transform', exact: true }).click();
    await field.fill('#336699'); await field.press('Tab');
    content = (await saved(page)).texts[0].article.content.content[0].content;
    assert.equal(content[0].marks[0].attrs.color, '#336699'); assert.equal(content[1].marks, undefined);
    await tab(page, 'Color').press('ArrowLeft');
    assert.equal(await tab(page, 'Transform').getAttribute('aria-selected'), 'true');
    await tab(page, 'Transform').press('Home');
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    await tab(page, 'Color').click();
    await page.getByText('Images have no color settings.', { exact: true }).waitFor();
    await tab(page, 'Color').press('Shift+F10'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Color');
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Delete');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Cancel layer deletion');
    assert.equal(await tab(page, 'Layers').getAttribute('aria-selected'), 'true', 'canvas Delete reveals Layers in its existing dock');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Confirm layer deletion' }).count(), 0);
    await tab(page, 'Layers').click();
    await page.screenshot({ path: `${output}/docked-mist-wide.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
