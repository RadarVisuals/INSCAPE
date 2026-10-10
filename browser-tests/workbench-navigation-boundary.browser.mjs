import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

test('navigation accumulates camera input without rendering or replacing an editing surface during pan', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__navigation_boundary__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__navigation_boundary__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
      const { useWorkbenchCamera } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
      const { WorkbenchWindow } = await import('/src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx');
      await import('/src/inscapeTokens.css');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      window.editorRenders = 0;
      window.cameraPaints = [];
      function Editor() {
        const { scale } = useWorkbenchView();
        const [text, setText] = React.useState('The composition stays editable.');
        window.editorRenders += 1;
        return React.createElement('textarea', { 'aria-label': 'Composition text', 'data-scale': scale,
          value: text, onChange: event => setText(event.target.value) });
      }
      function CameraProbe() {
        const camera = useWorkbenchCamera();
        window.readCamera = camera.getCamera;
        window.cameraPaints.push({ scale: camera.scale, offset: camera.offset });
        return null;
      }
      function Bench() {
        const host = React.useRef(null);
        return React.createElement(WorkbenchViewProvider, null,
          React.createElement('main', { ref: host, className: 'system-workflow', tabIndex: -1 },
            React.createElement(WorkbenchViewControls, { hostRef: host }),
            React.createElement(CameraProbe),
            React.createElement(WorkbenchWindow, { label: 'Text', title: 'Navigation boundary', viewId: 'text:boundary',
              width: 300, initialHeight: 220, initialX: 80, initialY: 80 }, React.createElement(Editor))));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Bench));
    });
    const editor = page.getByRole('textbox', { name: 'Composition text', exact: true });
    await editor.fill('Keep this unfinished sentence and its caret.');
    await settle(page);
    const before = await editor.evaluate(node => {
      node.setSelectionRange(10, 20);
      window.originalEditor = node;
      return { renders: window.editorRenders, text: node.value, scale: Number(node.dataset.scale) };
    });
    // A burst arrives before React paints: each event must use the latest whole
    // camera, while editors remain outside the offset subscription.
    const panned = await page.evaluate(() => {
      const host = document.querySelector('main');
      for (let i = 0; i < 10; i++) host.dispatchEvent(new WheelEvent('wheel', {
        deltaX: 5, deltaY: 10, bubbles: true, cancelable: true,
      }));
      return window.readCamera();
    });
    assert.deepEqual(panned, { scale: 1, offset: { x: -50, y: -100 } });
    await settle(page);
    assert.deepEqual(await editor.evaluate(node => ({ renders: window.editorRenders, text: node.value, scale: Number(node.dataset.scale) })), before);
    assert.deepEqual(await editor.evaluate(node => ({ same: node === window.originalEditor, focused: node === document.activeElement,
      selection: [node.selectionStart, node.selectionEnd] })), { same: true, focused: true, selection: [10, 20] });

    const zoomed = await page.evaluate(() => {
      window.cameraPaints = [];
      const host = document.querySelector('main'), rect = host.getBoundingClientRect();
      for (let i = 0; i < 2; i++) host.dispatchEvent(new WheelEvent('wheel', {
        ctrlKey: true, deltaY: -40, clientX: rect.left + 500, clientY: rect.top + 400, bubbles: true, cancelable: true,
      }));
      return window.readCamera();
    });
    near(zoomed.scale, Math.exp(.24));
    near(zoomed.offset.x, 500 - 550 * zoomed.scale);
    near(zoomed.offset.y, 400 - 500 * zoomed.scale);
    await settle(page);
    near(Number(await editor.getAttribute('data-scale')), zoomed.scale);
    assert.equal(await editor.inputValue(), before.text);
    assert.equal(await editor.evaluate(node => node === window.originalEditor), true);
    const paints = await page.evaluate(() => window.cameraPaints);
    assert.ok(paints.length > 0);
    for (const camera of paints) {
      near((500 - camera.offset.x) / camera.scale, 550);
      near((400 - camera.offset.y) / camera.scale, 500);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
