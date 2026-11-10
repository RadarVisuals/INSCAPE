import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, detachTool, sharedToolPanel, sharedToolTab, openSharedColorPicker } from './fixtures/shared-tools.mjs';
import { settlePlaywrightAnimationFrames } from './playwright-browser-adapter.mjs';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/tool-docking';
const saved = page => page.evaluate(() => window.savedDraft());
const dock = sharedToolPanel;
const tab = sharedToolTab;
// Library shares the Layers dock slot; this inventory measures dockable tools.
const groups = page => page.locator('.workbench-tool-dock').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('[role="tab"][data-tool-tab]')].map(tab => tab.dataset.toolTab)));
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
const paneTabs = page => page.locator('.workbench-dock-pane').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('[role="tab"][data-tool-tab]')].map(tab => tab.dataset.toolTab)));

async function joinTools(page) {
  await tab(page, 'Inspector').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Dock with Layers', exact: true }).click();
  await tab(page, 'Layers').click();
}

async function resizedStack(page, section = 'Color') {
  await mountToolDockFixture(page); await joinTools(page);
  await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
  const name = 'Inspector';
  await openSharedTool(page, section);
  await tab(page, 'Layers').click();
  const box = await dock(page, 'Layers').boundingBox();
  await drag(page, tab(page, name), { x: box.x + 80, y: box.y + box.height - 16 });
  const frame = await dock(page, 'Layers').boundingBox();
  await drag(page, dock(page, 'Layers').locator('[data-edge="s"]'), { x: frame.x + 150, y: frame.y + 700 });
  const separator = page.getByRole('separator', { name: `Resize Layers and ${name} panels`, exact: true });
  const split = await separator.boundingBox();
  await drag(page, separator, { x: split.x + 80, y: frame.y + 260 });
}

test('Layers fills the dock again after hiding, detaching or rejoining a resized lower pane', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await resizedStack(page); await mkdir(output, { recursive: true });
    const before = await saved(page);
    const fillsFrame = async stage => {
      const frame = await dock(page, 'Layers').boundingBox(), content = await pane(page, 'Layers').boundingBox();
      const actions = await page.getByRole('navigation', { name: 'Layer actions', exact: true }).boundingBox();
      assert.ok(frame.y + frame.height - content.y - content.height < 3, `${stage}: pane fills its remaining frame`);
      assert.ok(frame.y + frame.height - actions.y - actions.height < 14, `${stage}: layer actions stay at the lower edge`);
    };
    const stackedHeight = (await pane(page, 'Layers').boundingBox()).height;
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await dock(page, 'Layers').screenshot({ path: `${output}/layers-after-close.png` });
    await fillsFrame('close');
    await openSharedTool(page, 'Inspector');
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).height - stackedHeight) < 2, 'reopening restores the split');
    const inspectorHeight = (await pane(page, 'Inspector').boundingBox()).height;
    await detachTool(page, 'Inspector'); await fillsFrame('detach');
    assert.ok(Math.abs((await dock(page, 'Inspector').boundingBox()).height - inspectorHeight) < 3, 'menu detach also keeps the pane height');
    const frame = await dock(page, 'Layers').boundingBox();
    // The Navigator covers the right end of a tall dock; grab its free lower edge.
    await page.mouse.move(frame.x + 30, frame.y + frame.height - 2); await page.mouse.down();
    await page.mouse.move(frame.x + 30, frame.y + 260, { steps: 12 }); await page.mouse.up();
    assert.ok((await dock(page, 'Layers').boundingBox()).height < 270, 'the bottom edge can actually shorten the window');
    await fillsFrame('resize');
    await dock(page, 'Layers').screenshot({ path: `${output}/layers-after-detach-resize.png` });
    await dockTab(page, 'Inspector', 'Layers'); await tab(page, 'Layers').click(); await fillsFrame('rejoin');
    await page.reload(); await tab(page, 'Layers').waitFor(); await fillsFrame('reload');
    assert.deepEqual(await saved(page), before, 'window rearrangement does not edit artwork');
  } finally { await browser.close(); }
});

