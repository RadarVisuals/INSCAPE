import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5183';

test('Text surfaces meet at their saved window edges without hidden chrome gaps', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(`${origin}/__text_edges__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__text_edges__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Text = (await import('/src/text/TextWorkbench.jsx')).default;
      const { createArticle } = await import('/src/text/domain/article.js');
      await import('/src/inscapeTokens.css');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const root = createRoot(document.getElementById('root'));
      window.showEdgeFixture = (vertical, legacy = false) => {
        const records = ['a', 'b'].map((id, i) => {
          const article = createArticle(`Article ${id}`);
          if (legacy) delete article.appearance;
          else article.appearance = { ...article.appearance, background: i ? '#000000' : '#ffffff', color: i ? '#ffffff' : '#000000' };
          return { id: `text:${id}`, article, visibility: 'PUBLIC' };
        });
        root.render(React.createElement('main', { className: 'system-workflow' }, React.createElement(Text, {
          key: `${vertical}-${legacy}`, profileAddress: 'edge-fixture', records,
          presentations: records.map((r, i) => ({ id: r.id, open: true, window: {
            left: 24 + (!vertical ? i * 288 : 0), top: 48 + (vertical ? i * 240 : 0), width: 288, height: 240,
          } })),
        })));
      };
      window.showEdgeFixture(false);
    });
    for (const [name, width, vertical, legacy] of [['wide', 1440, false, false], ['narrow', 390, true, false], ['legacy', 1440, false, true]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(([v, l]) => window.showEdgeFixture(v, l), [vertical, legacy]);
      await page.waitForTimeout(100);
      const windows = page.locator('.text-window'), surfaces = page.locator('.text-module-body');
      const first = await surfaces.nth(0).boundingBox(), second = await surfaces.nth(1).boundingBox();
      assert.deepEqual(first, await windows.nth(0).boundingBox());
      assert.deepEqual(second, await windows.nth(1).boundingBox());
      assert.equal(vertical ? first.y + first.height : first.x + first.width, vertical ? second.y : second.x);
      assert.equal(await page.locator('.text-window > .system-workflow__instrument-content').first().evaluate(el => getComputedStyle(el).borderBottomRightRadius), '0px', 'no inherited rounded clip cuts the touching corners');
      await page.mouse.move(width - 2, 998);
      await page.screenshot({ path: `.browser-test-runtime/text-window-edges-${name}.png` });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
