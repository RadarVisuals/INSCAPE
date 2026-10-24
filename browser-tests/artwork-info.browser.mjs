import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { openDisplayTool, activate } from './fixtures/display-controls.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/artwork-info';
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const toolbar = page => page.locator('[data-workbench-toolbar]').getByRole('button', { name: 'Artwork info', exact: true });
const info = page => page.getByRole('article', { name: 'Artwork metadata', exact: true });
const saved = page => page.evaluate(() => window.readToolChromeDraft());
async function mount(browser, theme = 'mist', width = 1440, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&theme=${theme}`);
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  if (!await tab(page, 'Layers').count()) await page.locator('[data-workbench-toolbar]').getByRole('button', { name: 'Layers', exact: true }).click();
  await tab(page, 'Layers').click();
  await page.locator('[data-layer-id^="image:"] .workbench-layer-name').click();
  await toolbar(page).click(); await info(page).waitFor();
  return { page, errors };
}
test('Image info follows visible sides, detaches and rejoins without editing content or history', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser);
    const before = await saved(page), sides = before.imageModules[0].sides;
    await info(page).getByRole('heading', { name: sides[0].asset.name, exact: true }).waitFor();
    assert.ok((await info(page).innerText()).includes(sides[0].asset.description));
    await info(page).getByText('Source details', { exact: true }).click();
    assert.ok((await info(page).innerText()).includes(sides[0].asset.contractAddress));
    await tab(page, 'Info').press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Detach Info', exact: true }).press('Enter');
    assert.equal(await page.locator('.workbench-tool-dock').count(), 2);
    assert.equal(await info(page).count(), 1);
    assert.equal(await info(page).locator('details').getAttribute('open'), '');
    await tab(page, 'Info').press('Shift+F10');
    await page.getByRole('menuitem', { name: /^Dock with Layers/ }).click();
    assert.equal(await page.locator('.workbench-tool-dock').count(), 1);
    assert.equal(await info(page).locator('details').getAttribute('open'), '');
    const next = page.getByRole('button', { name: 'Next Image side', exact: true });
    await activate(page, next);
    await info(page).getByRole('heading', { name: sides[1].asset.name, exact: true }).waitFor();
    assert.ok(!(await info(page).innerText()).includes(sides[0].asset.name));
    await page.getByRole('button', { name: 'Close Info', exact: true }).click();
    assert.equal(await info(page).count(), 0);
    await toolbar(page).click();
    await info(page).getByRole('heading', { name: sides[1].asset.name, exact: true }).waitFor();
    await tab(page, 'Layers').click();
    await page.locator('[data-layer-id^="shape:"] .workbench-layer-name').click();
    assert.equal(await toolbar(page).isDisabled(), true);
    await tab(page, 'Info').click();
    await page.getByText('Select one artwork with source information.', { exact: true }).waitFor();
    assert.equal(await info(page).count(), 0);
    await tab(page, 'Layers').click();
    await page.locator('[data-layer-id^="image:"] .workbench-layer-name').click({ modifiers: ['Control'] });
    await tab(page, 'Info').click();
    assert.equal(await info(page).count(), 0, 'multiple selection cannot show stale Image info');
    assert.deepEqual(await saved(page), before, 'metadata and docking do not edit authored content');
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await saved(page), before, 'no metadata operation creates Undo history');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('New Workbench name', { exact: true }).fill('Info check');
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
    await tab(page, 'Info').click();
    assert.equal(await info(page).count(), 0, 'new Workbench has no stale registration');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 568]]) test(`Info retains source details and scroll containment (${theme} ${width}x${height})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, theme, width, height);
    await mkdir(output, { recursive: true });
    await info(page).getByText('Source details', { exact: true }).click();
    const source = info(page).getByRole('link', { name: 'View asset source', exact: true });
    await source.scrollIntoViewIfNeeded();
    const dock = page.locator('.workbench-tool-dock').filter({ has: tab(page, 'Info') });
    const frame = await dock.boundingBox(), link = await source.boundingBox();
    assert.ok(frame.x >= 0 && frame.x + frame.width <= width + 1);
    assert.ok(frame.y >= 0 && frame.y + frame.height <= height + 1);
    assert.ok(link.y >= frame.y && link.y + link.height <= frame.y + frame.height);
    assert.equal(await info(page).evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await info(page).getByText('Source details', { exact: true }).click();
    assert.equal(await info(page).locator('summary').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
    await info(page).locator('summary').press('Tab'); await page.keyboard.press('Shift+Tab');
    assert.notEqual(await info(page).locator('summary').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
    await tab(page, 'Info').click();
    await dock.locator('.workbench-tools-body').evaluate(node => { node.scrollTop = 0; });
    await info(page).getByRole('heading').first().click();
    await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    await page.getByRole('button', { name: 'Close Info', exact: true }).click();
    if (width < 600) {
      await page.getByRole('button', { name: 'Close Workbench Layers', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Keeper settings', exact: true }).evaluate(node => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), true, 'closing the dock leaves Keeper reachable');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('reference Info shares the artwork presentation and follows selection in both themes', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/design-system.html#components`);
      const studio = page.locator('.ds-studio');
      for (const theme of ['carbon', 'mist']) {
        await page.getByLabel('Preview surface').selectOption(theme);
        await studio.getByLabel('Workspace selection').selectOption('image');
        await studio.getByRole('button', { name: 'Artwork info', exact: true }).click();
        await studio.getByRole('article', { name: 'Artwork metadata', exact: true }).waitFor();
        assert.equal(await studio.locator('.ds-studio-auxiliary').count(), 0);
        await studio.screenshot({ path: `${output}/reference-${theme}-${width}.png` });
        await studio.getByLabel('Workspace selection').selectOption('shape');
        await studio.getByText('Select one artwork with source information.', { exact: true }).waitFor();
        assert.equal(await studio.getByRole('button', { name: 'Artwork info', exact: true }).isDisabled(), true);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
test('Display metadata routes to the same Info tab with no duplicate owner window', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser);
    const before = await saved(page);
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    await openDisplayTool(page, board, 'METADATA');
    const cue = board.getByRole('button', { name: /^Read metadata for / }).first();
    await activate(page, cue);
    await info(page).waitFor();
    assert.equal(await tab(page, 'Info').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[data-shared-tool="metadata"]').count(), 1);
    assert.equal(await page.locator('[data-shared-display-tools] aside').count(), 0);
    assert.equal(await board.getAttribute('data-inspecting'), null);
    assert.deepEqual(await saved(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
