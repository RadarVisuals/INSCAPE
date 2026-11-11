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
  return { page, sidebar: page.getByRole('complementary', { name: 'Workspace sidebar', exact: true }), errors };
}

// The sidebar is now an overlay; destinations close it at every desktop width.
// Keep behavior and content checks; retired rails, pushed-canvas margins and
// phone-only target sizes are not requirements of this authoring surface.
for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [760, 700], [1000, 390]]) {
  test(`navigation overlay routes to Library and Profile without editing content (${theme} ${width}x${height})`, { timeout: 45000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, sidebar, errors } = await mount(browser, width, height, theme);
      const draft = await page.evaluate(() => window.readToolChromeDraft());
      const before = await interactionState(page);
      await sidebar.dispatchEvent('wheel', { deltaY: 90, bubbles: true, cancelable: true });
      assert.deepEqual((await interactionState(page)).camera, before.camera, 'sidebar scroll leaves camera alone');
      await sidebar.getByRole('button', { name: 'Library', exact: true }).click();
      await sidebar.waitFor({ state: 'hidden' });
      await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
      assert.deepEqual((await interactionState(page)).camera, before.camera, 'navigation overlay does not move the canvas');
      await page.getByRole('button', { name: 'Close Library', exact: true }).click();
      await editorDestination(page, 'Profile');
      const profile = page.locator('[data-system-workflow-panel="profile"]');
      await profile.locator('aside').waitFor();
      assert.equal(await sidebar.isVisible(), false);
      await profile.getByRole('button', { name: /^Close / }).first().click();
      await profile.waitFor({ state: 'hidden' });
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

test('Discover account Escape closes only its menu and restores focus', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser);
    await editorDestination(page, 'Discover');
    const discover = page.locator('[data-system-workflow-panel="discover"] .public-entry-portal');
    await discover.waitFor();
    const trigger = discover.locator('.public-entry-portal__account-trigger');
    await trigger.click();
    const before = await interactionState(page);
    // Discover suspends the artwork tool hosts. Test its rendered state, rather
    // than requiring a hidden Editor selection counter from the retired UI.
    await discover.getByRole('button', { name: 'Disconnect', exact: true }).focus();
    await page.keyboard.press('Escape');
    assert.equal(await discover.isVisible(), true);
    assert.equal(await discover.locator('.public-entry-portal__account-menu').count(), 0);
    assert.deepEqual(await interactionState(page), before);
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await trigger.click();
    await discover.locator('main button:enabled').first().waitFor();
    await discover.getByRole('button', { name: 'Disconnect', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await discover.evaluate(node => node.contains(document.activeElement) && !document.activeElement.closest('.public-entry-portal__account')), true);
    await page.keyboard.press('Escape');
    assert.equal(await discover.locator('.public-entry-portal__account-menu').count(), 0);
    assert.equal(await discover.isVisible(), true);
    assert.deepEqual(await interactionState(page), before);
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('sidebar visibility persists across canvas switches and preview', { timeout: 60000 }, async () => {
 const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
 try {
  const { page, sidebar, errors } = await mount(browser);
  const logo = page.getByRole('button', { name: 'Inscape sidebar' });
  await logo.click(); assert.equal(await sidebar.isVisible(), false);
  await editorCommand(page, 'Canvas', 'New canvas');
  await page.getByLabel('New canvas name', { exact: true }).fill('Sidebar check');
  await page.getByRole('button', { name: 'Create canvas', exact: true }).click();
  assert.equal(await sidebar.isVisible(), false);
  await selectEditorDocument(page, { label: 'Workbench 1' });
  assert.equal(await sidebar.isVisible(), false);
  await editorCommand(page, 'Canvas', 'Preview');
  await page.getByRole('button', { name: 'EXIT', exact: true }).click();
  await editorMenu(page, 'Canvas').waitFor();
  assert.equal(await sidebar.isVisible(), false);
  await logo.click(); assert.equal(await sidebar.isVisible(), true);
  assert.deepEqual(errors, []);
 } finally { await browser.close(); }
});
