import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { editorCommand, editorMenu } from './fixtures/editor-menu.mjs';
import { mkdir } from 'node:fs/promises';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
let browser;
test.before(async () => { browser = await chromium.launch({ executablePath, headless: true }); });
test.after(async () => { await browser?.close(); });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function mount(page, theme = 'carbon') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/browser-tests/workbench-toolbar-fixture.html?theme=${theme}`);
  await page.getByRole('toolbar', { name: 'Creation tools' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return errors;
}
const within = (box, width, height, label) => assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + .5 && box.y + box.height <= height + .5,
  `${label} stays inside ${width}×${height}: ${JSON.stringify(box)}`);
const appearance = locator => locator.evaluate(node => {
  const s = getComputedStyle(node), mark = getComputedStyle(node, '::after');
  return { color: s.color, background: s.background, shadow: s.boxShadow, outline: s.outlineWidth, outlineStyle: s.outlineStyle,
    marker: mark.display, transition: s.transitionDuration };
});

for (const [width, height, touch] of [[1576, 1244, false], [1440, 900, false], [1000, 800, false], [961, 900, false], [960, 900, false], [800, 650, false], [1000, 600, false]]) {
  test(`Flat toolbar and menus remain usable at ${width}×${height}${touch ? ' touch' : ''}`, { timeout: 60000 }, async () => {
    await mkdir(output, { recursive: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
      const errors = await mount(page);
      const toolbar = page.getByRole('toolbar', { name: 'Creation tools' });
      const buttons = toolbar.getByRole('button');
      assert.equal(await buttons.count(), 7);
      const bar = await toolbar.boundingBox(); within(bar, width, height, 'toolbar');
      assert.equal(await toolbar.evaluate(node => getComputedStyle(node).fontFamily), '"Inter Variable", Arial, sans-serif');
      if (width > 520) {
        assert.ok(bar.width < 500, 'icon toolbar stays compact on wide and narrow screens');
        assert.equal(bar.height, touch ? 52 : 44, 'single-row height includes padding around full input targets');
      }
      for (const button of await buttons.all()) {
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox(); within(box, width, height, await button.getAttribute('aria-label'));
        const persistent = ['Select tool', 'Hand tool', 'Text tool'].includes(await button.getAttribute('aria-label'));
        const expanded = width > 520 && persistent && await button.getAttribute('aria-pressed') === 'true';
        const target = touch || width <= 520 ? 44 : 36;
        if (expanded) assert.ok(box.width >= 82, 'selected persistent tool shows its label');
        else assert.equal(box.width, target, 'icon key retains its full input width');
        assert.ok(box.height >= target, 'full input height');
        assert.ok(box.x >= bar.x && box.x + box.width <= bar.x + bar.width + .5 && box.y >= bar.y && box.y + box.height <= bar.y + bar.height + .5, 'keys stay inside their shell');
      }
      assert.equal(await page.locator('.workbench-view-controls').count(), 0, 'one central toolbar in the Editor');
      assert.equal(await buttons.evaluateAll(nodes => new Set(nodes.map(node => node.getBoundingClientRect().y)).size), 1, 'all seven tools share one row');
      await page.screenshot({ path: `${output}/toolbar-${width}.png` });
      if (width === 1576) await page.screenshot({ path: `${output}/reference-toolbar.png`, clip: { x: bar.x - 16, y: bar.y - 12, width: bar.width + 32, height: bar.height + 28 } });
      await editorCommand(page, 'Edit', 'Search commands');
      const search = page.getByRole('textbox', { name: 'Search commands' });
      assert.equal(await search.evaluate(node => node === document.activeElement), true);
      const popup = page.getByRole('dialog', { name: 'Search commands' });
      within(await popup.boundingBox(), width, height, 'popup');
      assert.ok((await popup.boundingBox()).y + (await popup.boundingBox()).height <= bar.y - 7);
      if (touch) assert.ok(Number.parseFloat(await search.evaluate(node => getComputedStyle(node).fontSize)) >= 16);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('End');
      const finalCommand = page.locator('.workbench-toolbar__command:not(:disabled)').last();
      assert.equal(await finalCommand.evaluate(node => node === document.activeElement), true);
      const visible = await finalCommand.boundingBox(), scroll = await page.locator('.workbench-toolbar__commands').boundingBox();
      assert.ok(visible.y >= scroll.y && visible.y + visible.height <= scroll.y + scroll.height + 1, 'keyboard scroll exposes the whole command');
      await page.screenshot({ path: `${output}/toolbar-menu-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await editorMenu(page, 'Edit').evaluate(node => node === document.activeElement), true, 'Escape restores trigger focus');
      assert.deepEqual(errors, []);
    } finally { for (const context of browser.contexts()) await context.close(); }
  });
}

