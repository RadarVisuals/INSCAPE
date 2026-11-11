import { editorMenu } from './fixtures/editor-menu.mjs';
import { openTextToolSection } from './fixtures/text-tool-sections.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { receptionStylingSeed } from './fixtures/reception-styling.js';
import { separateLayers, openSharedTool, closeSharedTool } from './fixtures/shared-tools.mjs';

const production = process.env.INSCAPE_STYLING_PRODUCTION === '1';
const output = process.env.INSCAPE_SCREENSHOT_DIR || `.browser-test-runtime/reception-styling-${production ? 'built' : 'dev'}`;
let browser, server, appFile, origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
test.before(async () => {
  if (production) {
    appFile = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))['index.html'].file;
    server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
    origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  }
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  await mkdir(output, { recursive: true });
});
test.after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve)); });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const metrics = locator => locator.evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => {
  const r = n.getBoundingClientRect(), s = getComputedStyle(n);
  return { name: n.getAttribute('aria-label') || n.textContent.trim(), width: r.width, height: r.height, font: s.fontSize,
    line: s.lineHeight, border: s.borderBottomStyle, display: s.display, position: s.position, clip: s.clipPath };
}));
async function targets(locator, minimum = 44) {
  const values = await metrics(locator);
  assert.ok(values.length, 'Expected visible controls');
  for (const value of values) assert.ok(value.width >= minimum - .1 && value.height >= minimum - .1, JSON.stringify(value));
  return values;
}
async function typography(page) {
  await page.evaluate(() => document.fonts.ready);
  const values = await metrics(page.locator('.reception-profile-copy p, .reception-profile-copy li, .reception-profile-links a, .reception-profile-details dd'));
  assert.ok(values.length >= 5, 'Filled profile, links and details must be rendered');
  return values.map(({ name, font, line }) => ({ name, font, line }));
}
async function colour(page) {
  const rows = await metrics(page.locator('.ds-colour-channels'));
  assert.equal(rows.length, 1);
  assert.deepEqual(await page.locator('.ds-colour-channels input').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['Color hue', 'Color saturation', 'Color lightness']);
  const hints = await metrics(page.locator('.ds-colour-instructions'));
  assert.equal(hints.length, 1); assert.equal(hints[0].position, 'absolute'); assert.equal(hints[0].clip, 'inset(50%)');
  assert.equal(await page.locator('.ds-colour-panel input[type=number]').count(), 3, 'HSL values are editable numeric controls');
  if (await page.evaluate(() => matchMedia('(pointer: coarse), (max-width: 520px)').matches)) {
    await targets(page.locator('.ds-colour-hex-row > .ds-colour-hex, .ds-colour-channels input'));
    for (const field of await metrics(page.locator('.ds-colour-hex input, .ds-colour-channels input'))) assert.equal(field.font, '16px');
  }
}
async function textTargets(page) {
  const panel = await openSharedTool(page, 'Inspector');
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse), (max-width: 520px)').matches);
  const minimum = touch ? 44 : 20, fieldFont = touch ? '16px' : '11px';
  await button(page, 'Bold').scrollIntoViewIfNeeded();
  await targets(panel.locator('.text-toolbar-icons button, .text-selection-number button, .text-selection-font button'), minimum);
  const fields = await metrics(page.locator('.text-controls-body input:not([type=checkbox]):not([type=range]):not([type=color]), .text-controls-body select'));
  for (const field of fields) assert.equal(field.font, fieldFont, JSON.stringify(field));
  for (const summary of await metrics(page.locator('.text-controls-body summary'))) assert.ok(summary.height >= (touch ? 44 : 28), JSON.stringify(summary));
  assert.equal(await panel.locator('.workbench-inspector').evaluate(n => n.scrollWidth > n.clientWidth + 1), false, 'Text inspector must not scroll horizontally');
  for (const name of ['Default text style', 'Title']) await openTextToolSection(panel, name);
  await targets(page.locator('.text-settings .text-selection-number button, .text-title-alignment button, .text-controls-body input[type=color]'), minimum);
  for (const field of await metrics(page.locator('.text-settings input:not([type=checkbox]):not([type=range]):not([type=color]), .text-settings select'))) {
    assert.equal(field.font, fieldFont, JSON.stringify(field)); assert.ok(field.height >= (touch ? 44 : 28), JSON.stringify(field));
  }
  assert.equal(await panel.locator('.workbench-inspector').evaluate(n => n.scrollWidth > n.clientWidth + 1), false, 'Article controls must not scroll horizontally');
}