for (const section of ['Color', 'FX']) test(`detached lower Inspector with ${section} stays under the pointer and keeps its pane height`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const name = 'Inspector';
    await resizedStack(page, section); await mkdir(output, { recursive: true });
    const before = await saved(page), source = await tab(page, name).boundingBox(), originalPane = await pane(page, name).boundingBox();
    const point = { x: 460, y: 320 }, grabY = source.y + source.height / 2 - originalPane.y;
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 12 });
    const ghost = await page.locator('.workbench-dock-ghost').boundingBox();
    await page.screenshot({ path: `${output}/${section.toLowerCase()}-inspector-detaching.png` });
    assert.ok(Math.abs(ghost.y + grabY - point.y) < 2, 'drag preview is anchored to the grabbed header');
    await page.mouse.up();
    const detached = await dock(page, name).boundingBox(), header = await dock(page, name).locator('header').boundingBox();
    assert.ok(point.y >= header.y && point.y <= header.y + header.height, 'release keeps the header under the pointer');
    assert.ok(Math.abs(detached.height - originalPane.height) < 3, 'detachment uses the pane height, not the complete stack');
    await dock(page, name).screenshot({ path: `${output}/${section.toLowerCase()}-inspector-detached.png` });
    assert.deepEqual(await saved(page), before);
  } finally { await browser.close(); }
});

