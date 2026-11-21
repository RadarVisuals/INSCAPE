import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorCommand } from './fixtures/editor-menu.mjs';
import { openSharedTool, closeSharedTool } from './fixtures/shared-tools.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/reception-local-editing';
const reception = page => page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
const frame = (value, id) => value.workbench[id.startsWith('text:') ? 'texts' : 'shapes'].find(item => item.id === id).window;
const targetId = 'shape:tiling-top';
for (const width of [1440, 900]) test(`local additions preview, cancel, save, resize and restore without text drift (${width}px)`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' }), errors = [];
    page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    await page.getByRole('button', { name: 'Back to cell', exact: true }).click();
    const cell = page.getByRole('group', { name: 'Upper text bento cell', exact: true });
    await closeSharedTool(page, 'Inspector');
    const layersClose = page.getByRole('button', { name: 'Close Workbench Layers', exact: true });
    if (await layersClose.isVisible()) await layersClose.click();
    await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click();
    await cell.click({ position: { x: 20, y: 20 } });
    const original = await reception(page), textId = original.cells.find(c => c.id === targetId).members[0];
    const text = page.locator(`.text-window[data-workbench-view-id="${textId}"]`);
    const localInset = async () => {
      const a = await cell.boundingBox(), b = await text.boundingBox();
      return (b.y - a.y) / a.height;
    };
    const inset = await localInset(), trigger = page.getByRole('button', { name: 'Add cell', exact: true });
    const drawPreview = async () => {
      const box = await cell.boundingBox();
      await trigger.click();
      assert.equal(await page.getByRole('listbox', { name: 'Add cell', exact: true }).count(), 0);
      await page.keyboard.down('Shift');
      await page.mouse.move(box.x + box.width * .1, box.y + box.height * .1); await page.mouse.down();
      await page.mouse.move(box.x + box.width * .6, box.y + box.height * .35, { steps: 8 });
      await page.locator('[data-bento-draw-preview]').waitFor();
    };
    await drawPreview();
    assert.deepEqual(await reception(page), original, 'drawing preview does not save');
    // Cell hit regions are intentionally hidden during creation. Read the native
    // shape projection to verify content inset while its cell is pushed aside.
    const projectedInset = async () => {
      const a = await page.locator(`.shape-window[data-workbench-view-id="${targetId}"]`).boundingBox(), b = await text.boundingBox();
      return (b.y - a.y) / a.height;
    };
    assert.ok(Math.abs(await projectedInset() - inset) < .005, 'preview text retains its local inset');
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.keyboard.up('Shift');
    assert.equal(await page.locator('[data-bento-draw-preview]').count(), 0);
    assert.deepEqual(await reception(page), original);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('main[data-reception-editor]').evaluate(node => node.contains(document.activeElement)), true);
    await cell.click({ position: { x: 20, y: 20 } });
    await drawPreview();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/local-draw-preview-${width}.png` });
    await page.mouse.up(); await page.keyboard.up('Shift');
    const saved = await reception(page);
    assert.equal(saved.cells.length, original.cells.length + 1);
    assert.equal(frame(saved, targetId).height, frame(original, targetId).height);
    assert.equal(frame(saved, textId).top - frame(saved, targetId).top, frame(original, textId).top - frame(original, targetId).top);
    assert.equal(frame(saved, textId).height, frame(original, textId).height);
    assert.ok(Math.abs(await localInset() - inset) < .005, 'committed text matches preview');
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), original);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), saved);
    await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click();
    await cell.click({ position: { x: 20, y: 20 } });
    const inspector = await openSharedTool(page, 'Inspector');
    const height = inspector.getByRole('spinbutton', { name: 'Cell height', exact: true });
    await height.fill(String(frame(saved, targetId).height + 80)); await height.press('Enter');
    const resized = await reception(page);
    assert.deepEqual(frame(resized, targetId), { ...frame(saved, targetId), height: frame(saved, targetId).height + 80 });
    assert.deepEqual(frame(resized, textId), frame(saved, textId));
    assert.equal(resized.workbench.area.height, saved.workbench.area.height + 80);
    await closeSharedTool(page, 'Inspector');
    await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click();
    await cell.click({ position: { x: 20, y: 20 } });
    await drawPreview(); await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await page.mouse.up(); await page.keyboard.up('Shift');
    assert.deepEqual(await reception(page), resized, 'failed drawing preserves saved geometry');
    assert.equal(await page.locator('[data-bento-draw-preview]').count(), 0);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.reload(); await cell.waitFor();
    assert.deepEqual(await reception(page), resized);
    await page.screenshot({ path: `${output}/local-add-restored-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
