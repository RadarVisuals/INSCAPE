import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
import { resetCameraTestView } from './fixtures/workbench-camera-test.mjs';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
// Window chrome may cover part of a large selection; start on an exposed surface.
const dragPoint = target => target.evaluate(node => {
  const box = node.getBoundingClientRect();
  for (let y = Math.max(12, box.top + 15); y < Math.min(innerHeight - 12, box.bottom - 12); y += 24)
    for (let x = Math.max(12, box.left + 15); x < Math.min(innerWidth - 12, box.right - 12); x += 24)
      if (node.contains(document.elementFromPoint(x, y))) return { x, y };
  throw Error('No exposed drag surface');
});
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function mount(page, visitor = false) {
  await page.evaluate(async visitor => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { createDefaultWorkbenchPresentation, createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const { createArticle } = await import('/src/text/domain/article.js');
    const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, key = systemWorkflowDraftKey(profileAddress);
    const layoutKey = `inscape:workbench:layout:v1:${profileAddress}`;
    const storage = { getItem: name => localStorage.getItem(name), setItem: (name, value) => {
      if (window.failLayout && name === layoutKey) throw Error('Layout storage full');
      localStorage.setItem(name, value);
    } };
    const assets = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset,
      imageUrl: 'https://reload.test/art.jpg', originalImageUrl: 'https://reload.test/art.jpg', thumbnailUrl: 'https://reload.test/art.jpg',
      src: 'https://reload.test/art.jpg', previewSrc: 'https://reload.test/art.jpg', imageWidth:1920, imageHeight:1080,
    }));
    const store = createSystemWorkflowDraftStore({ profileAddress, storage });
    if (store.getRecordState().status === 'absent') {
      const draft = store.getDraft(), asset = buildProfileDocumentV9Asset(assets[0], assets[0].id);
      draft.workbench = createDefaultWorkbenchPresentation();
      draft.workbench.display.window = { left:400, top:100, width:640, height:360 };
      draft.workbench.identity.open = false;
      draft.imageModules = ['one','two','three'].map((id, index) => ({ id:`image:${id}`, name:`Image ${index + 1}`,
        width:240, height:135, visibility:'PUBLIC', sides:[{ id:`side:${id}`, asset, crop:{ x:.5,y:.5,zoom:1 }, transform:{ quarterTurns:0,mirrorX:false,mirrorY:false } }],
      }));
      draft.workbench.imageModules = draft.imageModules.map((image,index) => ({ id:image.id, open:true, position:{ left:80+index*300, top:700 } }));
      draft.texts = [{ id:'text:one', visibility:'PUBLIC', article:createArticle() }];
      draft.workbench.texts = [{ ...createTextPresentation('text:one'), window:{ left:1080, top:100, width:280, height:300 } }];
      store.commitCompletedOperation(draft, { expectedGeneration:store.getGeneration() });
    }
    window.readDraft = () => JSON.parse(storage.getItem(key));
    window.readLayout = () => JSON.parse(storage.getItem(layoutKey));
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default : Runtime;
    const props = visitor ? { document:(await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({
      profileAddress, systemWorkflowDraft:store.getDraft(), assetRecords:assets,
    }) } : {
      profileAddress, reviewStorage:storage, reviewAssets:assets, reviewCategories:[], reviewActivity:[], reviewProfile:{ name:'Layout reload' },
    };
    createRoot(document.getElementById('root')).render(React.createElement(Component, props));
  }, visitor);
  await page.locator('[data-workbench-view-id="image:three"]').waitFor();
  await page.locator('.text-window').waitFor(); await settle(page);
  await page.evaluate(() => document.fonts.ready); await settle(page);
  await resetCameraTestView(page, visitor);
}

