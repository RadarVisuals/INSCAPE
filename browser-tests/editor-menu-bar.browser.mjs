import { editorDocumentTitle, editorMenu, openEditorMenu, editorCommand } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5227';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/editor-menu-bar';
const top = editorMenu;
const choose = editorCommand;

test('one wordmark menu keeps keyboard access, tools and destinations at wide and narrow computer sizes', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  await mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 760]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      try {
        await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1`, { waitUntil: 'domcontentloaded' });
        await top(page).waitFor(); await page.evaluate(() => document.fonts.ready);
        const rect = await page.locator('.editor-menu-bar').boundingBox();
        assert.equal(rect.y, 0); assert.equal(rect.height, 48);
        assert.equal(await page.getByRole('menubar').count(), 0);
        assert.equal(await page.getByRole('complementary', { name: 'Workspace sidebar' }).count(), 0);
        assert.equal(await editorDocumentTitle(page).textContent(), await page.evaluate(() => window.guardedStore().listWorkbenches().find(item => item.id === window.guardedStore().getWorkbenchId()).name));
        const draft = await page.evaluate(() => window.savedDraft());
        await top(page).press('ArrowDown');
        const menu = page.getByRole('menu', { name: 'Inscape menu', exact: true });
        assert.deepEqual(await menu.locator(':scope > button > span').allTextContents(), [
          'Search commands...', 'Profile', 'Gallery', 'Writing', 'Studio',
          'Canvas', 'Edit', 'View', 'Tools', 'Manage compositions', 'Activity', 'Settings', 'Backup',
        ]);
        assert.equal(await menu.getByRole('menuitemcheckbox', { name: 'Studio', checked: true }).count(), 1);
        const anchor = await page.locator('.editor-menu-bar .workspace-wordmark').boundingBox();
        assert.deepEqual([anchor.x, anchor.y], [16, 11]);
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await page.getByRole('menu', { name: 'Edit options', exact: true }).waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await top(page).evaluate(node => node === document.activeElement), true);
        await choose(page, 'Tools', 'Drawing toolbar', 'menuitemcheckbox');
        assert.equal(await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).isVisible(), false);
        await choose(page, 'Tools', 'Drawing toolbar', 'menuitemcheckbox');
        await choose(page, 'Tools', 'Groups');
        const groupSelection = page.getByRole('heading', { name: 'Selected layers', exact: true });
        await groupSelection.waitFor(); await groupSelection.press('Escape');
        assert.equal(await top(page).evaluate(node => node === document.activeElement), true);
        await choose(page, 'Edit', 'Settings');
        await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
        await openEditorMenu(page, 'Backup');
        await page.getByRole('button', { name: 'Close Backup', exact: true }).click();
        await openEditorMenu(page, 'Tools');
        await page.screenshot({ path: `${output}/tools-${width}.png` });
        await page.keyboard.press('Escape');
        const frame = page.locator('.editor-workspace-frame');
        const geometry = await frame.evaluate(node => {
          const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
          return { top: rect.top, bottom: innerHeight - rect.bottom, border: style.borderTopWidth, pointer: style.pointerEvents };
        });
        assert.deepEqual(geometry, { top: 48, bottom: 2, border: '1px', pointer: 'none' });
        if (width === 760) {
          await page.setViewportSize({ width, height: 500 });
          await openEditorMenu(page, 'Canvas');
          const child = await page.getByRole('menu', { name: 'Canvas options' }).boundingBox();
          assert.ok(child.x >= 0 && child.x + child.width <= width && child.y >= 0 && child.y + child.height <= 500);
          await page.keyboard.press('Escape');
          await choose(page, 'Studio', 'Rename composition');
          await page.getByRole('dialog', { name: 'Rename composition' }).getByRole('button', { name: 'Cancel' }).click();
          const root = await openEditorMenu(page);
          const backup = root.getByRole('menuitem', { name: 'Backup' });
          await backup.scrollIntoViewIfNeeded();
          const visible = await backup.boundingBox();
          assert.ok(visible.y >= 0 && visible.y + visible.height <= 500);
          await page.keyboard.press('Escape');
        }
        assert.deepEqual(await page.evaluate(() => window.savedDraft()), draft);
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
    await choose(page, 'Studio', 'Rename composition');
    await page.getByLabel('Composition name', { exact: true }).fill('First canvas');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    const documentLabel = editorDocumentTitle(page);
    assert.equal(await documentLabel.textContent(), 'First canvas');
    const first = await page.evaluate(() => window.guardedStore().getWorkbenchId());
    await choose(page, 'Canvas', '+ New');
    await page.getByLabel('Composition name', { exact: true }).fill('Second canvas');
    await page.getByRole('button', { name: 'Create composition', exact: true }).click();
    assert.equal(await documentLabel.textContent(), 'Second canvas');
    assert.notEqual(await page.evaluate(() => window.guardedStore().getWorkbenchId()), first);
    await choose(page, 'Compositions', 'First canvas', 'menuitemcheckbox');
    assert.equal(await documentLabel.textContent(), 'First canvas');
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
    await page.evaluate(() => window.failWorkbenchWrites(true));
    await choose(page, 'Studio', 'Rename composition');
    await page.getByLabel('Composition name', { exact: true }).fill('Unsaved name');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /save/i);
    assert.equal(await page.getByRole('dialog', { name: 'Rename composition' }).isVisible(), true);
    assert.equal(await documentLabel.textContent(), 'First canvas', 'the indicator only shows the saved document name');
  } finally { await browser.close(); }
});

test('the single toolbar retains camera return, Groups and Index in Dark and Light', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    for (const [width, theme] of [[1440, 'carbon'], [700, 'mist']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=actions&theme=${theme}`);
      const image = page.locator('.image-module__canvas').first();
      await image.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const brand = page.getByRole('button', { name: 'Inscape menu' });
      if (await brand.getAttribute('aria-expanded') === 'true') await brand.click();
      const camera = () => page.locator('main.system-workflow').evaluate(node =>
        ['workbenchCameraScale', 'workbenchCameraX', 'workbenchCameraY'].map(key => node.dataset[key]));
      const saved = await page.evaluate(() => window.readToolChromeDraft());
      await image.press('Shift+Enter');
      const before = await camera();
      await choose(page, 'View', 'Focus selection');
      await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      assert.notDeepEqual(await camera(), before);
      await choose(page, 'View', 'Previous view');
      await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      assert.deepEqual(await camera(), before);
      assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), saved);
      await choose(page, 'Tools', 'Groups');
      await page.getByRole('heading', { name: 'Selected layers', exact: true }).press('Escape');
      assert.equal(await top(page, 'Tools').evaluate(node => node === document.activeElement), true);
      await page.getByRole('button', { name: 'Actions', exact: true }).click();
      await page.getByRole('dialog', { name: 'Search commands', exact: true }).getByRole('button', { name: 'Index', exact: true }).click();
      const index = page.getByRole('complementary', { name: 'Index — Destinations', exact: true });
      await index.waitFor();
      await index.getByRole('button', { name: 'Close Index', exact: true }).click();
      await page.getByRole('button', { name: 'Actions', exact: true }).click();
      await page.getByRole('dialog', { name: 'Search commands', exact: true }).getByRole('button', { name: 'Index', exact: true }).click();
      await index.waitFor();
      assert.equal(await page.locator('.workbench-view-controls').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Meet Grid-naad', exact: true }).count(), 0);
      await page.screenshot({ path: `${output}/single-toolbar-${theme}-${width}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});
