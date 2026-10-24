import { setTextBackground } from './fixtures/shared-tools.mjs';
import { openTextToolSection } from './fixtures/text-tool-sections.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
import fs from 'node:fs';
import path from 'node:path';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5197';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
fs.mkdirSync(output, { recursive: true });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1, `${label}: ${actual} / ${expected}`);
const saved = page => page.evaluate(() => window.savedDraft());
const savedFrame = draft => draft.workbench.texts[0].window;

test('content-sized fixed-width windows recover their width after a narrow viewport', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route(`${origin}/__fit_window__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__fit_window__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { WorkbenchWindow } = await import('/src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/public/ownerSystemWorkflow/displayInstruments.css');
      function Fixture() {
        const [layout, setLayout] = React.useState({ width: 840 }), [height, setHeight] = React.useState(200);
        window.expandContent = () => setHeight(400); window.reportedWidth = layout.width;
        return React.createElement(WorkbenchWindow, { label: 'Fixed width', title: 'Measured content', width: layout.width, fitContent: true, initialX: 32, initialY: 80, onLayoutChange: setLayout },
          React.createElement('div', { style: { height } }, 'Measured content'));
      }
      createRoot(document.getElementById('root')).render(React.createElement('main', { className: 'system-workflow' }, React.createElement(Fixture)));
    });
    const win = page.locator('aside'); await win.waitFor();
    const initial = await win.boundingBox();
    await page.evaluate(() => window.expandContent()); await settle(page);
    near((await win.boundingBox()).height, initial.height + 200, 'height follows content');
    assert.equal(await win.getByRole('separator').count(), 0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await settle(page);
      near((await win.boundingBox()).width, Math.min(840, width - 16), 'visible width');
      assert.equal(await page.evaluate(() => window.reportedWidth), 840, 'viewport clipping does not replace fixed width');
    }
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`Text columns, inline title and module resize remain usable at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const tools = page.locator('.text-tools-window'), text = page.locator('.text-window');
    // The fixture's original frame starts underneath current navigation chrome.
    // Pan the camera through a clear canvas point, preserving authored geometry.
    if (width === 1440) await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    const beforePan = await saved(page), beforePanFrame = await text.boundingBox();
    await page.locator('main.system-workflow').focus();
    const panPoint = { x: width === 1440 ? width / 2 : 16, y: 780 };
    assert.equal(await page.evaluate(({ x, y }) => { const hit = document.elementFromPoint(x, y); return Boolean(hit?.closest('main.system-workflow')) && !hit.closest('[data-system-workflow-overlay]'); }, panPoint), true, 'camera pan starts on unobstructed canvas');
    await page.mouse.move(panPoint.x, panPoint.y);
    await page.keyboard.down('Space'); await page.mouse.down();
    await page.mouse.move(panPoint.x + (width === 1440 ? 32 : 0), panPoint.y + 96, { steps: 4 });
    await page.mouse.up(); await page.keyboard.up('Space');
    await settle(page);
    near((await text.boundingBox()).y, beforePanFrame.y + 96, 'camera exposes the action strip below navigation');
    assert.deepEqual(await saved(page), beforePan, 'camera arrangement preserves saved composition');
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    assert.equal((await saved(page)).texts[0].article.appearance.background, '#101111');
    assert.equal(await page.getByRole('combobox', { name: 'Insert Library artwork' }).count(), 0);
    const layout = await tools.boundingBox();
    assert.ok(layout.x >= 0 && layout.x + layout.width <= width);
    const settings = tools.locator('.text-tools-content');
    const overflow = await settings.evaluate(n => ({ x: n.scrollWidth - n.clientWidth, y: n.scrollHeight - n.clientHeight,
      overflowY: getComputedStyle(n).overflowY, bottom: n.getBoundingClientRect().bottom }));
    assert.ok(overflow.x <= 1, 'both settings columns fit without horizontal clipping');
    assert.ok(overflow.bottom <= layout.y + layout.height, 'settings scrolling stays inside the tool window');
    if (overflow.y > 1) {
      assert.equal(overflow.overflowY, 'auto', 'long settings retain their own scroll container');
      await settings.evaluate(n => { n.scrollTop = n.scrollHeight; });
      assert.ok(await settings.evaluate(n => n.scrollTop > 0), 'the lower settings are reachable');
    }
    assert.equal(await tools.locator('.workbench-tool-panel-resize').count(), 8, 'tools retain invisible resize edges');
    assert.deepEqual(await tools.getByRole('tab').allTextContents(), ['Format text', 'Article settings'], 'Text retains its two accepted settings scopes');
    assert.equal(await tools.getByRole('tab', { name: 'Format text', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await tools.getByRole('textbox', { name: 'Article title', exact: true }).count(), 0, 'title is edited in the document');
    const beforeSectionChange = await saved(page);
    await openTextToolSection(tools, 'Display connection');
    assert.equal(await tools.getByRole('tab', { name: 'Article settings', exact: true }).getAttribute('aria-selected'), 'true');
    assert.deepEqual(await saved(page), beforeSectionChange, 'switching settings scopes does not author the article');
    assert.equal(await page.getByRole('combobox', { name: 'Follow Display', exact: true }).isVisible(), true);
    const follow = page.getByRole('combobox', { name: 'Follow Display', exact: true });
    await follow.scrollIntoViewIfNeeded();
    assert.equal(await follow.evaluate(n => { const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'lower settings receive pointer input after contained scrolling');
    await page.screenshot({ path: path.join(output, `text-tools-${width}.png`) });
    await openTextToolSection(page.locator('.text-tools-window'), 'Background & edges');
    assert.notEqual((await page.evaluate(() => window.savedDraft())).texts[0].article.appearance.background, null);
    await openTextToolSection(page.locator('.text-tools-window'), 'Background & edges');
    await setTextBackground(page, 'none');
    assert.equal((await saved(page)).texts[0].article.appearance.background, null);
    await openTextToolSection(page.locator('.text-tools-window'), 'Background & edges');
    await setTextBackground(page, 'colour');
    await page.screenshot({ path: path.join(output, `text-appearance-${width}.png`) });
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    const title = text.getByRole('textbox', { name: 'Article title', exact: true });
    await title.fill('Titel rechtstreeks in het document'); await title.press('Enter');
    assert.equal(await body.evaluate(node => node === document.activeElement), true, 'Enter continues in the body');
    const frameBeforeRead = await text.boundingBox();
    const read = text.getByRole('button', { name: 'Read', exact: true });
    assert.equal(await read.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'Read receives pointer input outside navigation chrome');
    await read.click();
    assert.equal(await tools.count(), 0);
    assert.equal(await text.locator('article .text-document-title').innerText(), 'Titel rechtstreeks in het document');
    await text.getByRole('button', { name: 'Write', exact: true }).click();
    await tools.waitFor();
    assert.deepEqual(await text.boundingBox(), frameBeforeRead, 'opening the tools does not reflow or move the module');
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await body.focus(); await page.keyboard.press('Control+End'); await page.keyboard.type(' Extra tekst.');
    const article = (await saved(page)).texts[0].article;
    const grip = text.getByLabel('Move Text window', { exact: true });
    await grip.focus(); await settle(page);
    let box = await text.boundingBox(), strip = await grip.boundingBox();
    assert.ok(strip.y + strip.height <= box.y - 27, 'action strip is clear of content and resize handles');
    const buttons = await grip.locator('button').all();
    assert.equal(buttons.length, 5);
    for (const button of buttons) { const rect = await button.boundingBox(); near(rect.width, 32, 'equal action cells'); }
    for (const zoom of [.5, 1.37, 1]) {
      await setWorkbenchZoom(page, zoom);
      for (const handle of await text.getByRole('separator').all()) {
        const rect = await handle.boundingBox(); near(rect.width, 28, 'screen target width'); near(rect.height, 28, 'screen target height');
      }
    }
    // Keyboard resizing exercises every edge even when composition geometry is
    // outside the viewport. Tool windows themselves stay in screen coordinates.
    for (const [edge, key] of [['nw', 'ArrowLeft'], ['n', 'ArrowUp'], ['ne', 'ArrowRight'], ['e', 'ArrowRight'], ['se', 'ArrowDown'], ['s', 'ArrowDown'], ['sw', 'ArrowDown'], ['w', 'ArrowLeft']]) {
      const before = savedFrame(await saved(page));
      await text.locator(`.system-workflow__detached-window-resize.is-${edge}`).focus(); await page.keyboard.press(`Alt+${key}`); await settle(page);
      const after = savedFrame(await saved(page));
      near(edge.includes('w') ? after.left + after.width : after.left, edge.includes('w') ? before.left + before.width : before.left, `${edge} horizontal anchor`);
      near(edge.includes('n') ? after.top + after.height : after.top, edge.includes('n') ? before.top + before.height : before.top, `${edge} vertical anchor`);
      assert.notDeepEqual(after, before, `${edge} saved resize`);
      assert.deepEqual((await saved(page)).texts[0].article, article, 'resize preserves typography and content');
    }
    const beforeCancel = await saved(page), screenBefore = await text.boundingBox();
    const top = await text.locator('.is-nw').boundingBox();
    assert.equal(await text.locator('.is-nw').evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + 14, r.y + 14)); }), true, 'the actual pointer resize target is unobstructed');
    await page.mouse.move(top.x + 14, top.y + 14); await page.mouse.down();
    await page.mouse.move(top.x + 42, top.y + 36, { steps: 4 }); await settle(page);
    assert.notDeepEqual(await text.boundingBox(), screenBefore, 'pointer previews resize');
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await saved(page), beforeCancel, 'Escape does not save');
    assert.deepEqual(await text.boundingBox(), screenBefore, 'Escape restores position and size');
    if (width === 1440) {
      const before = await saved(page);
      await page.evaluate(() => { window.failSave = true; });
      await text.locator('.is-w').focus(); await page.keyboard.press('Alt+ArrowLeft'); await settle(page);
      assert.deepEqual(await saved(page), before, 'failed save never claims the resize');
      assert.deepEqual(await text.boundingBox(), screenBefore, 'failed resize restores visible geometry');
      await page.evaluate(() => { window.failSave = false; });
      await text.locator('.is-w').focus(); await page.keyboard.press('Alt+ArrowLeft'); await settle(page);
      const after = await saved(page);
      assert.notDeepEqual(savedFrame(after), savedFrame(before));
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); await settle(page);
      assert.deepEqual(savedFrame(await saved(page)), savedFrame(before), 'Undo restores the whole frame');
      await page.keyboard.press('Control+Shift+z'); await settle(page);
      assert.deepEqual(savedFrame(await saved(page)), savedFrame(after), 'Redo restores the resize');
    }
    await grip.focus(); await page.screenshot({ path: path.join(output, `text-controls-${width}.png`) });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Display Layers keeps content sizing; Text tools and Info recover within the viewport', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mountTextToolsFixture(page, origin);
    const before = await saved(page);
    for (const [command, label] of [[null, 'Text tools'], ['LAYERS', 'Layers'], ['METADATA', 'Info']]) {
      if (command) {
        await page.locator('[data-display-instance="display:primary"]').getByLabel(/Move Display Module:/).focus(); await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem', { name: 'TOOLS', exact: true }).click();
        await page.getByRole('menuitem', { name: command, exact: true }).click();
      }
      const grip = page.getByLabel(`Move ${label} ${label === 'Info' ? 'panel' : 'window'}`, { exact: true });
      const win = label === 'Text tools' ? page.locator('.text-tools-window') : label === 'Info' ? page.getByRole('region', { name: 'Info', exact: true }) : page.locator('.system-workflow__instrument-window').filter({ has: grip });
      await grip.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
      if (label === 'Text tools') {
        assert.equal(await win.locator('.workbench-tool-panel-resize').count(), 8);
        await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
        const narrow = await win.boundingBox(); assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= 390 && narrow.y + narrow.height <= 796);
        // The shared Info dock can sit above the independent Text window after
        // viewport fitting. Dismiss that visible window before using Text's close.
        const closeInfo = page.getByRole('button', { name: 'Close Info', exact: true });
        if (await closeInfo.isVisible()) await closeInfo.click();
        const closeText = win.getByRole('button', { name: 'Close Text tools', exact: true });
        assert.equal(await closeText.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'Text close receives pointer input after dismissing Info');
        await closeText.click();
        assert.equal(await win.count(), 0);
        assert.deepEqual(await saved(page), before, 'closing the stacked tool windows does not author the composition');
        await page.setViewportSize({ width: 1440, height: 1000 });
        continue;
      }
      if (label === 'Layers') assert.equal(await win.getByRole('separator').count(), 0, 'Display Layers retains its existing content-sized shell');
      else {
        assert.equal(await win.locator('.workbench-tool-panel-resize').count(), 8, 'Info uses the accepted resizable shared dock');
        assert.equal(await win.getByRole('tab', { name: 'Info', exact: true }).getAttribute('aria-selected'), 'true');
        assert.equal(await win.getByText('MOUNTAIN SIGNAL II', { exact: true }).isVisible(), true, 'Display Metadata still shows the selected artwork');
      }
      if (label === 'Layers') {
        const artwork = win.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true });
        await artwork.focus(); await artwork.press('Enter');
      }
      await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
      const narrow = await win.boundingBox(); assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= 390 && narrow.y + narrow.height <= 796);
      await page.screenshot({ path: path.join(output, `${command || 'text-tools'}-resize-narrow.png`) });
      const close = win.getByRole('button', { name: `Close ${label}`, exact: true });
      await close.focus(); await close.press('Enter');
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.locator('[data-display-instance="display:primary"]').getByLabel(/Move Display Module:/).focus(); await page.keyboard.press('Shift+F10');
        await page.getByRole('menuitem', { name: 'TOOLS', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const sharedTools = page.locator('[data-shared-display-tools]');
    const layersGrip = sharedTools.getByLabel('Move Layers window', { exact: true });
    await layersGrip.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await layersGrip.waitFor({ state: 'hidden' });
    assert.notEqual(await sharedTools.getAttribute('hidden'), null, 'raised companion tools still yield to an occupied Workbench panel');
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await layersGrip.waitFor({ state: 'visible' });
    assert.equal(await sharedTools.getAttribute('hidden'), null, 'closing the panel restores the same companion');
    assert.deepEqual(await saved(page), before, 'companion tools do not author the composition');
  } finally { await browser.close(); }
});