test('Flat states preserve selection, focus, creation and readable contrast', { timeout: 60000 }, async () => {
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = await mount(page);
    const hand = page.getByRole('button', { name: 'Hand tool', exact: true });
    const before = await hand.boundingBox(), resting = await appearance(hand);
    await hand.hover();
    assert.notEqual((await appearance(hand)).background, resting.background, 'available controls respond to hover');
    await page.mouse.down();
    assert.notEqual((await appearance(hand)).background, resting.background, 'press has a visible flat fill');
    assert.deepEqual(await hand.boundingBox(), before, 'press never shifts the hit target');
    await page.mouse.up();
    assert.equal(await hand.getAttribute('aria-pressed'), 'true');
    await page.mouse.move(1, 1); await page.waitForTimeout(150);
    const selected = await appearance(hand);
    await hand.hover(); await page.waitForTimeout(150);
    assert.deepEqual(await appearance(hand), selected, 'hover preserves the selected material');
    assert.equal(selected.marker, 'none', 'active toolbar icons have no underline');
    assert.equal(selected.shadow, 'none', 'flat controls have no relief shadow');
    assert.notEqual(selected.background, resting.background, 'inverted fill identifies the active tool');
    await editorCommand(page, 'Edit', 'Search commands');
    const disabled = page.getByRole('dialog', { name: 'Search commands' }).getByRole('button', { name: /Artwork info/ });
    assert.equal(await disabled.isDisabled(), true);
    const unavailable = await appearance(disabled);
    await disabled.hover(); assert.deepEqual(await appearance(disabled), unavailable, 'disabled command never gains hover depth');
    await page.keyboard.press('Escape');
    // Escape and the creation shortcuts still use the real owner adapter.
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('t');
    await page.locator('.workbench-creation-hint').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Text tool', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed'), 'true');
    await editorCommand(page, 'Edit', 'Search commands');
    await page.getByRole('textbox', { name: 'Search commands' }).fill('Horizontal');
    assert.equal(await page.locator('.workbench-toolbar__command').count(), 0, 'experimental Display creation is absent from search');
    await page.keyboard.press('Escape');
    const action = page.getByRole('button', { name: 'Add module', exact: true });
    await action.focus();
    assert.equal((await appearance(action)).outline, '2px', 'keyboard focus remains visible after closing');
    // Measure text/accent contrast against the actual flat surface.
    const contrast = await page.locator('.workbench-toolbar[data-workflow-material]').evaluate(node => {
      const s = getComputedStyle(node), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const surface = rgb(s.getPropertyValue('--tactile-surface').trim());
      const brightest = surface;
      const luminance = values => values.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      return ['--tactile-ink', '--tactile-muted', '--tactile-accent'].map(token => {
        const color = rgb(s.getPropertyValue(token).trim()), a = ctx.getImageData(0, 0, 1, 1).data[3] / 255;
        const opaque = color.map((value, i) => value * a + brightest[i] * (1 - a));
        return [token, (Math.max(luminance(opaque), luminance(brightest)) + .05) / (Math.min(luminance(opaque), luminance(brightest)) + .05)];
      });
    });
    for (const [token, ratio] of contrast) assert.ok(ratio >= 4.5, `${token}: ${ratio.toFixed(2)} contrast`);
    console.log('Material text contrast:', contrast.map(([token, ratio]) => `${token} ${ratio.toFixed(2)}:1`).join(', '));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal((await appearance(action)).transition, '0s');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.getByRole('button', { name: 'Select tool', exact: true }).focus();
    const highContrast = await appearance(page.getByRole('button', { name: 'Select tool', exact: true }));
    assert.equal(highContrast.marker, 'none'); assert.equal(highContrast.outline, '2px');
    assert.notEqual(highContrast.background, (await appearance(hand)).background, 'system highlight identifies selection without an underline');
    await page.screenshot({ path: `${output}/toolbar-forced-colors.png` });
    assert.deepEqual(errors, []);
  } finally { for (const context of browser.contexts()) await context.close(); }
});

