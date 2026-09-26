import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
test('empty Workbench grid uses a bounded tile at every zoom, with matching world phase', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
    await page.route(`${origin}/__grid_cost__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__grid_cost__`);
    const results = await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => x => x; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, client = await import('/@id/react-dom/client'), dom = await import('/@id/react-dom');
      const createRoot = client.createRoot || client.default.createRoot, flushSync = dom.flushSync || dom.default.flushSync;
      const { WorkbenchViewProvider, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
      const { useWorkbenchCamera } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
      const { WorkbenchGridPattern: Grid } = await import('/src/public/ownerSystemWorkflow/WorkbenchAlignmentGrid.jsx');
      const Legacy = (await import('/src/lattice/rendering/LatticePixelGrid.jsx')).default;
      let update;
      function Bench() {
        const view = useWorkbenchView(), camera = useWorkbenchCamera();
        const [settings, setSettings] = React.useState({ mode: 'DOTS', legacy: false });
        update = (scale, offset, mode, legacy) => { view.setScale(scale); camera.setOffset(offset); setSettings({ mode, legacy }); };
        return settings.legacy ? React.createElement(Legacy, { mode: settings.mode, color: '#777', width: 2560, height: 1440,
          field: { cellSize: 24 * view.scale, left: camera.offset.x, top: camera.offset.y } })
          : React.createElement(Grid, { mode: settings.mode, color: '#777', offset: camera.offset, scale: view.scale });
      }
      const root = createRoot(document.getElementById('root'));
      flushSync(() => root.render(React.createElement(WorkbenchViewProvider, null, React.createElement(Bench))));
      const results = [];
      for (const legacy of [true, false]) for (const mode of ['LINES', 'DOTS']) for (const scale of [1, .25]) {
        const times = [], work = [];
        for (let i = 0; i < 35; i++) {
          const start = performance.now();
          flushSync(() => update(scale, { x: -123 + i * .13, y: 67 + i * .21 }, mode, legacy));
          document.querySelector('svg').getBoundingClientRect();
          work.push(performance.now() - start);
          await new Promise(requestAnimationFrame); times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b); work.sort((a, b) => a - b);
        const svg = document.querySelector('svg'), pattern = svg.querySelector('pattern');
        results.push({ legacy, mode, scale, p50: times[17], p95: times[33], workP95: work[33], bytes: svg.innerHTML.length,
          tile: pattern && { width: Number(pattern.getAttribute('width')), x: Number(pattern.getAttribute('x')), nodes: pattern.children.length } });
      }
      window.gridReview = (mode, scale, offset = { x: -83.2, y: 47.8 }) => flushSync(() => update(scale, offset, mode, false));
      return results;
    });
    console.log(JSON.stringify(results));
    for (const r of results.filter(r => !r.legacy)) {
      assert.ok(r.bytes < 1000, 'grid representation does not grow with dot count');
      assert.equal(r.tile.nodes, 1);
      assert.equal(r.tile.width, 24 * r.scale);
      const origin = -123 + 34 * .13, recovered = r.tile.x + r.tile.width / 2;
      assert.ok(Math.abs((origin - recovered) / r.tile.width - Math.round((origin - recovered) / r.tile.width)) < 1e-8);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const mode of ['LINES', 'DOTS']) {
        await page.evaluate(mode => window.gridReview(mode, .37), mode);
        await page.screenshot({ path: `.browser-test-runtime/grid-pattern-${mode}-${width}.png` });
      }
    }
    // Show opposite workspace corners. Outside the placement bounds every
    // screenshot pixel must remain the plain page background.
    for (const offset of [{ x: 80, y: 60 }, { x: -1800, y: -1700 }]) {
      await page.evaluate(offset => window.gridReview('DOTS', .25, offset), offset);
      const bounds = await page.locator('svg > rect').boundingBox();
      assert.equal(bounds.x, offset.x + 2);
      assert.equal(bounds.y, offset.y + 2);
      assert.equal(bounds.width, 1996);
      assert.equal(bounds.height, 1996);
      const png = await page.screenshot({ path: `.browser-test-runtime/grid-bounds-${offset.x}.png` });
      const outside = await page.evaluate(async ({ png, bounds }) => {
        const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        let marked = 0, checked = 0;
        for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
          if (x >= bounds.x - 1 && x <= bounds.x + bounds.width + 1 && y >= bounds.y - 1 && y <= bounds.y + bounds.height + 1) continue;
          checked++; const i = (y * img.width + x) * 4;
          if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) marked++;
        }
        return { marked, checked };
      }, { png: png.toString('base64'), bounds });
      assert.ok(outside.checked > 1000); assert.equal(outside.marked, 0, 'no grid beyond placement bounds');
    }
  } finally { await browser.close(); }
});