test('stacked panels share one movable frame, resize independently, detach and reopen in place', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page); await joinTools(page); await mkdir(output, { recursive: true });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const before = await saved(page), box = await dock(page, 'Layers').boundingBox();
    await drag(page, tab(page, 'Inspector'), { x: box.x + box.width / 2, y: box.y + box.height - 16 }, 'escape');
    assert.equal(await page.locator('.workbench-dock-pane').count(), 1);
    // Capture the actual drop affordance, then commit at the lower edge.
    const source = await tab(page, 'Inspector').boundingBox();
    await page.mouse.move(source.x + 12, source.y + 16); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 16, { steps: 10 });
    assert.equal(await pane(page, 'Layers').getAttribute('data-drop-side'), 'below');
    await dock(page, 'Layers').screenshot({ path: `${output}/stack-drop-preview.png` });
    await page.mouse.up();
    assert.deepEqual(await paneTabs(page), [['Layers'], ['Inspector']]);
    assert.equal(await page.getByRole('tabpanel', { name: 'Layers', exact: true }).isVisible(), true);
    assert.equal(await page.locator('[role="tabpanel"][id$="-panel-Inspector"]').isVisible(), true);
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    const combined = dock(page, 'Layers'), frame = await combined.boundingBox();
    await drag(page, combined.locator('[data-edge="se"]'), { x: frame.x + frame.width, y: frame.y + 700 });
    const separator = page.getByRole('separator', { name: 'Resize Layers and Inspector panels', exact: true });
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
    await drag(page, grip, { x: handle.x + handle.width / 2 + 180, y: handle.y + 8 });
    const moved = await combined.boundingBox();
    assert.ok(moved.x > stable.x + 100);
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).width - (await pane(page, 'Inspector').boundingBox()).width) < 1);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    assert.equal(await page.locator('.workbench-dock-pane').count(), 1);
    await openSharedTool(page, 'Inspector');
    assert.deepEqual(await paneTabs(page), [['Layers'], ['Inspector']]);
    assert.ok(Math.abs((await pane(page, 'Layers').boundingBox()).height - height) < 2);
    await tab(page, 'Inspector').click(); // Pointer use clears keyboard focus without changing the artwork selection.
    await combined.screenshot({ path: `${output}/stacked-mist-wide.png` });
    await drag(page, tab(page, 'Inspector'), { x: 460, y: 120 });
    assert.equal(await page.locator('.workbench-tool-dock').count(), 2);
    const target = await pane(page, 'Layers').boundingBox();
    await drag(page, tab(page, 'Inspector'), { x: target.x + 80, y: target.y + 3 });
    assert.deepEqual(await paneTabs(page), [['Inspector'], ['Layers']]);
    await dockTab(page, 'Inspector', 'Layers');
    assert.equal(await page.locator('.workbench-dock-pane').count(), 1);
    assert.deepEqual(await saved(page), before, 'all layout operations stay outside authored state');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('keyboard stacking, whole-dock stacking and narrow scrolling retain both hosts', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { carbon: true }); await joinTools(page);
    await tab(page, 'Layers').click();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const before = await saved(page);
    await tab(page, 'Inspector').focus(); await tab(page, 'Inspector').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Dock below Layers', exact: true }).press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Inspector');
    assert.deepEqual(await paneTabs(page), [['Layers'], ['Inspector']]);
    await tab(page, 'Inspector').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Detach Inspector', exact: true }).press('Enter');
    const other = await dock(page, 'Inspector').boundingBox();
    await drag(page, dock(page, 'Layers').locator('.workbench-tool-panel-grip'), { x: other.x + 80, y: other.y + other.height - 16 });
    assert.deepEqual(await paneTabs(page), [['Inspector'], ['Layers']]);
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    await page.setViewportSize({ width: 760, height: 540 });
    const color = page.getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true });
    await color.scrollIntoViewIfNeeded();
    const field = await color.boundingBox(), frame = await dock(page, 'Layers').boundingBox();
    assert.ok(field.y + field.height <= frame.y + frame.height + 1);
    assert.equal(await page.locator('.workbench-dock-pane').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth)), true);
    await dock(page, 'Layers').screenshot({ path: `${output}/stacked-carbon-narrow.png` });
    for (const name of ['Inspector', 'Layers']) await page.getByRole('button', { name: `Close ${name === 'Layers' ? 'Workbench Layers' : name}`, exact: true }).click();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 0);
    await openSharedTool(page, 'Color'); await openSharedTool(page, 'Layers');
    assert.deepEqual(await paneTabs(page), [['Inspector'], ['Layers']]);
    assert.deepEqual(await saved(page), before);
    await page.reload(); await tab(page, 'Layers').waitFor();
    assert.deepEqual(await paneTabs(page), [['Inspector'], ['Layers']], 'layout survives reload');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Layers and the complete Inspector detach, regroup, reorder and recover without authoring edits', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { carbon: true }); await joinTools(page); await mkdir(output, { recursive: true });
    await tab(page, 'Layers').click();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const before = await saved(page);
    assert.deepEqual(await groups(page), [['Layers', 'Inspector']]);
    await drag(page, tab(page, 'Inspector'), { x: 650, y: 112 }, 'escape');
    assert.deepEqual(await groups(page), [['Layers', 'Inspector']]);
    await drag(page, tab(page, 'Inspector'), { x: 650, y: 112 }, 'blur');
    assert.deepEqual(await groups(page), [['Layers', 'Inspector']]);
    await drag(page, tab(page, 'Inspector'), { x: 650, y: 112 });
    assert.equal((await groups(page)).length, 2);
    assert.equal(await page.locator('.workbench-dock-tabs button:focus-visible').count(), 0, 'pointer docking leaves no keyboard outline');
    await openSharedTool(page, 'Color');
    await page.getByRole('textbox', { name: 'Color colour', exact: true }).waitFor();
    await openSharedTool(page, 'Transform');
    assert.equal(await page.getByRole('spinbutton', { name: 'Transform Width', exact: true }).inputValue(), '540');
    assert.equal(await dock(page, 'Inspector').getByRole('tab').count(), 1, 'sections remain inside a single host');
    await page.screenshot({ path: `${output}/two-independent-carbon.png` });
    const inspector = dock(page, 'Inspector'), oldFrame = await inspector.boundingBox();
    await drag(page, inspector.locator('.workbench-tool-panel-grip'), { x: oldFrame.x + oldFrame.width - 80, y: oldFrame.y + 90 });
    assert.notEqual((await inspector.boundingBox()).y, oldFrame.y);
    const layerHeader = await tab(page, 'Layers').boundingBox();
    await drag(page, inspector.locator('.workbench-tool-panel-grip'), { x: layerHeader.x + layerHeader.width - 3, y: layerHeader.y + 18 });
    assert.deepEqual(await groups(page), [['Layers', 'Inspector']], 'the entire Inspector joins Layers');
    // The selected Inspector can scroll the first tab partly outside the strip.
    await tab(page, 'Layers').scrollIntoViewIfNeeded();
    const first = await tab(page, 'Layers').boundingBox();
    await drag(page, tab(page, 'Inspector'), { x: first.x + 2, y: first.y + first.height / 2 });
    assert.deepEqual(await groups(page), [['Inspector', 'Layers']], 'the two host tabs can be reordered');
    await tab(page, 'Layers').click();
    const all = dock(page, 'Layers'), frame = await all.boundingBox();
    await drag(page, all.locator('.workbench-tool-panel-grip'), { x: frame.x + 150, y: frame.y + 120 }, 'escape');
    assert.deepEqual(await all.boundingBox(), frame);
    await drag(page, tab(page, 'Layers'), { x: 600, y: 160 });
    await dockTab(page, 'Layers', 'Inspector');
    assert.equal((await groups(page)).length, 1);
    for (const name of ['Layers', 'Inspector']) {
      await tab(page, name).click();
      await page.getByRole('button', { name: `Close ${name === 'Layers' ? 'Workbench Layers' : name}`, exact: true }).click();
    }
    assert.equal(await page.locator('.workbench-tool-dock').count(), 0);
    await openSharedTool(page, 'Color'); await openSharedTool(page, 'Layers');
    assert.equal((await groups(page)).length, 1);
    await page.setViewportSize({ width: 760, height: 540 });
    await openSharedTool(page, 'Color');
    const narrow = await inspector.boundingBox();
    assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= 760 && narrow.y + narrow.height <= 540);
    const opacity = page.getByRole('spinbutton', { name: 'Fill opacity (%)', exact: true });
    await opacity.scrollIntoViewIfNeeded();
    const fieldBox = await opacity.boundingBox();
    assert.ok(fieldBox.y + fieldBox.height <= narrow.y + narrow.height, 'lower controls remain reachable inside a short dock');
    assert.equal(await inspector.locator('.workbench-inspector').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await inspector.locator('.workbench-inspector').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${output}/docked-carbon-narrow.png` });
    assert.deepEqual(await saved(page), before, 'docking, moving and tool visibility never save artwork');
    await drag(page, tab(page, 'Inspector'), { x: 120, y: 200 });
    const grip = inspector.locator('.workbench-tool-panel-grip'), box = await grip.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 15); await page.mouse.down(); await page.mouse.move(box.x + 25, box.y + 25);
    await page.evaluate(() => window.leaveEditor()); await page.mouse.up();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('keyboard docking keeps text selection, color history and the two host targets', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { writing: true }); await joinTools(page);
    await tab(page, 'Layers').click();
    await page.getByRole('button', { name: 'Select Mist', exact: true }).click();
    await openSharedTool(page, 'Inspector');
    const target = page.getByRole('button', { name: /^Color target:/ });
    await target.waitFor();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    await page.evaluate(() => document.fonts.ready);
    await text.focus(); await settlePlaywrightAnimationFrames(page);
    assert.equal(await text.evaluate(node => node === document.activeElement), true);
    // Let flow focus settle, then type into the existing selection without
    // Locator.press refocusing the editor between selection keystrokes.
    await page.keyboard.press('Control+Home');
    await page.waitForFunction(() => {
      const selection = getSelection(), editor = document.querySelector('[aria-label="Article text"]');
      return editor?.contains(selection?.anchorNode) && selection.isCollapsed && selection.anchorOffset === 0;
    });
    for (let i = 0; i < 'Native '.length; i++) await page.keyboard.press('Shift+ArrowRight');
    await page.waitForFunction(() => window.getSelection()?.toString() === 'Native ');
    await settlePlaywrightAnimationFrames(page);
    assert.equal(await page.evaluate(() => getSelection()?.toString()), 'Native ');
    // The visible Color target reflects the editor's selection transaction,
    // which follows the browser's native selectionchange notification.
    await page.waitForFunction(() => document.querySelector('button[aria-label="Color target: Selected text"]'));
    await tab(page, 'Inspector').focus(); await tab(page, 'Inspector').press('Enter');
    // Wait for the editor's selection transaction before docking its controls.
    await page.waitForFunction(() => document.querySelector('button[aria-label="Color target: Selected text"]'));
    assert.equal(await target.getAttribute('aria-label'), 'Color target: Selected text');
    await tab(page, 'Inspector').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Detach Inspector', exact: true }).press('Enter');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Inspector');
    assert.equal(await target.getAttribute('aria-label'), 'Color target: Selected text');
    await openSharedColorPicker(page);
    const field = page.getByRole('textbox', { name: 'Color colour', exact: true });
    await field.fill('#aa3344'); await field.press('Tab');
    let content = (await saved(page)).texts[0].article.content.content[0].content;
    assert.equal(content[0].text, 'Native '); assert.equal(content[0].marks[0].attrs.color, '#aa3344');
    assert.equal(content[1].marks, undefined);
    await tab(page, 'Inspector').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Dock with Layers', exact: true }).click();
    await field.fill('#336699'); await field.press('Tab');
    content = (await saved(page)).texts[0].article.content.content[0].content;
    assert.equal(content[0].marks[0].attrs.color, '#336699'); assert.equal(content[1].marks, undefined);
    await tab(page, 'Inspector').press('ArrowLeft');
    const library = page.getByRole('tab', { name: 'Library', exact: true });
    assert.equal(await library.getAttribute('aria-selected'), 'true');
    await library.press('ArrowLeft');
    assert.equal(await tab(page, 'Layers').getAttribute('aria-selected'), 'true');
    await tab(page, 'Layers').press('End');
    assert.equal(await tab(page, 'Inspector').getAttribute('aria-selected'), 'true');
    await tab(page, 'Inspector').press('Home');
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    await tab(page, 'Inspector').click();
    await dock(page, 'Inspector').getByRole('button', { name: 'Fit inside', exact: true }).waitFor();
    assert.equal(await dock(page, 'Inspector').getByRole('textbox', { name: 'Color colour', exact: true }).count(), 0);
    await tab(page, 'Inspector').press('Shift+F10'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Inspector');
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
