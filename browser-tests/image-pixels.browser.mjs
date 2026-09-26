import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
test('Image paints all four edges, corners and source alpha at fractional camera scales and pixel densities', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const shots = await mkdtemp(join(tmpdir(), 'inscape-image-pixels-'));
  console.log(`Pixel screenshots: ${shots}`);
  try {
    for (const density of [1, 1.25, 2]) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('https://image.test/**', async route => {
        const key = new URL(route.request().url()).pathname.split('/')[1].split('.')[0];
        const url = await page.evaluate(key => window.urls[key], key);
        await route.fulfill({ contentType: 'image/png', body: Buffer.from(url.split(',')[1], 'base64') });
      });
      await page.route(`${origin}/__pixels__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__pixels__`);
      await page.evaluate(async () => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
        const { WorkbenchViewProvider, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
        const { useWorkbenchCamera } = await import('/src/public/ownerSystemWorkflow/WorkbenchCamera.jsx');
        const ImageWorkbench = (await import('/src/imageModule/ImageWorkbench.jsx')).default;
        const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
        const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
        await import('/src/inscapeTokens.css');
        const asset = buildProfileDocumentV9Asset(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id);
        const bitmap = document.createElement('canvas'); bitmap.width = 200; bitmap.height = 160;
        const ctx = bitmap.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 200, 160);
        const opaque = bitmap.toDataURL(); ctx.clearRect(50, 40, 100, 80); const alpha = bitmap.toDataURL();
        for (const [color, x, y] of [['#ff0000',0,0], ['#00ff00',100,0], ['#0000ff',0,80], ['#ffff00',100,80]]) { ctx.fillStyle=color; ctx.fillRect(x,y,100,80); }
        window.urls = { opaque, alpha, quadrants: bitmap.toDataURL() };
        function Fixture() {
          const camera = useWorkbenchView();
          const pan = useWorkbenchCamera();
          const [config, setConfig] = React.useState({ width: 317, height: 193, alpha: false, turn: 0, mirror: false });
          window.configureImage = (next, zoom) => { setConfig(next); camera.setScale(zoom); pan.setOffset({x: .23*zoom, y: .17*zoom}); };
          const record = { id: 'image:pixels', name: 'Pixels', width: config.width, height: config.height, visibility: 'PUBLIC',
            sides: [{ id: 'side:pixels', asset: { ...asset, media: { ...asset.media, url: `https://image.test/${config.quadrants ? 'quadrants' : config.alpha ? 'alpha' : 'opaque'}.png`, width: 200, height: 160 } },
              crop: config.native ? null : { x: .5, y: .5, zoom: config.cropZoom || 1 }, transform: { quarterTurns: config.turn, mirrorX: config.mirror, mirrorY: config.mirrorY ?? config.mirror } }] };
          return React.createElement(ImageWorkbench, { records: [record], presentations: [{ id: record.id, open: true, position: { left: 80.3, top: 60.7 } }] });
        }
        createRoot(document.getElementById('root')).render(React.createElement(WorkbenchViewProvider, null, React.createElement(Fixture)));
      });
      await page.addStyleTag({ content: 'body { margin:0; background:#000; } .image-module__header { visibility:hidden; }' });
      await page.locator('.image-module__artwork').waitFor();
      await page.evaluate(async () => { for (const key of ['opaque', 'alpha', 'quadrants']) { const image = new Image(); image.src = `https://image.test/${key}.png`; await image.decode(); } });
      for (const [width, height] of [[32, 32], [317, 193], [97, 511], [701, 64], [4096, 4096]]) {
        for (const zoom of [.25, .33, .41, .67, 1, 1.25, 1.37, 2]) {
          // The large fitted case must stay visible for a complete screenshot.
          if (width === 4096 && zoom > 1) continue;
          for (const alpha of [false, true]) {
            await page.evaluate(({ width, height, zoom, alpha }) => window.configureImage({ width, height, alpha, turn: alpha ? 1 : 0, mirror: alpha }, zoom), { width, height, zoom, alpha });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const png = await page.screenshot();
            const result = await page.evaluate(async ({ png, alpha }) => {
              const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
              const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
              const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
              const rect = document.querySelector('.image-module__canvas').getBoundingClientRect(), d = devicePixelRatio;
              const left = Math.ceil(rect.left * d), top = Math.ceil(rect.top * d), right = Math.floor(rect.right * d), bottom = Math.floor(rect.bottom * d);
              const points = [];
              // Every fully covered physical pixel along all edges, including corners.
              for (let x = left; x < right; x++) points.push([x, top], [x, bottom - 1]);
              for (let y = top; y < bottom; y++) points.push([left, y], [right - 1, y]);
              // At thumbnail size filtering can mix the internal alpha hole
              // into corners; opaque sources remain the strict edge oracle.
              const covered = alpha ? [] : points;
              const bad = covered.filter(([x, y]) => { const p = ctx.getImageData(x, y, 1, 1).data; return p[0] < 250 || p[1] > 4 || p[2] > 4; });
              // Fully outside pixels may not contain artwork at any side or corner.
              const outside = [[Math.floor(rect.left*d)-1, top], [Math.ceil(rect.right*d), top], [left, Math.floor(rect.top*d)-1], [left, Math.ceil(rect.bottom*d)]];
              const leaked = outside.filter(([x,y]) => ctx.getImageData(x,y,1,1).data[0] !== 0);
              const center = [...ctx.getImageData(Math.floor((rect.left+rect.width/2)*d), Math.floor((rect.top+rect.height/2)*d),1,1).data];
              return { bad: bad.slice(0, 8).map(([x,y]) => [x,y,...ctx.getImageData(x,y,1,1).data]), badCount: bad.length, leaked, center, rect: { left:rect.left, top:rect.top, width:rect.width, height:rect.height } };
            }, { png: png.toString('base64'), alpha });
            assert.equal(result.badCount, 0, JSON.stringify({ density, width, height, zoom, alpha, ...result }));
            assert.equal(result.leaked.length, 0, JSON.stringify({ density, width, height, zoom, alpha, ...result }));
            assert.deepEqual(result.center.slice(0, 3), alpha ? [0, 0, 0] : [255, 0, 0], 'native alpha remains a hole');
          }
        }
      }
      await page.screenshot({ path: join(shots, `alpha-${density}.png`) });
      // Asymmetric source pixels prove quarter-turns and both mirror axes, in
      // native fit and cropped mode, rather than merely checking DOM styles.
      for (let turn=0; turn<4; turn++) for (const mirror of [false,true]) for (const mirrorY of [false,true]) for (const native of [false,true]) {
        const config = { width: turn%2 ? 256:320, height: turn%2 ? 320:256, turn, mirror, mirrorY, native, quadrants:true, cropZoom:2 };
        await page.evaluate(config => window.configureImage(config, .73), config);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const png = await page.screenshot();
        const samples = await page.evaluate(async png => {
          const image=new Image(); image.src=`data:image/png;base64,${png}`; await image.decode();
          const c=document.createElement('canvas'); c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
          const r=document.querySelector('.image-module__canvas').getBoundingClientRect();
          return [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>[...ctx.getImageData(Math.floor((r.left+r.width*x)*devicePixelRatio),Math.floor((r.top+r.height*y)*devicePixelRatio),1,1).data].slice(0,3));
        }, png.toString('base64'));
        const expected = [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y]) => {
          if(mirror) x=1-x; if(mirrorY) y=1-y;
          for(let i=0;i<turn;i++) [x,y]=[y,1-x];
          return y<.5 ? x<.5 ? [255,0,0]:[0,255,0] : x<.5 ? [0,0,255]:[255,255,0];
        });
        assert.deepEqual(samples,expected,JSON.stringify({density,...config}));
      }
      await page.screenshot({ path: join(shots, `transforms-${density}.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
