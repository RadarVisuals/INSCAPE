import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { openEditorMenu, editorMenu, editorCommand } from './fixtures/editor-menu.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';

for (const width of [1440, 900]) test(`frame line opacity uses the colour control, saves once, undoes and reloads at ${width}`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://api.universalprofile.cloud/image/**', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp' }));
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    const saved = () => page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
    const before = await saved();
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByRole('button', { name: 'Frame line color', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Frame line color', exact: true });
    const input = picker.getByRole('spinbutton', { name: 'Frame line opacity (%)', exact: true });
    assert.equal(await input.inputValue(), '100');
    await input.fill('35'); await input.press('Tab');
    const after = await saved();
    assert.deepEqual(after, { ...before, showFrame: true, frameOpacity: .35 });
    await page.screenshot({ path: `${process.env.INSCAPE_BROWSER_OUTPUT}/frame-opacity-${width}.png` });
    await picker.press('Escape');
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await saved(), before);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await saved(), after);
    await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await saved(), after);
    await editorCommand(page, 'Canvas', 'Preview');
    const canvas = page.locator('.reception-document-canvas'); await canvas.waitFor();
    assert.equal(await canvas.evaluate(node => node.style.getPropertyValue('--reception-frame-line-opacity')), '35%');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
