import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, detachTool } from './fixtures/shared-tools.mjs';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/fx-tools';
const saved = page => page.evaluate(() => window.savedDraft());
const undo = async page => { await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); };
const paint = page => page.locator('[data-workbench-view-id="shape:landscape"] .shape-paint');
async function zoom(page, scale) {
  const canvas = page.locator('main.system-workflow');
  for (let i = 0; i < 12; i++) {
    const current = await paint(page).evaluate(node => Number(getComputedStyle(node).getPropertyValue('--workbench-content-scale')) / devicePixelRatio);
    if (Math.abs(current - scale) < 1e-7) return;
    await canvas.dispatchEvent('wheel', { deltaY: Math.max(-100, Math.min(100, -Math.log(scale / current) / .003)), ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  throw Error('Camera did not reach the requested scale');
}
async function beginDrag(page, slider, fraction) {
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + 8, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2, { steps: 7 });
}

test('FX previews one Shape gesture, commits once, cancels safely, survives docking and renders the same published effect', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountToolDockFixture(page);
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    let fx = await openSharedTool(page, 'FX');
    const original = await saved(page), blur = fx.getByRole('slider', { name: 'FX Blur', exact: true });
    await beginDrag(page, blur, .6);
    assert.match(await paint(page).evaluate(node => getComputedStyle(node).filter), /blur\([1-9]/);
    assert.deepEqual(await saved(page), original, 'live preview is not saved');
    await page.mouse.up();
    assert.ok((await saved(page)).shapes[0].blur > 0);
    await undo(page); assert.deepEqual(await saved(page), original, 'one Undo restores the whole gesture');
    await beginDrag(page, blur, .8); await page.keyboard.press('Escape');
    const blurBox = await blur.boundingBox();
    await page.mouse.move(blurBox.x + blurBox.width * .4, blurBox.y + blurBox.height / 2);
    await page.mouse.up();
    assert.deepEqual(await saved(page), original); assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), 'none');
    await beginDrag(page, blur, .7); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
    assert.deepEqual(await saved(page), original);
    await beginDrag(page, blur, .5); await page.keyboard.press('Tab'); await page.mouse.up();
    assert.deepEqual(await saved(page), original, 'leaving the slider cancels an unfinished gesture');
    await beginDrag(page, blur, .5);
    await fx.getByRole('button', { name: 'Close FX', exact: true }).dispatchEvent('click');
    await page.mouse.up();
    assert.deepEqual(await saved(page), original, 'closing FX cancels an unfinished gesture');
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), 'none');
    fx = await openSharedTool(page, 'FX');

    const grain = fx.getByRole('slider', { name: 'FX Grain', exact: true });
    await grain.focus(); await grain.press('End');
    assert.equal((await saved(page)).shapes[0].grain, 1);
    await undo(page); assert.deepEqual(await saved(page), original);
    await blur.focus(); await blur.press('End');
    assert.equal((await saved(page)).shapes[0].blur, 12);
    await zoom(page, .5);
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), 'blur(6px)');
    await zoom(page, 1);
    const frame = page.locator('[data-workbench-view-id="shape:landscape"]');
    const paintBounds = await paint(page).boundingBox(), frameBounds = await frame.boundingBox();
    assert.equal(paintBounds.height, frameBounds.height, 'the paint wrapper retains the full artwork extent');
    assert.equal(await frame.evaluate(node => getComputedStyle(node).filter), 'none', 'selection bounds do not blur');
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node.parentElement).overflow), 'visible', 'soft edges are not clipped');
    await detachTool(page, 'FX');
    const beforeRetarget = await saved(page);
    await beginDrag(page, fx.getByRole('slider', { name: 'FX Blur' }), .4);
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).dispatchEvent('click');
    await page.mouse.up();
    assert.deepEqual(await saved(page), beforeRetarget, 'retargeting cannot save the departing preview');
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), 'blur(12px)');
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await page.screenshot({ path: `${output}/fx-mist-independent.png` });
    await fx.getByRole('tab', { name: 'FX', exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Dock with Layers, Transform, Color, Image, Shape and Info', exact: true }).click();
    await fx.getByRole('button', { name: 'Close FX', exact: true }).click();
    fx = await openSharedTool(page, 'FX');
    assert.equal(await fx.getByRole('slider', { name: 'FX Blur' }).inputValue(), '12');
    await page.screenshot({ path: `${output}/fx-mist-docked.png` });
    const finalShape = (await saved(page)).shapes[0];
    await page.reload();
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await openSharedTool(page, 'FX');
    assert.equal(await page.getByRole('slider', { name: 'FX Blur' }).inputValue(), '12');
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const draft = window.savedDraft();
      const document = buildProfileDocumentV9({ profileAddress: window.fixtureProfile, systemWorkflowDraft: draft, assetRecords: [] });
      window.leaveEditor();
      createRoot(globalThis.document.getElementById('root')).render(React.createElement(Visitor, { document }));
    });
    await paint(page).waitFor();
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), `blur(${finalShape.blur}px)`);
    assert.equal(await page.getByRole('slider', { name: 'FX Blur' }).count(), 0);
    await page.screenshot({ path: `${output}/fx-visitor.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('FX keeps failed edits recoverable, clears stale targets and fits a compact Carbon dock', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 760, height: 620 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await mountToolDockFixture(page, { shapes: true, carbon: true });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const fx = await openSharedTool(page, 'FX'), original = await saved(page);
    await page.evaluate(() => {
      window.originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.startsWith('inscape.system-workflow-draft.')) throw Error('full'); return window.originalSetItem.call(this, key, value); };
    });
    const blur = fx.getByRole('slider', { name: 'FX Blur', exact: true });
    await blur.focus(); await blur.press('End'); await fx.getByRole('alert').waitFor();
    assert.deepEqual(await saved(page), original);
    assert.equal(await blur.inputValue(), '0');
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), 'none');
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
    await blur.press('End'); assert.equal((await saved(page)).shapes[0].blur, 12);
    assert.equal(await paint(page).evaluate(node => getComputedStyle(node).filter), 'blur(24px)', 'paint accounts for the high-density window transform');
    await fx.getByRole('alert').waitFor({ state: 'detached' });
    await page.locator('main.system-workflow').focus();
    await page.screenshot({ path: `${output}/fx-carbon-narrow.png`, scale: 'css' });
    await page.locator('[data-image-module="image:body"] .image-module__canvas').click({ position: { x: 20, y: 20 } });
    await fx.getByText('Select one Shape to edit its effects.').waitFor();
    assert.equal(await fx.getByRole('slider').count(), 0);
    await openSharedTool(page, 'Layers');
    await page.getByRole('button', { name: 'Select Grid', exact: true }).click();
    await openSharedTool(page, 'FX');
    assert.equal(await fx.getByRole('slider', { name: 'FX Grain' }).count(), 0, 'Grid retains its existing pattern model');
    assert.equal(await fx.getByRole('slider', { name: 'FX Blur' }).isDisabled(), true);
    await fx.getByRole('button', { name: 'Open artwork', exact: true }).click();
    await fx.getByRole('slider', { name: 'FX Blur' }).focus(); await fx.getByRole('slider', { name: 'FX Blur' }).press('End');
    assert.equal((await saved(page)).shapes.find(item => item.id === 'shape:grid').blur, 12);
    assert.equal((await saved(page)).shapes[0].blur, 12);
  } finally { await browser.close(); }
});
