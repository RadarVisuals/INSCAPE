import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';

test('Workbench grid paints viewport-sized canvases with correct world phase and 4000px bounds', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const density of [1, 1.25, 2]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: density });
      await page.route(`${origin}/__grid_cost__`, route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0}</style><div id="root"></div>' }));
      await page.goto(`${origin}/__grid_cost__`);
      await page.evaluate(async () => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default;
        const { createRoot } = (await import('/@id/react-dom/client')).default;
        const { flushSync } = (await import('/@id/react-dom')).default;
        const { WorkbenchGridPattern } = await import('/src/public/ownerSystemWorkflow/WorkbenchAlignmentGrid.jsx');
        const root = createRoot(document.getElementById('root'));
        window.gridReview = options => flushSync(() => root.render(React.createElement('main', { style: { position: 'fixed', inset: 0 } },
          React.createElement(WorkbenchGridPattern, { color: '#777777', ...options }))));
      });
      for (const width of [1440, 390]) for (const mode of ['DOTS', 'LINES']) for (const scale of [1, .25, .37, 1.37]) {
        await page.setViewportSize({ width, height: 900 });
        const offset = { x: 80.3, y: 60.7 };
        await page.evaluate(options => window.gridReview(options), { mode, scale, offset });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const result = await page.locator('canvas.lattice-pixel-grid').evaluate((canvas, { mode, scale, offset }) => {
          const density = devicePixelRatio, ctx = canvas.getContext('2d');
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const bounds = { left: (8 * scale + offset.x) * density, top: (8 * scale + offset.y) * density,
            right: (3992 * scale + offset.x) * density, bottom: (3992 * scale + offset.y) * density };
          let outside = 0, ink = 0;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            if (!image.data[(y * canvas.width + x) * 4 + 3]) continue;
            ink++;
            if (x + 1 < bounds.left || y + 1 < bounds.top || x > bounds.right + 1 || y > bounds.bottom + 1) outside++;
          }
          const x = Math.round((24 * scale + offset.x) * density), y = Math.round((24 * scale + offset.y) * density);
          const expectedMark = ctx.getImageData(x, y, 1, 1).data[3] > 0;
          return { width: canvas.width, height: canvas.height, outside, ink, expectedMark, nodes: canvas.childElementCount };
        }, { mode, scale, offset });
        assert.equal(result.width, Math.round(width * density));
        assert.equal(result.height, Math.round(900 * density));
        assert.equal(result.nodes, 0, 'dot density never adds DOM nodes');
        assert.equal(result.outside, 0, 'no painted guides outside the Workbench bounds');
        assert.ok(result.ink > 0); assert.equal(result.expectedMark, true, 'painted guide intersects the expected world coordinate');
        if (density === 1 && scale === .37) await page.screenshot({ path: `.browser-test-runtime/grid-pattern-${mode}-${width}.png` });
      }
      await page.evaluate(() => window.gridReview({ mode: 'NONE', scale: 1, offset: { x: 0, y: 0 } }));
      assert.equal(await page.locator('canvas.lattice-pixel-grid').count(), 0);
      await page.close();
    }
  } finally { await browser.close(); }
});