for (const theme of ['carbon', 'mist']) for (const width of [1440, 800]) {
  test(`production toolbar uses the shared flat recipe with Display creation parked (${theme}, ${width})`, { timeout: 60000 }, async () => {
    await mkdir(output, { recursive: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 520 });
      const errors = await mount(page, theme);
      assert.equal(await page.locator('html').getAttribute('data-interface-theme'), theme === 'mist' ? 'light' : 'dark', 'theme comes from the shared device preference');
      const root = page.locator('[data-workbench-toolbar]');
      const recipe = await root.evaluate(node => {
        const s = getComputedStyle(node), key = getComputedStyle(node.querySelector('button')), shell = getComputedStyle(node.querySelector('[aria-label="Creation tools"]'));
        const icon = getComputedStyle(node.querySelector('svg.lucide > *'));
        return { scheme: s.colorScheme, face: s.getPropertyValue('--tactile-face').trim(), radius: key.borderRadius, shellRadius: shell.borderRadius, stroke: icon.strokeWidth, vector: icon.vectorEffect };
      });
      assert.deepEqual(recipe, { scheme: theme === 'mist' ? 'light' : 'dark', face: theme === 'mist' ? '#ebece7' : '#080808', radius: '5px', shellRadius: '9px', stroke: '1.5px', vector: 'non-scaling-stroke' });
      // The accepted migrations now include the sidebar, switcher, Navigator and shared tools.
      // Keep an explicit surface boundary, including the otherwise classless dock material root.
      const migrated = await page.locator('main.system-workflow [data-workflow-finish="flat"]').evaluateAll(nodes => nodes.map(node => {
        for (const name of ['workbench-toolbar', 'workbench-navigator', 'workbench-layers', 'context-toolbar', 'editor-menu-shell', 'workspace-navigation']) {
          if (node.classList.contains(name)) return name;
        }
        if (node.matches('[data-workbench-navigator]')) return 'workbench-navigator';
        if (!node.className && node.matches('[data-workbench-selection-tools][data-system-workflow-overlay][data-lattice-menu-surface]') && (!node.children.length || node.querySelector(':scope > .workbench-tool-dock'))) return 'shared-tool-dock';
        return 'unrecognized:' + node.outerHTML.slice(0, 180);
      }));
      assert.deepEqual(migrated.sort(), ['shared-tool-dock', 'context-toolbar', 'workbench-navigator', 'editor-menu-shell', 'workbench-toolbar', 'workspace-navigation', ...(width > 520 ? ['workbench-layers'] : [])].sort(), 'only the accepted mounted surfaces opt into flat styling');
      const select = page.getByRole('button', { name: 'Select tool', exact: true });
      await select.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.getByRole('button', { name: 'Hand tool', exact: true }).evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('End');
      const add = page.getByRole('button', { name: 'Add module', exact: true });
      assert.equal(await add.evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Enter');
      let dialog = page.getByRole('dialog', { name: 'Add module', exact: true });
      assert.equal(await dialog.locator('header').count(), 0);
      assert.equal(await dialog.getByRole('button', { name: /Close/ }).count(), 0);
      assert.equal(await dialog.getByRole('button', { name: /Display|Horizontal|Vertical|Custom size/i }).count(), 0, 'Display is absent rather than disabled');
      for (const name of ['Image', 'Text', 'Rectangle', 'Grid']) {
        assert.equal(await dialog.getByRole('button', { name, exact: true }).isEnabled(), true, `${name} remains available`);
      }
      assert.equal(await page.locator('[data-display-instance]').count(), 1, 'an existing Display remains mounted');
      await page.screenshot({ path: `${output}/add-modules-${theme}-${width}.png` });
      await add.click();
      assert.equal(await root.getByRole('dialog').count(), 0, 'trigger toggles the menu closed');
      await add.click(); await page.mouse.click(width - 12, 12);
      assert.equal(await root.getByRole('dialog').count(), 0, 'outside dismissal');
      const actions = editorMenu(page, 'Edit');
      await editorCommand(page, 'Edit', 'Search commands');
      const search = page.getByRole('textbox', { name: 'Search commands' });
      const inset = await search.evaluate(node => { const a = node.getBoundingClientRect(), b = node.closest('[role="dialog"]').getBoundingClientRect(); return [a.left - b.left, b.right - a.right]; });
      assert.deepEqual(inset, [4, 4]);
      await page.screenshot({ path: `${output}/toolbar-${theme}-${width}.png` });
      await search.fill('Workbench grid');
      const grid = root.getByRole('button', { name: 'Workbench grid', exact: true });
      const selected = await grid.getAttribute('aria-pressed');
      await page.keyboard.press('Enter');
      assert.equal(await root.getByRole('dialog').count(), 0);
      await editorCommand(page, 'Edit', 'Search commands'); await search.fill('Workbench grid');
      assert.notEqual(await grid.getAttribute('aria-pressed'), selected, 'real preference callback still changes the grid');
      await page.keyboard.press('Escape');
      assert.equal(await actions.evaluate(node => node === document.activeElement), true);
      const workspace = page.locator('main.system-workflow');
      await workspace.focus(); await page.keyboard.press('Shift+F10');
      const commands = page.getByRole('menu', { name: 'Workbench commands', exact: true });
      await commands.getByRole('menuitem', { name: 'ADD', exact: true }).click();
      assert.equal(await commands.getByRole('menuitem', { name: /DISPLAY|HORIZONTAL|VERTICAL|CUSTOM SIZE/ }).count(), 0, 'context menu shares the same creation choices');
      await commands.getByRole('menuitem', { name: 'IMAGE', exact: true }).click();
      await page.locator('[data-image-module] .image-module__canvas').waitFor();
      assert.equal(await page.locator('[data-display-instance]').count(), 1, 'creating an Image does not replace an existing Display');
      assert.deepEqual(errors, []);
    } finally { for (const context of browser.contexts()) await context.close(); }
  });
}
