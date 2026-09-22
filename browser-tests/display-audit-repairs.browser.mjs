import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5194';
const output = 'output/display-repairs-2026-09-21';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
async function setup(browser, width = 1440, dpr = 1) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  await page.route(`${origin}/__repairs__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__repairs__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => t => t;
    window.__vite_plugin_react_preamble_installed__ = true;
    window.React = (await import('/@id/react')).default;
    window.createRoot = (await import('/@id/react-dom/client')).default.createRoot;
  });
  return { page, errors };
}
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Display text editing preserves placement and ordinary placement keyboard editing remains available', { timeout: 90000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [1440, 390]) {
      const { page, errors } = await setup(browser, width);
      await page.evaluate(async () => {
        const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
        const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
        window.readDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
        await import('/src/index.css'); await import('/src/inscapeTokens.css');
        await import('/src/lattice/rendering/latticeMenuSurface.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
        createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage,
          reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Repair review' } }));
      });
      await page.getByRole('button', { name: 'Tools', exact: true }).click();
      await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
      const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
      if (await unlock.count()) await unlock.click();
      await page.getByRole('button', { name: 'Add text', exact: true }).click();
      const editor = page.getByRole('textbox', { name: 'Article text' });
      await editor.fill('ARRIVAL');
      const placements = () => page.evaluate(() => readDraft().grids.flatMap(g => g.placements).filter(p => p.kind === 'text'));
      const before = await placements();
      await editor.press('End'); await editor.press('ArrowLeft'); await editor.press('Backspace');
      const after = await placements();
      assert.equal(after.length, 1); assert.equal(after[0].column, before[0].column); assert.equal(after[0].row, before[0].row);
      assert.notDeepEqual(after[0].text, before[0].text);
      assert.equal(await page.getByRole('button', { name: /Frame and/ }).count(), 0);
      await page.screenshot({ path: `${output}/text-${width}.png` });
      // The placement itself remains an eligible keyboard target.
      const layer = page.locator('[data-system-workflow-placement-id]').first();
      await layer.focus(); await page.keyboard.press('ArrowRight');
      const moved = await placements(); assert.ok(moved[0].column > after[0].column);
      await page.keyboard.press('Delete'); assert.equal((await placements()).length, 0);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('cancelled crop drag cannot mutate a replacement session and stale crop never commits', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const { page, errors } = await setup(browser);
    await page.evaluate(async () => {
      const useCrop = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowCrop.js')).default;
      const placement = id => ({ id, stableAssetId: id, column: 0, row: 0, columnSpan: 8, rowSpan: 8, crop: null,
        transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } });
      const a = placement('a'), b = placement('b'), assetsById = new Map(['a', 'b'].map(id => [id, { id, width: 100, height: 100 }]));
      window.audit = { a, b, requests: [] };
      function App() {
        const [grid, setGrid] = React.useState({ id: 'grid-a', placements: [a, b] });
        audit.setGrid = setGrid;
        audit.crop = useCrop({ assetsById, controller: { moduleId: 'display:a', selectedGrid: grid, generation: 0,
          run: fn => fn({ cropPlacement: request => { audit.requests.push(request); return true; } }), replaceSelection() {} } });
        return React.createElement('div', { 'data-system-workflow-crop-surface': true });
      }
      createRoot(document.getElementById('root')).render(React.createElement(App));
    });
    await settle(page);
    await page.evaluate(() => audit.crop.beginCrop(audit.a)); await settle(page);
    await page.evaluate(() => audit.crop.updateCropZoom(2)); await settle(page);
    await page.evaluate(() => audit.crop.beginCropDrag({ button: 0, pointerId: 1, clientX: 40, clientY: 40, preventDefault() {}, stopPropagation() {} }, 'a', 10));
    await page.evaluate(() => { audit.crop.cancelCrop(); audit.crop.beginCrop(audit.b); }); await settle(page);
    const before = await page.evaluate(() => audit.crop.cropSession);
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 75, clientY: 40 }))); await settle(page);
    assert.deepEqual(await page.evaluate(() => audit.crop.cropSession), before);
    await page.evaluate(() => { audit.crop.cancelCrop(); audit.crop.beginCrop(audit.a); }); await settle(page);
    await page.evaluate(() => audit.crop.updateCropZoom(2)); await settle(page);
    await page.evaluate(() => audit.setGrid({ id: 'grid-a', placements: [{ ...audit.a, crop: { x: .5, y: .5, zoom: 3 } }, audit.b] })); await settle(page);
    assert.equal(await page.evaluate(() => audit.crop.cropSession), null);
    await page.evaluate(() => audit.crop.applyCrop());
    assert.deepEqual(await page.evaluate(() => audit.requests), []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('owner and Visitor clip adjacent media identically and canonical alpha replaces the thumbnail', { timeout: 90000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const [width, dpr] of [[800, 1], [390, 1.25], [800, 2]]) {
      const { page, errors } = await setup(browser, width, dpr);
      await page.route('https://repair.invalid/**', async route => {
        const name = new URL(route.request().url()).pathname;
        if (name.includes('fail')) return route.abort();
        if (name.includes('alpha')) await new Promise(resolve => setTimeout(resolve, 100));
        const shape = name.includes('alpha') ? '<circle cx="100" cy="100" r="40" fill="lime"/>'
          : `<rect width="200" height="200" fill="${name.includes('red') ? 'red' : 'lime'}"/>`;
        return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">${shape}</svg>` });
      });
      await page.evaluate(async () => {
        const Owner = (await import('/src/public/ownerSystemWorkflow/DisplayPlacementContent.jsx')).default;
        const Visitor = (await import('/src/profileDocument/components/GridProductionRenderer.jsx')).default;
        const { DisplayStageSizeContext } = await import('/src/public/ownerSystemWorkflow/DisplayStageSizeContext.js');
        const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
        const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
        await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
        const h = React.createElement;
        const low = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="red"/></svg>');
        const assets = ['red', 'green', 'alpha'].map((name, index) => ({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[index],
          imageUrl: `https://repair.invalid/${name}.svg`, originalImageUrl: `https://repair.invalid/${name}.svg`,
          src: `https://repair.invalid/${name}.svg`, previewSrc: undefined, thumbnailUrl: name === 'alpha' ? low : `https://repair.invalid/${name}.svg`,
          width: 200, height: 200, imageWidth: 200, imageHeight: 200 }));
        const placements = assets.map((asset, index) => ({ id: `p${index}`, stableAssetId: asset.id, column: index * 10, row: 0,
          columnSpan: 10, rowSpan: 10, layer: index, navigationOrder: index, crop: null,
          transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }));
        const grid = { id: 'grid:pixel', title: 'Pixels', placements: placements.map((placement, index) => ({ ...placement, asset: buildProfileDocumentV9Asset(assets[index], assets[index].id) })) };
        const document = { artboard: { aspectWidth: 16, aspectHeight: 9 }, geometry: { columns: 32, rows: 18 }, appearance: { guideMode: 'NONE', guideSize: 0, guideColor: '#000000' } };
        const root = createRoot(window.document.getElementById('root'));
        const render = () => root.render(h('main', null,
          h('div', { id: 'owner', style: { position: 'absolute', left: 20, top: 20, width: 320, height: 180, background: 'blue' } },
            ...placements.map((placement, index) => h('div', { key: placement.id, className: 'system-workflow__placement', style: { left: index * 100, top: 0, width: 100, height: 100 } },
              h(Owner, { placement, asset: assets[index], width: 100, height: 100, cellSize: 10 })))),
          h('div', { id: 'visitor', style: { position: 'absolute', left: 20, top: 220, width: 320, height: 180, background: 'blue' } },
            h(DisplayStageSizeContext.Provider, { value: { width: 320, height: 180 } }, h(Visitor, { document, grid, imageLoading: 'eager' })))));
        window.pixelReview = { assets, render }; render();
      });
      await page.waitForFunction(() => document.querySelectorAll('#visitor img.is-ready').length === 3
        && document.querySelector('#owner [data-high-ready]') && document.querySelectorAll('#owner img').length === 3);
      // Match the two test canvases; Visitor normally supplies its Grid surface.
      await page.locator('#visitor .lattice-production-table').evaluate(node => node.style.backgroundColor = 'blue');
      const png = await page.screenshot({ path: `${output}/pixels-${width}-${dpr}.png` });
      const pixels = await page.evaluate(async base64 => {
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const pixel = (x, y) => [...context.getImageData(Math.floor(x * devicePixelRatio), Math.floor(y * devicePixelRatio), 1, 1).data];
        return { ownerEdge: pixel(119, 50), visitorEdge: pixel(119, 250), ownerAlpha: pixel(230, 30), visitorAlpha: pixel(230, 230) };
      }, png.toString('base64'));
      assert.deepEqual(pixels.ownerEdge, pixels.visitorEdge); assert.deepEqual(pixels.ownerEdge, [255, 0, 0, 255]);
      assert.deepEqual(pixels.ownerAlpha, [0, 0, 255, 255]); assert.deepEqual(pixels.ownerAlpha, pixels.visitorAlpha);
      // A changed source and failed high-resolution image must restore a visible fallback.
      await page.evaluate(() => {
        const asset = pixelReview.assets[2]; pixelReview.assets[2] = { ...asset, imageUrl: 'https://repair.invalid/fail.svg',
          originalImageUrl: 'https://repair.invalid/fail.svg', src: 'https://repair.invalid/fail.svg' }; pixelReview.render();
      });
      await page.waitForFunction(() => {
        const media = document.querySelector('#owner .system-workflow__progressive-media');
        return media && !media.hasAttribute('data-high-ready') && media.querySelectorAll('img').length === 1
          && getComputedStyle(media.querySelector('img')).opacity === '1';
      });
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('reduced motion advances exactly once on release in owner and Visitor', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 4 });
      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
      await stage.waitFor(); await settle(page);
      const box = await stage.boundingBox();
      const state = () => page.evaluate(() => {
        const track = document.querySelector('.system-workflow__grid-track,.visitor-grid-world__grid-track');
        return { x: new DOMMatrix(getComputedStyle(track).transform).m41,
          id: track.querySelector('[class*=grid-plane--current]')?.dataset.renderedGridId };
      });
      const before = await state();
      if (!visitor) await page.keyboard.down('Space');
      await stage.dispatchEvent('pointerdown', { button: 0, pointerId: 77, clientX: box.x + box.width * .7, clientY: box.y + box.height * .5 });
      await page.evaluate(({ x, y }) => dispatchEvent(new PointerEvent('pointermove', { pointerId: 77, clientX: x, clientY: y, bubbles: true })),
        { x: box.x - box.width * 1.7, y: box.y + box.height * .5 });
      await settle(page); assert.deepEqual(await state(), before);
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { pointerId: 77, bubbles: true })));
      if (!visitor) await page.keyboard.up('Space');
      await settle(page);
      const after = await state(); assert.equal(after.x, 0); assert.notEqual(after.id, before.id);
      const oldIndex = Number(before.id.split('-').at(-1)); assert.equal(after.id, `grid:motion-${(oldIndex + 1) % 4}`);
      assert.equal(await page.evaluate(() => localStorage.getItem(__motionKey) === __motionSaved), true);
      await page.close();
    }
  } finally { await browser.close(); }
});
