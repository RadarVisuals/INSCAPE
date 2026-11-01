import { editorCommand, editorOverview } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/composition-index';
async function prepare(page, path = '/browser-tests/composition-index-fixture.html') {
  page.setDefaultTimeout(15000);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    return route.abort();
  });
  await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
}
const camera = page => page.locator('.composition-explorer-viewport').evaluate(node => ({
  scale: Number(node.dataset.cameraScale), x: Number(node.dataset.cameraX), y: Number(node.dataset.cameraY), width: node.clientWidth, height: node.clientHeight,
}));
async function failWrites(page, fail) {
  await page.evaluate(fail => {
    window.normalSetItem ||= Storage.prototype.setItem;
    Storage.prototype.setItem = fail ? function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw new DOMException('Full', 'QuotaExceededError');
      return window.normalSetItem.call(this, key, value);
    } : window.normalSetItem;
  }, fail);
}
const near = (a, b, message) => assert.ok(Math.abs(a - b) < .02, `${message}: ${a} / ${b}`);

test('desktop index explores real artwork, retains each camera and never edits its input', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await prepare(page);
    const host = page.locator('.composition-explorer-viewport'); await host.waitFor();
    await page.waitForFunction(() => Number(document.querySelector('.composition-explorer-viewport')?.dataset.cameraScale) > 0);
    await page.locator('.composition-explorer-viewport img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const saved = await page.evaluate(() => JSON.stringify(window.reviewEntries));
    const first = await camera(page), bounds = await host.boundingBox();
    await page.getByRole('button', { name: 'Open Abyssal Study', exact: true }).hover();
    assert.equal(await page.locator('.composition-explorer-heading h1').innerText(), 'Lunar Desert', 'hover does not replace a work being explored');
    await host.focus(); await page.keyboard.down('Space');
    await page.mouse.move(bounds.x + 400, bounds.y + 200); await page.mouse.down();
    await page.mouse.move(bounds.x + 490, bounds.y + 255, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Space');
    const moved = await camera(page); near(moved.x, first.x + 90, 'Space drag x'); near(moved.y, first.y + 55, 'Space drag y');
    const wheelX = Math.round(bounds.x + 300), wheelY = Math.round(bounds.y + 150), anchorX = wheelX - bounds.x;
    await host.dispatchEvent('wheel', { ctrlKey: true, deltaY: -110, clientX: wheelX, clientY: wheelY, bubbles: true, cancelable: true });
    await page.waitForFunction(scale => Number(document.querySelector('.composition-explorer-viewport').dataset.cameraScale) > scale, moved.scale);
    const zoomed = await camera(page); assert.ok(zoomed.scale > moved.scale);
    near((anchorX - zoomed.x) / zoomed.scale, (anchorX - moved.x) / moved.scale, 'zoom remains under cursor');
    await page.getByRole('button', { name: 'Open Abyssal Study', exact: true }).click();
    await page.getByRole('button', { name: 'Open Lunar Desert', exact: true }).click();
    assert.deepEqual(await camera(page), zoomed, 'switching works restores the camera');
    await page.getByRole('button', { name: 'Expand canvas', exact: true }).click();
    await page.waitForFunction(previous => {
      const node = document.querySelector('.composition-explorer-viewport');
      return Math.abs((node.clientWidth / 2 - Number(node.dataset.cameraX)) / Number(node.dataset.cameraScale) - (previous.width / 2 - previous.x) / previous.scale) < .02;
    }, zoomed);
    const expanded = await camera(page);
    near((expanded.width / 2 - expanded.x) / expanded.scale, (zoomed.width / 2 - zoomed.x) / zoomed.scale, 'expansion preserves world centre');
    assert.equal(await page.getByRole('navigation', { name: 'Canvases' }).isVisible(), false);
    await page.keyboard.press('Escape'); await page.getByRole('navigation', { name: 'Canvases' }).waitFor();
    await page.getByRole('combobox', { name: 'Camera point', exact: true }).selectOption('workbench-view:detail');
    assert.equal(await page.getByRole('combobox', { name: 'Camera point', exact: true }).inputValue(), 'workbench-view:detail');
    await host.focus(); await page.keyboard.press('Home');
    near((await camera(page)).scale, first.scale, 'Home returns to whole composition');
    await page.getByText('Artwork sources', { exact: false }).first().click();
    await page.getByRole('combobox', { name: 'Artwork source', exact: true }).selectOption({ index: 1 });
    await page.locator('.composition-explorer-dossier').waitFor();
    assert.ok(await page.locator('.canvas-presentation-highlight').count());
    assert.equal(await page.locator('.composition-explorer-viewport [contenteditable="true"], .composition-explorer-viewport iframe').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.reviewEntries)), saved);
    await page.getByRole('combobox', { name: 'Artwork source', exact: true }).selectOption('');
    await page.getByText('Artwork sources', { exact: false }).first().click();
    await mkdir(output, { recursive: true });
    for (const width of [1920, 1440, 1024]) {
      await page.setViewportSize({ width, height: 1080 }); await page.evaluate(() => document.fonts.ready);
      await page.locator('.workbench-overview').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: `${output}/index-${width}.png`, fullPage: true });
      assert.ok(await page.locator('.workbench-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    }
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('desktop owner index keeps browsing separate from activation and save failures', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await prepare(page, '/browser-tests/workbench-storage-fixture.html?seed=1&shell=1');
    await editorOverview(page);
    await page.locator('.composition-explorer-viewport').waitFor();
    const originalId = await page.evaluate(() => window.savedDraft().activeId);
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel('Canvas name', { exact: true }).fill('Lunar Desert');
    await page.getByLabel(/Introduction/).fill('A saved description.');
    await failWrites(page, true);
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /Could not save/);
    assert.equal(await page.getByLabel(/Introduction/).inputValue(), 'A saved description.');
    await failWrites(page, false);
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.getByRole('heading', { name: 'Lunar Desert', exact: true }).waitFor();
    await page.getByRole('menuitem', { name: 'My Inscape', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New canvas', exact: true }).click();
    await page.getByLabel('Canvas name', { exact: true }).fill('Studies');
    await page.getByRole('button', { name: 'Create canvas', exact: true }).click();
    await page.getByRole('heading', { name: 'Studies', exact: true }).waitFor();
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await page.getByRole('button', { name: 'Open Lunar Desert', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
    assert.equal(await page.locator('.workbench-overview-introduction').innerText(), 'A saved description.');
    await failWrites(page, true);
    await page.getByRole('button', { name: 'Edit canvas', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /Could not save/);
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
    await failWrites(page, false);
    await page.getByRole('button', { name: 'Edit canvas', exact: true }).click();
    await page.locator('.text-window').waitFor();
    assert.equal(await page.evaluate(() => window.savedDraft().activeId), originalId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await editorOverview(page);
    await page.getByRole('heading', { name: 'Lunar Desert', exact: true }).waitFor();
    assert.equal(await page.locator('.workbench-overview-introduction').innerText(), 'A saved description.');
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel(/Introduction/).fill('');
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Edit details');
    assert.equal(await page.locator('.workbench-overview-introduction').count(), 0);
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel('Canvas name', { exact: true }).fill('Discard this name');
    await page.getByLabel('Canvas name', { exact: true }).press('Escape');
    await page.getByRole('heading', { name: 'Lunar Desert', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reception', exact: true }).click();
    await page.getByText('Published view requested', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('My Inscape opens the Reception editor in the same session without changing its canvases', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await prepare(page, '/browser-tests/workbench-storage-fixture.html?seed=1&shell=1');
    await editorOverview(page);
    await page.locator('.composition-index').waitFor();
    assert.equal(await page.locator('.composition-index-brand').innerText(), 'My Inscape');
    const before = await page.evaluate(() => window.savedDraft());
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/my-inscape-reception-entry.png`, fullPage: true });
    await page.getByRole('menuitem', { name: 'My Inscape', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit Reception', exact: true }).click();
    await page.locator('[data-reception-editor]').waitFor();
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    const saved = await page.evaluate(() => window.savedDraft());
    assert.equal(saved.activeId, before.activeId, 'Reception editing never activates another canvas');
    assert.deepEqual(saved.workbenches, before.workbenches, 'Reception editing preserves all canvas content');
    await editorOverview(page);
    await page.locator('.composition-index').waitFor();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.getByRole('heading', { name: 'My Inscape', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('menuitem', { name: 'My Inscape', exact: true }).click();
    await page.screenshot({ path: `${output}/my-inscape-reception-entry-390.png`, fullPage: true });
    await page.getByRole('menuitem', { name: 'Edit Reception', exact: true }).click();
    await page.locator('[data-reception-editor]').waitFor();
    assert.equal(await page.getByRole('alert').count(), 0, 'returning reacquires the Reception scope without losing the editor lease');
    await editorOverview(page);
    await page.getByRole('heading', { name: 'My Inscape', exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.savedDraft().workbenches), before.workbenches);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
