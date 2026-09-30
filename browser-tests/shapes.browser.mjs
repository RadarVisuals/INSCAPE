import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} / ${b}`);

test('Shapes create at cursor, resize, layer beneath content, recover covered shapes, persist and preview', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await page.mouse.click(560, 240, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'SHAPE', exact: true }).click();
    await page.locator('.shape-window').waitFor();
    const id = await page.evaluate(() => window.savedDraft().shapes[0].id);
    const shape = page.locator(`[data-workbench-view-id="${id}"]`);
    const tools = page.locator('.shape-tools'); await tools.waitFor();
    const created = await shape.boundingBox(); near(created.x, 560); near(created.y, 240);
    await tools.getByLabel('Shape colour').fill('#ff6600');
    const flat = await shape.locator('.shape-fill').screenshot();
    const grain = tools.getByRole('slider', { name: 'Grain strength', exact: true });
    await grain.focus(); await grain.press('End');
    await page.waitForFunction(() => window.savedDraft().shapes[0].grain === 1);
    await shape.locator('.module-surface-grain').evaluate(async node => {
      const image = new Image(); image.src = getComputedStyle(node).backgroundImage.slice(5, -2); await image.decode();
    });
    assert.notDeepEqual(await shape.locator('.shape-fill').screenshot(), flat, 'the texture visibly changes the fill');
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !Object.hasOwn(window.savedDraft().shapes[0], 'grain'));
    assert.equal(await shape.locator('.module-surface-grain').count(), 0);
    await page.keyboard.press('Control+Shift+z'); await shape.locator('.module-surface-grain').waitFor();
    await tools.getByLabel('Shape width', { exact: true }).fill('700');
    await tools.getByLabel('Shape height', { exact: true }).fill('450');
    await tools.getByRole('button', { name: 'Apply size', exact: true }).click(); await settle(page);
    near((await shape.boundingBox()).width, 700);
    const fill = await shape.locator('.shape-fill').boundingBox();
    near(fill.width, 700); near(fill.height, 450);
    assert.equal(await shape.locator('.shape-fill').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 102, 0)');
    assert.ok(await page.evaluate(() => Boolean(document.elementFromPoint(1000, 300)?.closest('.system-workflow__presentation-board'))), 'Display stays above shapes too');
    // Move the background partly under the text, through the same direct drag.
    await page.keyboard.down('Alt'); await page.mouse.move(600, 280); await page.mouse.down();
    await page.mouse.move(140, 320, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
    const moved = await shape.boundingBox(); near(moved.x, 100); near(moved.y, 280);
    assert.ok(await page.evaluate(() => Boolean(document.elementFromPoint(200, 400)?.closest('.text-window'))), 'Text stays above the selected shape');
    await tools.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await page.waitForFunction(() => window.savedDraft().shapes.length === 2);
    const duplicate = await page.evaluate(() => window.savedDraft().shapes[1].id);
    assert.equal(await page.evaluate(() => window.savedDraft().shapes[1].grain), 1, 'duplication retains grain');
    await tools.getByLabel('Shape colour').fill('#0055ff');
    await tools.getByRole('button', { name: 'To back', exact: true }).click();
    await page.waitForFunction(id => window.savedDraft().shapes[0].id === id, duplicate);
    assert.equal(await page.evaluate(() => document.elementFromPoint(500, 400)?.closest('[data-workbench-view-id]')?.dataset.workbenchViewId), id);
    await tools.getByRole('button', { name: 'Make square', exact: true }).click();
    await page.waitForFunction(id => { const w = window.savedDraft().workbench.shapes.find(s => s.id === id).window; return w.width === w.height; }, duplicate);
    // Dimensions follow pointer resize, not only numeric fields.
    await tools.getByLabel('Choose shape').selectOption(id); await page.keyboard.press('Escape');
    const handle = shape.getByRole('separator', { name: 'Resize Shape window', exact: true });
    const box = await handle.boundingBox(); await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await settle(page); near((await shape.boundingBox()).width, 740);
    // A shape behind everything remains reachable through the Workbench menu.
    await page.mouse.click(1380, 800, { button: 'right' });
    await page.getByRole('menuitem', { name: 'SHAPES', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Shape 1', exact: true }).first().click(); await tools.waitFor();
    await page.screenshot({ path: '.browser-test-runtime/shapes-wide.png' });
    await setWorkbenchZoom(page, .5); await settle(page);
    near((await shape.boundingBox()).width, 370);
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    const panel = await page.locator('.context-toolbar').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 391); assert.ok(panel.y + panel.height <= 845);
    await page.screenshot({ path: '.browser-test-runtime/shapes-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload(); await mountTextToolsFixture(page, origin); await shape.waitFor();
    await shape.locator('.module-surface-grain').waitFor();
    near((await shape.boundingBox()).width, 740); near((await shape.boundingBox()).x, moved.x);
    // Actual public renderer uses the same geometry/order with no editing tools.
    await mountTextToolsFixture(page, origin, { visitor: true }); await shape.waitFor();
    await shape.locator('.module-surface-grain').waitFor();
    assert.equal(await shape.locator('.module-surface-grain').evaluate(node => getComputedStyle(node).opacity), '0.3');
    await page.screenshot({ path: '.browser-test-runtime/shapes-visitor-grain.png' });
    near((await shape.boundingBox()).width, 740);
    assert.equal(await page.locator('.shape-tools').count(), 0);
    assert.equal(await shape.getByRole('separator').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
