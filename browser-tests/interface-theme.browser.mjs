import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5217';
const output = '.browser-test-runtime/interface-theme';
const button = (page, name) => page.getByRole('button', { name, exact: true });
const palette = async (page, selector) => page.locator(selector).first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }));
const colors = { dark: { environment: 'rgb(23, 23, 23)', panel: 'rgb(8, 8, 8)', ink: 'rgb(235, 236, 231)' }, light: { environment: 'rgb(222, 219, 211)', panel: 'rgb(235, 236, 231)', ink: 'rgb(23, 23, 23)' } };
async function open(page, path) { await page.goto(origin + path, { waitUntil: 'domcontentloaded' }); }
async function capture(page, name) { await page.mouse.move(1435, 5); await page.screenshot({ path: `${output}/${name}.png` }); }

test('one Settings choice governs owner controls, portal menus, reception, overview, login and Discover', { timeout: 120000 }, async () => {
 const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
   const url = new URL(route.request().url());
   if (url.origin === origin) return route.continue();
   const asset = url.hostname === 'raw.githubusercontent.com' && url.pathname.split('/public/')[1];
   return asset ? route.fulfill({ path: 'public/' + asset }) : route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir(output, { recursive: true });
  await open(page, '/browser-tests/workbench-storage-fixture.html?seed=1&shell=1');
  await button(page, 'Settings').click();
  for (const mode of ['light', 'dark']) {
   const content = await page.evaluate(() => JSON.stringify(window.savedDraft()));
   const expected = colors[mode];
   await button(page, mode.toUpperCase()).click(); await page.mouse.move(1435, 5);
   assert.deepEqual(await palette(page, '.system-workflow__settings'), { background: expected.panel, color: expected.ink });
   assert.deepEqual(await palette(page, '.interface-theme-toggle [aria-pressed=true]'), { background: expected.ink, color: expected.panel });
   assert.equal((await palette(page, '.system-workflow')).background, expected.environment);
   assert.equal(await page.getByRole('button', { name: /Menu theme|Workbench background/ }).count(), 0);
   await page.getByRole('button', { name: /Workbench grid display/ }).click();
   assert.deepEqual(await palette(page, '[role=listbox]'), { background: expected.panel, color: expected.ink });
   await page.keyboard.press('Escape');
   await capture(page, `settings-${mode}`);
   assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), content);
   await button(page, 'Close Settings').click(); await page.locator('.system-workflow__settings').waitFor({ state: 'detached' });
   await button(page, 'Overview').click(); await page.locator('.composition-index').waitFor();
   assert.equal((await palette(page, '.workbench-overview')).background, expected.environment);
   assert.equal((await palette(page, '.composition-explorer-viewport')).background, expected.panel);
   await capture(page, `overview-${mode}`);
   await button(page, 'Edit canvas').click(); await button(page, 'Settings').click();
  }
  await button(page, 'LIGHT').click();
  await open(page, '/browser-tests/reception-editor-fixture.html?sample&session=theme-review');
  await button(page, 'Settings').click(); await page.getByRole('tab', {name: 'Grid',exact:true}).click();
  assert.equal(await button(page, 'LIGHT').getAttribute('aria-pressed'), 'true');
  assert.equal((await palette(page, '.reception-window')).background, colors.light.panel);
  const reception = await page.evaluate(() => JSON.stringify(receptionFixture.root.getBackupSnapshot()));
  await button(page, 'DARK').click();
  assert.equal((await palette(page, '.reception-window')).background, colors.dark.panel);
  assert.equal(await page.evaluate(() => JSON.stringify(receptionFixture.root.getBackupSnapshot())), reception);
  await capture(page, 'reception-dark');
  for (const mode of ['dark', 'light']) {
   await button(page, mode.toUpperCase()).click();
   const publicPage = await context.newPage(); publicPage.setDefaultTimeout(20000);
   publicPage.on('pageerror', e => errors.push(e.message));
   for (const path of ['/', '/?discover=']) {
    await open(publicPage, path); await publicPage.locator('.public-entry-portal').waitFor();
    await publicPage.locator('.startveil[data-exiting]').waitFor({state:'detached'});
    await publicPage.waitForFunction(() => !document.querySelector('.startveil') || document.querySelector('.startveil[data-ready]'));
    const expected = colors[mode];
    assert.deepEqual(await palette(publicPage, '.public-entry-portal'), { background: expected.environment, color: expected.ink });
    await capture(publicPage, `${path === '/' ? 'login' : 'discover'}-${mode}`);
   }
   await open(publicPage, '/browser-tests/discover-style-fixture.html');
   await button(publicPage, 'Open Discover').click();
   await publicPage.locator('.public-entry-portal__world-card').first().waitFor();
   assert.equal((await palette(publicPage, '.public-entry-portal__world-card')).background, colors[mode].panel);
   await publicPage.locator('.public-entry-portal__world-card').first().locator('img.is-ready').first().waitFor();
   await capture(publicPage, `discover-filled-${mode}`);
   await publicPage.close();
  }
  assert.deepEqual(errors, []);
 } finally { await browser.close(); }
});
