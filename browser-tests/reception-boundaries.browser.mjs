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
  const open = async (search = '') => {
    const page = await context.newPage();
    await page.goto(origin + '/browser-tests/reception-boundaries-fixture.html' + search);
    await page.getByText('LOCAL A', { exact: true }).waitFor();
    return page;
  };
  return { browser, context, errors, open };
}
async function viewReception(page) {
  await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
  await page.getByRole('button', { name: 'Reception', exact: true }).click();
  await page.locator('.reception-page').waitFor();
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
    await editor.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    const canvasBefore = await editor.evaluate(() => window.receptionBoundaryFixture.saved().workbenches);
    await editor.locator('main[data-reception-editor]').focus(); await editor.keyboard.press('r');
    await editor.mouse.move(200, 200); await editor.mouse.down(); await editor.mouse.move(400, 400, { steps: 6 }); await editor.mouse.up();
    await editor.waitForFunction(() => window.receptionBoundaryFixture.saved().reception.version === 3);
    await viewReception(editor);
    await editor.locator('.reception-document-canvas').waitFor();
    await reader.locator('.reception-document-canvas').waitFor();
    assert.deepEqual(await editor.evaluate(() => window.receptionBoundaryFixture.saved().workbenches), canvasBefore);
    await editor.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await reader.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await reader.getByRole('heading', { name: 'This tab is view-only', exact: true }).waitFor();
    await viewReception(editor);
    await reader.getByRole('button', { name: 'Try editing here', exact: true }).click();
    await reader.getByRole('combobox', { name: 'Active document', exact: true }).waitFor();
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
    await viewReception(page);
    await page.getByText('RESTORED LOCAL', { exact: true }).waitFor();
    assert.equal(await page.getByText('Your local Reception could not be read.', { exact: false }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('backup recovery from an open editor retains the document target and refreshes the public reader', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open(), backup = await page.evaluate(() => window.receptionBoundaryFixture.backup);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Replace Workbench with backup', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active document', exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Active document', exact: true }).inputValue(), 'reception');
    await viewReception(page);
    await page.getByText('RESTORED LOCAL', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-reception-editor]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('authored Text typography survives native Editor preview and return to Reception', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup({ hasTouch: true });
  try {
    const page = await open();
    const metrics = () => page.locator('h1.text-document-title').evaluate(el => {
      const style = getComputedStyle(el); return { fontSize: style.fontSize, lineHeight: style.lineHeight };
    });
    const reader = await metrics();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('h1.text-document-title').waitFor();
    assert.deepEqual(await metrics(), reader);
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    await viewReception(page);
    await page.locator('.reception-page').waitFor();
    assert.deepEqual(await metrics(), reader);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('public Edit Reception and My Inscape use one Editor document selector through reload and history', { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open();
    const canvases = await page.evaluate(() => window.receptionBoundaryFixture.saved().workbenches);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    const selector = page.getByRole('combobox', { name: 'Active document', exact: true });
    await selector.waitFor();
    assert.equal(new URL(page.url()).searchParams.get('editor'), 'reception');
    assert.equal(await selector.inputValue(), 'reception');
    await page.reload();
    await selector.waitFor();
    assert.equal(await selector.inputValue(), 'reception');
    const canvasId = await selector.locator('option').evaluateAll(options => options.find(option => option.value !== 'reception').value);
    await selector.selectOption(canvasId);
    await page.waitForFunction(() => !new URLSearchParams(location.search).has('editor'));
    assert.equal(await selector.inputValue(), canvasId);
    await page.goBack();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('editor') === 'reception');
    await page.waitForFunction(() => document.querySelector('select[aria-label="Active document"]')?.value === 'reception');
    await page.goForward();
    await page.waitForFunction(id => document.querySelector('select[aria-label="Active document"]')?.value === id, canvasId);
    assert.equal(new URL(page.url()).searchParams.has('editor'), false);
    await page.getByRole('button', { name: 'My Inscape', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await selector.waitFor();
    assert.equal(await selector.inputValue(), 'reception');
    assert.deepEqual(await page.evaluate(() => window.receptionBoundaryFixture.saved().workbenches), canvases);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const collection of [false, true]) test(`StrictMode public-to-Editor entry preserves eight saved Reception layers in a ${collection ? 'collection' : 'single draft'}`, { timeout: 60000 }, async () => {
  const { browser, open, errors } = await setup();
  try {
    const page = await open('?strict=1');
    const before = await page.evaluate(async collection => {
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createReceptionEditorScope } = await import('/src/reception/receptionEditorScope.js');
      const { addShape } = await import('/src/shapes/shapeSession.js');
      const { address, key } = window.receptionBoundaryFixture;
      const root = createSystemWorkflowDraftStore({ profileAddress: address, storage: localStorage });
      const scope = createReceptionEditorScope(root);
      const count = () => scope.getDraft().shapes.length + scope.getDraft().texts.length + scope.getDraft().imageModules.length;
      while (count() < 8) addShape(scope, address, { position: { left: 100 + count() * 25, top: 120 + count() * 20 }, size: { width: 180, height: 140 } });
      scope.release();
      if (collection && !root.createWorkbench('Second canvas')) throw new Error('Could not seed a collection');
      window.receptionBoundaryFixture.remount();
      return { raw: localStorage.getItem(key), reception: root.getDraft().reception };
    }, collection);
    const saved = () => page.evaluate(() => localStorage.getItem(window.receptionBoundaryFixture.key));
    await page.locator('.reception-document-canvas').waitFor();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active document', exact: true }).waitFor();
    await page.waitForFunction(count => document.querySelectorAll('main[data-reception-editor] .shape-instance').length === count, before.reception.shapes.length);
    assert.equal(await page.locator('main[data-reception-editor] .shape-instance').count(), before.reception.shapes.length);
    assert.equal(await saved(), before.raw, 'opening the unified Editor does not rewrite saved content');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('region', { name: 'Reception responsive preview', exact: true }).waitFor();
    const afterPreview = await saved();
    const authored = raw => {
      const value = JSON.parse(raw);
      const reception = value.shared?.reception || value.reception;
      // The shared presentation capture normalizes the unused primary Display
      // slot; it must not change any Reception artwork, membership or geometry.
      delete reception.workbench.display;
      delete reception.workbench.displays;
      return value;
    };
    assert.deepEqual(authored(afterPreview), authored(before.raw));
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await viewReception(page);
    assert.equal(await saved(), afterPreview, 'returning to public view preserves all native records');
    await page.reload();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active document', exact: true }).waitFor();
    assert.equal(await saved(), afterPreview, 'StrictMode remount and reconciliation preserve the exact saved draft');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
