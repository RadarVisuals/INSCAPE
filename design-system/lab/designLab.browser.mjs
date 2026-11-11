import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../../scripts/browserEnvironment.mjs';

const root = resolve(import.meta.dirname, '../..');
test('live artboards isolate state, inspect production sources and reset in both themes', { timeout: 240000 }, async () => {
  // Like design:capture, exercise the dedicated running lab in a fresh browser context.
  const origin = 'http://127.0.0.1:5179';
  let browser, page;
  const pending = new Set();
  try {
    browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
    page.on('request', request => pending.add(request.url()));
    page.on('requestfinished', request => pending.delete(request.url()));
    page.on('requestfailed', request => pending.delete(request.url()));
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    const errors = [], external = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      if (url.hostname === 'api.universalprofile.cloud' && url.pathname.startsWith('/image/'))
        return route.fulfill({ path: resolve(root, 'public/assets/actors/skull_reaper/full.webp'), contentType: 'image/webp' });
      external.push(url.origin); return route.abort();
    });
    await page.goto(origin + '/design-lab.html');
    await page.getByRole('navigation', { name: 'Reception navigation' }).waitFor();
    await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
    const storageBefore = await page.evaluate(() => { localStorage.setItem('inscape:lab-test-sentinel', 'preserve'); return { ...localStorage }; });
    await page.getByRole('button', { name: 'Inspect source', exact: true }).click();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const selected = JSON.parse(await page.getByLabel('Selected component context').inputValue());
    assert.match(selected.selection.source, /^src\/reception\/ReceptionOverview.jsx:\d+$/u);
    assert.equal(selected.selection.owner, 'ReceptionPage');
    assert.equal(await page.getByRole('region', { name: 'Exploration room' }).count(), 0, 'inspection does not activate Explore');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.getByRole('region', { name: 'Exploration room' }).waitFor();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('region', { name: 'Reception layout' }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Exploration room' }).count(), 0);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByText('Edit Reception selected. This study previews Reception; that destination is not connected here.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), storageBefore);
    const output = resolve(root, 'output/design-lab/verification'); await mkdir(output, { recursive: true });
    for (const mode of ['LIGHT', 'DARK']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-interface-theme'), mode.toLowerCase());
      await page.screenshot({ path: resolve(output, `reception-${mode.toLowerCase()}.png`), fullPage: true });
    }
    await page.getByLabel('Artboard', { exact: true }).selectOption('artboards/toolbar');
    await page.getByRole('button', { name: 'Hand tool', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Hand tool', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Select tool', exact: true }).focus(); await page.keyboard.press('Control+k');
    await page.getByRole('button', { name: 'Duplicate artwork', exact: true }).click();
    await page.getByText('Duplicate requested in this example.', { exact: true }).waitFor();
    await page.screenshot({ path: resolve(output, 'toolbar.png'), fullPage: true });
    await page.getByLabel('Artboard', { exact: true }).selectOption('artboards/workspace');
    await page.locator('.ds-studio').waitFor();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Arch study');
    assert.equal(await page.locator('.system-workflow__library-item').count(), 1);
    await page.screenshot({ path: resolve(output, 'workspace.png'), fullPage: true });
    assert.equal(await page.getByLabel('Artboard', { exact: true }).locator('option[value="experiments/reception-study"]').count(), 0, 'the retired editor is absent from the lab');
    await page.getByLabel('Artboard', { exact: true }).selectOption('artboards/reception-editor');
    const editor = page.frameLocator('iframe[title="Reception Editor"]');
    await editor.getByRole('region', { name: 'Editor documents', exact: true }).waitFor();
    await editor.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.equal(await editor.getByRole('combobox', { name: 'Active document', exact: true }).inputValue(), 'reception');
    assert.equal(await editor.locator('main[data-reception-editor]').count(), 1);
    assert.equal(await editor.getByRole('button', { name: 'Done', exact: true }).count(), 0);
    await editor.getByRole('button', { name: 'Preview', exact: true }).click();
    await editor.getByRole('region', { name: 'Reception responsive preview', exact: true }).waitFor();
    await editor.getByRole('button', { name: 'Phone', exact: true }).click();
    await editor.locator('.reception-document-canvas[data-mobile]').waitFor();
    await page.screenshot({ path: resolve(output, 'editor-phone-preview.png'), fullPage: false });
    await editor.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await editor.getByRole('combobox', { name: 'Active document', exact: true }).selectOption({ label: 'Workbench 1' });
    await editor.locator('main[data-canvas-context="canvas"]').waitFor();
    await editor.getByRole('combobox', { name: 'Active document', exact: true }).selectOption('reception');
    await editor.locator('main[data-canvas-context="reception"]').waitFor();
    await page.screenshot({ path: resolve(output, 'shared-reception-editor.png'), fullPage: false });
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await editor.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await page.setViewportSize({ width: 430, height: 1000 });
    await editor.getByRole('region', { name: 'Editor documents', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(output, 'shared-editor-narrow.png'), fullPage: false });
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    const remaining = await page.evaluate(() => ({ ...localStorage })); delete remaining['inscape:interface-theme']; delete storageBefore['inscape:interface-theme'];
    for (const key of Object.keys(remaining)) if (key.startsWith('inscape:design-lab:reception-editor:')) delete remaining[key];
    // Visiting the ordinary sample canvas also mounts the native Display's
    // existing shortcut preference, keyed by this fixture profile on the lab
    // origin. It is not a Reception document or a second editor store.
    delete remaining['inscape:workbench:presentation-board:0x1111111111111111111111111111111111111111'];
    assert.deepEqual(remaining, storageBefore, 'Editor sample storage stays separate from application storage');
  } catch (error) {
    console.error('Pending:', [...pending]);
    if (page) console.error((await page.locator('body').innerText()).slice(0, 3000));
    throw error;
  } finally { await browser?.close(); }
});
