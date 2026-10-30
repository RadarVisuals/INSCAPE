import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/settings-finishing';
const profile = '0x9999999999999999999999999999999999999999';
const settings = page => page.getByRole('dialog', { name: 'Settings', exact: true });
const saved = page => page.evaluate(() => window.readToolChromeDraft());
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
async function open(page) {
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  const trigger = sidebar.getByRole('button', { name: 'Settings', exact: true, includeHidden: true });
  if (!await trigger.isVisible()) await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await trigger.click(); await settings(page).waitFor();
  return await trigger.isVisible() ? trigger : sidebar.getByRole('button', { name: 'Expand sidebar', exact: true });
}
async function mount(browser, theme = 'mist', width = 1440, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const pending = new Set();
  const started = request => pending.add(request.url());
  const finished = request => pending.delete(request.url());
  page.on('request', started); page.on('requestfinished', finished); page.on('requestfailed', finished);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  try {
    await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&persistent&theme=${theme}`);
  } catch (error) {
    console.error('Settings navigation diagnostics', JSON.stringify({ pending: [...pending], errors,
      document: await page.evaluate(() => ({ readyState: document.readyState, text: document.body.innerText,
        resources: performance.getEntriesByType('resource').map(({ name, duration }) => ({ name, duration })) })).catch(() => null) }));
    throw error;
  } finally {
    page.off('request', started); page.off('requestfinished', finished); page.off('requestfailed', finished);
  }
  await page.locator('.keeper-dock-window').waitFor();
  // The isolated fixture mounts below the app's normal signal/profile binding.
  await page.evaluate(async profile => {
    const { useSignalStore } = await import('/src/signals/state/useSignalStore.js');
    useSignalStore.getState().setProfileAddress(profile);
  }, profile);
  return { page, errors };
}

for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 900], [320, 568], [844, 390]]) {
  test(`Settings shares flat window chrome and keeps every section reachable (${theme} ${width}x${height})`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, errors } = await mount(browser, theme, width, height), before = await saved(page);
      const material = await page.locator('.keeper-dock-window').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node).borderRadius }));
      const trigger = await open(page), panel = settings(page), close = panel.getByRole('button', { name: 'Close Settings' });
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/settings-${theme}-${width}-top.png` });
      const box = await panel.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.equal(await panel.evaluate(node => getComputedStyle(node).boxShadow), 'none');
      assert.deepEqual(await panel.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node).borderRadius })), material);
      assert.equal(await close.evaluate(hit), true);
      const notification = panel.getByLabel('Activity notifications', { exact: true });
      await notification.scrollIntoViewIfNeeded(); assert.equal(await notification.evaluate(hit), true);
      await notification.click();
      assert.equal(await notification.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'pointer does not add a focus ring');
      await notification.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert.notEqual(await notification.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'keyboard focus remains visible');
      const background = panel.getByRole('button', { name: /^Workbench background:/ });
      await background.scrollIntoViewIfNeeded();
      // A user can scroll a selector to the top of the panel; its popup must flip.
      await background.evaluate(node => {
        const body = node.closest('.system-workflow__settings-body');
        body.scrollTop += node.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
      });
      await background.click();
      const menu = page.getByRole('listbox'); const menuBox = await menu.boundingBox();
      assert.ok(menuBox.y >= 0 && menuBox.y + menuBox.height <= height, 'selector stays inside the viewport');
      assert.equal(await menu.evaluate(node => getComputedStyle(node).backgroundColor), material.background, 'portalled menu uses the window material');
      assert.equal(await background.evaluate(node => getComputedStyle(node, '::after').content), 'none', 'no old heavy active bar');
      await page.keyboard.press('ArrowDown');
      assert.equal(await menu.locator(':focus').evaluate(hit), true, 'keyboard options remain reachable');
      await page.screenshot({ path: `${output}/settings-${theme}-${width}-menu.png` });
      await page.keyboard.press('Escape');
      const grid = panel.getByLabel('Workbench grid cell size', { exact: true });
      await grid.scrollIntoViewIfNeeded(); assert.equal(await grid.evaluate(hit), true);
      const windows = panel.getByRole('button', { name: /^Menu theme:/ });
      await windows.scrollIntoViewIfNeeded(); assert.equal(await windows.evaluate(hit), true);
      const file = panel.getByLabel('Open Workbench backup', { exact: true });
      await file.scrollIntoViewIfNeeded(); assert.equal(await file.evaluate(hit), true);
      assert.equal(await close.evaluate(hit), true, 'titlebar stays reachable while the body scrolls');
      await page.screenshot({ path: `${output}/settings-${theme}-${width}-backup.png` });
      await close.click();
      await panel.waitFor({ state: 'detached' });
      await trigger.and(page.locator(':focus')).waitFor();
      assert.equal(await settings(page).count(), 0);
      assert.deepEqual(await saved(page), before, 'reading Settings and local signal preferences do not edit the composition');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Settings keeps existing local persistence, interface theme and backup validation', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser), before = await saved(page); await open(page);
    const panel = settings(page);
    const speech = panel.getByLabel('Speech', { exact: true }), speechValue = !await speech.isChecked();
    await speech.setChecked(speechValue);
    await panel.getByLabel('Workbench grid cell size', { exact: true }).fill('41'); await page.keyboard.press('Tab');
    await panel.getByLabel('Space between modules', { exact: true }).fill('12');
    await panel.getByLabel('Workbench grid color', { exact: true }).fill('#8d73c2');
    await panel.getByRole('button', { name: /^Workbench grid display:/ }).click();
    await page.getByRole('option', { name: 'Dots', exact: true }).click();
    assert.deepEqual(await saved(page), before, 'local Workbench and signal controls do not author the composition');
    await panel.getByRole('button', { name: /^Menu theme:/ }).click();
    await page.getByRole('option', { name: 'Carbon', exact: true }).click();
    const changed = await saved(page);
    assert.equal(changed.appearance.menuSurfaceId, 'carbon');
    assert.deepEqual({ ...changed, appearance: before.appearance }, before, 'theme retains its existing appearance owner');
    await page.reload(); await page.locator('.keeper-dock-window').waitFor(); await open(page);
    await page.evaluate(async profile => {
      const { useSignalStore } = await import('/src/signals/state/useSignalStore.js');
      useSignalStore.getState().setProfileAddress(profile);
    }, profile);
    assert.equal(await speech.isChecked(), speechValue, 'signal preferences retain their existing profile storage');
    assert.equal(await panel.getByLabel('Workbench grid cell size', { exact: true }).inputValue(), '41');
    assert.equal(await panel.getByLabel('Space between modules', { exact: true }).inputValue(), '12');
    assert.equal(await panel.getByLabel('Workbench grid color', { exact: true }).inputValue(), '#8d73c2');
    assert.equal(await panel.getByRole('button', { name: 'Workbench grid display: Dots', exact: true }).count(), 1);
    assert.equal(await panel.getByRole('button', { name: 'Menu theme: Carbon', exact: true }).count(), 1);
    await panel.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
    await panel.getByRole('status').waitFor();
    assert.match(await panel.getByRole('status').innerText(), /backup|JSON/i);
    assert.deepEqual(await saved(page), changed, 'an invalid backup does not replace the draft');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
