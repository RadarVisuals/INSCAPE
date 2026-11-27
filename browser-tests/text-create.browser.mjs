import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} / ${b}`);
const readCamera = page => page.locator('main.system-workflow').evaluate(host => {
  const bounds = host.getBoundingClientRect();
  return { scale: Number(host.dataset.workbenchCameraScale), offset: {
    x: bounds.left + Number(host.dataset.workbenchCameraX), y: bounds.top + Number(host.dataset.workbenchCameraY),
  } };
});

test('Add Text uses the context-menu invocation point through pan, zoom, undo and reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await setWorkbenchZoom(page, .5);
    const beforePan = await page.locator('aside.text-window').boundingBox();
    await page.locator('main.system-workflow').focus(); await page.keyboard.down('Space');
    await page.mouse.move(1380, 800); await page.mouse.down();
    await page.mouse.move(1180, 700, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
    const seed = await page.locator('aside.text-window').boundingBox();
    const { offset } = await readCamera(page);
    assert.ok(seed.x - beforePan.x < -100, 'the gesture pans the canvas left from its fitted starting view');
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
    const { scale: restoredScale, offset: restoredOffset } = await readCamera(page);
    near(restored.x, record.window.left * restoredScale + restoredOffset.x);
    near(restored.y, record.window.top * restoredScale + restoredOffset.y);
    assert.deepEqual(await page.evaluate(id => window.savedDraft().workbench.texts.find(t => t.id === id), record.id), record);
    // A menu repositioned to fit near the viewport edge keeps its original
    // invocation point, rather than using its own clamped menu coordinates.
    await text.getByLabel('Move Text window', { exact: true }).focus();
    await page.locator('.workbench-tool-dock:has([data-text-inspector])').getByRole('button', { name: 'Close Inspector', exact: true }).click();
    const camera = await readCamera(page);
    const edge = { x: 1420, y: 800 };
    await page.mouse.click(edge.x, edge.y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'TEXT', exact: true }).click();
    await page.waitForFunction(() => window.savedDraft().texts.length === 3);
    const last = await page.evaluate(() => { const d = window.savedDraft(); return d.workbench.texts.find(t => t.id === d.texts[2].id); });
    const area = await page.evaluate(() => window.savedDraft().workbench.area || { left: 0, top: 0, width: 2000, height: 4000 });
    const originX = area.left || 0, originY = area.top || 0;
    near(last.window.left, Math.max(originX + 8, Math.min(originX + area.width - 8 - last.window.width, (edge.x - camera.offset.x) / camera.scale)));
    near(last.window.top, Math.max(originY + 8, Math.min(originY + area.height - 8 - last.window.height, (edge.y - camera.offset.y) / camera.scale)));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
