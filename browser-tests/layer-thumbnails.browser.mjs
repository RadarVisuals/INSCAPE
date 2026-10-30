import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5173';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 80 80"><script>parent.thumbnailScriptExecuted = true;</script><circle cx="40" cy="40" r="35" fill="purple"/></svg>';

test('Layers and removal previews recover XML-served SVGs without starting artwork documents', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__layer_svg*`, route => route.fulfill({ contentType: 'application/xml', body: svg }));
    await page.route(`${origin}/__layer_raster.jpg`, route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.route(`${origin}/__layer_thumbnails__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__layer_thumbnails__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Inspector = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowSelectionInspector.jsx')).default;
      const { SharedDisplayToolsProvider, SharedDisplayToolWindows } = await import('/src/public/ownerSystemWorkflow/SharedDisplayTools.jsx');
      const { ContextToolbarProvider } = await import('/src/public/ownerSystemWorkflow/ContextToolbar.jsx');
      await import('/src/inscapeTokens.css');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const assets = [
        { id: 'svg', title: 'SVG extension', src: '/__layer_svg.svg' },
        { id: 'typed', title: 'SVG metadata', src: '/__layer_svg', assetRecord: { mediaFileType: 'image/svg+xml' } },
        { id: 'raster', title: 'Raster', src: '/__layer_raster.jpg' },
      ];
      const grid = { id: 'grid:review', placements: assets.map((asset, layer) => ({ id: `placement:${asset.id}`, stableAssetId: asset.id, layer, locked: false })) };
      window.thumbnailGrid = grid;
      window.thumbnailGridBefore = JSON.stringify(grid);
      const controller = { moduleId: 'display:primary', selectedGrid: grid, selectedPlacements: [], selectedPlacementIds: [],
        selectPlacement: id => { window.thumbnailSelection = id; } };
      function Fixture() {
        const [value, onChange] = React.useState({ layers: true, metadata: false, windows: {} });
        return React.createElement(ContextToolbarProvider, { target: controller.moduleId },
          React.createElement(SharedDisplayToolsProvider, { value, onChange },
            React.createElement(SharedDisplayToolWindows),
            React.createElement(Inspector, { assetsById: new Map(assets.map(asset => [asset.id, asset])), controller })));
      }
      createRoot(document.getElementById('root')).render(React.createElement('main', { className: 'system-workflow' }, React.createElement(Fixture)));
    });
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('.system-workflow__layer-select img')];
      return images.length === 3 && images.every(image => image.complete && image.naturalWidth > 0);
    });
    for (const title of ['SVG extension', 'SVG metadata']) {
      await page.getByRole('button', { name: `Remove ${title} from Grid`, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.system-workflow__remove-confirm img')?.naturalWidth > 0);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await page.getByRole('button', { name: 'SVG extension', exact: true }).click();
    assert.equal(await page.evaluate(() => window.thumbnailSelection), 'placement:svg');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.locator('.system-workflow__layer-list').evaluate(list => list.scrollWidth <= list.clientWidth + 1), true);
      assert.equal(await page.locator('.system-workflow__layer-select img').evaluateAll(images => images.every(image => image.naturalWidth > 0 && image.getBoundingClientRect().width === 30)), true);
    }
    assert.equal(await page.locator('.system-workflow__layer-list iframe').count(), 0);
    assert.equal(await page.evaluate(() => window.thumbnailScriptExecuted), undefined);
    assert.equal(await page.evaluate(() => JSON.stringify(window.thumbnailGrid) === window.thumbnailGridBefore), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
