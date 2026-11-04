import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorDestination, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/side-dock';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 2, `${a} != ${b}`);
async function stableToolbar(page, original) {
  const bar = page.getByRole('toolbar', { name: 'Creation tools', exact: true });
  const bounds = await bar.boundingBox();
  near(bounds.x + bounds.width / 2, page.viewportSize().width / 2);
  if (original) for (const key of ['x', 'y', 'width', 'height']) near(bounds[key], original[key]);
  for (const button of await bar.getByRole('button').all()) assert.equal(await button.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  }), true, 'each creation tool stays clickable over the docks');
  return bounds;
}
async function drag(page, locator, point, cancel) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 12 });
  if (cancel === 'escape') await page.keyboard.press('Escape');
  if (cancel === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up(); await settle(page);
}
for (const side of ['left', 'right']) for (const [width, height, theme] of [[1440, 900, 'dark'], [700, 650, 'light']]) test(`screen windows reach edges and share a reversible ${side} dock (${width})`, { timeout: 90000 }, async () => {
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
    const toolbar = await stableToolbar(page);
    const before = await page.evaluate(() => window.readToolChromeDraft());
    await page.evaluate(() => { window.originalNavigator = document.querySelector('.navigator-map'); });
    // Keyboard movement can reach exact corners without dropping into the rail.
    for (const window of [nav, keeper]) {
      const grip = window.locator('.workbench-tool-panel-grip');
      await grip.focus();
      for (let i = 0; i < 65; i++) await grip.press('Shift+ArrowDown');
      for (let i = 0; i < 65; i++) await grip.press(side === 'left' ? 'Shift+ArrowLeft' : 'Shift+ArrowRight');
      const box = await window.boundingBox(); near(side === 'left' ? box.x : box.x + box.width, side === 'left' ? 0 : width); near(box.y + box.height, height);
      await window.getByRole('button', { name: new RegExp(`Dock .* on ${side}`) }).click();
      assert.equal(await window.getAttribute('data-side-docked'), 'true');
    }
    await tools.getByRole('button', { name: new RegExp(`Dock .* on ${side}`) }).focus();
    await tools.getByRole('button', { name: new RegExp(`Dock .* on ${side}`) }).click(); await settle(page);
    const n = await nav.boundingBox(), k = await keeper.boundingBox(), t = await tools.boundingBox();
    near(side === 'left' ? n.x : n.x + n.width, side === 'left' ? 0 : width); near(k.x, n.x); near(t.x, n.x); near(k.y, n.y + n.height); near(t.y, k.y + k.height); near(t.y + t.height, height);
    const stable = await nav.boundingBox();
    const west = await nav.locator(`[data-edge="${side === 'left' ? 'e' : 'w'}"]`).boundingBox();
    await drag(page, nav.locator(`[data-edge="${side === 'left' ? 'e' : 'w'}"]`), { x: west.x + west.width / 2 + (side === 'left' ? 50 : -50), y: stable.y + 50 }, 'escape');
    near((await nav.boundingBox()).width, stable.width);
    await drag(page, nav.locator(`[data-edge="${side === 'left' ? 'e' : 'w'}"]`), { x: west.x + west.width / 2 + (side === 'left' ? 90 : -90), y: stable.y + 50 });
    near((await nav.boundingBox()).width, stable.width + 90); near((await keeper.boundingBox()).width, stable.width + 90);
    await stableToolbar(page, toolbar);
    const split = await nav.boundingBox();
    const south = await nav.locator('[data-edge="s"]').boundingBox();
    await drag(page, nav.locator('[data-edge="s"]'), { x: split.x + 70, y: south.y + south.height / 2 + 40 });
    near((await nav.boundingBox()).height, split.height + 40);
    for (const cancel of ['escape', 'blur']) {
      const original = await nav.boundingBox();
      await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: 180, y: 240 }, cancel);
      assert.equal(await nav.getAttribute('data-side-docked'), 'true'); near((await nav.boundingBox()).height, original.height);
    }
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/docked-${side}-${width}.png` });
    assert.equal(await page.evaluate(() => window.originalNavigator === document.querySelector('.navigator-map')), true, 'docking preserves the live Navigator');
    await page.reload(); await nav.waitFor(); await settle(page);
    assert.equal(await nav.getAttribute('data-side-docked'), 'true'); assert.equal(await keeper.getAttribute('data-side-docked'), 'true');
    near((await keeper.boundingBox()).width, stable.width + 90);
    await stableToolbar(page, toolbar);
    await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: 200, y: 200 });
    assert.equal(await nav.getAttribute('data-side-docked'), null);
    await stableToolbar(page, toolbar);
    const floating = await nav.boundingBox();
    const east = await nav.locator('[data-edge="e"]').boundingBox();
    await drag(page, nav.locator('[data-edge="e"]'), { x: east.x + east.width / 2 + 35, y: floating.y + 60 });
    near((await nav.boundingBox()).width, floating.width + 35);
    await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: side === 'left' ? 2 : width - 2, y: 100 });
    await page.screenshot({ path: `${output}/redocked-${side}-${width}.png` });
    assert.equal(await nav.getAttribute('data-dock-side'), side);
    await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('150');
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click();
    await keeper.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    const text = page.locator('.text-tools-window');
    await text.getByRole('button', { name: `Dock Text on ${side}`, exact: true }).focus();
    await text.getByRole('button', { name: `Dock Text on ${side}`, exact: true }).click();
    assert.equal(await text.getAttribute('data-side-docked'), 'true');
    const color = page.getByRole('tab', { name: 'Color', exact: true });
    await color.scrollIntoViewIfNeeded();
    await drag(page, color, { x: side === 'left' ? 2 : width - 2, y: height - 80 });
    assert.equal(await color.evaluate(node => node.closest('.workbench-tool-panel').hasAttribute('data-side-docked')), true, 'individual tool tabs can slot into either dock');
    await stableToolbar(page, toolbar);
    assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), before, 'docking and resizing never author artwork');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 700]) test(`both docks keep Library live beneath the navigation overlay (${width})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
      return route.abort();
    });
    await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&persistent&theme=${width === 700 ? 'light' : 'dark'}`);
    await page.getByRole('button', { name: 'Navigate Workbench', exact: true }).waitFor();
    await setEditorSidebarOpen(page, false);
    const toolbar = await stableToolbar(page);
    const before = await page.evaluate(() => window.readToolChromeDraft());
    const nav = page.locator('.workbench-navigator'), keeper = page.locator('.keeper-dock-window'), tools = page.locator('.workbench-tool-dock').first();
    await nav.getByRole('button', { name: 'Dock Navigator on left', exact: true }).click();
    await keeper.getByRole('button', { name: /Dock .* on right/ }).click();
    await tools.getByRole('button', { name: /Dock .* on right/ }).focus();
    await tools.getByRole('button', { name: /Dock .* on right/ }).click();
    await editorDestination(page, 'Library');
    assert.ok((await page.getByRole('button', { name: 'Detach Library', exact: true }).boundingBox()).y >= 40, 'Library opens below the measured menu');
    await page.getByRole('button', { name: 'Detach Library', exact: true }).click();
    const library = page.locator('.workbench-library-window');
    await page.evaluate(() => { window.originalLibrary = document.querySelector('.system-workflow__library'); });
    await library.getByRole('button', { name: 'Dock Library on left', exact: true }).click();
    await settle(page);
    const read = async () => ({ nav: await nav.boundingBox(), keeper: await keeper.boundingBox(), library: await library.boundingBox(), tools: await tools.boundingBox() });
    const initial = await read();
    near(initial.nav.x, 0); near(initial.library.x, 0); near(initial.library.y, initial.nav.y + initial.nav.height);
    near(initial.keeper.x + initial.keeper.width, width); near(initial.tools.y, initial.keeper.y + initial.keeper.height);
    assert.ok(initial.library.width < initial.keeper.x, 'both docks leave a central workspace');
    await stableToolbar(page, toolbar);
    if (width === 1440) {
      const edge = nav.locator('[data-edge="e"]'), handle = await edge.boundingBox();
      await drag(page, edge, { x: handle.x + handle.width / 2 + 400, y: initial.nav.y + 60 });
      const enlarged = await read();
      near(enlarged.nav.width, initial.nav.width + 400); near(enlarged.keeper.width, initial.keeper.width);
      await stableToolbar(page, toolbar);
      await page.getByRole('button', { name: 'Add module', exact: true }).click();
      await page.getByRole('dialog', { name: 'Add module', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `${output}/both-resized-${width}.png` });
      const resizedHandle = await edge.boundingBox();
      await drag(page, edge, { x: resizedHandle.x + resizedHandle.width / 2 - 400, y: initial.nav.y + 60 });
    }
    await setEditorSidebarOpen(page, true); await settle(page);
    assert.deepEqual(await read(), initial, 'opening navigation does not move docked windows');
    await stableToolbar(page, toolbar);
    assert.equal(await page.getByRole('button', { name: 'Inscape sidebar', exact: true }).getAttribute('aria-expanded'), 'true');
    const reception = page.locator('.workbench-sidebar').getByRole('button', { name: 'Editor', exact: true });
    assert.equal(await reception.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'navigation receives input above the left dock');
    await page.screenshot({ path: `${output}/both-navigation-${width}.png` });
    await setEditorSidebarOpen(page, false);
    assert.equal(await page.evaluate(() => window.originalLibrary === document.querySelector('.system-workflow__library')), true);
    // Cross-edge moves use the same live Library; cancellation restores both stacks.
    for (const cancel of ['escape', 'blur']) {
      await drag(page, library.locator('.workbench-tool-panel-grip'), { x: width - 2, y: 100 }, cancel);
      assert.equal(await library.getAttribute('data-dock-side'), 'left');
      const after = await read();
      for (const id of Object.keys(initial)) { near(after[id].x, initial[id].x); near(after[id].height, initial[id].height); }
    }
    await drag(page, library.locator('.workbench-tool-panel-grip'), { x: width - 2, y: 100 });
    assert.equal(await library.getAttribute('data-dock-side'), 'right');
    await drag(page, library.locator('.workbench-tool-panel-grip'), { x: 2, y: 800 });
    assert.equal(await library.getAttribute('data-dock-side'), 'left');
    assert.equal(await page.evaluate(() => window.originalLibrary === document.querySelector('.system-workflow__library')), true);
    await page.screenshot({ path: `${output}/both-docks-${width}.png` });
    // A destination closes the overlay at all sizes; reopening Library retains its edge.
    await editorDestination(page, 'Activity');
    assert.equal(await page.getByRole('button', { name: 'Inscape sidebar', exact: true }).getAttribute('aria-expanded'), 'false');
    await editorDestination(page, 'Editor');
    await editorDestination(page, 'Library'); await library.waitFor();
    assert.equal(await library.getAttribute('data-dock-side'), 'left');
    await page.reload(); await nav.waitFor(); await editorDestination(page, 'Library'); await library.waitFor(); await settle(page);
    assert.equal(await library.getAttribute('data-dock-side'), 'left');
    assert.equal(await keeper.getAttribute('data-dock-side'), 'right');
    assert.equal(await tools.getAttribute('data-dock-side'), 'right');
    assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
