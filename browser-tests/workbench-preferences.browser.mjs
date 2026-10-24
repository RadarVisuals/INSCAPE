import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/workbench-preferences';
const key = 'inscape:workbench:preferences:0x9999999999999999999999999999999999999999';
const retryName = 'Save current Workbench preferences';
const settings = page => page.getByRole('dialog', { name: 'Settings', exact: true });
async function openSettings(page) {
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await sidebar.waitFor();
  const trigger = sidebar.getByRole('button', { name: 'Settings', exact: true, includeHidden: true });
  if (!await trigger.isVisible()) await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await trigger.click(); await settings(page).waitFor();
}
async function mount(browser, width, corrupt = false) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  if (corrupt) await page.addInitScript(key => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, '{broken'); sessionStorage.setItem('seeded', 'yes'); }
  }, key);
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&persistent&theme=mist`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  return { page, errors };
}
async function failWrites(page) {
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    window.blockedPreferences = new Set(['inscape:workbench:preferences:', 'inscape:editor-preferences:']);
    window.restorePreferenceWrites = () => { Storage.prototype.setItem = write; };
    Storage.prototype.setItem = function(key, value) {
      if ([...window.blockedPreferences].some(prefix => key.startsWith(prefix))) throw new DOMException('Quota', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
}
async function setSpacing(page, value) {
  const input = settings(page).getByLabel('Workbench grid cell size', { exact: true });
  await input.fill(String(value)); await input.press('Enter');
}

for (const width of [1440, 390]) test(`Workbench and editor save failures stay visible and retry independently (${width})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, width);
    const before = await page.evaluate(() => window.readToolChromeDraft());
    await openSettings(page); await failWrites(page); await setSpacing(page, 41);
    const retry = page.getByRole('button', { name: retryName, exact: true }); await retry.waitFor();
    await setSpacing(page, 52);
    assert.equal(await settings(page).getByLabel('Workbench grid cell size', { exact: true }).inputValue(), '52');
    assert.notEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gridSpacing, key), 52);
    await settings(page).getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    await page.getByRole('region', { name: 'Library workspace', exact: true }).getByLabel('Card size', { exact: true }).fill('250');
    const editorRetry = page.getByRole('button', { name: 'Save current editor preferences', exact: true });
    await editorRetry.waitFor();
    const a = await retry.boundingBox(), b = await editorRetry.boundingBox();
    assert.ok(a.y >= b.y + b.height, 'both recovery actions remain in separate visible rows');
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/preference-errors-${width}.png` });
    await retry.click(); await retry.waitFor(); // A failed retry must retain the error and latest value.
    await page.evaluate(() => window.blockedPreferences.delete('inscape:workbench:preferences:'));
    await retry.click(); await retry.waitFor({ state: 'detached' });
    await editorRetry.evaluate(node => node.addEventListener('click', () => window.restorePreferenceWrites(), { capture: true, once: true }));
    await editorRetry.click(); await editorRetry.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gridSpacing, key), 52);
    await page.reload({ waitUntil: 'domcontentloaded' }); await openSettings(page);
    assert.equal(await settings(page).getByLabel('Workbench grid cell size', { exact: true }).inputValue(), '52');
    assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a malformed Workbench preference record survives mount and edits until explicit replacement', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, 1440, true);
    const before = await page.evaluate(() => window.readToolChromeDraft());
    await page.getByText('Your saved Workbench preferences could not be read.', { exact: false }).waitFor();
    await openSettings(page); await setSpacing(page, 63);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{broken');
    await page.getByRole('button', { name: retryName, exact: true }).click();
    await page.reload({ waitUntil: 'domcontentloaded' }); await openSettings(page);
    assert.equal(await settings(page).getByLabel('Workbench grid cell size', { exact: true }).inputValue(), '63');
    assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('pending Workbench preferences survive a composition switch in the same profile', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, 1440);
    await openSettings(page); await failWrites(page); await setSpacing(page, 73);
    await settings(page).getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('textbox', { name: 'New Workbench name', exact: true }).fill('Other composition');
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
    await openSettings(page);
    assert.equal(await settings(page).getByLabel('Workbench grid cell size', { exact: true }).inputValue(), '73');
    const retry = page.getByRole('button', { name: retryName, exact: true }); await retry.waitFor();
    await page.evaluate(() => window.restorePreferenceWrites()); await retry.click();
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).gridSpacing, key), 73);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
