import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5189';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const [width, density] of [[1440, 1], [390, 1.25]]) test(`Image resize focus stays on the corner mark at ${width}px`, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__image_resize_focus__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_resize_focus__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const ImageWindow = (await import('/src/imageModule/ImageWindow.jsx')).default;
      const { WorkbenchViewProvider } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/imageModule/imageModule.css');
      await import('/src/lattice/rendering/latticeMenuSurface.css');
      function App() {
        const [size, setSize] = React.useState({ width: 240, height: 180 });
        return React.createElement(WorkbenchViewProvider, null,
          React.createElement('main', { className: 'system-workflow', 'data-surface': 'slate', 'data-lattice-menu-surface': '', 'data-menu-surface': 'carbon', style: { position: 'fixed', inset: 0 } },
            React.createElement(ImageWindow, { id: 'image:focus-test', title: 'Resize sample', position: { left: 48, top: 96 }, size,
              fitScale: 1, editable: true, active: true, onPosition() {}, onResize: setSize, onClose() {} },
              () => React.createElement('div', { className: 'image-module__canvas', style: { background: '#383f43' } },
                React.createElement('svg', { width: '100%', height: '100%', viewBox: '0 0 240 180' },
                  React.createElement('circle', { cx: 120, cy: 90, r: 58, fill: '#aab6b7' }))))));
      }
      createRoot(document.getElementById('root')).render(React.createElement(App));
    });
    const handle = page.getByRole('separator', { name: 'Resize Image window', exact: true });
    await handle.waitFor(); await settle(page);
    // Reach the resize grip by keyboard: its focus indication belongs to the
    // visible 8px mark while the forgiving 28px pointer target stays invisible.
    await page.locator('.image-module__window').focus();
    for (let count = 0; count < 10 && !await handle.evaluate(el => el === document.activeElement); count++) await page.keyboard.press('Tab');
    assert.equal(await handle.evaluate(el => el.matches(':focus-visible')), true);
    const focus = await handle.evaluate(el => ({ target: getComputedStyle(el).outlineStyle,
      mark: getComputedStyle(el, '::after').backgroundColor, markWidth: getComputedStyle(el, '::after').width }));
    assert.equal(focus.target, 'none', 'the click target must not become a second visible square');
    assert.equal(focus.mark, 'rgb(255, 255, 255)', 'keyboard focus fills the real corner mark');
    assert.equal(focus.markWidth, '8px');
    const before = await page.locator('.image-module__window').boundingBox();
    await page.keyboard.press('ArrowRight'); await settle(page);
    assert.ok((await page.locator('.image-module__window').boundingBox()).width > before.width, 'keyboard resizing still works');
    await page.screenshot({ path: `.browser-test-runtime/image-resize-keyboard-${width}.png` });
    const box = await handle.boundingBox();
    assert.ok(Math.abs(box.width - 28) < 1, 'large click target is retained');
    await page.mouse.move(box.x + 12, box.y + 12); await page.mouse.down();
    await page.mouse.move(box.x + 36, box.y + 36, { steps: 5 }); await page.mouse.up(); await settle(page);
    assert.ok((await page.locator('.image-module__window').boundingBox()).width > before.width + 20, 'pointer resizing still works');
    assert.equal(await handle.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await page.screenshot({ path: `.browser-test-runtime/image-resize-pointer-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
