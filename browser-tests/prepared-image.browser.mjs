import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { productionResponseSecurityHeaders } from '../scripts/productionSecurityPolicy.js';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:24967';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/prepared-image';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const painted = page => page.locator('#prepared image');
const isPrepared = page => page.waitForFunction(() => document.querySelector('#prepared image')?.href.baseVal.startsWith('blob:'));

function animatedWebP(frames) {
  const chunk = (name, data) => {
    const head = Buffer.alloc(8); head.write(name); head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, Buffer.alloc(data.length % 2)]);
  };
  const extended = Buffer.alloc(10); extended[0] = 2; extended.writeUIntLE(63, 4, 3); extended.writeUIntLE(63, 7, 3);
  const contents = [Buffer.from('WEBP'), chunk('VP8X', extended), chunk('ANIM', Buffer.alloc(6))];
  for (const frame of frames) {
    const data = Buffer.alloc(16); data.writeUIntLE(63, 6, 3); data.writeUIntLE(63, 9, 3); data.writeUIntLE(180, 12, 3); data[15] = 2;
    const parts = [data];
    for (let at = 12; at < frame.length;) {
      const length = frame.readUInt32LE(at + 4), end = at + 8 + length + length % 2;
      if (['VP8 ', 'VP8L', 'ALPH'].includes(frame.toString('ascii', at, at + 4))) parts.push(frame.subarray(at, end));
      at = end;
    }
    contents.push(chunk('ANMF', Buffer.concat(parts)));
  }
  const body = Buffer.concat(contents), header = Buffer.alloc(8); header.write('RIFF'); header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

