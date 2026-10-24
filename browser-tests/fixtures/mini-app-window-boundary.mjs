import assert from 'node:assert/strict';

export async function verifyMiniAppWindowBoundary(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__mini_window__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__mini_window__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const MiniApps = (await import('/src/miniApps/MiniAppsWorkbench.jsx')).default;
      const { WorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchViewContext.js');
      const { captureWorkbenchPresentation } = await import('/src/public/ownerSystemWorkflow/workbenchPresentationCapture.js');
      const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      await import('/src/index.css'); await import('/src/inscapeTokens.css');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const records = [{ id: 'mini-app:window', name: 'Window probe', url: '', visibility: 'PUBLIC' }];
      window.windowReports = {};
      window.captureMiniWindow = () => captureWorkbenchPresentation({ layout: createDefaultWorkbenchPresentation(), hasPrimaryDisplay: false,
        miniApps: records, miniAppPresentations: window.windowReports }).value.miniApps[0];
      createRoot(document.getElementById('root')).render(React.createElement(WorkbenchView.Provider, { value: { scale: 1, transforms: {}, entries: new Map(), navigationInset: 232 } },
        React.createElement(MiniApps, { records, profileAddress: `0x${'1'.repeat(40)}`, presentations: [{ id: records[0].id, open: true, window: { left: 320, top: 100, width: 600, height: 500 } }],
          onPresentationChange: (id, value) => { window.windowReports[id] = value; } })));
    });
    const frame = page.locator('.mini-app-workbench .system-workflow__instrument-window');
    await frame.waitFor();
    await page.waitForFunction(() => window.windowReports['mini-app:window']);
    const initial = await page.evaluate(() => window.captureMiniWindow());
    await page.getByLabel('Resize Mini app window', { exact: true }).press('ArrowRight');
    await page.waitForFunction(width => window.captureMiniWindow().window.width > width, initial.window.width);
    const resized = await page.evaluate(() => window.captureMiniWindow());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => { const box = document.querySelector('.mini-app-workbench .system-workflow__instrument-window').getBoundingClientRect(); return box.x + box.width <= 391; });
    const narrow = { painted: await frame.boundingBox(), captured: await page.evaluate(() => window.captureMiniWindow()) };
    console.log('Mini app narrow measurement', JSON.stringify({ initial, resized, narrow }));
    assert.deepEqual(narrow.captured, resized, 'viewport projection cannot replace authored presentation or capture');
    assert.ok(narrow.painted.x >= 0 && narrow.painted.x + narrow.painted.width <= 391);
    assert.equal(await page.getByLabel('Resize Mini app window', { exact: true }).count(), 0, 'undersized viewport cannot commit a below-minimum resize');
    const grip = await page.getByLabel('Move Mini app window', { exact: true }).boundingBox();
    await page.mouse.move(grip.x + 10, grip.y + grip.height / 2);
    await page.mouse.down(); await page.mouse.move(grip.x + 10, grip.y + grip.height / 2 + 24);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.captureMiniWindow()), resized, 'cancelled movement restores authored geometry, not its viewport projection');
    await page.getByRole('button', { name: 'Close Window probe', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Window probe', exact: true }).press('Enter');
    assert.deepEqual(await page.evaluate(() => window.captureMiniWindow()), resized, 'close/reopen preserves authored geometry on the narrow viewport');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForFunction(width => Math.abs(document.querySelector('.mini-app-workbench .system-workflow__instrument-window').getBoundingClientRect().width - width) < 1, resized.window.width);
    assert.deepEqual(await page.evaluate(() => window.captureMiniWindow()), resized);
    console.log('PASS mini app authored resize, narrow capture, close/reopen and wide restoration');
  } finally { await page.close(); }
}
