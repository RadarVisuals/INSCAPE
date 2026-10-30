import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-boundaries';
async function setup(options = {}) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const errors = [];
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await mkdir(output, { recursive: true });
  const open = async () => {
    const page = await context.newPage();
    await page.goto(origin + '/browser-tests/reception-boundaries-fixture.html');
    await page.getByText('LOCAL A', { exact: true }).waitFor();
    return page;
  };
  return { browser, context, errors, open };
}
test('local Reception survives every public failure; visitors never see owner drafts', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open();
    for (const status of ['LOADING', 'UNAVAILABLE', 'ERROR', 'INVALID', 'RESOLVED']) {
      await page.evaluate(s => window.receptionBoundaryFixture.setStatus(s), status);
      await page.getByText('LOCAL A', { exact: true }).waitFor();
      assert.equal(await page.locator('.published-profile-status').count(), 0);
    }
    await page.evaluate(() => window.receptionBoundaryFixture.setOwner(false));
    await page.getByText('PUBLIC ONLY', { exact: true }).waitFor();
    assert.equal(await page.getByText('LOCAL ARTICLE', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Edit Reception', exact: true }).count(), 0);
    await page.evaluate(() => window.receptionBoundaryFixture.setStatus('UNAVAILABLE'));
    await page.locator('.published-profile-status').waitFor();
    assert.equal(await page.locator('.reception-canvas').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('another tab refreshes its reader after legal editing; editor lease and authority remain isolated', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const reader = await open(), editor = await open();
    await editor.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await editor.getByRole('button', { name: 'Edit name and logo', exact: true }).click();
    await editor.getByRole('textbox', { name: 'Header name', exact: true }).fill('LOCAL B');
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await editor.getByText('LOCAL B', { exact: true }).waitFor();
    await reader.getByText('LOCAL B', { exact: true }).waitFor();
    await editor.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await reader.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await reader.getByRole('heading', { name: 'This tab is view-only', exact: true }).waitFor();
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await reader.getByRole('button', { name: 'Try editing here', exact: true }).click();
    await reader.getByRole('button', { name: 'Done', exact: true }).waitFor();
    await reader.evaluate(() => window.receptionBoundaryFixture.setOwner(false));
    await reader.getByText('PUBLIC ONLY', { exact: true }).waitFor();
    assert.equal(await reader.locator('[data-reception-editor]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('successful private recovery immediately renders the restored local Reception', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open(), backup = await page.evaluate(() => window.receptionBoundaryFixture.backup);
    await page.evaluate(() => { window.receptionBoundaryFixture.corrupt(); window.receptionBoundaryFixture.remount(); });
    await page.getByText('Your local Reception could not be read.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Replace Workbench with backup', exact: true }).click();
    await page.getByText('RESTORED LOCAL', { exact: true }).waitFor();
    assert.equal(await page.getByText('Your local Reception could not be read.', { exact: false }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('backup recovery from an open editor uses the same refreshed reader as Done', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open(), backup = await page.evaluate(() => window.receptionBoundaryFixture.backup);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('button', { name: 'Backup and recovery', exact: true }).click();
    await page.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Replace Workbench with backup', exact: true }).click();
    await page.getByText('RESTORED LOCAL', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-reception-editor]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('closing a panel returns keyboard focus without overriding another control or surviving authority loss', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    const trigger = page.getByRole('button', { name: 'Settings', exact: true });
    const focused = name => page.waitForFunction(label => document.activeElement?.getAttribute('aria-label') === label, name);
    await trigger.focus(); await trigger.press('Enter');
    const close = page.getByRole('button', { name: 'Close Settings', exact: true });
    await close.focus(); await close.press('Enter'); await focused('Settings');
    await trigger.press('Enter');
    await close.focus();
    await page.keyboard.press('Escape'); await focused('Settings');
    await trigger.press('Enter');
    const branding = page.getByRole('button', { name: 'Edit name and logo', exact: true });
    await branding.click(); await focused('Edit name and logo');
    await page.evaluate(() => window.receptionBoundaryFixture.setOwner(false));
    await page.getByText('PUBLIC ONLY', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-reception-editor]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('authored typography matches preview, tool controls retain touch targets after lazy tool loading', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup({ hasTouch: true });
  try {
    const page = await open();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('region', { name: 'Region 2 · text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article title', exact: true }).waitFor();
    const metrics = () => page.locator('.text-document-title').evaluate(el => {
      const s = getComputedStyle(el); return { padding: s.padding, border: s.borderWidth, fontSize: s.fontSize, lineHeight: s.lineHeight };
    });
    const editing = await metrics();
    assert.equal(editing.padding, '0px'); assert.equal(editing.border, '0px');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('h1.text-document-title').waitFor();
    assert.deepEqual(await metrics(), editing);
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('button', { name: 'Edit name and logo', exact: true }).click();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const targets = await page.locator('.reception-editor-header button, .workbench-tool-panel-close').evaluateAll(nodes => nodes.map(el => ({
        name: el.getAttribute('aria-label') || el.textContent, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height,
      })));
      for (const t of targets) assert.ok(t.w >= 44 && t.h >= 44, width + ' ' + JSON.stringify(t));
      assert.equal(await page.getByRole('textbox', { name: 'Header name', exact: true }).evaluate(el => getComputedStyle(el).fontSize), '16px');
      assert.ok(await page.locator('.reception-editor-window').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.screenshot({ path: output + '/touch-' + width + '.png' });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
