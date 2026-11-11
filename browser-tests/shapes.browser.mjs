import { setSharedColor, setTransform, openSharedTool, chooseSharedShape } from './fixtures/shared-tools.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { artworkCommand, artworkHeader } from './fixtures/artwork-menu.mjs';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} / ${b}`);
async function actualCoordinates(page) {
  // Entry now frames the whole canvas; this geometry test deliberately uses
  // 100% and an unpanned camera before comparing screen and authored positions.
  await page.locator('main.system-workflow').focus();
  await setWorkbenchZoom(page, 1);
  const pan = await page.evaluate(() => {
    const rect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
    const frame = window.savedDraft().workbench.display.window;
    return { deltaX: rect.left - frame.left, deltaY: rect.top - frame.top, bubbles: true, cancelable: true };
  });
  await page.locator('main.system-workflow').dispatchEvent('wheel', pan); await settle(page);
}

test('Shapes create at cursor, resize, layer beneath content, recover covered shapes, persist and preview', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await actualCoordinates(page);
    await page.mouse.click(560, 240, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'SHAPE', exact: true }).click();
    await page.locator('aside.shape-window').waitFor();
    const id = await page.evaluate(() => window.savedDraft().shapes[0].id);
    const shape = page.locator(`aside[data-workbench-view-id="${id}"]`);
    await openSharedTool(page, 'Shape');
    const tools = page.locator('section.shape-inspector-properties'); await tools.waitFor();
    const created = await shape.boundingBox(); near(created.x, 560); near(created.y, 240);
    await setSharedColor(page, '#ff6600');
    await openSharedTool(page, 'Shape');
    assert.equal(await tools.getByRole('slider', { name: 'Grain strength', exact: true }).count(), 0);
    assert.equal(await tools.getByRole('checkbox', { name: 'Show shape', exact: true }).count(), 0);
    await setTransform(page, 'Width', 700); await setTransform(page, 'Height', 450);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click(); await settle(page);
    near((await shape.boundingBox()).width, 700);
    const fill = await shape.locator('.shape-fill').boundingBox();
    near(fill.width, 700); near(fill.height, 450);
    assert.equal(await shape.locator('.shape-fill').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 102, 0)');
    assert.ok(await page.evaluate(() => Boolean(document.elementFromPoint(1000, 300)?.closest('.system-workflow__presentation-board'))), 'Display stays above shapes too');
    // Move the background partly under the text, through the same direct drag.
    await page.keyboard.down('Alt'); await page.mouse.move(1100, 620); await page.mouse.down();
    await page.mouse.move(640, 660, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
    const moved = await shape.boundingBox(); near(moved.x, 100); near(moved.y, 280);
    // Workbench selection owns its drag overlay; inspect the content stack
    // after leaving that temporary interaction, as a reader would.
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Escape');
    await page.locator('.workbench-selection').waitFor({ state: 'detached' });
    const overlap = await page.evaluate(() => ({ hit: document.elementFromPoint(350, 400)?.outerHTML.slice(0, 600),
      text: document.querySelector('.text-window')?.getBoundingClientRect().toJSON(),
      above: Boolean(document.elementFromPoint(350, 400)?.closest('.text-window')) }));
    assert.ok(overlap.above, `Text stays above the selected shape: ${JSON.stringify(overlap)}`);
    // Escape clears artwork selection; choose the Shape again before editing it.
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Select Shape 1', exact: true }).click();
    await page.getByRole('button', { name: 'Close Workbench Layers', exact: true }).click();
    await openSharedTool(page, 'Shape');
    await artworkCommand(page, await page.evaluate(() => window.savedDraft().shapes[0].id), 'Duplicate');
    await page.waitForFunction(() => window.savedDraft().shapes.length === 2);
    const duplicate = await page.evaluate(() => window.savedDraft().shapes[1].id);
    assert.equal(await page.evaluate(() => window.savedDraft().shapes[1].color), '#ff6600', 'duplication retains appearance');
    await setSharedColor(page, '#0055ff');
    await artworkCommand(page, duplicate, 'Send to back');
    await page.waitForFunction(id => window.savedDraft().artworkLayers[0] === id, duplicate);
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Escape');
    await page.locator('.workbench-selection').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.elementFromPoint(500, 400)?.closest('[data-workbench-view-id]')?.dataset.workbenchViewId), id);
    // Escape cleared the artwork selection; shared settings follow selection.
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Select Shape 1 copy', exact: true }).click();
    await page.getByRole('button', { name: 'Close Workbench Layers', exact: true }).click();
    await openSharedTool(page, 'Shape');
    await tools.getByRole('button', { name: /^Selected shape:/ }).focus();
    const squareWidth = await page.evaluate(id => window.savedDraft().workbench.shapes.find(s => s.id === id).window.width, duplicate);
    await setTransform(page, 'Height', squareWidth);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await page.waitForFunction(id => { const w = window.savedDraft().workbench.shapes.find(s => s.id === id).window; return w.width === w.height; }, duplicate);
    // Dimensions follow pointer resize, not only numeric fields.
    await openSharedTool(page, 'Shape');
    await chooseSharedShape(page, await page.evaluate(id => `${window.savedDraft().shapes.find(shape => shape.id === id).name} · Rectangle`, id));
    // The chooser also selects the Shape for proportional Workbench scaling.
    // Clear that selection from the Workbench before testing its solo grip.
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Escape');
    await page.locator('.workbench-selection').waitFor({ state: 'detached' });
    for (const name of ['Close Inspector']) {
      const close = page.getByRole('button', { name, exact: true });
      if (await close.count()) await close.press('Enter');
    }
    await artworkHeader(page, id).focus(); await settle(page);
    const handle = page.locator(`[data-detached-window][data-workbench-view-id="${id}"], .workbench-window-controls:has(header[data-workbench-view-id="${id}"])`).getByRole('separator', { name: 'Resize Shape window', exact: true });
    assert.equal(await handle.evaluate(node => {
      const b = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
    }), true, 'the solo Shape grip is exposed before dragging');
    const box = await handle.boundingBox(); await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await settle(page); near((await shape.boundingBox()).width, 740);
    // A covered shape remains reachable through the Workbench menu. Open the
    // host's keyboard menu so a floating Navigator cannot intercept the click.
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'SHAPES', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Shape 1', exact: true }).first().click();
    await openSharedTool(page, 'Shape'); await tools.waitFor();
    await page.screenshot({ path: '.browser-test-runtime/shapes-wide.png' });
    await setWorkbenchZoom(page, .5); await settle(page);
    near((await shape.boundingBox()).width, 370);
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    const panel = await (await openSharedTool(page, 'Shape')).boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 391); assert.ok(panel.y + panel.height <= 845);
    await page.screenshot({ path: '.browser-test-runtime/shapes-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload(); await mountTextToolsFixture(page, origin); await shape.waitFor(); await actualCoordinates(page);
    near((await shape.boundingBox()).width, 740); near((await shape.boundingBox()).x, moved.x);
    // Actual public renderer uses the same geometry/order with no editing tools.
    await mountTextToolsFixture(page, origin, { visitor: true }); await shape.waitFor();
    assert.equal(await shape.locator('.shape-fill').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 102, 0)');
    await page.screenshot({ path: '.browser-test-runtime/shapes-visitor.png' });
    near((await shape.boundingBox()).width, 740);
    assert.equal(await page.locator('section.shape-inspector-properties').count(), 0);
    assert.equal(await shape.getByRole('separator').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
