import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/destinations';
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
const interactionState = page => page.locator('main.system-workflow').evaluate(node => ({
  camera: { zoom: node.querySelector('.navigator-zoom output')?.textContent,
    frames: [...node.querySelectorAll('[data-workbench-view-id]')].map(module => ({ id: module.dataset.workbenchViewId, rect: module.getBoundingClientRect().toJSON() })) },
  selection: node.querySelector('.workbench-view-controls__selection-count')?.textContent,
  activeTargets: [...node.querySelectorAll('[data-workbench-view-id][data-window-active]')].map(module => module.dataset.workbenchViewId),
}));
async function open(browser, width, height, theme, suffix = '') {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 600 });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&theme=${theme}${suffix}`);
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await sidebar.waitFor();
  const activate = async name => {
    const button = sidebar.getByRole('button', { name, exact: true, includeHidden: true });
    if (!await button.isVisible()) await sidebar.getByRole('button', { name: 'Expand sidebar' }).click();
    await button.click();
  };
  return { page, activate, errors };
}

for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [320, 320]]) {
  test(`Destination windows use shared reachable chrome: ${theme} ${width}×${height}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, activate, errors } = await open(browser, width, height, theme);
      const draft = await page.evaluate(() => window.readToolChromeDraft());
      const camera = () => page.locator('main.system-workflow').evaluate(n => [n.dataset.workbenchCameraX, n.dataset.workbenchCameraY, n.dataset.workbenchCameraScale]);
      const beforeCamera = await camera();
      await mkdir(output, { recursive: true });
      for (const name of ['Publish', 'Docs', 'Profile', 'Grids']) {
        await activate(name);
        const panel = page.locator('.workbench-destination-panel');
        await panel.waitFor();
        const box = await panel.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${name} fits the viewport`);
        assert.equal(await panel.getAttribute('data-workflow-finish'), 'flat');
        assert.equal(await panel.evaluate(n => getComputedStyle(n).borderRadius), '9px');
        assert.equal(await panel.evaluate(n => n.scrollWidth <= n.clientWidth), true, `${name} has no horizontal overflow`);
        assert.equal(await panel.evaluate(n => getComputedStyle(n).backgroundColor), theme === 'mist' ? 'rgb(235, 236, 231)' : 'rgb(25, 27, 27)');
        const close = panel.getByRole('button', { name: name === 'Publish' ? 'Close Publication' : `Close ${name}`, exact: true });
        assert.equal(await close.evaluate(hit), true, `${name} close stays reachable`);
        if (name === 'Publish') {
          const action = panel.getByRole('button', { name: 'Prepare publication', exact: true });
          assert.equal(await action.evaluate(hit), true, 'publication action stays reachable below scrollable copy');
          assert.equal(await panel.getByRole('region', { name: 'Alpha support' }).count(), 0);
        }
        if (name === 'Docs') {
          const tab = panel.getByRole('tab', { name: 'Workbench', exact: true });
          await tab.click();
          assert.equal(await tab.evaluate(n => getComputedStyle(n).outlineStyle), 'none', 'pointer has no focus box');
          await tab.press('End');
          assert.notEqual(await panel.getByRole('tab', { name: 'Publish', exact: true }).evaluate(n => getComputedStyle(n).outlineStyle), 'none', 'keyboard focus is visible');
          assert.equal(await panel.getByRole('tab', { name: 'Publish', exact: true }).getAttribute('aria-selected'), 'true');
          assert.equal(await panel.getByRole('tab', { name: 'Publish', exact: true }).evaluate(hit), true);
          await page.keyboard.press('Home');
          await panel.getByRole('tabpanel').evaluate(n => { n.scrollTop = n.scrollHeight; });
          assert.equal(await close.evaluate(hit), true, 'Docs scroll never hides its close button');
        }
        await page.screenshot({ path: `${output}/${name.toLowerCase()}-${theme}-${width}x${height}.png` });
        await close.click();
        await panel.waitFor({ state: 'detached' });
      }
      assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), draft, 'browsing chrome does not edit the composition');
      assert.deepEqual(await camera(), beforeCamera, 'browsing chrome does not change the camera');
      assert.equal(await page.getByRole('button', { name: 'Keeper settings', exact: true }).evaluate(hit), true);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Grids keeps rename, visibility, duplicate and delete with local cancellation', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, activate, errors } = await open(browser, 390, 640, 'mist');
    await activate('Grids');
    const panel = page.getByRole('complementary', { name: 'Grids', exact: true });
    await panel.getByRole('button', { name: 'New Grid', exact: true }).click();
    const row = panel.locator('.system-workflow__grid-row:not([data-world-cover])').last();
    await row.getByRole('button', { name: /^Rename / }).click();
    const input = row.getByRole('textbox');
    await input.fill('Temporary'); await input.press('Escape');
    assert.equal(await panel.isVisible(), true, 'rename Escape does not close the whole panel');
    await row.getByRole('button', { name: /^Rename / }).click();
    await row.getByRole('textbox').fill('Layered scene');
    await row.getByRole('button', { name: 'Confirm rename' }).click();
    await row.getByRole('button', { name: 'Make Layered scene public' }).click();
    await row.getByRole('button', { name: 'Make Layered scene private' }).waitFor();
    await row.getByRole('button', { name: 'Duplicate Layered scene' }).click();
    const copy = panel.locator('.system-workflow__grid-row:not([data-world-cover])').last();
    await copy.getByRole('button', { name: /^Delete / }).click();
    await panel.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).focus();
    const beforeEscape = await interactionState(page);
    assert.equal(beforeEscape.selection, '1 selected', 'Escape starts with selected artwork behind the dialog');
    assert.deepEqual(beforeEscape.activeTargets, [await page.evaluate(() => window.readToolChromeDraft().texts[0].id)], 'the original Text remains the active target');
    await page.keyboard.press('Escape');
    assert.equal(await panel.getByRole('alertdialog').count(), 0);
    const afterEscape = await interactionState(page);
    const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') }));
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/grid-escape-state.json`, JSON.stringify({ beforeEscape, afterEscape, focus }, null, 2));
    assert.equal(await panel.isVisible(), true, 'delete Escape keeps Grids open');
    assert.deepEqual(afterEscape, beforeEscape, 'local cancellation preserves selected artwork and camera');
    assert.equal(await copy.getByRole('button', { name: /^Delete / }).evaluate(node => node === document.activeElement), true, 'local cancellation returns focus to its Delete trigger');
    await copy.getByRole('button', { name: /^Delete / }).click();
    await panel.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    assert.equal(await panel.locator('.system-workflow__grid-row:not([data-world-cover])').count(), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [320, 320]]) {
  test(`Movable Groups and Index share flat chrome: ${theme} ${width}×${height}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, errors } = await open(browser, width, height, theme, '&navigation-tools');
      const index = page.getByRole('complementary', { name: 'Index — Destinations', exact: true });
      await index.waitFor();
      for (const [name, panel, close] of [
        ['index', index, 'Close Index'],
        ['groups', page.getByRole('complementary', { name: 'Workbench groups — Groups', exact: true }), 'Close Workbench groups'],
      ]) {
        if (name === 'groups') {
          // Floating Keeper/Navigator windows can overlap the rail on a tiny
          // viewport. This case checks the panel; open it through its keyboard action.
          const opener = page.getByRole('button', { name: 'Workbench groups', exact: true });
          await opener.focus(); await opener.press('Enter');
        }
        await panel.waitFor();
        const rect = await panel.boundingBox();
        assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `${name} fits`);
        assert.equal(await panel.getAttribute('data-window-chrome'), 'flat');
        assert.equal(await panel.evaluate(n => getComputedStyle(n).borderRadius), '9px');
        assert.equal(await panel.getByRole('button', { name: close }).evaluate(hit), true);
        assert.equal(await panel.locator('.system-workflow__instrument-content').evaluate(n => n.scrollWidth <= n.clientWidth && n.clientHeight >= 80), true, 'content remains usable without horizontal overflow');
        if (name === 'index') assert.equal(await panel.getByRole('separator').first().evaluate(n => getComputedStyle(n, '::after').display), 'none', 'resize targets have no visible handles');
        const field = panel.getByRole('textbox').first();
        await field.click();
        assert.equal(await field.evaluate(n => getComputedStyle(n).borderRadius), '5px');
        await page.screenshot({ path: `${output}/${name}-${theme}-${width}x${height}.png` });
        await panel.getByRole('button', { name: close }).click();
        await panel.waitFor({ state: 'detached' });
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
