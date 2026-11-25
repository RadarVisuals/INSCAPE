import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';

test('live SVG documents recover across breakpoints and keep their fit when introductory artwork is clicked', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/__composition_svg__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.route('https://composition.test/__composition_source_*.svg', route => {
      const id = Number(route.request().url().match(/_(\d+)\.svg$/)[1]);
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="orange"/><script>setInterval(()=>top.postMessage({type:'composition-svg-tick',id:${id}},'*'),50)</script></svg>` });
    });
    await page.goto(`${origin}/__composition_svg__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { default: Canvas } = await import('/src/composition/CompositionDocumentCanvas.jsx');
      const { createCompositionEditorDocument, withCompositionModuleWindow } = await import('/src/composition/compositionEditorDocument.js');
      const { createCompositionExample } = await import('/design-system/lab/compositionExample.js');
      await import('/src/index.css');
      await import('/src/imageModule/imageModule.css');
      let value = createCompositionEditorDocument();
      value.workbench.area = { left: 0, top: 0, width: 2518, height: 400 };
      value.bento = { gap: 0, padding: 0 };
      // Insertion order differs from spatial reading order, as after moving cells.
      for (let i = 5; i >= 0; i--) {
        const id = `shape:cell-${i}`, member = `image:svg-${i}`;
        value.shapes.push({ id, color: '#171717', opacity: 1, visibility: 'PUBLIC' });
        value.cells.push({ id, members: [member], mobile: { columns: 2, height: 300 } });
        const artwork = createCompositionExample().imageModules[0].artwork;
        artwork.crop = null;
        artwork.asset.media = { url: `https://composition.test/__composition_source_${i}.svg`, width: 200, height: 200 };
        value.imageModules.push({ id: member, artwork, visibility: 'PUBLIC' });
        value.artworkLayers.push(id, member);
        const rect = { left: i * 2518 / 6, top: 0, width: 2518 / 6, height: 400 };
        value = withCompositionModuleWindow(value, id, rect);
        value = withCompositionModuleWindow(value, member, rect);
      }
      window.svgTicks = {};
      addEventListener('message', event => { if (event.data?.type === 'composition-svg-tick') window.svgTicks[event.data.id] = (window.svgTicks[event.data.id] || 0) + 1; });
      window.svgComposition = value;
      const root = createRoot(document.getElementById('root'));
      window.resizeComposition = width => root.render(React.createElement(Canvas, { composition: value, width }));
      window.resizeComposition(2518);
    });
    const running = async () => {
      const previous = await page.evaluate(() => ({ ...window.svgTicks }));
      await page.waitForFunction(before => [0, 1, 2, 3, 4, 5].every(id => (window.svgTicks[id] || 0) > (before[id] || 0) + 3), previous, { timeout: 10000 });
    };
    await running();
    for (const width of [1800, 2518, 900, 2518, 320, 2518]) {
      await page.evaluate(width => window.resizeComposition(width), width);
      await page.waitForFunction(width => document.querySelector('.composition-document-canvas')?.style.width === `${width}px`, width);
      // At narrow widths lower cells may correctly suspend offscreen. Restore
      // the original layout and prove every live document resumes without editing.
      if (width === 2518) await running();
    }
    assert.equal(await page.locator('.artwork-svg-document').count(), 6);
    const source = page.locator('[data-cell-group]').first();
    const before = await source.boundingBox();
    await page.evaluate(() => { window.introFrames = [...document.querySelectorAll('iframe')]; });
    assert.equal(await page.getByRole('button', { name: /^Inspect / }).count(), 0);
    await source.click();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(await source.boundingBox(), before);
    assert.equal(await page.evaluate(() => window.introFrames.every((frame, i) => frame === document.querySelectorAll('iframe')[i])), true);
    await running();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
