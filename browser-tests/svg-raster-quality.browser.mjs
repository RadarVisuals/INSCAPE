import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const grey = await readFile(new URL('./fixtures/keeper-layered.svg', import.meta.url), 'utf8');
const purple = await readFile(new URL('./fixtures/keeper-octopus.svg', import.meta.url), 'utf8');
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });

test('embedded WebP thumbnails stay filtered on hover and retain original pixels for Lift', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    for (const [width, deviceScaleFactor] of [[1440, 1], [390, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 400, seamReview: 'single',
        artwork: { url: 'https://quality.invalid/keeper.svg', width: 2048, height: 2048, body: grey } });
      const source = page.locator('.image-module__canvas').first();
      await source.locator('.artwork-svg-document').waitFor();
      await source.locator('.artwork-svg-status').waitFor({ state: 'detached' });
      const iframe = await source.locator('iframe').elementHandle(), host = await iframe.contentFrame(), runtime = host.childFrames()[0];
      const filtered = () => runtime.waitForFunction(() => [...document.querySelectorAll('image')].every(n => n.href.baseVal.startsWith('blob:')));
      await filtered();
      const before = await runtime.evaluate(() => [...document.querySelectorAll('image')].map(n => n.href.baseVal));
      await page.evaluate(() => {
        window.prepared = false;
        addEventListener('message', event => { if (event.data?.type === 'inscape:artwork-prepared') window.prepared = true; });
      });
      // The populated fixture's floating tools can cover this thumbnail. Send
      // the same pointer-over event directly to exercise its hover handler.
      await source.dispatchEvent('pointerover', { pointerType: 'mouse', buttons: 0 });
      await page.waitForFunction(() => window.prepared);
      assert.deepEqual(await runtime.evaluate(() => [...document.querySelectorAll('image')].map(n => n.href.baseVal)), before, 'hover warming never replaces the visible filtered sources');
      await mkdir('.browser-test-runtime', { recursive: true });
      await source.screenshot({ path: `.browser-test-runtime/svg-quality-hover-${width}.png` });
      const board = page.locator('main.system-workflow').first();
      for (const target of [.5, 2, .25, 1]) {
        for (let step = 0; step < 30; step++) {
          const current = Number(await board.getAttribute('data-workbench-camera-scale'));
          if (Math.abs(current - target) < 1e-6) break;
          const box = await source.boundingBox();
          await board.dispatchEvent('wheel', { deltaY: Math.max(-100, Math.min(100, -Math.log(target / current) / .003)),
            ctrlKey: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true });
          await page.waitForFunction(previous => Number(document.querySelector('main.system-workflow').dataset.workbenchCameraScale) !== previous, current);
        }
        const outerScale = await source.locator('foreignObject').evaluate(node => {
          const matrix = node.getScreenCTM(); return Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) * devicePixelRatio;
        });
        await runtime.waitForFunction(async density => {
          const node = document.querySelector('#body image');
          const image = new Image(); image.src = node.href.baseVal; await image.decode();
          const matrix = node.getScreenCTM();
          const expected = Math.ceil(node.width.baseVal.value * Math.hypot(matrix.a, matrix.b) * density * 2);
          return Math.abs(image.naturalWidth - expected) <= 2;
        }, outerScale);
      }
      await source.focus(); await page.keyboard.press('Shift+Enter');
      await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      const focusedScale = await source.locator('foreignObject').evaluate(node => {
        const m = node.getScreenCTM(); return Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) * devicePixelRatio;
      });
      await runtime.waitForFunction(async density => {
        const node = document.querySelector('#body image'), image = new Image(); image.src = node.href.baseVal; await image.decode();
        const m = node.getScreenCTM(), size = node.width.baseVal.value;
        const pixels = size * Math.hypot(m.a, m.b) * density * 2;
        return Math.abs(image.naturalWidth - (pixels >= size * .75 ? size : Math.ceil(pixels))) <= 2;
      }, focusedScale);
      await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
      await filtered();
      await source.focus(); await page.keyboard.press('Enter');
      await runtime.waitForFunction(() => [...document.querySelectorAll('image')].every(n => n.href.baseVal.startsWith('data:')));
      await page.waitForFunction(() => document.querySelector('.image-lift')?.style.getPropertyValue('--inspection-lift-progress') === '1');
      assert.equal(await source.locator('iframe').evaluate((node, original) => node === original, iframe), true);
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
      await filtered();
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('grey layers and purple WebP head use bounded filtered sources, resize, and release their paint resources', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    for (const width of [1100, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 700 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route(`${origin}/__raster_quality__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__raster_quality__`);
      await page.evaluate(async sources => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
        const { KeeperRigArtwork } = await import('/src/keeper/KeeperRigArtwork.jsx');
        const { parseKeeperRig } = await import('/src/keeper/keeperRig.js');
        await import('/src/keeper/keeper.css');
        window.paintUrls = new Set();
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); window.paintUrls.add(url); return url; };
        URL.revokeObjectURL = url => { window.paintUrls.delete(url); revoke(url); };
        document.body.style.cssText = 'background:#cccac1;margin:20px';
        window.rigs = sources.map(source => parseKeeperRig(new DOMParser().parseFromString(source, 'image/svg+xml').documentElement));
        window.originalRigs = JSON.stringify(window.rigs);
        window.qualityRoot = createRoot(document.getElementById('root'));
        window.qualityRoot.render(React.createElement('div', null, ...window.rigs.map((rig, index) => React.createElement('div', { key: index, className: 'sample', style: { position: 'relative', height: 290 } },
          React.createElement('div', { className: 'keeper-roamer', style: { position: 'absolute', left: 155, top: 145, '--keeper-size': '260px' } }, React.createElement(KeeperRigArtwork, { rig }))))));
      }, [grey, purple]);
      const sourcesReady = () => page.waitForFunction(() => [...document.querySelectorAll('.keeper-rig img, .keeper-rig image')].length === 9
        && [...document.querySelectorAll('.keeper-rig img, .keeper-rig image')].every(n => (n.getAttribute('src') || n.getAttribute('href')).startsWith('blob:')));
      await sourcesReady();
      const dimensions = () => page.locator('.keeper-rig img, .keeper-rig image').evaluateAll(async nodes => Promise.all(nodes.map(async node => {
        const image = new Image(); image.src = node.getAttribute('src') || node.getAttribute('href'); await image.decode();
        return { width: image.naturalWidth, height: image.naturalHeight, url: image.src };
      })));
      const before = await dimensions();
      assert.ok(before.every(image => image.width > 0 && image.width < 600 && image.height < 600));
      await page.screenshot({ path: `.browser-test-runtime/keeper-quality-fixed-${width}.png` });
      await page.locator('.keeper-roamer').evaluateAll(nodes => nodes.forEach(node => node.style.setProperty('--keeper-size', '520px')));
      await page.waitForFunction(urls => [...document.querySelectorAll('.keeper-rig img, .keeper-rig image')].every((n, i) => (n.getAttribute('src') || n.getAttribute('href')) !== urls[i]), before.map(image => image.url));
      const after = await dimensions();
      assert.ok(after.every((image, i) => image.width >= before[i].width * 1.9), 'enlarging regenerates from original pixels');
      assert.equal(await page.evaluate(() => JSON.stringify(window.rigs) === window.originalRigs), true, 'prepared pixels never replace authored sources');
      await page.evaluate(() => window.qualityRoot.unmount());
      assert.equal(await page.evaluate(() => window.paintUrls.size), 0, 'all generated sources released');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('Focus, Return and subsequent zoom update Image and Display pixels without another click', { timeout: 120000 }, async () => {
  const browser = await launch();
  try {
    for (const visitor of [false, true]) for (const [width, deviceScaleFactor] of [[1440, 1], [390, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 400, seamReview: 'single',
        artwork: { url: 'https://quality.invalid/keeper.svg', width: 2048, height: 2048, body: grey } });
      const board = page.locator('main.system-workflow').first();
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const arrived = async () => { await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]')); await settle(); };
      for (const kind of ['image', 'display']) {
        const source = kind === 'image' ? page.locator('.image-module__canvas').first()
          : page.locator('.system-workflow__presentation-board').locator('.system-workflow__placement[tabindex="0"], .lattice-production-placement[tabindex="0"]').first();
        await source.locator('.artwork-svg-document').waitFor();
        await source.locator('.artwork-svg-status').waitFor({ state: 'detached' });
        const iframe = await source.locator('iframe').elementHandle(), host = await iframe.contentFrame(), runtime = host.childFrames()[0];
        const original = await runtime.evaluate(() => {
          // Read the authored dimensions, which remain unchanged by paint preparation.
          const node = document.querySelector('#body image');
          return { width: node.width.baseVal.value, height: node.height.baseVal.value };
        });
        const correctPixels = async () => {
          const density = await source.locator('foreignObject').evaluate(node => {
            const m = node.getScreenCTM(); return Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) * devicePixelRatio;
          });
          await runtime.waitForFunction(async ({ density, original }) => {
            const node = document.querySelector('#body image'), m = node.getScreenCTM();
            const image = new Image(); image.src = node.href.baseVal; await image.decode();
            const ratio = Math.min(1, Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) * density * 2);
            const expected = ratio >= .75 ? original.width : Math.ceil(original.width * ratio);
            return Math.abs(image.naturalWidth - expected) <= 2;
          }, { density, original });
        };
        const zoom = async target => {
          for (let step = 0; step < 35; step++) {
            const current = Number(await board.getAttribute('data-workbench-camera-scale'));
            if (Math.abs(current - target) < 1e-6) break;
            const box = await source.boundingBox();
            await board.dispatchEvent('wheel', { deltaY: Math.max(-100, Math.min(100, -Math.log(target / current) / .003)),
              ctrlKey: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true });
            await page.waitForFunction(previous => Number(document.querySelector('main.system-workflow').dataset.workbenchCameraScale) !== previous, current);
          }
          await settle(); await correctPixels();
        };
        const select = async () => {
          await board.focus(); await page.keyboard.press('Escape');
          await page.locator(`[data-workbench-view-id="${kind === 'image' ? 'image:motion-0' : 'display:primary'}"]`).evaluate(node => {
            const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
            target.focus({ preventScroll: true }); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
          });
          await settle();
        };
        await zoom(.25); await select();
        await runtime.evaluate(() => {
          window.cameraDensities = [];
          addEventListener('message', event => { if (event.data?.type === 'inscape:artwork-density') window.cameraDensities.push(event.data.scale); });
        });
        await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click();
        await arrived(); await correctPixels();
        assert.ok(await runtime.evaluate(() => window.cameraDensities.length <= 6), 'camera preparation/arrival refresh pixels without per-frame resampling');
        await mkdir('.browser-test-runtime', { recursive: true });
        await source.screenshot({ path: `.browser-test-runtime/svg-focus-${kind}-${visitor}-${width}.png` });
        await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click();
        await arrived(); await correctPixels();
        await select();
        await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).click();
        await page.waitForFunction(() => Number(document.querySelector('main.system-workflow').dataset.workbenchCameraScale) > .3
          && document.querySelector('[data-workbench-travelling]'));
        // Wheel input interrupts Focus; the intermediate geometry also needs fresh pixels.
        await board.dispatchEvent('wheel', { deltaY: 10, ctrlKey: true, clientX: 150, clientY: 300, bubbles: true, cancelable: true });
        await arrived(); await correctPixels();
        await zoom(1);
        await board.focus(); await page.keyboard.press('Escape');
        await source.focus();
        if (kind === 'image') await page.keyboard.press('Enter');
        else await source.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        await runtime.waitForFunction(() => [...document.querySelectorAll('image')].every(node => node.href.baseVal.startsWith('data:')));
        await page.waitForFunction(kind => {
          const target = kind === 'image' ? document.querySelector('.image-lift') : document.querySelector('[data-inspection-context="selected"]')?.parentElement;
          return target?.style.getPropertyValue('--inspection-lift-progress') === '1';
        }, kind);
        await page.keyboard.press('Escape');
        await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
        await settle(); await correctPixels();
        await zoom(2); await zoom(.25);
        assert.equal(await source.locator('iframe').evaluate((node, original) => node === original, iframe), true, 'camera never replaces the live SVG document');
        await zoom(1);
      }
      if (!visitor) assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('live group spreading, item focus and pointer pan retain SVG pixel density without remounting artwork', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(10000);
    await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 400, seamReview: 'single',
      artwork: { url: 'https://quality.invalid/keeper.svg', width: 2048, height: 2048, body: grey } });
    await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem(window.__motionKey));
      draft.workbenchGroups = [{ id: 'workbench-group:svg', name: 'SVG study', memberIds: ['image:motion-0', 'image:motion-1'], position: { left: 80, top: 240 } }];
      localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
    });
    const source = page.locator('.image-module__canvas').first();
    await source.locator('.artwork-svg-document').waitFor({ state: 'attached' });
    await source.locator('.artwork-svg-status').waitFor({ state: 'detached' });
    let iframe, runtime;
    const settled = () => page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
    const correctPixels = async () => {
      const density = await source.locator('foreignObject').evaluate(node => {
        const m = node.getScreenCTM(); return Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) * devicePixelRatio;
      });
      await runtime.waitForFunction(async density => {
        const node = document.querySelector('#body image'), image = new Image(); image.src = node.href.baseVal; await image.decode();
        const m = node.getScreenCTM(), size = node.width.baseVal.value;
        const pixels = size * Math.hypot(m.a, m.b) * density * 2;
        return Math.abs(image.naturalWidth - (pixels >= size * .75 ? size : Math.ceil(pixels))) <= 2;
      }, density);
      assert.equal(await source.locator('iframe').evaluate((node, original) => node === original, iframe), true);
    };
    const routes = page.getByRole('navigation', { name: 'Workbench destinations', exact: true });
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    for (let repeat = 0; repeat < 2; repeat++) {
      await routes.getByRole('button', { name: 'SVG study', exact: true }).click(); await settled();
      await source.locator('.artwork-svg-document').waitFor(); await source.locator('.artwork-svg-status').waitFor({ state: 'detached' });
      iframe = await source.locator('iframe').elementHandle(); runtime = (await iframe.contentFrame()).childFrames()[0];
      await correctPixels();
      await routes.getByRole('combobox', { name: 'Group item', exact: true }).selectOption('image:motion-0'); await settled(); await correctPixels();
      // Selecting the current named group returns to its overview, without
      // replaying an already-open image from the compact stack origin.
      await routes.getByRole('button', { name: 'SVG study', exact: true }).click(); await settled(); await correctPixels();
      const bench = page.locator('main.system-workflow').first();
      await bench.focus(); await page.keyboard.down('Space');
      await page.mouse.move(1000, 700); await page.mouse.down();
      await page.mouse.move(-1800, 700, { steps: 8 }); await page.waitForTimeout(100);
      assert.equal(await source.locator('iframe').evaluate((node, original) => node === original, iframe), true, 'crossing offscreen during a live gesture must not reload the artwork');
      await page.mouse.move(920, 660, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Space');
      await settled(); await correctPixels();
      await bench.dispatchEvent('wheel', { ctrlKey: true, deltaY: 120, clientX: 700, clientY: 450, bubbles: true, cancelable: true }); await correctPixels();
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settled();
      // The authored window is now below the viewport at this zoom. Its document
      // may unload normally between journeys; the next opening prepares it again.
      await source.locator('iframe').waitFor({ state: 'detached' });
    }
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
  } finally { await browser.close(); }
});
