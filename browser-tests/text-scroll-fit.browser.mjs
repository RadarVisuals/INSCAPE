import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5183';

test('Text scrolls only when content exceeds its viewport in Write and Read', async () => {
  const screenshots = await mkdtemp(join(tmpdir(), 'inscape-text-fit-'));
  console.log(`Text fit screenshots: ${screenshots}`);
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(`${origin}/__text_scroll__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__text_scroll__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { WorkbenchWindow } = await import('/src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx');
      const Editor = (await import('/src/text/ArticleEditor.jsx')).default;
      const View = (await import('/src/text/ArticleView.jsx')).default;
      const Viewport = (await import('/src/text/TextViewport.jsx')).default;
      const TextWorkbench = (await import('/src/text/TextWorkbench.jsx')).default;
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const { createArticle } = await import('/src/text/domain/article.js');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const root = createRoot(document.getElementById('root'));
      const h = React.createElement;
      window.showScrollFixture = ({ write, count = 1, scale = 1, height = 180, width = 288, padding, paragraphs, title = '', fontSize = 16 }) => {
        const article = createArticle();
        article.title = title;
        article.appearance.fontSize = fontSize;
        article.appearance.scale = scale;
        if (padding) article.appearance.padding = padding;
        article.content.content = Array.from({ length: count }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Line ${i + 1}.` }] }));
        if (paragraphs) article.content.content = paragraphs.map(text => ({ type: 'paragraph', attrs: { textAlign: 'left' }, content: [{ type: 'text', text }] }));
        window.fittingArticle = article;
        root.render(h('main', { className: 'system-workflow' }, h('div', { className: 'text-workbench' }, h(WorkbenchWindow, {
          key: JSON.stringify({ write, count, scale, height, width, padding, paragraphs, title, fontSize }), label: 'Text', title: '', chrome: 'bevel', className: 'text-window text-window--read',
          initialX: 24, initialY: 48, width, initialHeight: height, resizableWidth: true,
        }, h('div', { className: 'text-module-body', style: { background: '#000000', color: '#ffffff' } },
          h(Viewport, { automaticPadding: !padding, mode: write ? 'write' : 'read' }, write ? h('div', {}, h(Editor, { article, onChange: () => {} })) : h(View, { article }))
        )))));
      };
      window.showActualText = () => {
        const profile = `0x${'1'.repeat(40)}`, entries = new Map();
        const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } });
        const record = { id: 'text:fit', visibility: 'PRIVATE', article: window.fittingArticle };
        store.commitCompletedOperation({ ...store.getDraft(), texts: [record] }, { expectedGeneration: store.getGeneration() });
        const presentation = { ...createTextPresentation(record.id), window: { left: 24, top: 48, width: 336, height: 840 } };
        root.render(h('main', { className: 'system-workflow' }, h(TextWorkbench, { records: [record], presentations: [presentation], profileAddress: profile, store })));
      };
    });
    for (const width of [1440, 390]) for (const write of [true, false]) {
      await page.setViewportSize({ width, height: 900 });
      const scroll = page.locator('.text-module-scroll');
      for (const scale of [1, 1.5]) {
        await page.evaluate(options => window.showScrollFixture(options), { write, scale });
        await page.locator('.text-document p').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        const initialParagraph = await page.locator('.text-document p').first().boundingBox();
        assert.equal(await scroll.evaluate(el => getComputedStyle(el).overscrollBehavior), 'none', 'disable native edge feedback as well as scroll chaining');
        await scroll.hover(); await page.mouse.wheel(0, 300); await page.waitForTimeout(100);
        const metrics = await scroll.evaluate(el => ({ top: el.scrollTop, content: el.scrollHeight, height: el.clientHeight }));
        assert.equal(metrics.content, metrics.height, `fitting text has no scroll range: ${JSON.stringify({ width, write, scale, metrics })}`);
        assert.equal(metrics.top, 0);
        await page.mouse.wheel(0, -300); await page.waitForTimeout(100);
        assert.deepEqual(await page.locator('.text-document p').first().boundingBox(), initialParagraph, 'fitting text stays in place in both wheel directions');
      }
      await page.screenshot({ path: join(screenshots, `text-fit-${width}-${write ? 'write' : 'read'}.png`) });
      await page.evaluate(options => window.showScrollFixture(options), { write, count: 4, height: 210 });
      await page.locator('.text-document p').first().waitFor();
      assert.equal(await scroll.evaluate(el => el.scrollHeight - el.clientHeight), 0, 'last paragraph adds no trailing paragraph gap');
      await page.evaluate(options => window.showScrollFixture(options), { write, count: 20 });
      await page.locator('.text-document p').first().waitFor();
      await scroll.hover(); await page.mouse.wheel(0, 300); await page.waitForTimeout(100);
      assert.ok(await scroll.evaluate(el => el.scrollHeight > el.clientHeight && el.scrollTop > 0), 'long text remains scrollable');
      await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const last = await page.locator('.text-document p').last().boundingBox(), viewport = await scroll.boundingBox();
      assert.ok(last.y >= viewport.y && last.y + last.height <= viewport.y + viewport.height + 1, 'last paragraph stays reachable');
    }
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 1440, height: 900 });
    const paragraphs = [
      'There are no tracks leading to where I woke. I turn and check the ground behind me, as though there might be an explanation stuck to my arse. Nothing. Whatever brought me here did a clean job. Somewhere, something has less of me on it now.',
      "I try to remember my name. It’s like working a tongue into the socket of a missing tooth. I can’t leave the hole alone. There should be a lifetime of shit packed into this head, things buried so deep I’d have to take pieces of me with them to come out.",
      "My legs get me upright. I wipe my mouth on the cloth. Being left alive doesn’t mean I was spared.Shit is full of living things.",
    ];
    for (const write of [true, false]) {
      await page.evaluate(o => window.showScrollFixture(o), { write, width: 696, height: 336, paragraphs });
      await page.locator('.text-document p').first().waitFor();
      await page.waitForTimeout(60);
      const measured = await page.locator('.text-module-scroll').evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, last: el.querySelector('.text-document p:last-child').getBoundingClientRect().bottom - el.getBoundingClientRect().top }));
      assert.ok(measured.last < measured.client && measured.scroll === measured.client, `automatic bottom padding yields when the writing fits: ${JSON.stringify({ write, measured })}`);
      await page.evaluate(o => window.showScrollFixture(o), { write, width: 696, height: 336, paragraphs, padding: { top: 24, right: 24, bottom: 16, left: 24 } });
      await page.locator('.text-document p').first().waitFor();
      assert.equal(await page.locator('.text-module-scroll').evaluate(el => el.scrollHeight - el.clientHeight), 0, 'video text fits without reserved bottom spacing');
      await page.locator('.text-module-scroll').hover(); await page.mouse.wheel(0, 300); await page.waitForTimeout(100);
      assert.equal(await page.locator('.text-module-scroll').evaluate(el => el.scrollTop), 0);
      await page.evaluate(o => window.showScrollFixture(o), { write, width: 696, height: 336, paragraphs, padding: { top: 24, right: 24, bottom: 48, left: 24 } });
      await page.locator('.text-document p').first().waitFor();
      assert.ok(await page.locator('.text-module-scroll').evaluate(el => el.scrollHeight > el.clientHeight), 'explicit bottom spacing stays authored and scrollable');
    }
    const arrival = [
      'I lift my head. A rope of spit pulls the dirt up with me before it snaps. My throat dumps something thick between my hands.',
      'There are no tracks leading to where I woke. I turn and check the ground behind me, as though there might be an explanation somewhere I haven’t looked. Nothing. Whatever brought me here did a clean job. Somewhere, something has less of me on it now.',
      'I try to remember my name. It’s like working a tongue into the socket of a missing tooth.',
      'I dig my hands into the dirt and try to push myself up, but my elbows won’t hold. I turn my face enough to breathe without getting another mouthful.',
    ];
    for (const width of [1440, 390]) for (const write of [true, false]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(o => window.showScrollFixture(o), { write, width: 336, height: 840, scale: 1.5, fontSize: 10.5, title: 'A mouthful of almost', paragraphs: arrival });
      await page.locator('.text-document p').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const scroll = page.locator('.text-module-scroll');
      await page.waitForTimeout(60);
      assert.equal(await scroll.evaluate(el => el.scrollHeight - el.clientHeight), 0, `the illustrated passage fits without scrolling blank end space: ${JSON.stringify({ width, write, metrics: await scroll.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight, content: getComputedStyle(el.firstChild).height, end: el.querySelector('p:last-child').getBoundingClientRect().bottom - el.getBoundingClientRect().top, padding: el.style.cssText })) })}`);
      await scroll.hover(); await page.mouse.wheel(0, 200); await page.waitForTimeout(60);
      assert.equal(await scroll.evaluate(el => el.scrollTop), 0);
      await page.screenshot({ path: join(screenshots, `arrival-${width}-${write ? 'write' : 'read'}.png`) });
      await page.locator('.text-window').evaluate(el => { el.style.height = '700px'; });
      await page.waitForTimeout(60);
      assert.ok(await scroll.evaluate(el => el.scrollHeight > el.clientHeight), 'shrinking the same window restores scrolling');
      await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const last = await page.locator('.text-document p').last().boundingBox(), bounds = await scroll.boundingBox();
      assert.ok(last.y + last.height <= bounds.y + bounds.height + 1, 'the final line stays reachable after resize');
      await page.locator('.text-window').evaluate(el => { el.style.height = '840px'; });
      await page.waitForTimeout(60);
      assert.equal(await scroll.evaluate(el => el.scrollHeight - el.clientHeight), 0, 'enlarging restores the fitted state');
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.showActualText());
    const actual = page.locator('.text-window');
    await actual.getByRole('textbox', { name: 'Article text', exact: true }).waitFor();
    await page.waitForTimeout(60);
    const before = await actual.locator('.text-document p').first().boundingBox();
    for (const action of ['Read', 'Write']) {
      await actual.getByRole('button', { name: action, exact: true }).click({ force: true });
      await page.waitForTimeout(60);
      assert.equal(await actual.locator('.text-module-scroll').evaluate(el => el.scrollHeight - el.clientHeight), 0, `${action} stays fitted in the actual module`);
      const after = await actual.locator('.text-document:visible p').first().boundingBox();
      assert.deepEqual(after, before, 'switching modes preserves the paragraph geometry');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
