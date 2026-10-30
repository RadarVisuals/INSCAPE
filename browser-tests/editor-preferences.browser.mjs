import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { holdFrames } from './fixtures/deferred-focus.mjs';
import { pointerAction, r12Cases } from './fixtures/r12-pointer.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/editor-preferences';
const profile = '0x9999999999999999999999999999999999999999';
const key = `inscape:editor-preferences:v1:${profile}`;
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const dock = (page, name) => page.locator('.workbench-tool-dock').filter({ has: tab(page, name) });
const prefs = page => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.value, key);
const saved = page => page.evaluate(() => window.readToolChromeDraft());
const library = page => page.getByRole('region', { name: 'Library workspace', exact: true });
async function openLibrary(page) {
  await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
  await library(page).waitFor();
}
async function mount(browser, theme = 'mist', width = 1440, height = 1000) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&persistent&theme=${theme}`);
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  return { page, errors };
}

for (const [name, role] of [['Sort assets: A–Z', 'listbox'], ['Filters: All', 'dialog']]) {
  test(`Library ${role} returns focus after Escape but preserves a newer focus choice`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, errors } = await mount(browser); await openLibrary(page);
      const before = await saved(page), trigger = page.getByRole('button', { name, exact: true });
      const search = page.getByRole('searchbox', { name: 'Search', exact: true });
      await trigger.click(); await page.getByRole(role, { name: role === 'dialog' ? 'Filters' : undefined }).waitFor();
      await page.keyboard.press('Escape');
      await page.waitForFunction(name => document.activeElement?.getAttribute('aria-label') === name, name);
      await trigger.click(); await holdFrames(page); await page.keyboard.press('Escape');
      await page.getByRole(role, { name: role === 'dialog' ? 'Filters' : undefined }).waitFor({ state: 'hidden' });
      await search.focus(); assert.equal(await search.evaluate(n => n === document.activeElement), true);
      await page.evaluate(() => window.releaseHeldFrames());
      assert.equal(await search.evaluate(n => n === document.activeElement), true, 'a deferred menu callback cannot replace the later focus target');
      assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`closing a destination preserves a newer focus choice (${reducedMotion})`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, errors } = await mount(browser); await page.emulateMedia({ reducedMotion });
      const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
      const trigger = sidebar.getByRole('button', { name: 'Docs', exact: true });
      if (!await trigger.isVisible()) await sidebar.getByRole('button', { name: 'Expand sidebar' }).click();
      const panel = page.getByRole('dialog', { name: 'Docs', exact: true });
      await trigger.click(); await panel.waitFor();
      await panel.getByRole('button', { name: 'Close Docs', exact: true }).click();
      await panel.waitFor({ state: 'detached' });
      await page.waitForFunction(node => document.activeElement === node, await trigger.elementHandle());
      await trigger.click(); await panel.waitFor(); await holdFrames(page);
      await panel.getByRole('button', { name: 'Close Docs', exact: true }).click();
      const next = page.getByRole('combobox', { name: 'Active Workbench' }); await next.focus();
      await panel.waitFor({ state: 'detached' });
      await page.evaluate(() => window.releaseHeldFrames());
      assert.equal(await next.evaluate(n => n === document.activeElement), true, 'closing animation and deferred return preserve newer focus');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
test('Library asset-menu dismissal preserves a later focus choice', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser); await openLibrary(page);
    const before = await saved(page), asset = page.locator('.lattice-browser-asset').first();
    const menu = page.getByRole('menu', { name: 'NFT category membership', exact: true });
    await asset.click({ button: 'right' }); await menu.waitFor();
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
    await page.waitForFunction(node => node === document.activeElement, await asset.elementHandle());
    await asset.click({ button: 'right' }); await menu.waitFor(); await holdFrames(page);
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
    const search = page.getByRole('searchbox', { name: 'Search', exact: true }); await search.focus();
    await page.evaluate(() => window.releaseHeldFrames());
    assert.equal(await search.evaluate(n => n === document.activeElement), true, 'asset-menu return cannot steal newer focus');
    assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Library inline cancellation restores its replaced trigger and respects newer focus', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser); await openLibrary(page);
    const before = await saved(page), create = page.getByRole('button', { name: 'Create Category', exact: true });
    const input = page.getByRole('textbox', { name: 'category name', exact: true });
    await create.click(); await input.fill('Cancelled category'); await input.press('Escape');
    await input.waitFor({ state: 'detached' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await create.evaluate(n => n === document.activeElement), true, 'Escape returns to the newly rendered Create Category button');
    await create.click(); await input.fill('Also cancelled'); await holdFrames(page); await input.press('Escape');
    await input.waitFor({ state: 'detached' });
    const search = page.getByRole('searchbox', { name: 'Search', exact: true }); await search.focus();
    await page.evaluate(() => window.releaseHeldFrames());
    assert.equal(await search.evaluate(n => n === document.activeElement), true, 'inline cancellation cannot steal newer focus');
    assert.equal(await page.getByRole('button', { name: 'Cancelled category', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Also cancelled', exact: true }).count(), 0);
    assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Library preferences survive close, Workbench switching and reload without editing the composition', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser); const before = await saved(page);
    await openLibrary(page);
    await page.getByRole('button', { name: 'Owned', exact: true }).click();
    await library(page).getByRole('button', { name: 'Filters: All', exact: true }).click();
    await page.getByRole('radio', { name: 'INSCAPE STUDIES', exact: true }).click();
    await page.keyboard.press('Escape');
    const search = library(page).getByRole('searchbox', { name: 'Search', exact: true });
    await library(page).getByLabel('Card size', { exact: true }).fill('230');
    await library(page).getByLabel('Labels', { exact: true }).uncheck();
    await library(page).getByRole('button', { name: 'Sort assets: A–Z', exact: true }).click();
    await page.getByRole('option', { name: 'Z–A', exact: true }).click();
    await search.fill('moon');
    await library(page).getByRole('button', { name: 'Resize Library', exact: true }).press('ArrowRight');
    await library(page).getByRole('button', { name: 'Close workspace', exact: true }).click();
    await openLibrary(page); assert.equal(await search.inputValue(), 'moon');
    await page.reload(); await openLibrary(page);
    assert.equal(await search.inputValue(), 'moon');
    assert.equal(await page.getByRole('button', { name: 'Owned', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await library(page).getByRole('button', { name: 'Filters: INSCAPE STUDIES', exact: true }).count(), 1);
    assert.equal(await library(page).getByLabel('Card size', { exact: true }).inputValue(), '230');
    assert.equal(await library(page).getByLabel('Labels', { exact: true }).isChecked(), false);
    assert.equal(await library(page).getByRole('button', { name: 'Sort assets: Z–A', exact: true }).count(), 1);
    const settings = (await prefs(page)).library;
    assert.ok(settings.libraryWidth > 300);
    await library(page).getByRole('button', { name: 'Close workspace', exact: true }).click();
    assert.deepEqual(await saved(page), before);
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('New Workbench name', { exact: true }).fill('Preference check');
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
    await openLibrary(page); assert.equal(await search.inputValue(), 'moon');
    assert.equal(await library(page).getByLabel('Card size', { exact: true }).inputValue(), '230');
    assert.deepEqual((await prefs(page)).library, settings);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('detached and stacked tabs, Text and screen utility positions restore after reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser); const before = await saved(page);
    await tab(page, 'Color').press('Shift+F10');
    await page.getByRole('menuitem', { name: /^Dock below Layers/ }).click();
    await tab(page, 'Color').and(page.locator(':focus')).waitFor();
    await tab(page, 'Info').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Detach Info', exact: true }).click();
    await tab(page, 'Info').and(page.locator(':focus')).waitFor();
    await dock(page, 'Info').getByRole('button', { name: 'Move Info panel', exact: true }).press('ArrowLeft');
    await dock(page, 'Info').locator('[data-edge="se"]').press('ArrowRight');
    await tab(page, 'Image').click(); await page.getByRole('button', { name: 'Close Image', exact: true }).click();
    await tab(page, 'Layers').click();
    await page.locator('[data-layer-id^="text:"] .workbench-layer-name').click();
    await page.getByRole('button', { name: 'Text tool', exact: true }).click();
    const text = page.locator('.text-tools-window'); await text.waitFor();
    await page.getByRole('button', { name: 'Move Text tools window', exact: true }).press('ArrowLeft');
    await text.locator('[data-edge="se"]').press('ArrowRight');
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const navigator = page.getByRole('button', { name: 'Move Navigator window', exact: true });
    await page.getByLabel('Move Navigator window', { exact: true }).press('ArrowLeft');
    await page.getByLabel('Move Keeper dock window', { exact: true }).press('ArrowUp');
    await page.waitForFunction(key => { const value = JSON.parse(localStorage.getItem(key))?.value; return value?.navigator && Object.keys(value?.keeper || {}).length; }, key);
    const expected = await prefs(page);
    await page.reload(); await tab(page, 'Info').waitFor();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 2);
    assert.equal(await page.locator('.workbench-dock-pane').count(), 3);
    assert.equal(await tab(page, 'Image').count(), 0);
    const restored = await prefs(page);
    for (const field of ['library', 'textFrame', 'textOpen', 'navigator', 'keeper']) assert.deepEqual(restored[field], expected[field]);
    assert.deepEqual(restored.docks.groups, expected.docks.groups);
    assert.deepEqual(await saved(page), before);
    await page.setViewportSize({ width: 390, height: 700 });
    for (const panel of await page.locator('.workbench-tool-dock').all()) {
      const box = await panel.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 701);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const { theme, width, height } of [{ theme: 'mist', width: 1440, height: 1000 }, ...r12Cases]) {
test(`a failed preference save is visible, retryable and independent of the authored draft (${theme} ${width}x${height})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, theme, width, height); const before = await saved(page);
    // Reach the control before injecting its failure: opening the Library also
    // writes editor layout preferences, which is a different operation.
    await openLibrary(page);
    await page.evaluate(() => {
      const write = Storage.prototype.setItem;
      window.restorePreferenceWrites = () => { Storage.prototype.setItem = write; };
      Storage.prototype.setItem = function(key, value) { if (key.startsWith('inscape:editor-preferences:')) throw new DOMException('Quota', 'QuotaExceededError'); return write.call(this, key, value); };
    });
    await library(page).getByLabel('Card size', { exact: true }).fill('250');
    await page.getByText('Your editor preferences could not be saved. Keep this window open and retry.', { exact: false }).waitFor();
    assert.equal(await library(page).getByLabel('Card size', { exact: true }).inputValue(), '250');
    // A persistent error must leave the ordinary Library opener usable, too.
    // R12-OBS01 previously covered this button on short landscape viewports.
    const opener = page.getByRole('button', { name: 'Artwork library', exact: true });
    await pointerAction(page, library(page).getByRole('button', { name: 'Close workspace', exact: true }));
    await library(page).waitFor({ state: 'detached' });
    await pointerAction(page, opener);
    await library(page).waitFor();
    assert.equal(await library(page).getByLabel('Card size', { exact: true }).inputValue(), '250');
    const retry = page.getByRole('button', { name: 'Save current editor preferences', exact: true });
    // Keep the failure in place until the actual retry: a pending layout save
    // could otherwise recover between enabling writes and clicking the button.
    await retry.evaluate(node => node.addEventListener('click', () => window.restorePreferenceWrites(), { capture: true, once: true }));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/r12-preferences-${theme}-${width}x${height}.png` });
    await pointerAction(page, retry);
    await retry.waitFor({ state: 'detached' });
    assert.equal((await prefs(page)).library.assetSize, 250);
    await page.reload(); await openLibrary(page);
    assert.equal(await library(page).getByLabel('Card size', { exact: true }).inputValue(), '250');
    assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
}
for (const departure of ['pagehide', 'unmount']) test(`pending preferences flush before editing access is released on ${departure}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser); await openLibrary(page);
    // Change the real React input and depart in the same task, before the save timer.
    await page.evaluate(departure => {
      const input = document.querySelector('.system-workflow__workspace-size input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '271');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (departure === 'pagehide') dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      else window.leaveToolChromeEditor();
    }, departure);
    await page.getByText(departure === 'pagehide' ? 'This tab is view-only' : 'Editor closed', { exact: true }).waitFor();
    assert.equal((await prefs(page)).library.assetSize, 271);
    await page.reload(); await openLibrary(page);
    assert.equal(await library(page).getByLabel('Card size', { exact: true }).inputValue(), '271');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 900], [390, 520]]) test(`Library shares flat reference chrome and reachable controls (${theme} ${width}×${height})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, theme, width, height);
    await openLibrary(page); await mkdir(output, { recursive: true });
    const panel = library(page), search = panel.getByRole('searchbox', { name: 'Search', exact: true });
    const draftBeforeFocus = await saved(page);
    await panel.getByRole('button', { name: 'Close workspace', exact: true }).focus();
    const restingSearch = await search.boundingBox();
    await page.screenshot({ path: `${output}/search-rest-${theme}-${width}-${height}.png` });
    await search.click();
    const focusedSearch = await search.boundingBox();
    await page.screenshot({ path: `${output}/search-focus-${theme}-${width}-${height}.png` });
    console.log(JSON.stringify({ searchFocus: { theme, width, height, resting: restingSearch, focused: focusedSearch } }));
    for (const coordinate of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(restingSearch[coordinate] - focusedSearch[coordinate]) < 1, `search ${coordinate} stays fixed on pointer focus`);
    }
    await search.press('Shift+Tab'); await page.keyboard.press('Tab');
    assert.equal(await search.evaluate(node => node === document.activeElement), true, 'Tab returns to the search field');
    const keyboardSearch = await search.boundingBox();
    for (const coordinate of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(restingSearch[coordinate] - keyboardSearch[coordinate]) < 1, `search ${coordinate} stays fixed on keyboard focus`);
    }
    assert.deepEqual(await saved(page), draftBeforeFocus, 'search focus does not author composition content');
    await search.fill('moon');
    await page.waitForFunction(() => [...document.querySelectorAll('.lattice-browser-asset__media img')].some(image => image.complete && image.naturalWidth));
    await search.fill('');
    assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    assert.equal(await panel.evaluate(node => getComputedStyle(node).boxShadow), 'none');
    for (const control of [search, panel.getByLabel('Card size', { exact: true }), panel.getByRole('button', { name: 'Close workspace', exact: true }), page.getByRole('button', { name: 'Owned', exact: true }), page.getByRole('button', { name: 'Created', exact: true })]) {
      assert.equal(await control.evaluate(node => { const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); }), true);
    }
    await page.screenshot({ path: `${output}/library-${theme}-${width}-${height}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
