import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} / ${b}`);

test('Add Text uses the context-menu invocation point through pan, zoom, undo and reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await setWorkbenchZoom(page, .5);
    await page.locator('main.system-workflow').focus(); await page.keyboard.down('Space');
    await page.mouse.move(1380, 800); await page.mouse.down();
    await page.mouse.move(1180, 700, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
    const seed = await page.locator('.text-window').boundingBox();
    const offset = { x: seed.x - 64 * .5, y: seed.y - 120 * .5 };
    assert.ok(offset.x < -100, 'the fixture has panned away from the origin');
    const point = { x: 1080, y: 780 };
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'TEXT', exact: true }).click();
    await page.waitForFunction(() => window.savedDraft().texts.length === 2);
    const record = await page.evaluate(() => { const draft = window.savedDraft(); return draft.workbench.texts.find(t => t.id === draft.texts[1].id); });
    near(record.window.left, (point.x - offset.x) / .5); near(record.window.top, (point.y - offset.y) / .5);
    const text = page.locator(`[data-text-id="${record.id}"] .text-window`); await text.waitFor(); await settle(page);
    const box = await text.boundingBox(); near(box.x, point.x); near(box.y, point.y);
    await page.screenshot({ path: '.browser-test-runtime/text-created-at-cursor.png' });
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.savedDraft().texts.length === 1);
    assert.equal(await text.count(), 0, 'one Undo removes the new content and window');
    await page.keyboard.press('Control+Shift+z'); await text.waitFor();
    near((await text.boundingBox()).x, point.x);
    await page.reload(); await mountTextToolsFixture(page, origin); await text.waitFor();
    const restored = await text.boundingBox();
    near(restored.x, record.window.left); near(restored.y, record.window.top);
    assert.deepEqual(await page.evaluate(id => window.savedDraft().workbench.texts.find(t => t.id === id), record.id), record);
    // A menu repositioned to fit near the viewport edge keeps its original
    // invocation point, rather than using its own clamped menu coordinates.
    await text.getByLabel('Move Text window', { exact: true }).focus();
    await page.locator('.text-tools-window').getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const edge = { x: 1420, y: 800 };
    await page.mouse.click(edge.x, edge.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'TEXT', exact: true }).click();
    await page.waitForFunction(() => window.savedDraft().texts.length === 3);
    const last = await page.evaluate(() => { const d = window.savedDraft(); return d.workbench.texts.find(t => t.id === d.texts[2].id); });
    near(last.window.left, edge.x); near(last.window.top, edge.y);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
