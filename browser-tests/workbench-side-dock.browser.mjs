import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/side-dock';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 2, `${a} != ${b}`);
async function drag(page, locator, point, cancel) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  if (cancel === 'escape') await page.keyboard.press('Escape');
  if (cancel === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up(); await settle(page);
}
for (const [width, height, theme] of [[1440, 900, 'dark'], [700, 650, 'light']]) test(`screen windows reach edges and share a reversible right dock (${width})`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
      return route.abort();
    });
    await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&persistent&theme=${theme}`);
    const nav = page.locator('.workbench-navigator'), keeper = page.locator('.keeper-dock-window'), tools = page.locator('.workbench-tool-dock').first();
    await page.getByRole('button', { name: 'Navigate Workbench', exact: true }).waitFor(); await settle(page);
    const sidebar = page.getByRole('button', { name: 'Inscape sidebar', exact: true });
    if (await sidebar.getAttribute('aria-expanded') === 'true') await sidebar.click();
    const before = await page.evaluate(() => window.readToolChromeDraft());
    await page.evaluate(() => { window.originalNavigator = document.querySelector('.navigator-map'); });
    // Keyboard movement can reach exact corners without dropping into the rail.
    for (const window of [nav, keeper]) {
      const grip = window.locator('.workbench-tool-panel-grip');
      await grip.focus();
      for (let i = 0; i < 65; i++) await grip.press('Shift+ArrowDown');
      for (let i = 0; i < 65; i++) await grip.press('Shift+ArrowRight');
      const box = await window.boundingBox(); near(box.x + box.width, width); near(box.y + box.height, height);
      await window.getByRole('button', { name: /Dock .* on right/ }).click();
      assert.equal(await window.getAttribute('data-side-docked'), 'true');
    }
    await tools.getByRole('button', { name: /Dock .* on right/ }).focus();
    await tools.getByRole('button', { name: /Dock .* on right/ }).click(); await settle(page);
    const n = await nav.boundingBox(), k = await keeper.boundingBox(), t = await tools.boundingBox();
    near(n.x + n.width, width); near(k.x, n.x); near(t.x, n.x); near(k.y, n.y + n.height); near(t.y, k.y + k.height); near(t.y + t.height, height);
    const stable = await nav.boundingBox();
    const west = await nav.locator('[data-edge="w"]').boundingBox();
    await drag(page, nav.locator('[data-edge="w"]'), { x: west.x + west.width / 2 - 50, y: stable.y + 50 }, 'escape');
    near((await nav.boundingBox()).width, stable.width);
    await drag(page, nav.locator('[data-edge="w"]'), { x: west.x + west.width / 2 - 90, y: stable.y + 50 });
    near((await nav.boundingBox()).width, stable.width + 90); near((await keeper.boundingBox()).width, stable.width + 90);
    const split = await nav.boundingBox();
    const south = await nav.locator('[data-edge="s"]').boundingBox();
    await drag(page, nav.locator('[data-edge="s"]'), { x: split.x + 70, y: south.y + south.height / 2 + 40 });
    near((await nav.boundingBox()).height, split.height + 40);
    for (const cancel of ['escape', 'blur']) {
      const original = await nav.boundingBox();
      await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: 180, y: 240 }, cancel);
      assert.equal(await nav.getAttribute('data-side-docked'), 'true'); near((await nav.boundingBox()).height, original.height);
    }
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/docked-${width}.png` });
    assert.equal(await page.evaluate(() => window.originalNavigator === document.querySelector('.navigator-map')), true, 'docking preserves the live Navigator');
    await page.reload(); await nav.waitFor(); await settle(page);
    assert.equal(await nav.getAttribute('data-side-docked'), 'true'); assert.equal(await keeper.getAttribute('data-side-docked'), 'true');
    near((await keeper.boundingBox()).width, stable.width + 90);
    await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: 200, y: 200 });
    assert.equal(await nav.getAttribute('data-side-docked'), null);
    const floating = await nav.boundingBox();
    const east = await nav.locator('[data-edge="e"]').boundingBox();
    await drag(page, nav.locator('[data-edge="e"]'), { x: east.x + east.width / 2 + 35, y: floating.y + 60 });
    near((await nav.boundingBox()).width, floating.width + 35);
    await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: width - 2, y: 100 });
    await page.screenshot({ path: `${output}/redocked-${width}.png` });
    assert.equal(await nav.getAttribute('data-side-docked'), 'true');
    await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('150');
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click();
    await keeper.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    const text = page.locator('.text-tools-window');
    await text.getByRole('button', { name: 'Dock Text on right', exact: true }).focus();
    await text.getByRole('button', { name: 'Dock Text on right', exact: true }).click();
    assert.equal(await text.getAttribute('data-side-docked'), 'true');
    const color = page.getByRole('tab', { name: 'Color', exact: true });
    await color.scrollIntoViewIfNeeded();
    await drag(page, color, { x: width - 2, y: height - 80 });
    assert.equal(await color.evaluate(node => node.closest('.workbench-tool-panel').hasAttribute('data-side-docked')), true, 'individual tool tabs can slot into the right dock');
    const bar = await page.locator('[data-workbench-toolbar]').boundingBox();
    assert.ok(bar.x + bar.width <= (await nav.boundingBox()).x, 'the creation toolbar stays beside the dock');
    assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), before, 'docking and resizing never author artwork');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
