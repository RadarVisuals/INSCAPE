import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';

// Real Image surfaces and Hand input, with only the animation clock paused
// so screenshots can inspect particular frames of the release glide.
async function mount(page, scale) {
  await page.route(`${origin}/__explore_joins__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__explore_joins__`);
  const red = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 130;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 180, 130);
    return canvas.toDataURL().split(',')[1];
  });
  await page.route('https://image.test/explore.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(red, 'base64') }));
  await page.evaluate(async scale => {
    const refresh = (await import('/@react-refresh')).default; refresh.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
    const { useWorkbenchCamera } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
    const ImageWindow = (await import('/src/imageModule/ImageWindow.jsx')).default;
    const ImageArtwork = (await import('/src/imageModule/ImageArtwork.jsx')).default;
    await import('/src/imageModule/imageModule.css');
    const side = { asset: { media: { url: 'https://image.test/explore.png', width: 180, height: 130 } }, crop: { x: .5, y: .5, zoom: 1 }, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
    const positions = [{ left: 40.3, top: 130.7 }, { left: 220.3, top: 130.7 }, { left: 40.3, top: 260.7 }, { left: 220.3, top: 260.7 }];
    function Fixture() {
      const host = React.useRef(null), view = useWorkbenchView(), camera = useWorkbenchCamera();
      window.__joinsCamera = camera.getCamera;
      window.__joinsAuthored = () => ({ positions, transforms: view.transforms });
      React.useLayoutEffect(() => { view.setScale(scale); camera.setOffset({ x: .37, y: -.23 }); }, []);
      return React.createElement('main', { ref: host, tabIndex: -1, style: { position: 'fixed', inset: 0 } },
        React.createElement(WorkbenchViewControls, { hostRef: host }),
        positions.map((position, i) => React.createElement(ImageWindow, { key: i, id: `image:${i}`, title: `Image ${i}`, position, size: { width: 180, height: 130 }, fitScale: 1,
          editable: false, onPosition: () => { throw Error('camera wrote a module position'); }, onClose: () => {} },
        rectangle => React.createElement(ImageArtwork, { rectangle, side }))));
    }
    window.__joinsCommits = 0;
    createRoot(document.getElementById('root')).render(React.createElement(React.Profiler, { id: 'joins', onRender: () => window.__joinsCommits++ },
      React.createElement(WorkbenchViewProvider, null, React.createElement(Fixture))));
  }, scale);
  await page.addStyleTag({ content: 'body {background:#123456} .image-module__window {outline:none!important} .image-module__close {visibility:hidden}' });
  await page.locator('.image-module__artwork image').last().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.image-module__artwork[data-media-state="ready"]').length === 4);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function pixels(page) {
  const png = await page.screenshot();
  return page.evaluate(async png => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const rectangles = [...document.querySelectorAll('.image-module__window')].map(node => node.getBoundingClientRect());
    let bad = 0, sampled = 0;
    for (const [first, second, axis] of [[0, 1, 'x'], [2, 3, 'x'], [0, 2, 'y'], [1, 3, 'y']]) {
      const a = rectangles[first], b = rectangles[second], d = devicePixelRatio;
      const seam = Math.round((axis === 'x' ? b.left : b.top) * d);
      const start = Math.ceil((axis === 'x' ? Math.max(a.top, b.top) : Math.max(a.left, b.left)) * d) + 2;
      const end = Math.floor((axis === 'x' ? Math.min(a.bottom, b.bottom) : Math.min(a.right, b.right)) * d) - 2;
      for (let along = start; along < end; along++) for (let across = seam - 1; across <= seam; across++) {
        const [r, g, blue] = ctx.getImageData(axis === 'x' ? across : along, axis === 'x' ? along : across, 1, 1).data;
        if (r < 250 || g > 4 || blue > 4) bad++;
        sampled++;
      }
    }
    return { bad, sampled, camera: window.__joinsCamera(), rectangles: rectangles.map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height })) };
  }, png.toString('base64'));
}

for (const density of [1, 1.25, 2]) for (const width of [1440, 390]) {
  test(`Hand keeps both Image joins opaque throughout release momentum (${width}px, DPR ${density})`, { timeout: 60000 }, async () => {
    await mkdir('.browser-test-runtime', { recursive: true });
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: density });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mount(page, width === 390 ? .671 : 1.371);
      const before = await page.evaluate(() => window.__joinsAuthored());
      const baseline = await pixels(page);
      assert.equal(baseline.bad, 0, `baseline joins: ${JSON.stringify(baseline)}`);
      await page.getByRole('button', { name: 'Hand tool', exact: true }).click();
      await page.evaluate(() => {
        const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
        let sequence = 1000000; const pending = new Map();
        window.requestAnimationFrame = callback => { const id = ++sequence; pending.set(id, callback); return id; };
        window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
        window.__joinsStep = time => new Promise(resolve => request(() => {
          const batch = [...pending.values()]; pending.clear(); batch.forEach(callback => callback(time));
          request(() => request(resolve));
        }));
        window.__joinsRestore = () => { window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel; };
      });
      await page.mouse.move(width - 80, 650); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(width - 80 + i * 2, 650 + i * 1.5); if (i < 8) await page.waitForTimeout(12); }
      await page.mouse.up();
      const released = await page.evaluate(() => ({ camera: window.__joinsCamera(), time: performance.now(), commits: window.__joinsCommits }));
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 4, 'release started projected motion');
      let coastCommits;
      for (const elapsed of [0, 33, 83, 157]) {
        await page.evaluate(time => window.__joinsStep(time), released.time + elapsed);
        const raster = await pixels(page);
        if (elapsed === 83) await page.screenshot({ path: `.browser-test-runtime/workbench-hand-joins-${width}-${density}.png` });
        assert.ok(raster.sampled > 200, 'inspect actual joined artwork pixels');
        assert.equal(raster.bad, 0, `opaque joins at ${elapsed}ms: ${JSON.stringify(raster)}`);
        if (elapsed > 0) assert.ok(raster.camera.offset.x > released.camera.offset.x, 'momentum continues after release');
        if (elapsed === 0) coastCommits = await page.evaluate(() => window.__joinsCommits);
      }
      assert.equal(await page.evaluate(() => window.__joinsCommits), coastCommits, 'coast does not commit React per frame');
      await page.evaluate(time => window.__joinsStep(time), released.time + 1000);
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0, 'projection retires after settling');
      assert.equal((await pixels(page)).bad, 0, 'settled joins');
      assert.deepEqual(await page.evaluate(() => window.__joinsAuthored()), before, 'camera preserves authored geometry');
      await page.evaluate(() => window.__joinsRestore());
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
