import { undockWindow } from './fixtures/undock-window.mjs';
import { sharedToolTab, sharedToolPanel, detachTool } from './fixtures/shared-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorDestination, setEditorSidebarOpen, openEditorMenu } from './fixtures/editor-menu.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/side-dock';
async function dockWindow(page, panel, side) {
  const trigger = panel.getByRole('button', { name: / window options$/ });
  await trigger.focus(); await trigger.click();
  await page.getByRole('menuitemcheckbox', { name: 'Dock on ' + side, exact: true }).click();
}
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
for (const [width, theme] of [[1440, 'dark'], [760, 'light']]) test(`whole sidebars collapse without closing tools and retain their enclosure (${theme}, ${width})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/browser-tests/composition-native-editor-fixture.html?sample&session=sidebar-${theme}`);
    const layers = sharedToolPanel(page, 'Layers');
    const inspector = page.getByRole('region', { name: 'Inspector', exact: true });
    const navigator = page.getByRole('region', { name: 'Navigator', exact: true });
    await layers.waitFor(); await navigator.waitFor(); await settle(page);
    if (theme === 'light') await page.getByRole('switch', { name: 'Dark mode' }).uncheck();
    const original = await layers.boundingBox();
    await page.locator('main.system-workflow').press('Escape');
    assert.match(await inspector.innerText(), /Select a cell or artwork/);
    const emptyInspector = await inspector.boundingBox();
    near(emptyInspector.y + emptyInspector.height, 900);
    assert.equal(await inspector.evaluate(node => getComputedStyle(node).backgroundColor === getComputedStyle(node.querySelector('header')).backgroundColor), false, 'headers have their own derived tone');
    assert.equal(await inspector.evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
    const enclosure = page.locator('.editor-workspace-frame');
    assert.deepEqual(await enclosure.evaluate(node => {
      const s = getComputedStyle(node);
      return [s.borderTopLeftRadius, s.borderBottomLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius];
    }), ['0px', '0px', '0px', '0px'], 'attached edges meet the panels without nested corners');
    assert.equal(await inspector.getByRole('tab', { name: 'Inspector', exact: true }).evaluate(node => getComputedStyle(node).boxShadow), 'none', 'a sole panel title has no selection underline');
    const draft = await page.evaluate(() => {
      window.sidebarOriginalNodes = [...document.querySelectorAll('.workbench-tool-panel')];
      return window.nativeCompositionFixture.root.getDraft();
    });
    await page.getByRole('button', { name: 'Collapse left sidebar', exact: true }).click(); await settle(page);
    assert.equal(await layers.isVisible(), false); assert.equal(await navigator.isVisible(), false);
    assert.equal(await inspector.isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Expand left sidebar');
    await page.getByRole('button', { name: 'Collapse right sidebar', exact: true }).click(); await settle(page);
    assert.equal(await page.evaluate(() => window.sidebarOriginalNodes.every(node => node.isConnected && node.hidden)), true, 'all original tools remain mounted');
    const frame = await page.locator('.editor-workspace-frame').boundingBox();
    near(frame.x, 2); near(width - frame.x - frame.width, 2); near(900 - frame.y - frame.height, 2);
    assert.equal(await enclosure.evaluate(node => getComputedStyle(node).borderTopWidth), '1px');
    assert.deepEqual(await enclosure.evaluate(node => {
      const s = getComputedStyle(node);
      return [s.borderTopLeftRadius, s.borderBottomLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius];
    }), ['12px', '10px', '12px', '10px'], 'exposed edges retain the outer enclosure');
    for (const side of ['left', 'right']) {
      const reopen = page.getByRole('button', { name: `Expand ${side} sidebar`, exact: true });
      const button = await reopen.boundingBox();
      near(button.y - frame.y, 6);
      near(side === 'left' ? button.x - frame.x : frame.x + frame.width - button.x - button.width, 4);
      assert.equal(await reopen.evaluate(node => getComputedStyle(node).borderTopLeftRadius), '50%');
    }
    await page.getByRole('button', { name: 'Expand left sidebar', exact: true }).press('Enter'); await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Collapse left sidebar');
    assert.deepEqual(await layers.boundingBox(), original);
    assert.equal(await inspector.isVisible(), false);
    const collapse = page.getByRole('button', { name: 'Collapse left sidebar', exact: true });
    const controlBounds = await collapse.boundingBox();
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    assert.deepEqual(await collapse.boundingBox(), controlBounds, 'panel controls do not move between Layers and Library');
    const search = page.getByRole('searchbox', { name: 'Search', exact: true });
    const labels = await page.getByRole('button', { name: 'Library view options', exact: true }).boundingBox();
    const assets = await layers.locator('.lattice-browser-results').boundingBox();
    assert.ok(labels.y < assets.y, 'display controls stay above assets');
    assert.equal(await layers.locator('header').getByRole('button', { name: 'Layers and Library window options', exact: true }).count(), 1);
    assert.equal(await layers.locator('.system-workflow__library-header').count(), 0, 'no empty detach row');
    assert.equal(await layers.locator('.lattice-browser-sidebar-resize').isVisible(), true);
    assert.equal(await layers.getByRole('button', { name: /^Undock / }).count(), 0);
    await search.fill('skull');
    await page.getByRole('button', { name: 'Collapse left sidebar', exact: true }).click();
    const expand = page.getByRole('button', { name: 'Expand left sidebar', exact: true });
    await expand.hover(); await expand.press('Space');
    assert.equal(await search.inputValue(), 'skull', 'Library content survives collapse');
    await page.getByRole('button', { name: 'Collapse left sidebar', exact: true }).click();
    await page.waitForFunction(key => {
      const stored = localStorage.getItem(key);
      const collapsed = stored && JSON.parse(stored).value.sideDock.collapsed;
      return collapsed?.left && collapsed?.right;
    }, `native-composition:sidebar-${theme}:inscape:editor-preferences:v1:0x${'3'.repeat(40)}`);
    await page.reload();
    await page.getByRole('button', { name: 'Expand left sidebar', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Expand right sidebar', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Expand right sidebar', exact: true }).click();
    await editorDestination(page, 'Preview');
    await page.getByRole('dialog', { name: 'Composition preview' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Expand left sidebar', exact: true }).isVisible(), false, 'Preview has no editor handles');
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('button', { name: 'Expand left sidebar', exact: true }).waitFor();
    assert.equal(await inspector.isVisible(), true, 'Preview restores the previous independent sides');
    await page.getByRole('button', { name: 'Expand left sidebar', exact: true }).click();
    await layers.getByRole('tab', { name: 'Layers', exact: true }).click();
    await layers.getByRole('button', { name: 'Close Workbench Layers', exact: true }).click();
    assert.equal(await navigator.isVisible(), true, 'X closes a panel, not its sidebar');
    assert.deepEqual(await page.evaluate(() => window.nativeCompositionFixture.root.getDraft()), draft, 'shell actions never alter the Composition');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

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
    const sidebar = page.getByRole('button', { name: 'Inscape menu', exact: true });
    if (await sidebar.getAttribute('aria-expanded') === 'true') await sidebar.click();
    const toolbar = await stableToolbar(page);
    const menu = await page.locator('.editor-menu-bar').boundingBox(), dockY = menu.y + menu.height + 40;
    const before = await page.evaluate(() => window.readToolChromeDraft());
    for (const window of [nav, keeper, ...await page.locator('.workbench-tool-dock').all()]) {
      await undockWindow(page, window);
    }
    await page.evaluate(() => { window.originalNavigator = document.querySelector('.navigator-map'); });
    // Keyboard movement can reach exact corners without dropping into the rail.
    for (const window of [nav, keeper]) {
      const grip = window.locator('.workbench-tool-panel-grip');
      await grip.focus();
      for (let i = 0; i < 65; i++) await grip.press('Shift+ArrowDown');
      for (let i = 0; i < 65; i++) await grip.press(side === 'left' ? 'Shift+ArrowLeft' : 'Shift+ArrowRight');
      const box = await window.boundingBox(); near(side === 'left' ? box.x : box.x + box.width, side === 'left' ? 0 : width); near(box.y + box.height, height);
      await dockWindow(page, window, side);
      assert.equal(await window.getAttribute('data-side-docked'), 'true');
    }

    await dockWindow(page, tools, side); await settle(page);
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
    await drag(page, nav.locator('.workbench-tool-panel-grip'), { x: side === 'left' ? 2 : width - 2, y: dockY });
    await page.screenshot({ path: `${output}/redocked-${side}-${width}.png` });
    assert.equal(await nav.getAttribute('data-dock-side'), side);
    await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('150');
    await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click();
    await keeper.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    const text = sharedToolPanel(page);

    await dockWindow(page, text, side);
    assert.equal(await text.getAttribute('data-side-docked'), 'true');
    const inspector = sharedToolTab(page, 'Inspector');
    await inspector.scrollIntoViewIfNeeded();
    await drag(page, inspector, { x: side === 'left' ? 2 : width - 2, y: height - 80 });
    assert.equal(await inspector.evaluate(node => node.closest('.workbench-tool-panel').hasAttribute('data-side-docked')), true, 'the complete Inspector can slot into either dock');
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
    const menu = await page.locator('.editor-menu-bar').boundingBox(), dockY = menu.y + menu.height + 40;
    const before = await page.evaluate(() => window.readToolChromeDraft());
    const nav = page.locator('.workbench-navigator'), keeper = page.locator('.keeper-dock-window'), tools = page.locator('.workbench-tool-dock').first();
    for (const window of [nav, keeper, tools]) {
      await undockWindow(page, window);
    }
    await dockWindow(page, nav, 'left');
    await dockWindow(page, keeper, 'right');

    await dockWindow(page, tools, 'right');
    await editorDestination(page, 'Library');
    assert.ok((await sharedToolTab(page, 'Library').boundingBox()).y >= 40, 'Library opens below the measured menu');
    await detachTool(page, 'Library');
    const library = sharedToolPanel(page, 'Library');
    await page.evaluate(() => { window.originalLibrary = document.querySelector('.system-workflow__library'); });
    await dockWindow(page, library, 'left');
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
      await page.getByRole('button', { name: 'Actions', exact: true }).click();
      await page.getByRole('dialog', { name: 'Search commands', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `${output}/both-resized-${width}.png` });
      const resizedHandle = await edge.boundingBox();
      await drag(page, edge, { x: resizedHandle.x + resizedHandle.width / 2 - 400, y: initial.nav.y + 60 });
    }
    await setEditorSidebarOpen(page, true); await settle(page);
    assert.deepEqual(await read(), initial, 'opening navigation does not move docked windows');
    await stableToolbar(page, toolbar);
    assert.equal(await page.getByRole('button', { name: 'Inscape menu', exact: true }).getAttribute('aria-expanded'), 'true');
    await openEditorMenu(page, 'Tools');
    const libraryLink = page.getByRole('menuitemcheckbox', { name: 'Library', exact: true });
    assert.equal(await libraryLink.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'navigation receives input above the left dock');
    await page.screenshot({ path: `${output}/both-navigation-${width}.png` });
    await setEditorSidebarOpen(page, false);
    assert.equal(await page.evaluate(() => window.originalLibrary === document.querySelector('.system-workflow__library')), true);
    // Cross-edge moves use the same live Library; cancellation restores both stacks.
    for (const cancel of ['escape', 'blur']) {
      await drag(page, library.locator('.workbench-tool-panel-grip'), { x: width - 2, y: dockY }, cancel);
      assert.equal(await library.getAttribute('data-dock-side'), 'left');
      const after = await read();
      for (const id of Object.keys(initial)) { near(after[id].x, initial[id].x); near(after[id].height, initial[id].height); }
    }
    await drag(page, library.locator('.workbench-tool-panel-grip'), { x: width - 2, y: dockY });
    assert.equal(await library.getAttribute('data-dock-side'), 'right');
    await drag(page, library.locator('.workbench-tool-panel-grip'), { x: 2, y: 800 });
    assert.equal(await library.getAttribute('data-dock-side'), 'left');
    assert.equal(await page.evaluate(() => window.originalLibrary === document.querySelector('.system-workflow__library')), true);
    await page.screenshot({ path: `${output}/both-docks-${width}.png` });
    // A destination closes the overlay at all sizes; reopening Library retains its edge.
    await editorDestination(page, 'Activity');
    assert.equal(await page.getByRole('button', { name: 'Inscape menu', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', { name: 'Close activity', exact: true }).click();
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
