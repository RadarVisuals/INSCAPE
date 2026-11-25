import { openEditorMenu, editorDestination, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';
import { navigateWorkbench } from './fixtures/workbench-navigation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/destinations';
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
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
  await page.getByRole('button', { name: 'Inscape menu' }).waitFor();
  await setEditorSidebarOpen(page, false);
  const activate = async name => {
    if (name === 'Docs') await openEditorMenu(page, 'Docs');
    else await editorDestination(page, name);
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
      for (const name of ['Publish', 'Docs']) {
        await activate(name);
        const panel = page.locator('.workbench-destination-panel');
        await panel.waitFor();
        const box = await panel.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${name} fits the viewport`);
        assert.equal(await panel.getAttribute('data-workflow-finish'), 'flat');
        assert.equal(await panel.evaluate(n => getComputedStyle(n).borderRadius), '9px');
        assert.equal(await panel.evaluate(n => n.scrollWidth <= n.clientWidth), true, `${name} has no horizontal overflow`);
        assert.equal(await panel.evaluate(n => getComputedStyle(n).backgroundColor), theme === 'mist' ? 'rgb(235, 236, 231)' : 'rgb(8, 8, 8)');
        const close = panel.getByRole('button', { name: name === 'Publish' ? 'Close Publication' : `Close ${name}`, exact: true });
        assert.equal(await close.evaluate(hit), true, `${name} close stays reachable`);
        if (name === 'Publish') {
          const action = panel.getByRole('button', { name: 'Prepare publication', exact: true });
          assert.equal(await action.evaluate(hit), true, 'publication action stays reachable below scrollable copy');
          assert.equal(await panel.getByRole('region', { name: 'Alpha support' }).count(), 0);
        }
        if (name === 'Docs') {
          const tab = panel.getByRole('tab', { name: 'Studio', exact: true });
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

for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [320, 320]]) {
  test(`Movable Groups and Index share flat chrome: ${theme} ${width}×${height}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, errors } = await open(browser, width, height, theme, '&navigation-tools');
      if (height === 320) {
        await openEditorMenu(page, 'Tools');
        await page.getByRole('menuitemcheckbox', { name: 'Drawing toolbar', exact: true }).click();
      }
      const index = page.getByRole('complementary', { name: 'Index — Destinations', exact: true });
      await index.waitFor();
      for (const [name, panel, close] of [
        ['index', index, 'Close Index'],
        ['groups', page.getByRole('complementary', { name: 'Workbench groups — Groups', exact: true }), 'Close Workbench groups'],
      ]) {
        if (name === 'groups') {
          await navigateWorkbench(page, 'groups');
        }
        await panel.waitFor();
        await panel.locator('.workbench-tool-panel-grip').focus();
        const rect = await panel.boundingBox();
        assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `${name} fits`);
        assert.equal(await panel.getAttribute('data-window-chrome'), 'flat');
        assert.equal(await panel.evaluate(n => getComputedStyle(n).borderRadius), '9px');
        assert.equal(await panel.getByRole('button', { name: close }).evaluate(hit), true,
          JSON.stringify(await panel.getByRole('button', { name: close }).evaluate(node => {
            const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { panel: node.closest('[aria-label]')?.getAttribute('aria-label'), hit: hit?.outerHTML.slice(0, 500), rect: r.toJSON() };
          })));
        const content = panel.locator('.workbench-tool-panel-content');
        assert.equal(await content.evaluate(n => n.scrollWidth <= n.clientWidth && n.clientHeight >= 80), true, 'content remains usable without horizontal overflow');
        if (name === 'index') await panel.getByRole('button', { name: 'Add view', exact: true }).click();
        else await panel.getByText('Manage groups', { exact: true }).click();
        const field = panel.getByRole('textbox').first();
        await field.click();
        assert.equal(await field.evaluate(n => getComputedStyle(n).borderRadius), '7px');
        await page.screenshot({ path: `${output}/${name}-${theme}-${width}x${height}.png` });
        await panel.getByRole('button', { name: close }).click();
        await panel.waitFor({ state: 'detached' });
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
