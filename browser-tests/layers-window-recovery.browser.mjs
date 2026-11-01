import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
test('Layers recovers an offscreen saved window and remains reachable after viewport resize', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/__layers_recovery__', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194'}/__layers_recovery__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { SharedDisplayToolsProvider, SharedDisplayToolWindows, SharedDisplayToolContent } = await import('/src/public/ownerSystemWorkflow/SharedDisplayTools.jsx');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      function Fixture() {
        const [value, onChange] = React.useState({ layers: true, metadata: false, windows: { layers: { left: 3000, top: 1900, width: 320, height: 480 } } });
        return React.createElement(SharedDisplayToolsProvider, { value, onChange }, React.createElement(SharedDisplayToolWindows),
          React.createElement(SharedDisplayToolContent, { id: 'layers', targetId: 'display:primary', label: 'Display / Grid' }, React.createElement('div', { 'aria-label': 'Layers, front to back' }, 'Artwork 2\nArtwork 1')));
      }
      createRoot(document.getElementById('root')).render(React.createElement('main', { className: 'system-workflow' }, React.createElement(Fixture)));
    });
    const layers = page.locator('[data-shared-tool="layers"]'); await layers.waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => { const r = document.querySelector('[data-shared-tool="layers"]').closest('aside').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight - 48; });
      assert.match(await layers.innerText(), /Artwork 2/);
      await page.screenshot({ path: `.browser-test-runtime/layers-recovered-${width}.png` });
    }
  } finally { await browser.close(); }
});
