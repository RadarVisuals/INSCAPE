import { editorCommand, editorOverview } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/interface-theme';
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
  await editorCommand(page, 'Edit', 'Settings');
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
   await editorOverview(page); await page.locator('.composition-index').waitFor();
   assert.equal((await palette(page, '.workbench-overview')).background, expected.environment);
   assert.equal((await palette(page, '.composition-explorer-viewport')).background, expected.panel);
   await capture(page, `overview-${mode}`);
   await button(page, 'Edit canvas').click(); await editorCommand(page, 'Edit', 'Settings');
  }
  await button(page, 'LIGHT').click();
  await open(page, '/browser-tests/reception-editor-fixture.html?sample&session=theme-review');
  await editorCommand(page, 'Edit', 'Settings');
  assert.equal(await button(page, 'LIGHT').getAttribute('aria-pressed'), 'true');
  assert.equal((await palette(page, '.system-workflow__settings')).background, colors.light.panel);
  assert.equal((await palette(page, '.system-workflow')).background, colors.light.environment);
  const reception = await page.evaluate(() => JSON.stringify(receptionFixture.root.getBackupSnapshot()));
  await button(page, 'DARK').click();
  assert.equal((await palette(page, '.system-workflow__settings')).background, colors.dark.panel);
  assert.equal((await palette(page, '.system-workflow')).background, colors.dark.environment);
  assert.equal(await page.evaluate(() => JSON.stringify(receptionFixture.root.getBackupSnapshot())), reception);
  await capture(page, 'reception-dark');
  for (const mode of ['dark', 'light']) {
   await button(page, mode.toUpperCase()).click();
   const publicPage = await context.newPage(); publicPage.setDefaultTimeout(20000);
   publicPage.on('pageerror', e => errors.push(e.message));
   await open(publicPage, '/browser-tests/reception-editor-fixture.html?public&session=theme-review');
   await publicPage.locator('.reception-page').waitFor();
   assert.deepEqual(await palette(publicPage, '.reception-page'), { background: colors[mode].environment, color: colors[mode].ink });
   assert.equal((await palette(publicPage, '.reception-document-canvas')).background, colors[mode].environment);
   await capture(publicPage, `public-reception-${mode}`);
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

test('Workbench outside background and reveal shading repaint their actual pixels with the global mode', { timeout: 60000 }, async () => {
 const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await open(page, '/browser-tests/workbench-storage-fixture.html?seed=1&shell=1');
  await editorCommand(page, 'Canvas', 'Canvas size');
  const size = page.getByRole('group', { name: 'Canvas size controls', exact: true });
  await size.getByLabel('Width (px)', { exact: true }).fill('480');
  await size.getByLabel('Height (px)', { exact: true }).fill('320');
  await size.getByRole('button', { name: 'Apply', exact: true }).click();
  await button(page, 'Show outside canvas').click();
  await button(page, 'Close canvas size').click();
  await editorCommand(page, 'Edit', 'Settings');
  const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
  const pixels = () => page.evaluate(() => ['[data-workbench-area]', '[data-workbench-outside-shade]'].map(selector => {
   const canvas = document.querySelector(selector);
   return [...canvas.getContext('2d').getImageData(canvas.width - 4, canvas.height - 4, 1, 1).data];
  }));
  await mkdir(output, { recursive: true });
  for (const mode of ['dark', 'light', 'dark']) {
   await button(page, mode.toUpperCase()).click();
   const expected = mode === 'dark' ? [23, 23, 23] : [222, 219, 211];
   const [outside, shade] = await pixels();
   assert.deepEqual(outside, [...expected, 255], 'painted exterior uses the shared environment');
   shade.slice(0, 3).forEach((channel, index) => assert.ok(Math.abs(channel - expected[index]) <= 1, 'reveal shade uses the same colour'));
   assert.equal(shade[3], 166, 'reveal remains 65% opaque');
   await capture(page, `workbench-background-${mode}`);
  }
  await button(page, 'Close Settings').click();
  const beforePan = await pixels();
  await page.mouse.move(1050, 600); await page.keyboard.down('Space');
  await page.mouse.down(); await page.mouse.move(1120, 640, { steps: 6 });
  await page.mouse.up(); await page.keyboard.up('Space');
  assert.deepEqual(await pixels(), beforePan, 'camera repaint retains the selected palette');
  assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved, 'mode and camera do not edit the composition');
  assert.deepEqual(errors, []);
 } finally { await browser.close(); }
});