test('owner module placement survives real reload after individual, zoomed and group moves', { timeout:120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive:true });
  const browser = await chromium.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1600, height:1200 }, reducedMotion:'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://reload.test/art.jpg', route => route.fulfill({ contentType:'image/jpeg', path:'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.route(`${origin}/__layout_reload__`, route => route.fulfill({ contentType:'text/html', body:'<div id="root"></div>' }));
    await page.goto(`${origin}/__layout_reload__`); await mount(page);
    const image = index => page.locator('.image-module__window').nth(index);
    const geometry = () => page.locator('[data-workbench-view-id]').evaluateAll(nodes => Object.fromEntries(nodes
      .filter(node => node.matches('.image-module__window,.text-window,.system-workflow__presentation-board'))
      .map(node => [node.dataset.workbenchViewId, node.getBoundingClientRect().toJSON()])));
    const drag = async (target, dx, dy) => {
      await target.focus(); const start = await dragPoint(target);
      await page.keyboard.down('Alt'); await page.mouse.move(start.x,start.y); await page.mouse.down();
      await page.mouse.move(start.x+dx,start.y+dy,{ steps:6 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
    };
    const reload = async () => { await page.reload(); await mount(page); };
    await drag(image(0), 51, -70);
    await drag(image(1), 78, 64);
    const single = await geometry();
    await reload(); assert.deepEqual(await geometry(), single, 'individually moved modules restore their arrangement');
    await image(0).focus(); await page.keyboard.press('Shift+Enter');
    await image(1).focus();
    assert.equal(await page.getByRole('group', { name:'1 selected Workbench modules', exact:true }).count(), 1,
      'visiting the next candidate preserves the explicit selection');
    await page.keyboard.press('Shift+Enter');
    const selection = page.getByRole('group', { name:'2 selected Workbench modules', exact:true });
    await selection.waitFor();
    await image(1).focus(); await page.keyboard.press('Shift+Enter');
    assert.equal(await page.getByRole('group', { name:'1 selected Workbench modules', exact:true }).count(), 1,
      'Shift+Enter removes an existing member');
    await page.keyboard.press('Shift+Enter'); await selection.waitFor();
    await drag(selection, -40, -130);
    const group = await geometry();
    assert.notDeepEqual(group, single);
    await page.screenshot({ path:'.browser-test-runtime/layout-before-reload.png' });
    await reload();
    await page.screenshot({ path:'.browser-test-runtime/layout-after-reload.png' });
    assert.deepEqual(await geometry(), group, 'group movement restores the visible positions, including relative spacing');
    const draftBeforeMove = await page.evaluate(() => readDraft());
    await setWorkbenchZoom(page, .67);
    await drag(image(2), 97, -143);
    await image(2).focus(); await page.keyboard.press('Alt+ArrowRight'); await settle(page);
    await resetCameraTestView(page, false);
    const zoomed = await geometry();
    await reload(); assert.deepEqual(await geometry(), zoomed, 'moving a zoomed individual uses the same saved position path');
    assert.deepEqual(await page.evaluate(() => readDraft()), draftBeforeMove, 'local arrangement never changes module content');
    const selectMixed = async () => {
      for (const target of [page.locator('.system-workflow__presentation-board header[data-workbench-selectable]'),
        page.locator('.text-window header[data-workbench-selectable]'), image(0)]) {
        await target.focus(); await page.keyboard.press('Shift+Enter');
      }
      return page.getByRole('group', { name:'3 selected Workbench modules', exact:true });
    };
    const mixed = await selectMixed(); await mixed.focus();
    await page.keyboard.press('Alt+Shift+ArrowRight'); await page.keyboard.press('Alt+ArrowDown'); await settle(page);
    const keyboard = await geometry();
    for (const id of ['display:primary','text:one','image:one']) {
      assert.equal(keyboard[id].x, zoomed[id].x + 10);
      assert.equal(keyboard[id].y, zoomed[id].y + 1);
    }
    await page.waitForFunction(() => readLayout()?.layout.display.window.left === 410);
    const savedBeforeCancel = await page.evaluate(() => readLayout());
    const handle = await dragPoint(mixed);
    await page.mouse.move(handle.x,handle.y); await page.mouse.down();
    await page.mouse.move(handle.x+57,handle.y+51,{ steps:6 }); await settle(page);
    assert.notDeepEqual(await geometry(), keyboard, 'mixed selection moves during preview');
    await page.waitForTimeout(180);
    assert.deepEqual(await page.evaluate(() => readLayout()), savedBeforeCancel, 'an unfinished group move is not saved');
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await geometry(), keyboard, 'Escape restores the entire mixed selection');
    await drag(mixed, 32, 46);
    await page.keyboard.press('Escape'); await settle(page);
    const movedBeforeResize = await geometry();
    await image(0).getByRole('separator', { name:'Resize Image right', exact:true }).focus();
    await page.keyboard.press('Alt+Shift+ArrowRight'); await settle(page);
    const resized = await geometry();
    assert.equal(resized['image:one'].width, movedBeforeResize['image:one'].width + 10);
    for (const id of ['display:primary','text:one','image:two','image:three']) assert.deepEqual(resized[id], movedBeforeResize[id]);
    await reload(); assert.deepEqual(await geometry(), resized, 'resizing one Image retains every recently moved module after reload');
    await page.waitForFunction(() => readLayout()?.layout.display.window.left === 442);
    const savedBeforeFailure = await page.evaluate(() => readLayout());
    await selectMixed(); await page.evaluate(() => { window.failLayout = true; });
    await drag(mixed, 17, 21);
    await page.getByRole('button', { name:'Save current layout', exact:true }).waitFor();
    assert.deepEqual(await page.evaluate(() => readLayout()), savedBeforeFailure, 'failed saving retains the previous stored arrangement');
    const unsaved = await geometry();
    await page.evaluate(() => { window.failLayout = false; });
    await page.getByRole('button', { name:'Save current layout', exact:true }).click();
    await reload(); assert.deepEqual(await geometry(), unsaved, 'retry saves the visible mixed-module arrangement');
    await page.setViewportSize({ width:390, height:844 }); await settle(page);
    await resetCameraTestView(page, false);
    const narrow = await geometry(); await reload();
    const narrowRestored = await geometry();
    for (const id of Object.keys(narrow)) {
      assert.equal(narrowRestored[id].x, narrow[id].x, 'narrow reload never pulls a saved position back onto the screen');
      assert.equal(narrowRestored[id].y, narrow[id].y);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Visitor group movement remains temporary and reload restores the published start', { timeout:30000 }, async () => {
  const browser = await chromium.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1600, height:1200 }, reducedMotion:'reduce' });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://reload.test/art.jpg', route => route.fulfill({ contentType:'image/jpeg', path:'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.route(`${origin}/__layout_reload__`, route => route.fulfill({ contentType:'text/html', body:'<div id="root"></div>' }));
    await page.goto(`${origin}/__layout_reload__`); await mount(page, true);
    const geometry = () => page.locator('.image-module__window').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    const before = await geometry(), stored = await page.evaluate(() => ({ ...localStorage }));
    for (const index of [0,1]) { await page.locator('.image-module__window').nth(index).focus(); await page.keyboard.press('Shift+Enter'); }
    const selection = page.getByRole('group', { name:'2 selected Workbench modules', exact:true });
    await selection.focus(); await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('ArrowDown'); await settle(page);
    assert.notDeepEqual(await geometry(), before);
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), stored, 'Visitor never writes the maker layout');
    await page.reload(); await mount(page, true);
    assert.deepEqual(await geometry(), before, 'Visitor reload restores the published positions');
  } finally { await browser.close(); }
});

