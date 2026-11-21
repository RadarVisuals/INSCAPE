import { sharedToolPanel, sharedToolTab, detachTool } from './fixtures/shared-tools.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

for (const theme of ['dark', 'light']) test(`Library divider retains its chosen width across panel resizing (${theme})`, { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/'))
        return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
      return route.abort();
    });
    await page.goto(origin + '/browser-tests/reception-editor-fixture.html?sample&image-choices&session=divider-' + theme);
    await page.getByRole('button', { name: 'Artwork library', exact: true }).waitFor();
    if (theme === 'light') await page.getByRole('switch', { name: 'Dark mode' }).uncheck();
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    const panel = sharedToolPanel(page, 'Library');
    const divider = page.getByRole('button', { name: 'Resize Browser navigation', exact: true });
    const edge = panel.locator('[data-edge="e"]');
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dragBy = async (target, dx) => {
      const box = await target.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 5 }); await page.mouse.up(); await settle();
    };
    const resize = async width => dragBy(edge, width - (await panel.boundingBox()).width);
    const draft = await page.evaluate(() => JSON.stringify(window.receptionFixture.root.getDraft()));
    await dragBy(divider, -250);
    const compactX = (await divider.boundingBox()).x;
    for (const width of [390, 418, 420, 422, 450, 500, 390]) {
      await resize(width);
      assert.equal((await divider.boundingBox()).x, compactX, 'outer resizing leaves the compact rail fixed');
    }
    const rail = page.locator('.lattice-browser-sidebar');
    const iconX = await rail.locator('button svg').first().evaluate(node => node.getBoundingClientRect().x);
    const originalHeight = (await panel.boundingBox()).height;
    const bottom = panel.locator('[data-edge="s"]');
    const edgeBox = await bottom.boundingBox();
    await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height / 2);
    await page.mouse.down(); await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height / 2 + 290 - originalHeight, { steps: 8 });
    await page.mouse.up(); await settle();
    assert.equal(await rail.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    assert.equal(await rail.evaluate(node => node.scrollHeight > node.clientHeight), true, 'rail really overflows');
    assert.equal(await rail.locator('button svg').first().evaluate(node => node.getBoundingClientRect().x), iconX);
    assert.equal((await divider.boundingBox()).x, compactX);
    await rail.hover(); await page.mouse.wheel(0, 300);
    await page.waitForFunction(() => document.querySelector('.lattice-browser-sidebar').scrollTop > 0);
    await rail.getByRole('button', { name: 'All Assets', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Owned', exact: true }).evaluate(node => document.activeElement === node), true);
    await page.screenshot({ path: '.browser-test-runtime/library-divider/' + theme + '-rail-overflow.png' });
    const compactBottom = await bottom.boundingBox();
    await page.mouse.move(compactBottom.x + compactBottom.width / 2, compactBottom.y + compactBottom.height / 2);
    await page.mouse.down(); await page.mouse.move(compactBottom.x + compactBottom.width / 2, compactBottom.y + compactBottom.height / 2 + originalHeight - 290, { steps: 8 });
    await page.mouse.up(); await settle();
    await page.getByRole('button', { name: 'New Library item', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Section', exact: true }).click();
    const name = page.getByRole('textbox', { name: 'section name', exact: true });
    assert.ok((await name.boundingBox()).width >= 130, 'naming is readable');
    await name.press('Escape'); await settle();
    assert.equal((await divider.boundingBox()).x, compactX, 'temporary naming width does not change the saved rail');
    await dragBy(divider, 116);
    const expandedX = (await divider.boundingBox()).x;
    assert.ok(expandedX > compactX + 100, 'the divider remains independently resizable');
    for (const width of [418, 422, 500, 390]) {
      await resize(width); assert.equal((await divider.boundingBox()).x, expandedX);
    }
    await dragBy(divider, -250);
    await page.getByRole('button', { name: 'Library display options', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Labels', exact: true }).uncheck();
    await page.getByRole('slider', { name: 'Card size', exact: true }).focus(); await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    const badge = page.locator('[data-library-images-for]').first();
    const media = badge.locator('..').locator('.lattice-browser-asset__media').first();
    const checkBadge = async () => {
      const b = await badge.boundingBox(), m = await media.boundingBox();
      assert.ok(b.x >= m.x && b.y >= m.y && b.x + b.width <= m.x + m.width && b.y + b.height <= m.y + m.height, 'count overlays only the cover');
      assert.equal(await badge.locator('svg').count(), 0);
      assert.match((await badge.textContent()).trim(), /^\d+$/);
    };
    await checkBadge(); await badge.focus(); await page.keyboard.press('Enter');
    assert.equal(await badge.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Enter'); assert.equal(await badge.getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: '.browser-test-runtime/library-divider/' + theme + '-wide.png' });
    await page.setViewportSize({ width: 760, height: 900 }); await settle();
    assert.equal((await divider.boundingBox()).x, compactX); await checkBadge();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '.browser-test-runtime/library-divider/' + theme + '-narrow.png' });
    assert.equal(await page.evaluate(() => JSON.stringify(window.receptionFixture.root.getDraft())), draft);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const theme of ['dark', 'light']) test(`Library keeps square tiles, explicit navigation and a bounded drag picker (${theme})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'images.inscape.test') return route.fulfill({ path: 'public/assets/actors/abyssal_eye/full.webp' });
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
      return route.abort();
    });
    await page.goto(origin + '/browser-tests/library-images-fixture.html');
    await page.getByRole('button', { name: 'Artwork library', exact: true }).click();
    if (theme === 'light') await page.getByRole('switch', { name: 'Dark mode' }).uncheck();
    await detachTool(page, 'Library');
    const panel = sharedToolPanel(page, 'Library');
    const navigation = page.getByRole('navigation', { name: 'Browser navigation' });
    const view = page.getByRole('button', { name: 'Library display options', exact: true });
    const setView = async mode => { await view.click(); await page.getByRole('button', { name: mode, exact: true }).click(); await page.keyboard.press('Escape'); };
    const before = await page.evaluate(() => JSON.stringify(window.__imageTest.draft()));
    await view.click(); await page.getByRole('checkbox', { name: 'Labels', exact: true }).uncheck();
    await page.getByRole('slider', { name: 'Card size', exact: true }).fill('80'); await page.keyboard.press('Escape');
    await panel.locator('[data-edge="e"]').press('Shift+ArrowRight');
    const namedWidth = (await navigation.boundingBox()).width;
    const squares = async () => {
      const sizes = await panel.locator('.lattice-browser-asset__media').evaluateAll(nodes => nodes.map(n => {
        const r = n.getBoundingClientRect(); return [r.width, r.height, n.parentElement.getBoundingClientRect().width];
      }));
      assert.ok(sizes.length >= 7);
      for (const [w, h, card] of sizes) { assert.ok(Math.abs(w - h) < .1); assert.equal(card, 80); assert.equal(w, 78); }
    };
    await squares();
    await panel.locator('[data-library-images-for]').first().click(); await squares();
    await panel.locator('[data-edge="e"]').press('Shift+ArrowRight'); await squares();
    await setView('Icons'); assert.equal((await navigation.boundingBox()).width, 44);
    await squares();
    const folders = navigation.getByRole('button', { name: 'Folders', exact: true });
    await folders.click();
    const flyout = page.getByRole('dialog', { name: 'File artwork into folder', exact: true });
    await panel.locator('[data-library-folder-tile]').first().waitFor();
    assert.equal(await flyout.count(), 0, 'browsing folders replaces content without an overlay');
    assert.equal(await page.locator('.system-workflow__sidebar-hover-label').count(), 0);
    await panel.locator('[data-library-folder-tile]').first().click();
    await panel.locator('.lattice-browser-asset').first().waitFor();
    assert.match(await panel.locator('.library-breadcrumbs').innerText(), /PORTFOLIO/);
    await navigation.getByRole('button', { name: 'All Assets', exact: true }).click();
    const source = panel.locator('.system-workflow__library-item > button').first();
    const from = await source.boundingBox(), toFolders = await folders.boundingBox();
    await page.mouse.move(from.x + 30, from.y + 35); await page.mouse.down();
    await page.mouse.move(toFolders.x + toFolders.width / 2, toFolders.y + toFolders.height / 2, { steps: 12 });
    await flyout.waitFor();
    const pickerBox = await flyout.boundingBox(), panelBox = await panel.boundingBox();
    assert.ok(pickerBox.height <= 300 && pickerBox.y >= panelBox.y && pickerBox.y + pickerBox.height <= panelBox.y + panelBox.height, 'drag picker stays content-sized and inside Library');
    assert.equal(await navigation.getByRole('button', { name: 'Owned', exact: true }).getAttribute('title'), null);
    const destination = flyout.getByRole('button', { name: 'FIELD NOTES', exact: true });
    const to = await destination.boundingBox();
    await page.mouse.move(to.x + 45, to.y + to.height / 2, { steps: 10 }); await page.mouse.up();
    await flyout.waitFor({ state: 'detached' });
    await folders.click();
    await page.waitForFunction(() => document.querySelector('[data-library-folder-tile][data-browser-category-id="field-notes"] small')?.textContent === '3 assets');
    await navigation.getByRole('button', { name: 'All Assets', exact: true }).click();
    await folders.click();
    await panel.getByRole('button', { name: 'New Library item', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Section', exact: true }).click();
    await panel.getByRole('textbox', { name: 'section name', exact: true }).fill('Characters');
    await panel.getByRole('textbox', { name: 'section name', exact: true }).press('Enter');
    await panel.getByRole('button', { name: 'Add folder to Characters', exact: true }).click();
    const name = panel.getByRole('textbox', { name: 'folder name', exact: true });
    await name.fill('Poses'); await name.press('Enter');
    assert.match(await panel.locator('.library-breadcrumbs').innerText(), /Poses/);
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Folders');
    await folders.click();
    const newFolder = panel.getByRole('button', { name: 'Poses 0 assets', exact: true });
    assert.equal(await newFolder.count(), 1);
    await newFolder.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
    await name.fill('Nomad poses'); await name.press('Enter');
    assert.equal(await panel.getByRole('button', { name: 'Nomad poses 0 assets', exact: true }).count(), 1);
    assert.equal(await flyout.count(), 0, 'creation and renaming stay in the content area');
    await panel.screenshot({ path: `.browser-test-runtime/library-folder-view-${theme}.png` });
    await navigation.getByRole('button', { name: 'All Assets', exact: true }).click();
    await setView('Names'); assert.equal((await navigation.boundingBox()).width, namedWidth);
    await setView('Icons');
    for (let i = 0; i < 6; i++) await panel.locator('[data-edge="e"]').press('Shift+ArrowLeft');
    assert.ok((await panel.boundingBox()).width <= 320); await squares();
    assert.equal(await panel.evaluate(n => n.scrollWidth <= n.clientWidth), true);
    await panel.getByRole('button', { name: 'Library window options', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Dock on right', exact: true }).click();
    assert.equal(await panel.getAttribute('data-dock-side'), 'right');
    await panel.getByRole('button', { name: 'Library window options', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Floating', exact: true }).click();
    assert.equal(await panel.getAttribute('data-side-docked'), null);
    await page.waitForFunction(() => Object.keys(localStorage).some(key => {
      if (!key.includes('editor-preferences')) return false;
      const saved = JSON.parse(localStorage.getItem(key));
      return saved?.value?.docks?.groups.some(group => group.panes.some(pane => pane.tabs.length === 1 && pane.tabs[0] === 'Library')) && saved.value.library.navigationMode === 'icons';
    }));
    await page.reload(); await page.getByRole('button', { name: 'Artwork library', exact: true }).click(); await panel.waitFor();
    assert.equal((await navigation.boundingBox()).width, 44, 'navigation mode survives reload'); await squares();
    // Review membership is session-only; production-store filing/reload is covered by library-organization.
    await folders.click(); await panel.locator('[data-library-folder-tile]').first().waitFor();
    assert.equal(await flyout.count(), 0);
    await sharedToolTab(page, 'Library').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Dock with Layers', exact: true }).click();
    await sharedToolPanel(page, 'Layers').getByRole('tab', { name: 'Library', exact: true }).waitFor();
    assert.equal((await navigation.boundingBox()).width, 44, 'returning to the tab retains the live Library preferences');
    assert.equal(await page.evaluate(() => JSON.stringify(window.__imageTest.draft())), before, 'organising and window controls do not edit the composition');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