for (const [width, touch, theme] of [[1440, false, 'carbon'], [390, true, 'mist'], [320, false, 'carbon'], [1280, true, 'mist']]) {
  test(`Saved Reception reader retains shared styles: ${width}, touch=${touch}, ${theme}${production ? ', built' : ''}`, { timeout: 90000 }, async () => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], requests = [], measurements = {};
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const seed = receptionStylingSeed();
    await context.addInitScript(mode => localStorage.setItem('inscape:interface-theme', mode), theme === 'mist' ? 'light' : 'dark');
    await context.addInitScript(seed => localStorage.setItem(seed.key, seed.raw), seed);
    try {
      await page.goto(`${origin}/?view=${seed.address}&reception=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Disposable test authority only; never acquire a real wallet or publish.
      await page.evaluate(async ({ file, address }) => {
        const module = await import(file);
        const wallet = Object.values(module).find(value => value?.getState && 'hostProfileAddress' in value.getState());
        if (!wallet) throw Error('Wallet store export missing');
        wallet.getState().disposeWallet();
        let enforcing = false;
        const patch = { authorityLifecycleStatus: 'complete', hostProfileAddress: address, isWalletConnected: true, isHostProfileOwner: true };
        wallet.subscribe(state => { if (enforcing || Object.entries(patch).every(([k, v]) => state[k] === v)) return; enforcing = true; wallet.setState(patch); enforcing = false; });
        wallet.setState(patch);
      }, { file: production ? '/' + appFile : '/src/store/useWalletStore.js', address: seed.address });
      await page.getByText('STYLING REVIEW', { exact: true }).waitFor();
      await page.locator('.startveil').waitFor({ state: 'detached' });
      assert.ok(!requests.some(path => /reception-editing|ReceptionEditor/.test(path)), 'Reader must not load editing code');
      measurements.reader = await typography(page);
      assert.equal(await page.locator('[data-reception-editor]').count(), 0);
      if (touch || width <= 520) await targets(page.locator('.reception-navigation button'));
      await page.screenshot({ path: `${output}/reader-${width}-${theme}.png` });
      assert.deepEqual(errors, []);
      await writeFile(`${output}/metrics-${width}-${theme}.json`, JSON.stringify(measurements, null, 2));
    } catch (error) {
      await page.screenshot({ path: `${output}/failure-${width}.png`, timeout: 2000 }).catch(() => {}); throw error;
    } finally { await context.close(); }
  });
}

test('Workbench shares touch Text sizes and intrinsic colour layout', { timeout: 60000, skip: production }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try {
    await page.goto(origin + '/browser-tests/workbench-storage-fixture.html');
    await editorMenu(page, 'Canvas').waitFor();
    await page.evaluate(async () => {
      const { layersDraft } = await import('/browser-tests/fixtures/artwork-layers.js');
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      window.leaveEditor(); localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile), JSON.stringify(layersDraft()));
    });
    await page.reload(); await separateLayers(page);
    await button(page, 'Select Landscape').click(); await openSharedTool(page, 'Color');
    await page.locator('.ds-colour-channels').scrollIntoViewIfNeeded(); await colour(page);
    await button(page, 'Close Inspector').click();
    await button(page, 'Select Mist').click();
    await openSharedTool(page, 'Inspector');
    await button(page, 'Close Workbench Layers').press('Enter');
    await textTargets(page);
  } finally { await context.close(); }
});

test('Workbench Identity uses the same editable field scope with touch targets', { timeout: 60000, skip: production }, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try {
    await page.goto(origin + '/development/owner/system-workflow');
    await page.getByRole('tab', { name: 'Layers', exact: true }).waitFor();
    for (const name of ['Layers', 'Inspector']) await closeSharedTool(page, name);
    await button(page, 'Profile').click(); await page.locator('[data-identity-dossier-source]').click();
    const identity = page.locator('.identity-module aside');
    // Keep the field editor exposed beside the current left Navigator dock.
    const nav = await page.locator('.workbench-navigator').boundingBox(), frame = await identity.boundingBox();
    const move = page.getByLabel('Move Identity window', { exact: true });
    for (let i = 0; i < Math.ceil(Math.max(0, nav.x + nav.width + 12 - frame.x) / 10); i++) await move.press('Shift+ArrowRight');
    await button(identity, 'Edit Identity').click();
    await button(identity, 'Add field').click();
    await identity.getByLabel('Field 1 name', { exact: true }).fill('Location');
    await identity.getByLabel('Field 1 content', { exact: true }).fill('Underneath');
    await targets(identity.locator('.identity-module__cell-actions button'));
    const fields = await metrics(identity.locator('.identity-module__inline'));
    assert.ok(fields.length > 3);
    for (const field of fields) { assert.equal(field.border, 'dashed'); assert.equal(field.font, '16px'); }
    await page.screenshot({ path: `${output}/workbench-identity-touch.png` });
  } finally { await context.close(); }
});
