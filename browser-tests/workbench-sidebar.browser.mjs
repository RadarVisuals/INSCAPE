import { editorDestination, setEditorSidebarOpen, editorMenu, editorCommand, selectEditorDocument } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/sidebar';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
const interactionState = page => page.locator('main.system-workflow').evaluate(node => ({
  camera: [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY],
  selection: [...node.querySelectorAll('.workbench-layer-row[data-selected]')].map(row => row.dataset.layerId),
}));
async function mount(browser, width = 1440, height = 900, theme = 'mist') {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&theme=${theme}`);
  await page.locator('.keeper-dock-window').waitFor();
  await setEditorSidebarOpen(page, true);
  await page.locator('[data-navigator-object^="image:"] image').waitFor();
  await settle(page);
  return { page, sidebar: page.getByRole('menu', { name: 'Inscape menu', exact: true }), errors };
}

// The sidebar is now an overlay; destinations close it at every desktop width.
// Keep behavior and content checks; retired rails, pushed-canvas margins and
// phone-only target sizes are not requirements of this authoring surface.
for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [760, 700], [1000, 650]]) {
  test(`navigation overlay routes to Library and Settings without editing content (${theme} ${width}x${height})`, { timeout: 45000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, sidebar, errors } = await mount(browser, width, height, theme);
      const draft = await page.evaluate(() => window.readToolChromeDraft());
      const before = await interactionState(page);
      await sidebar.dispatchEvent('wheel', { deltaY: 90, bubbles: true, cancelable: true });
      assert.deepEqual((await interactionState(page)).camera, before.camera, 'sidebar scroll leaves camera alone');
      await editorDestination(page, 'Library');
      await sidebar.waitFor({ state: 'hidden' });
      await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
      assert.deepEqual((await interactionState(page)).camera, before.camera, 'navigation overlay does not move the canvas');
      await page.getByRole('button', { name: 'Close Library', exact: true }).click();
      await editorCommand(page, 'Edit', 'Settings');
      const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
      await settings.waitFor();
      assert.equal(await sidebar.isVisible(), false);
      await settings.getByRole('button', { name: 'Close Settings' }).click();
      await settings.waitFor({ state: 'hidden' });
      const home = page.getByRole('button', { name: 'Fit canvas in view', exact: true });
      await home.scrollIntoViewIfNeeded();
      assert.equal(await home.evaluate(hit), true, 'Navigator remains reachable after closing navigation');
      assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), draft, 'navigation does not edit composition');
      assert.deepEqual(errors, []);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/navigation-${theme}-${width}.png` });
    } finally { await browser.close(); }
  });
}

test('navigation closes across canvas switches and preview', { timeout: 60000 }, async () => {
 const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
 try {
  const { page, sidebar, errors } = await mount(browser);
  const logo = page.getByRole('button', { name: 'Inscape menu' });
  await logo.click(); assert.equal(await sidebar.isVisible(), false);
  await editorCommand(page, 'Canvas', '+ New');
  await page.getByLabel('Composition name', { exact: true }).fill('Sidebar check');
  await page.getByRole('button', { name: 'Create composition', exact: true }).click();
  assert.equal(await sidebar.isVisible(), false);
  await selectEditorDocument(page, { label: 'Workbench 1' });
  assert.equal(await sidebar.isVisible(), false);
  await editorCommand(page, 'Canvas', 'Preview');
  await page.getByRole('dialog', { name: 'Composition preview' }).getByRole('button', { name: 'Back to editing' }).click();
  await editorMenu(page, 'Canvas').waitFor();
  assert.equal(await sidebar.isVisible(), false);
  await logo.click(); assert.equal(await sidebar.isVisible(), true);
  assert.deepEqual(errors, []);
 } finally { await browser.close(); }
});