async function mount(page) {
  await page.route('**/imagePaint.worker.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(),
      ...productionResponseSecurityHeaders({ VITE_IPFS_GATEWAY_URL: 'https://prepared.invalid' }) } });
  });
  await page.route(`${origin}/__prepared_image__`, route => route.fulfill({ contentType: 'text/html',
    headers: productionResponseSecurityHeaders({ VITE_IPFS_GATEWAY_URL: 'https://prepared.invalid' }), body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__prepared_image__`);
  const media = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2000;
    const ctx = canvas.getContext('2d');
    for (const [color, x, y] of [['#ef2030',0,0], ['#20c040',1000,0], ['#2050ef',0,1000], ['#efcf20',1000,1000]]) {
      ctx.fillStyle = color; ctx.fillRect(x, y, 1000, 1000);
    }
    ctx.clearRect(800, 800, 400, 400);
    const still = canvas.toDataURL('image/webp', 1).split(',')[1];
    canvas.width = canvas.height = 64;
    const frames = ['#ff0000', '#00ff00'].map(color => { ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 64); return canvas.toDataURL('image/webp', 1).split(',')[1]; });
    return { still, frames };
  });
  // Chrome's canvas export includes an sRGB ICC profile. This known-sRGB pixel
  // fixture omits it; profile-bearing sources have their own native-fallback case.
  const exported = Buffer.from(media.still, 'base64'), parts = [exported.subarray(0, 12)];
  for (let at = 12; at < exported.length;) {
    const size = exported.readUInt32LE(at + 4), end = at + 8 + size + size % 2, name = exported.toString('ascii', at, at + 4);
    const part = Buffer.from(exported.subarray(at, end));
    if (name === 'VP8X') part[8] &= ~32;
    if (name !== 'ICCP') parts.push(part);
    at = end;
  }
  const still = Buffer.concat(parts); still.writeUInt32LE(still.length - 8, 4);
  const animation = animatedWebP(media.frames.map(value => Buffer.from(value, 'base64')));
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; }), headerRequested = new Promise(resolve => { requested = resolve; });
  await page.route('https://prepared.invalid/**', async route => {
    const url = new URL(route.request().url()), preparation = route.request().resourceType() === 'fetch';
    if (url.pathname === '/late.webp' && preparation) { requested(); await gate; }
    let body = url.pathname === '/animated.webp' ? animation : still;
    if (preparation && ['/profile.webp', '/orientation.webp', '/oversized.webp'].includes(url.pathname)) {
      body = Buffer.alloc(30); body.write('RIFF'); body.write('WEBP', 8); body.write('VP8X', 12); body.writeUInt32LE(10, 16);
      body[20] = url.pathname === '/profile.webp' ? 32 : url.pathname === '/orientation.webp' ? 8 : 0;
      body.writeUIntLE(url.pathname === '/oversized.webp' ? 5999 : 1999, 24, 3); body.writeUIntLE(5999, 27, 3);
    }
    try { await route.fulfill({ contentType: 'image/webp', headers: { 'access-control-allow-origin': url.pathname === '/no-cors.webp' ? 'https://elsewhere.invalid' : '*' },
      body: url.pathname === '/truncated.webp' && preparation ? body.subarray(0, 15) : body }); } catch { /* A cancelled read can finish after unmount. */ }
  });
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const react = await import('/@id/react'), dom = await import('/@id/react-dom/client');
    const React = react.default || react, { createRoot } = dom.default || dom;
    const ImageArtwork = (await import('/src/imageModule/ImageArtwork.jsx')).default;
    const { ArtworkGeometry } = await import('/src/artwork/ArtworkGeometry.jsx');
    await import('/src/imageModule/imageModule.css');
    document.body.style.cssText = 'margin:20px;background:#585858';
    const listeners = new Set(), geometry = { subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, isProjected: () => false };
    const urls = new Set(), create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url; };
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url); };
    window.preparedTest = { urls, listeners };
    function App() {
      const [config, setConfig] = React.useState({ source: 'still.webp', scale: 1, crop: null, quarterTurns: 0, mirrorX: false, mirrorY: false, open: true });
      preparedTest.change = values => setConfig(current => ({ ...current, ...values }));
      React.useLayoutEffect(() => { listeners.forEach(listener => listener()); }, [config]);
      return React.createElement(ArtworkGeometry.Provider, { value: geometry }, ...['prepared', 'reference'].map(id =>
        React.createElement('div', { id, key: id, style: { position: 'relative', width: 200 * config.scale, height: 200 * config.scale, marginBottom: 20 } },
          config.open && (id !== 'reference' || config.referenceOpen !== false) && React.createElement(ImageArtwork, { rectangle: { left: 0, top: 0, width: 200, height: 200 }, side: {
            asset: { media: { url: 'https://prepared.invalid/' + (id === 'reference' ? config.referenceSource || 'reference' : config.source), width: 2000, height: 2000 } },
            crop: config.crop, transform: { quarterTurns: config.quarterTurns, mirrorX: config.mirrorX, mirrorY: config.mirrorY },
          } }))));
    }
    createRoot(document.getElementById('root')).render(React.createElement(App));
  });
  await page.locator('#prepared [data-media-state="ready"]').waitFor();
  return { release, headerRequested };
}

test('prepared Image pixels retain alpha, crop and transforms; enlarge, reuse and dispose at two display densities', { timeout: 90000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const evidence = [];
  try {
    for (const [width, density] of [[1440, 1], [390, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: density });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mount(page); await isPrepared(page);
      const first = await painted(page).getAttribute('href');
      await page.evaluate(() => preparedTest.change({ scale: .67 })); await settle(page);
      await page.evaluate(() => preparedTest.change({ scale: 1 })); await settle(page);
      assert.equal(await painted(page).getAttribute('href'), first, 'zooming out and back reuses already sufficient pixels');
      for (const config of [{}, { quarterTurns: 1, mirrorX: true }, { quarterTurns: 3, mirrorY: true, crop: { x: .35, y: .65, zoom: 1.3 } }]) {
        await page.evaluate(config => preparedTest.change(config), config); await isPrepared(page); await settle(page);
        const left = await page.locator('#prepared').screenshot(), right = await page.locator('#reference').screenshot();
        const error = await page.evaluate(async ([a, b]) => {
          const pixels = async base64 => { const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
          const p = await pixels(a), q = await pixels(b); let sum = 0;
          for (let i = 0; i < p.length; i++) sum += Math.abs(p[i] - q[i]);
          return { meanChannelDifference: sum / p.length, channels: p.length };
        }, [left.toString('base64'), right.toString('base64')]);
        assert.ok(error.meanChannelDifference < 2, `prepared pixels match native source: ${JSON.stringify(error)}`);
        evidence.push({ width, density, config, ...error });
      }
      await page.locator('#prepared').screenshot({ path: `${output}/prepared-${width}.png` });
      await page.evaluate(() => preparedTest.change({ scale: 4, crop: null }));
      await page.waitForFunction(() => document.querySelector('#prepared image').href.baseVal === 'https://prepared.invalid/still.webp');
      assert.equal(await page.evaluate(() => preparedTest.urls.size), 0, 'enlargement restores full detail and releases the thumbnail');
      await page.evaluate(() => preparedTest.change({ scale: 1 })); await isPrepared(page);
      await page.evaluate(() => preparedTest.change({ open: false })); await settle(page);
      assert.equal(await page.evaluate(() => preparedTest.urls.size), 0, 'closing releases paint URLs');
      assert.equal(await page.evaluate(() => preparedTest.listeners.size), 0, 'closing removes geometry subscriptions');
      assert.deepEqual(errors, []); await page.close();
    }
    await writeFile(`${output}/pixel-evidence.json`, JSON.stringify(evidence, null, 2));
  } finally { await browser.close(); }
});

test('animated, unreadable and truncated WebP remain native; stale work cannot replace new content and workers close', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const { release, headerRequested } = await mount(page); await isPrepared(page);
    const blobWorkerBlocked = await page.evaluate(() => new Promise(resolve => {
      const url = URL.createObjectURL(new Blob(['self.postMessage("unexpected")'], { type: 'text/javascript' }));
      const cleanup = worker => { worker?.terminate(); URL.revokeObjectURL(url); };
      try {
        const worker = new Worker(url);
        worker.onmessage = () => { cleanup(worker); resolve(false); };
        worker.onerror = event => { event.preventDefault(); cleanup(worker); resolve(true); };
      } catch { cleanup(); resolve(true); }
    }));
    assert.equal(blobWorkerBlocked, true, 'production policy allows the bundled worker but still blocks blob workers');
    for (const source of ['animated.webp', 'no-cors.webp', 'truncated.webp', 'profile.webp', 'orientation.webp', 'oversized.webp', 'reference']) {
      await page.evaluate(source => preparedTest.change({ source }), source);
      await page.locator('#prepared [data-media-state="ready"]').waitFor(); await page.waitForTimeout(150);
      assert.equal(await painted(page).getAttribute('href'), 'https://prepared.invalid/' + source);
      assert.equal(await page.evaluate(() => preparedTest.urls.size), 0);
      if (source === 'animated.webp') {
        const frames = [];
        for (let i = 0; i < 8; i++) { frames.push((await page.locator('#prepared').screenshot()).toString('base64')); await page.waitForTimeout(70); }
        assert.ok(new Set(frames).size > 1, 'the animated WebP continues to animate');
      }
    }
    await page.evaluate(() => preparedTest.change({ referenceSource: 'still.webp' }));
    await page.waitForFunction(() => document.querySelector('#reference image').href.baseVal.startsWith('blob:'));
    const reference = await page.locator('#reference image').getAttribute('href');
    await page.evaluate(() => preparedTest.change({ source: 'late.webp' })); await headerRequested;
    await page.evaluate(() => preparedTest.change({ source: 'still.webp' })); await isPrepared(page);
    const current = await painted(page).getAttribute('href'); release(); await page.waitForTimeout(100);
    assert.equal(await painted(page).getAttribute('href'), current, 'obsolete header result cannot overwrite the current source');
    assert.equal(await page.locator('#reference image').getAttribute('href'), reference, 'changing one side preserves the other side\'s paint resource');
    assert.equal(page.workers().length, 1, 'two Image sides share one worker');
    assert.equal(await page.evaluate(() => preparedTest.urls.size), 2);
    await page.evaluate(() => preparedTest.change({ referenceOpen: false })); await settle(page);
    assert.equal(page.workers().length, 1, 'closing one side retains the worker needed by the other');
    assert.equal(await page.evaluate(() => preparedTest.urls.size), 1);
    await page.evaluate(() => preparedTest.change({ scale: 1.5 }));
    await page.evaluate(() => preparedTest.change({ open: false })); await settle(page);
    await page.waitForTimeout(150);
    assert.equal(page.workers().length, 0, 'the last closed side terminates its worker');
    assert.equal(await page.evaluate(() => preparedTest.urls.size), 0, 'late encoding does not leak or install a URL after closing');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
