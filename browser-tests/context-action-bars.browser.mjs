import { routeLocalWorkflowArtwork } from './fixtures/legacy-workflow-artwork.mjs';
import test from 'node:test';
import { artworkCommand } from './fixtures/artwork-menu.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { openSharedTool, sharedToolPanel } from './fixtures/shared-tools.mjs';
import { setEditorSidebarOpen } from './fixtures/editor-menu.mjs';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const draft = page => page.evaluate(() => window.readToolChromeDraft());
const selection = page => page.getByRole('group', { name: 'Selection tools', exact: true });
const inspection = page => page.getByRole('group', { name: 'Inspection and placement', exact: true });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
async function mount(browser, viewport = { width: 1440, height: 1000 }, theme = 'carbon', hasTouch = false) {
  const page = await browser.newPage({ viewport, hasTouch, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await routeLocalWorkflowArtwork(page, origin);
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=actions&theme=${theme}`);
  await page.locator('.image-module__canvas').waitFor();
  await setEditorSidebarOpen(page, false);
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
async function activate(page, kind) {
  if (kind === 'image') await page.locator('.image-module__canvas').first().focus();
  else if (kind === 'shape') {
    const id = (await draft(page)).shapes[0].id;
    await page.locator(`header[data-workbench-view-id="${id}"], [data-detached-window][data-workbench-view-id="${id}"] > header`).focus();
  }
  await settle(page);
  await openSharedTool(page, kind === 'image' ? 'Image' : 'Shape');
}
async function undo(page) {
  await page.locator('main.system-workflow').focus();
  await page.keyboard.press('Control+z'); await settle(page);
}

test('Image and Shape actions follow the active module and retain undo', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, errors } = await mount(browser);
    await activate(page, 'image');
    const image = sharedToolPanel(page);
    assert.equal(await button(image, 'In place').count(), 0);
    assert.equal(await button(image, 'Fit inside').innerText(), 'Fit');
    assert.equal(await button(image, 'Fill canvas').innerText(), 'Fill');
    await button(image, 'Fit inside').click();
    const fittedImage = await draft(page);
    assert.equal(fittedImage.imageModules[0].artwork.crop, null);
    await button(image, 'Fill canvas').click();
    assert.ok((await draft(page)).imageModules[0].artwork.crop.zoom >= 1);
    await undo(page);
    assert.deepEqual(await draft(page), fittedImage, 'Undo restores the real Image fit operation');
    await activate(page, 'image');
    await button(image, 'Fit inside').click();
    assert.equal((await draft(page)).imageModules[0].artwork.crop, null);
    await button(image, 'Rotate').click();
    assert.equal((await draft(page)).imageModules[0].artwork.transform.quarterTurns, 1);
    await undo(page);
    assert.equal((await draft(page)).imageModules[0].artwork.transform.quarterTurns, 0);
    await activate(page, 'shape');
    assert.equal(await inspection(page).count(), 0, 'Shape has no unrelated fit or inspection controls');
    assert.equal(await button(selection(page), 'Rotate').count(), 0);
    await artworkCommand(page, (await draft(page)).shapes[0].id, 'Duplicate');
    assert.equal((await draft(page)).shapes.length, 2);
    await artworkCommand(page, (await draft(page)).shapes.at(-1).id, 'Delete');
    assert.equal((await draft(page)).shapes.length, 1);
    await undo(page);
    assert.equal((await draft(page)).shapes.length, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('crop stays in the module panel, cancels without saving and commits one undoable edit', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, errors } = await mount(browser);
    {
      await activate(page, 'image');
      const before = await draft(page);
      const actions = sharedToolPanel(page);
      const cropPanel = sharedToolPanel(page);
      await button(actions, 'Crop').click();
      const zoom = cropPanel.getByRole('slider', { name: 'Crop zoom' });
      await zoom.waitFor();
      assert.equal(await (actions.locator('.image-inspector-transforms')).count(), 0);
      assert.equal(await page.locator('[data-context-tools] aside').isVisible(), false);
      await zoom.fill('2'); await zoom.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await zoom.evaluate(node => node === document.activeElement), true, 'toolbar arrows do not steal slider input');
      assert.deepEqual(await draft(page), before, 'crop preview never saves');
      await button(cropPanel, 'Cancel').click();
      assert.deepEqual(await draft(page), before);
      await button(actions, 'Crop').and(actions.locator(':focus')).waitFor();
      await button(actions, 'Crop').click(); await zoom.fill('2');
      await button(cropPanel, 'Done').click();
      assert.notDeepEqual(await draft(page), before);
      await undo(page);
      assert.deepEqual(await draft(page), before, 'one undo restores the crop');
    }
    await activate(page, 'image');
    const beforeSwitch = await draft(page);
    const image = sharedToolPanel(page);
    await button(image, 'Crop').click(); await image.getByRole('slider').fill('3');
    await activate(page, 'shape'); await activate(page, 'image');
    assert.equal(await image.getByRole('slider').count(), 0, 'changing modules cancels the old crop');
    assert.deepEqual(await draft(page), beforeSwitch);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
