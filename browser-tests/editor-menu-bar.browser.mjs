import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5227';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/editor-menu-bar';
const top = (page, name) => page.getByRole('menubar', { name: 'Editor commands' }).getByRole('menuitem', { name, exact: true });
async function choose(page, menu, name, role = 'menuitem') {
  await top(page, menu).click();
  await page.getByRole('menu', { name: `${menu} menu` }).getByRole(role, { name, exact: true }).click();
}

test('fixed menu, full sidebar toggle, keyboard menus, tool preferences and destinations at wide and narrow sizes', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  await mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      if (width === 390) await page.addInitScript(() => localStorage.setItem('inscape:interface-theme', 'light'));
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      try {
        await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1`, { waitUntil: 'domcontentloaded' });
        await top(page, 'Canvas').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const rect = await page.locator('.editor-menu-bar').boundingBox();
        assert.equal(rect.y, 0);
        assert.equal(rect.height, 40);
        const labels = await page.getByRole('menubar').getByRole('menuitem').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
        assert.deepEqual(labels, ['Canvas', 'Edit', 'View', 'Tools', 'Docs', 'Backup']);
        const last = await top(page, 'Backup').boundingBox();
        assert.ok(last.x + last.width <= width, `all menu titles fit at ${width}`);
        const draft = await page.evaluate(() => window.savedDraft());
        const logo = page.getByRole('button', { name: 'Inscape sidebar' });
        await logo.click();
        assert.equal(await page.getByRole('complementary', { name: 'Workspace sidebar' }).isVisible(), false);
        await logo.click();
        assert.equal(await page.getByRole('complementary', { name: 'Workspace sidebar' }).isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.savedDraft()), draft, 'sidebar preference does not edit artwork');
        await top(page, 'Canvas').press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await page.getByRole('menu', { name: 'Edit menu' }).waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await top(page, 'Edit').evaluate(node => node === document.activeElement), true);
        await choose(page, 'Tools', 'Drawing toolbar', 'menuitemcheckbox');
        assert.equal(await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).isVisible(), false);
        await choose(page, 'Tools', 'Drawing toolbar', 'menuitemcheckbox');
        await choose(page, 'Edit', 'Settings');
        await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Download backup', exact: true }).count(), 0);
        await top(page, 'Backup').click();
        await page.getByRole('dialog', { name: 'Backup', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close Backup', exact: true }).click();
        await top(page, 'Docs').click();
        await page.getByRole('button', { name: 'Close Docs', exact: true }).click();
        await top(page, 'Tools').click();
        await page.screenshot({ path: `${output}/tools-${width}.png` });
        await page.keyboard.press('Escape');
        assert.deepEqual(errors, []);
      } catch (error) { await page.screenshot({ path: `${output}/failure-${width}.png` }); throw error; }
      finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('canvas commands retain save failures, rename, dimensions and Undo', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1`, { waitUntil: 'domcontentloaded' });
    await choose(page, 'Canvas', 'Rename');
    await page.getByLabel('Canvas name', { exact: true }).fill('First canvas');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    const first = await page.evaluate(() => window.guardedStore().getWorkbenchId());
    await choose(page, 'Canvas', 'New canvas');
    await page.getByLabel('New canvas name', { exact: true }).fill('Second canvas');
    await page.getByRole('button', { name: 'Create canvas', exact: true }).click();
    assert.notEqual(await page.evaluate(() => window.guardedStore().getWorkbenchId()), first);
    await choose(page, 'Canvas', 'First canvas', 'menuitemcheckbox');
    assert.equal(await page.evaluate(() => window.guardedStore().getWorkbenchId()), first);
    await choose(page, 'Canvas', 'Canvas size');
    await page.getByLabel('Width (px)', { exact: true }).fill('1600');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    assert.match(await page.getByLabel('Canvas dimensions', { exact: true }).innerText(), /^1600/);
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    await choose(page, 'Edit', 'Undo');
    await choose(page, 'Canvas', 'Canvas size');
    assert.doesNotMatch(await page.getByLabel('Canvas dimensions', { exact: true }).innerText(), /^1600/);
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.startsWith('inscape.system-workflow-draft.')) throw Error('Full'); return set.call(this, key, value); };
    });
    await choose(page, 'Canvas', 'Rename');
    await page.getByLabel('Canvas name', { exact: true }).fill('Unsaved name');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /save/i);
    assert.equal(await page.getByRole('dialog', { name: 'Rename canvas' }).isVisible(), true);
  } finally { await browser.close(); }
});
