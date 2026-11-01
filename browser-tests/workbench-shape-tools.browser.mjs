import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { withinDeadline } from './browser-test-lifecycle.mjs';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, detachTool } from './fixtures/shared-tools.mjs';

const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/shape-tools';
const saved = page => page.evaluate(() => window.savedDraft());
const undo = async page => { await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); };
const field = async (panel, name, value) => {
  const input = panel.getByRole('spinbutton', { name, exact: true });
  await input.fill(String(value)); await input.press('Enter');
};
async function failStorage(page, fail) {
  await page.evaluate(fail => {
    if (!fail) { Storage.prototype.setItem = window.savedSetItem; return; }
    window.savedSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw Error('full');
      return window.savedSetItem.call(this, key, value);
    };
  }, fail);
}
async function drag(page, handle, dx, dy) {
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up();
}

test('Shape settings replace Properties, follow selection, preserve saved edits and recover failures in the originating tool', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { shapes: true, shapeGrain: .65 });
    assert.deepEqual(await page.getByRole('tablist', { name: 'Artwork tools' }).getByRole('tab').allTextContents(), ['Layers', 'Transform', 'Color', 'Image', 'Shape', 'FX', 'Info']);
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    let panel = await openSharedTool(page, 'Shape');
    const original = await saved(page);
    assert.equal(await page.locator('[data-context-tools]').isVisible(), false);
    assert.equal(await page.getByRole('combobox', { name: 'Selected shape', exact: true }).count(), 1);
    assert.equal(await panel.getByRole('textbox', { name: 'Color colour', exact: true }).count(), 0);
    assert.equal(await panel.getByRole('spinbutton', { name: /Transform/ }).count(), 0);
    const name = panel.getByRole('textbox', { name: 'Shape name', exact: true });
    await name.fill('Backdrop'); await name.press('Enter');
    assert.equal((await saved(page)).shapes[0].name, 'Backdrop');
    await undo(page); assert.equal(await name.inputValue(), 'Landscape');
    assert.equal(await panel.getByRole('slider', { name: 'Grain strength', exact: true }).count(), 0);
    assert.equal(await panel.getByRole('checkbox', { name: 'Show shape', exact: true }).count(), 0);
    assert.equal((await saved(page)).shapes[0].grain, .65, 'removing the control preserves authored grain');
    await page.locator('[data-workbench-view-id="shape:landscape"] .module-surface-grain').waitFor();
    const include = panel.getByRole('checkbox', { name: 'Include in publication', exact: true });
    await include.uncheck(); assert.equal((await saved(page)).shapes[0].visibility, 'PRIVATE');
    assert.equal((await saved(page)).shapes[1].visibility, 'PUBLIC');
    await undo(page); assert.equal(await include.isChecked(), true);

    // Settings and Color may both be detached: only the originating tool reports failure.
    await detachTool(page, 'Shape');
    await openSharedTool(page, 'Color');
    await failStorage(page, true);
    await include.click();
    await panel.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('alert').count(), 1);
    assert.equal((await saved(page)).shapes[0].visibility, 'PUBLIC');
    await failStorage(page, false);
    await include.uncheck(); assert.equal((await saved(page)).shapes[0].visibility, 'PRIVATE');
    await undo(page);
    await page.screenshot({ path: `${output}/shape-mist-independent.png` });
    await panel.getByRole('tab', { name: 'Shape', exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Dock with Layers, Transform, Color, Image, FX and Info', exact: true }).click();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    panel = await openSharedTool(page, 'Shape');
    await panel.getByRole('button', { name: 'Close Shape', exact: true }).click();
    await failStorage(page, true);
    await page.getByRole('navigation', { name: 'Shape actions', exact: true }).getByRole('button', { name: 'Duplicate shape', exact: true }).click();
    await page.locator('[data-context-action-bars]').getByRole('alert').waitFor();
    assert.deepEqual((await saved(page)).shapes, original.shapes);
    await failStorage(page, false);
    panel = await openSharedTool(page, 'Shape');
    await panel.getByRole('textbox', { name: 'Shape name', exact: true }).fill('Backdrop');
    await panel.getByRole('textbox', { name: 'Shape name', exact: true }).press('Enter');
    await undo(page);
    await page.screenshot({ path: `${output}/shape-mist-docked.png` });

    await panel.getByRole('combobox', { name: 'Selected shape', exact: true }).selectOption('shape:grid');
    assert.equal(await panel.getByRole('tab', { name: 'Shape', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await panel.getByRole('textbox', { name: 'Shape name', exact: true }).inputValue(), 'Grid');
    assert.equal(await panel.getByRole('slider').count(), 0);
    await page.locator('[data-image-module="image:body"] .image-module__canvas').click({ position: { x: 20, y: 20 } });
    await panel.getByText('Select one Shape to edit its settings.').waitFor();
    assert.equal(await panel.getByRole('combobox').count(), 0);
    assert.deepEqual((await saved(page)).shapes, original.shapes);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Grid and texture settings retain their behavior in a narrow dock, including hidden shapes and keyboard tab overflow', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  let page;
  try {
    await mkdir(output, { recursive: true });
    page = await browser.newPage({ viewport: { width: 760, height: 620 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page, { shapes: true, carbon: true });
    await page.evaluate(() => {
      window.shapeKeyboardTrace = [];
      const record = (phase, key, target) => window.shapeKeyboardTrace.push({ phase, key, target, time: performance.now(),
        focus: document.activeElement?.getAttribute('data-tool-tab') || document.activeElement?.getAttribute('aria-label'),
        panes: [...document.querySelectorAll('.workbench-dock-pane')].map(pane => ({
          selected: pane.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
          close: pane.querySelector('.workbench-tool-panel-close')?.getAttribute('aria-label'),
        })),
      });
      document.addEventListener('keydown', event => {
        const tab = event.target.getAttribute('data-tool-tab');
        if (!tab || !['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        record('keydown', event.key, tab);
        queueMicrotask(() => record('microtask', event.key, tab));
        requestAnimationFrame(() => record('frame', event.key, tab));
      }, true);
      document.addEventListener('focusin', event => {
        const tab = event.target.getAttribute('data-tool-tab');
        if (tab) record('focusin', null, tab);
      }, true);
    });
    await page.getByRole('button', { name: 'Select Grid', exact: true }).click();
    const beforeKeyboard = await saved(page);
    // Deliver a burst before the next animation frame. Each event must target
    // the tab reached by its predecessor, including wraparound at either end.
    const rapid = await page.evaluate(() => {
      document.querySelector('[data-tool-tab="Layers"]').focus();
      return ['End', 'ArrowLeft', 'ArrowLeft', 'Home', 'ArrowLeft', 'ArrowRight'].map(key => {
        const target = document.activeElement;
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        return { key, target: target.dataset.toolTab, focus: document.activeElement?.dataset.toolTab };
      });
    });
    await writeFile(`${output}/shape-keyboard-burst.json`, JSON.stringify(rapid, null, 2));
    assert.deepEqual(rapid, [
      { key: 'End', target: 'Layers', focus: 'Info' },
      { key: 'ArrowLeft', target: 'Info', focus: 'FX' },
      { key: 'ArrowLeft', target: 'FX', focus: 'Shape' },
      { key: 'Home', target: 'Shape', focus: 'Layers' },
      { key: 'ArrowLeft', target: 'Layers', focus: 'Info' },
      { key: 'ArrowRight', target: 'Info', focus: 'Layers' },
    ]);
    await page.getByRole('tab', { name: 'Layers', exact: true }).focus();
    await page.keyboard.press('End'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    let panel = page.locator('.workbench-tool-dock');
    await panel.getByRole('textbox', { name: 'Shape name', exact: true }).waitFor();
    await drag(page, panel.locator('[data-edge="w"]'), 40, 0);
    const checkTab = async name => {
      const target = page.getByRole('tab', { name, exact: true });
      const tab = await target.boundingBox();
      const strip = await page.getByRole('tablist', { name: 'Artwork tools' }).boundingBox();
      assert.ok(tab.x >= strip.x - 1 && tab.x + tab.width <= strip.x + strip.width + 1, `${name} is scrolled into view`);
      assert.equal(await target.getAttribute('aria-selected'), 'true');
      assert.equal(await target.evaluate(node => node === document.activeElement), true, `${name} owns keyboard focus`);
      assert.equal(await panel.locator('.workbench-tool-panel-close').getAttribute('aria-label'), `Close ${name === 'Layers' ? 'Workbench Layers' : name}`);
    };
    await checkTab('Shape');
    await page.getByRole('tab', { name: 'Shape', exact: true }).focus(); await page.keyboard.press('Home');
    await checkTab('Layers'); await page.keyboard.press('End'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await checkTab('Shape');
    const bounds = await panel.boundingBox(), close = await panel.getByRole('button', { name: 'Close Shape', exact: true }).boundingBox();
    assert.ok(close.x >= bounds.x && close.x + close.width <= bounds.x + bounds.width);
    assert.deepEqual(await saved(page), beforeKeyboard, 'tab navigation and dock resizing do not author Shape content');
    await page.screenshot({ path: `${output}/shape-keyboard-overflow.png` });
    assert.equal(await panel.getByRole('checkbox', { name: 'Show shape', exact: true }).count(), 0);
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Reopen Grid', exact: true }).click();
    await page.locator('[data-workbench-view-id="shape:grid"]').waitFor();
    panel = await openSharedTool(page, 'Shape');
    await field(panel, 'Grid spacing', 35);
    let draft = await saved(page);
    assert.equal(draft.shapes.find(item => item.id === 'shape:grid').grid.spacing, 35);
    assert.equal(draft.workbench.shapes.find(item => item.id === 'shape:grid').window.width % 35, 0);
    await undo(page); assert.equal(await panel.getByRole('spinbutton', { name: 'Grid spacing', exact: true }).inputValue(), '24');
    await field(panel, 'Grid spacing', 0); assert.equal(await panel.getByRole('spinbutton', { name: 'Grid spacing', exact: true }).inputValue(), '24');
    await field(panel, 'Line width', 2.5);
    await panel.getByRole('checkbox', { name: 'Snap to this grid', exact: true }).uncheck();
    draft = await saved(page);
    assert.deepEqual(draft.shapes.find(item => item.id === 'shape:grid').grid, { spacing: 24, lineWidth: 2.5, snap: false });
    await page.screenshot({ path: `${output}/shape-carbon-grid.png` });
    const beforeVisibility = await saved(page);
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Hide Grid in editor', exact: true }).click();
    assert.equal(await page.locator('[data-workbench-view-id="shape:grid"]').isVisible(), false);
    await page.getByRole('button', { name: 'Show Grid in editor', exact: true }).click();
    assert.equal(await page.locator('[data-workbench-view-id="shape:grid"]').isVisible(), true);
    assert.deepEqual(await saved(page), beforeVisibility, 'Layers visibility does not change publication or authored data');
    panel = await openSharedTool(page, 'Shape');
    assert.equal(await panel.getByRole('textbox', { name: 'Shape name', exact: true }).inputValue(), 'Grid');

    await panel.getByRole('combobox', { name: 'Selected shape', exact: true }).selectOption('shape:texture');
    await field(panel, 'Noise strength (%)', 40); await field(panel, 'Noise scale', 3);
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Reopen Texture', exact: true }).click();
    panel = await openSharedTool(page, 'Shape');
    draft = await saved(page);
    assert.equal(draft.shapes.find(item => item.id === 'shape:texture').opacity, .4);
    assert.equal(draft.shapes.find(item => item.id === 'shape:texture').texture.scale, 3);
    assert.equal(draft.shapes.find(item => item.id === 'shape:grid').grid.lineWidth, 2.5);
    await drag(page, panel.locator('[data-edge="s"]'), 0, -180);
    await panel.getByRole('checkbox', { name: 'Include in publication', exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await panel.locator('.workbench-tools-body').evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight > node.clientHeight), true);
    await page.screenshot({ path: `${output}/shape-carbon-texture.png` });
    assert.deepEqual(errors, []);
  } finally {
    try {
      if (page) await withinDeadline((async () => {
        await writeFile(`${output}/shape-keyboard-trace.json`, JSON.stringify(await page.evaluate(() => window.shapeKeyboardTrace || []), null, 2));
        await page.screenshot({ path: `${output}/shape-keyboard-final.png`, timeout: 4000 });
      })(), 5000, 'Shape diagnostics exceeded their deadline');
    } catch (error) {
      console.warn(`Shape diagnostics unavailable: ${error.message}`);
    } finally { await browser.close(); }
  }
});
