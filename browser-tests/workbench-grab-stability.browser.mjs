import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5208';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Workbench capture preserves exact Image grid positions across repeated grabs at fractional zoom', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route(`${origin}/__grab_stability__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__grab_stability__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView, workbenchModuleTransform } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
      const { useWorkbenchCamera } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
      const { WorkbenchPlacement } = await import('/src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx');
      const ImageWindow = (await import('/src/imageModule/ImageWindow.jsx')).default;
      await import('/src/imageModule/imageModule.css');
      function Fixture() {
        const host = React.useRef(null), view = useWorkbenchView(), pan = useWorkbenchCamera();
        const [position, setPosition] = React.useState({ left: 240, top: 240 });
        window.configureGrab = scale => { view.setScale(scale); view.setTransforms({}); pan.setOffset({ x: 13.37, y: 17.23 }); };
        window.readGrab = () => {
          const t = workbenchModuleTransform(view, 'image:test');
          return { left: (position.left * t.scale + t.x) / view.scale, top: (position.top * t.scale + t.y) / view.scale };
        };
        return React.createElement('main', { ref: host, tabIndex: -1, style: { position: 'fixed', inset: 0 } },
          React.createElement(WorkbenchPlacement, { hostRef: host, enabled: true, gridEnabled: true, gap: 0 },
            React.createElement(WorkbenchViewControls, { hostRef: host }),
            React.createElement(ImageWindow, { id: 'image:test', title: 'Test', position, size: { width: 317, height: 193 }, fitScale: 1,
              editable: true, placementModule: true, onPosition: setPosition, onResize: () => {}, onClose: () => {} }, () => null)));
      }
      createRoot(document.getElementById('root')).render(React.createElement(WorkbenchViewProvider, null, React.createElement(Fixture)));
    });
    await page.locator('.image-module__window').waitFor();
    for (const scale of [.67, 1.013, .413, 1.371, 1]) {
      await page.evaluate(scale => window.configureGrab(scale), scale); await settle(page);
      for (let grab = 0; grab < 4; grab++) {
        const rect = await page.locator('.image-module__window').boundingBox();
        await page.mouse.move(rect.x + 12, rect.y + 12); await page.mouse.down();
        for (const [dx, dy] of [[1, 1], [2, -1], [-1, 2], [0, 0]]) {
          await page.mouse.move(rect.x + 12 + dx, rect.y + 12 + dy); await settle(page);
          const actual = await page.evaluate(() => window.readGrab());
          assert.ok(Math.abs(actual.left - 240) < 1e-8 && Math.abs(actual.top - 240) < 1e-8,
            `grid position drift at ${scale}, grab ${grab}: ${JSON.stringify(actual)}`);
        }
        await page.mouse.up();
      }
    }
  } finally { await browser.close(); }
});
