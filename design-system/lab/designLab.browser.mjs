import { choosePointer } from '../../browser-tests/fixtures/editor-menu.mjs';
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
    const output = resolve(root, 'output/design-lab/verification'); await mkdir(output, { recursive: true });
    await page.getByLabel('Artboard', { exact: true }).selectOption('artboards/toolbar');
    await choosePointer(page, 'Hand');
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
    const storageBefore = await page.evaluate(() => ({ ...localStorage }));
    await page.getByLabel('Artboard', { exact: true }).selectOption('artboards/studio-editor');
    const editor = page.frameLocator('iframe[title="Composition Editor"]');
    await editor.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await editor.getByRole('button', { name: 'Preview', exact: true }).click();
    await editor.locator('.composition-document-canvas').waitFor();
    await editor.getByRole('button', { name: 'Back to editing', exact: true }).click();
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    const remaining = await page.evaluate(() => ({ ...localStorage })); delete remaining['inscape:interface-theme']; delete storageBefore['inscape:interface-theme'];
    for (const key of Object.keys(remaining)) if (key.startsWith('inscape:design-lab:composition-editor:')) delete remaining[key];
    // Visiting the ordinary sample canvas also mounts the native Display's
    // existing shortcut preference, keyed by this fixture profile on the lab
    // origin. It is not a Composition document or a second editor store.
    delete remaining['inscape:workbench:presentation-board:0x1111111111111111111111111111111111111111'];
    assert.deepEqual(remaining, storageBefore, 'Editor sample storage stays separate from application storage');
  } catch (error) {
    console.error('Pending:', [...pending]);
    if (page) console.error((await page.locator('body').innerText()).slice(0, 3000));
    throw error;
  } finally { await browser?.close(); }
});
