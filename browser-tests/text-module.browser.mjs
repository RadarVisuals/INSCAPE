import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const sampleText = 'The landscape began with a single shape. Layers of light and shadow spread across the desert, leaving room for new stories and unexpected encounters. Each fragment carries a memory of the world it came from.';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
test('Text module authors, reloads, renders and contains content at wide/narrow widths', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(15_000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__text_review__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = async () => page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      window.__textRoot = createRoot(document.getElementById('root'));
      window.__textRoot.render(React.createElement(Runtime, { profileAddress: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
        reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Text review' } }));
    });
    await page.goto(`${origin}/__text_review__`); console.log('Text review page loaded');
    let importTimer;
    try { await Promise.race([mount(), new Promise((_, reject) => { importTimer = setTimeout(() => reject(Error('Text review module imports timed out')), 30_000); })]); }
    finally { clearTimeout(importTimer); }
    console.log('Text review mounted');
    const workspace = page.locator('main.system-workflow'); await workspace.waitFor();
    await workspace.focus(); await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu', { name: 'Workbench commands', exact: true });
    await menu.getByRole('menuitem', { name: 'ADD', exact: true }).click(); await menu.getByRole('menuitem', { name: 'TEXT', exact: true }).click();
    await page.waitForTimeout(1500);
    const text = page.locator('[data-workbench-module="text"]');
    assert.equal(await text.getByRole('textbox', { name: 'Article title', exact: true }).evaluate(node => node.tagName), 'INPUT');
    await text.getByRole('textbox', { name: 'Article title', exact: true }).fill('Notes from the Lunar Desert');
    const content = text.getByRole('textbox', { name: 'Article text', exact: true });
    await content.fill(sampleText);
    await page.keyboard.press('Control+A'); await text.getByRole('button', { name: 'Bold', exact: true }).click();
    assert.equal(await content.locator('strong').innerText(), sampleText);
    await text.getByRole('button', { name: 'Read', exact: true }).click();
    assert.equal(await text.locator('article strong').innerText(), sampleText);
    assert.equal(await text.locator('.text-status').count(), 0, 'saved status takes no layout space');
    assert.equal(await text.locator('.text-window .system-workflow__detached-window-titlebar > strong').count(), 0, 'no duplicate window title');
    const readingGeometry = await text.evaluate(node => {
      const box = node.querySelector('.system-workflow__instrument-window').getBoundingClientRect();
      const body = node.querySelector('.text-module-scroll').getBoundingClientRect();
      return { top: body.top - box.top, height: box.height - body.height };
    });
    assert.ok(readingGeometry.top < 5 && readingGeometry.height < 8, 'Read uses the full window without editor rails');
    await text.getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await text.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), true, 'reading preserves editing history');
    await text.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await content.locator('strong').count(), 0, 'can undo formatting from before Read');
    await text.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.equal(await content.locator('strong').innerText(), sampleText);
    assert.equal(await text.getByRole('button', { name: 'Bold', exact: true }).innerText(), '');
    for (const ending of ['left', 'center', 'right', 'all']) {
      await text.getByRole('combobox', { name: 'Paragraph justification' }).selectOption(`justify-${ending}`);
      const expected = ['justify', ending === 'all' ? 'justify' : ending];
      assert.deepEqual(await content.locator('p').evaluate(n => [getComputedStyle(n).textAlign, getComputedStyle(n).textAlignLast]), expected);
      await text.getByRole('button', { name: 'Read', exact: true }).click();
      assert.deepEqual(await text.locator('article p').evaluate(n => [getComputedStyle(n).textAlign, getComputedStyle(n).textAlignLast]), expected);
      await text.getByRole('button', { name: 'Write', exact: true }).click();
    }
    await text.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await text.getByRole('combobox', { name: 'Paragraph justification' }).inputValue(), 'justify-right');
    await text.getByRole('button', { name: 'Redo', exact: true }).click();
    for (const alignment of ['center', 'right', 'left']) {
      await text.getByRole('button', { name: `Align ${alignment}`, exact: true }).click();
      assert.equal(await content.locator('p').evaluate(n => getComputedStyle(n).textAlign), alignment);
      assert.equal(await text.getByRole('button', { name: `Align ${alignment}`, exact: true }).getAttribute('aria-pressed'), 'true');
    }
    await text.getByRole('combobox', { name: 'Paragraph justification' }).selectOption('justify-center');
    await text.getByRole('combobox', { name: 'Paragraph style' }).selectOption('2');
    await text.getByRole('button', { name: 'Align right', exact: true }).click();
    assert.equal(await content.locator('h2').evaluate(n => getComputedStyle(n).textAlign), 'right');
    await text.getByRole('combobox', { name: 'Paragraph style' }).selectOption('paragraph');
    await text.getByRole('combobox', { name: 'Paragraph justification' }).selectOption('justify-center');
    await text.getByRole('button', { name: 'Read', exact: true }).click();

    await text.getByRole('combobox', { name: 'Document font', exact: true }).selectOption('literata');
    await text.getByRole('checkbox', { name: 'Include in Workbench publication' }).check();
    await page.reload(); await mount();
    await text.getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await text.getByRole('textbox', { name: 'Article title', exact: true }).inputValue(), 'Notes from the Lunar Desert');
    assert.equal(await content.locator('strong').innerText(), sampleText);

    assert.equal(await content.locator('p').first().evaluate(n => getComputedStyle(n).textAlignLast), 'center', 'alignment survives reload');
    assert.equal(await text.getByRole('combobox', { name: 'Document font', exact: true }).inputValue(), 'literata');
    const select = text.getByRole('combobox', { name: 'Insert Library artwork' });
    const image = await select.locator('option').nth(1).getAttribute('value');
    if (image) { await select.selectOption(image); await content.locator('figure img').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.text-document img')].every(img => img.complete && img.naturalWidth > 0)); }

    await text.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const scroller = text.getByRole('region', { name: 'Article content', exact: true });
    assert.equal(await scroller.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    if (image) {
      await scroller.hover(); await page.mouse.wheel(0, 260);
      await page.waitForFunction(() => document.querySelector('.text-module-scroll').scrollTop > 0);
      await scroller.evaluate(node => { node.scrollTop = 0; });
      await scroller.focus(); await page.keyboard.press('PageDown');
      await page.waitForFunction(() => document.querySelector('.text-module-scroll').scrollTop > 0);
      await scroller.evaluate(node => { node.scrollTop = 0; });
    }
    for (const [name, viewport] of [['wide', { width: 1440, height: 1000 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(150);
      await page.screenshot({ path: `.browser-test-runtime/text-${name}.png` });
      const box = await text.locator('.text-window').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1, `Text window contained at ${name}`);
      assert.equal(await text.locator('.text-module-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      assert.equal(await text.locator('.text-editor-page .text-document-title').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'title wraps without clipping');
    }
    assert.equal(await text.getByRole('button', { name: /NFT|Import|Export/i }).count(), 0);
    assert.equal(await text.locator('input[type=file]').count(), 0);
    await text.getByRole('button', { name: 'Read', exact: true }).click();
    await page.screenshot({ path: '.browser-test-runtime/text-narrow-read.png' });
    const ownerViewport = await text.locator('.text-module-scroll').evaluate(node => ({ width: node.clientWidth, height: node.clientHeight }));
    const records = await page.evaluate(async () => {
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { projectTextModules } = await import('/src/text/domain/article.js');
      return projectTextModules(createSystemWorkflowDraftStore({ profileAddress: '0x1111111111111111111111111111111111111111', storage: localStorage }).getDraft().texts);
    });
    const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await visitor.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    const editorRequests = []; visitor.on('request', r => { if (r.url().includes('ArticleEditor') || r.url().includes('tiptap')) editorRequests.push(r.url()); });
    await visitor.route(`${origin}/__text_reader__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root" class="system-workflow" data-lattice-menu-surface data-menu-surface="mist"></div>' }));
    await visitor.goto(`${origin}/__text_reader__`);
    await visitor.evaluate(async records => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const TextWorkbench = (await import('/src/text/TextWorkbench.jsx')).default;
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      await import('/src/lattice/rendering/latticeMenuSurface.css');
      createRoot(document.getElementById('root')).render(React.createElement(TextWorkbench, { records, profileAddress: '0x1111111111111111111111111111111111111111' }));
    }, records);
    await visitor.getByText(sampleText, { exact: true }).waitFor();
    assert.deepEqual(await visitor.locator('article p').first().evaluate(n => [getComputedStyle(n).textAlign, getComputedStyle(n).textAlignLast]), ['justify', 'center']);
    assert.equal(await visitor.getByRole('button', { name: 'Write', exact: true }).count(), 0);
    assert.equal(await visitor.getByRole('textbox').count(), 0);
    assert.deepEqual(editorRequests, []);
    await visitor.evaluate(() => document.fonts.ready);
    await visitor.waitForFunction(() => [...document.querySelectorAll('.text-document img')].every(img => img.complete && img.naturalWidth > 0));
    assert.deepEqual(await visitor.locator('.text-module-scroll').evaluate(node => ({ width: node.clientWidth, height: node.clientHeight })), ownerViewport,
      'owner Read and Visitor have identical usable dimensions');
    await visitor.screenshot({ path: '.browser-test-runtime/text-visitor-narrow.png' });
    await visitor.close();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
