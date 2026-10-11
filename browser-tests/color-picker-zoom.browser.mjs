import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = page => page.locator('main.system-workflow').evaluate(node => ({
  x: node.style.getPropertyValue('--workbench-pan-x'), y: node.style.getPropertyValue('--workbench-pan-y'),
  zoom: node.querySelector('[aria-label="Reset Workbench zoom to 100%"]').textContent,
}));
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

test('Shape colour changes leave zoom and wheel pan available despite stale wheel buttons', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin, { surfaces: true });
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await page.locator('.shape-fill').click();
    const colour = page.getByLabel('Shape colour', { exact: true });
    await colour.focus(); await colour.fill('#ff6600');
    await page.waitForFunction(() => window.savedDraft().shapes[0].color === '#ff6600');
    const saved = await page.evaluate(() => window.savedDraft());
    const host = page.locator('main.system-workflow');
    const point = { clientX: 1360, clientY: 850 };
    assert.equal(await colour.evaluate(node => document.activeElement === node), true);
    // Model the native picker's stale WheelEvent.buttons without a DOM pointer
    // press. Keep the colour input focused: recovery must not need window blur.
    const before = await camera(page);
    await host.dispatchEvent('wheel', { ...point, deltaY: -100, ctrlKey: true, buttons: 1 }); await settle(page);
    assert.notEqual((await camera(page)).zoom, before.zoom, 'zoom resumes immediately after choosing a colour');
    const zoomed = await camera(page);
    await host.dispatchEvent('wheel', { ...point, deltaY: 100, buttons: 1 }); await settle(page);
    assert.notEqual((await camera(page)).y, zoomed.y, 'ordinary wheel pan also ignores stale wheel buttons');
    await host.dispatchEvent('wheel', { ...point, deltaY: 100, ctrlKey: true, buttons: 1 }); await settle(page);
    assert.equal((await camera(page)).zoom, before.zoom, 'zoom out works too');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'camera recovery preserves colour and authored geometry');
    assert.equal(await colour.evaluate(node => document.activeElement === node), true, 'camera recovery does not steal input focus');
    await page.screenshot({ path: '.browser-test-runtime/shape-colour-zoom-recovery.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('real module drags block wheel camera changes even when wheel reports no buttons', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await mountTextToolsFixture(page, origin, { surfaces: true });
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const shape = page.locator('.shape-window'), bounds = await shape.boundingBox();
    await page.mouse.move(bounds.x + 100, bounds.y + 100); await page.mouse.down();
    await page.mouse.move(bounds.x + 120, bounds.y + 120, { steps: 4 }); await settle(page);
    const before = await camera(page);
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control'); await settle(page);
    assert.deepEqual(await camera(page), before, 'held Shape drag owns input even when WheelEvent.buttons is zero');
    await page.mouse.wheel(0, 100); await settle(page);
    assert.deepEqual(await camera(page), before, 'held Shape drag also blocks wheel pan');
    await page.mouse.up();
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control'); await settle(page);
    assert.notEqual((await camera(page)).zoom, before.zoom, 'normal pointer release restores zoom');
  } finally { await browser.close(); }
});