test('Display fitting follows the current viewport within one layout mode without resizing its saved window', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 640, height: 900 }, reducedMotion: 'reduce' });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://reload.test/art.jpg', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.route(`${origin}/__layout_reload__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__layout_reload__`); await mount(page);
    const measurements = [];
    const measure = async width => {
      await page.setViewportSize({ width, height: 900 }); await settle(page);
      const value = await page.evaluate(async () => {
        const geometry = await import('/src/public/ownerSystemWorkflow/presentationBoardGeometry.js');
        const board = document.querySelector('[data-display-instance="display:primary"] .system-workflow__presentation-board');
        const host = board.closest('[data-presentation-workbench]');
        const viewport = { width: host.clientWidth, height: host.clientHeight };
        const inset = geometry.presentationBoardResponsiveMetrics(viewport.width).inset;
        const documentGeometry = readDraft().geometry;
        const expected = geometry.fitPresentationBoard(viewport, { inset, identityStripHeight: 0, sidecarWidth: 0,
          aspectRatio: documentGeometry.columns / documentGeometry.rows });
        const windowWidth = parseFloat(board.style.width) / Number(board.dataset.workbenchScale);
        return { viewport, inset, windowWidth, actualFitWidth: windowWidth / Number(board.dataset.boardScale), expectedFitWidth: expected.stage.width };
      });
      measurements.push(value);
      await writeFile(`${output}/display-responsive-fit.json`, JSON.stringify(measurements, null, 2));
      assert.ok(Math.abs(value.actualFitWidth - value.expectedFitWidth) < .01,
        `at ${width}px the current viewport must determine fitting: ${value.actualFitWidth} vs ${value.expectedFitWidth}`);
      return value;
    };
    const initial = await measure(640);
    const sameMode = await measure(720);
    assert.ok(Math.abs(sameMode.windowWidth - initial.windowWidth) < .01, 'more space is not a request to resize the existing window');
    const nextMode = await measure(800);
    assert.ok(Math.abs(nextMode.windowWidth - initial.windowWidth) < .01);
    await page.screenshot({ path: `${output}/display-responsive-fit-800.png` });
    await measure(600);
    await page.screenshot({ path: `${output}/display-responsive-fit-600.png` });
  } finally { await browser.close(); }
});
