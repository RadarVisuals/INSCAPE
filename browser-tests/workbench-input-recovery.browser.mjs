import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { resetCameraTestView } from './fixtures/workbench-camera-test.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const state = page => page.locator('main.system-workflow').evaluate(n => ({ x: n.style.getPropertyValue('--workbench-pan-x'), y: n.style.getPropertyValue('--workbench-pan-y'),
  zoom: n.querySelector('.workbench-view-controls button[aria-label="Reset Workbench zoom to 100%"]')?.textContent }));

async function prepareNavigation(page) {
  await resetCameraTestView(page, false);
}

test('Workbench pan and zoom recover from a missing selection release after editing Text', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await prepareNavigation(page);
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await body.fill('The workbench remains usable after writing. '.repeat(20));
    await body.press('Control+A'); await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await page.getByRole('tab', { name: 'Layout', exact: true }).click();
    await page.getByLabel('Text columns', { exact: true }).selectOption('2');
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const saved = await page.evaluate(() => window.savedDraft());
    const host = page.locator('main.system-workflow');
    const point = { x: 1360, y: 850 };
    assert.ok(await page.evaluate(p => document.elementFromPoint(p.x, p.y).matches('main.system-workflow'), point));
    // Omit pointerup/cancel to model a release missed outside the browser.
    await host.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: point.x, clientY: point.y });
    const before = await state(page);
    await host.dispatchEvent('wheel', { deltaY: 100, buttons: 0, clientX: point.x, clientY: point.y }); await settle(page);
    assert.notEqual((await state(page)).y, before.y, 'released mouse must not leave canvas panning locked');
    await host.dispatchEvent('wheel', { deltaY: -100, ctrlKey: true, buttons: 0, clientX: point.x, clientY: point.y }); await settle(page);
    assert.notEqual((await state(page)).zoom, before.zoom, 'zoom works without Escape or reload');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'recovery never rewrites article or layout');
    await resetCameraTestView(page, false);
    await host.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: point.x, clientY: point.y });
    await host.focus(); await page.keyboard.down('Space');
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x - 100, point.y - 50, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Space'); await settle(page);
    assert.equal((await state(page)).x, '-100px'); assert.equal((await state(page)).y, '-50px');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('selection captures its pointer, cancels on lost capture, and does not block later zoom', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await mountTextToolsFixture(page, origin);
    await prepareNavigation(page);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const host = page.locator('main.system-workflow');
    await page.mouse.move(1360, 850); await page.mouse.down(); await page.mouse.move(1240, 780, { steps: 4 });
    assert.equal(await host.evaluate(n => n.hasPointerCapture(1)), true, 'selection owns capture across browser boundaries');
    const held = await state(page); await page.mouse.wheel(0, 100); await settle(page);
    assert.deepEqual(await state(page), held, 'wheel cannot pan during a held selection');
    assert.equal(await host.evaluate(n => n.hasPointerCapture(1)), true, 'a held pointer remains captured');
    await host.evaluate(n => n.releasePointerCapture(1));
    await page.mouse.move(1220, 760); await settle(page);
    assert.equal(await page.locator('.workbench-marquee').count(), 0, 'lost capture cancels the transient selection');
    await page.mouse.up();
    const before = await state(page);
    await page.mouse.move(1360, 850); await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await settle(page);
    assert.notEqual((await state(page)).zoom, before.zoom);
  } finally { await browser.close(); }
});
