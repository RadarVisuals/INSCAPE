import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closeTo = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1, `${message}: ${actual} vs ${expected}`);
const sameTextLayout = (actual, expected) => {
  assert.equal(actual[0], expected[0], 'logical text width unchanged');
  // Native font rasterization rounds line metrics at the target zoom level.
  assert.ok(Math.abs(actual[1] - expected[1]) <= 2, 'text overflow differs only by font rounding');
};

async function mount(page, visitor = false, fractional = false) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
  });
  await page.route(`${origin}/__view_scale__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__view_scale__`);
  await page.evaluate(async ({ visitor, fractional }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { createSystemWorkflowAuthoringSession } = await import('/src/systemWorkflow/systemWorkflowAuthoringSession.js');
    const { createDefaultWorkbenchPresentation, createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const { createArticle } = await import('/src/text/domain/article.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
    const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
    if (!store.getDraft().texts?.length) {
      const session = createSystemWorkflowAuthoringSession({ store });
      session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[6].id,
        destination: { column: 0, row: 0, columnSpan: 32, rowSpan: 18 } });
      session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id,
        destination: { column: 12, row: 4, columnSpan: 8, rowSpan: 8 } });
      const draft = structuredClone(store.getDraft());
      draft.appearance = { ...draft.appearance, guideMode: 'NONE', surfaceId: 'carbon', frame: false, edges: { corners: [0, 0, 0, 0], shadow: false, grain: 0 } };
      const article = createArticle('// ARRIVAL');
      article.content = { type: 'doc', content: Array.from({ length: 4 }, () => ({ type: 'paragraph', content: [{ type: 'text', text: 'I lift my head. A rope of spit pulls the dirt up with me before it snaps. There are no tracks leading to where I woke.' }] })) };
      article.appearance.background = '#101111';
      draft.texts = [{ id: 'text:zoom', visibility: 'PUBLIC', article }];
      draft.workbench = createDefaultWorkbenchPresentation();
      draft.workbench.display.window = { left: 340, top: 100, width: 800, height: 450 };
      draft.workbench.identity.open = false;
      draft.workbench.texts = [{ ...createTextPresentation('text:zoom'), window: { left: 100, top: 100, width: 240, height: 450 } }];
      if (fractional) {
        draft.workbench.texts[0].window = { left: 100.3, top: 100.7, width: 240.3, height: 450.3 };
        draft.workbench.display.window = { left: 340.6, top: 100.7, width: 800.4, height: 450.3 };
      }
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Fixture failed');
      localStorage.setItem(`inscape:workbench:preferences:${profileAddress}`, JSON.stringify({ gridMode: 'NONE', surfaceId: 'graphite', shortcutSnap: false, edgeSnap: true }));
    }
    window.readZoomDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
    await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    const root = createRoot(document.getElementById('root'));
    if (visitor) {
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
      const document = buildProfileDocumentV9({ assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, createdAt: 1, exportedAt: 2,
        profileAddress, profileIdentity: { name: 'Zoom review' }, revision: 1, systemWorkflowDraft: store.getDraft() });
      root.render(React.createElement(Visitor, { document }));
    } else {
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      root.render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage,
        reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Zoom review' } }));
    }
  }, { visitor, fractional });
  await page.locator('.text-window').waitFor();
  await page.locator('.system-workflow__presentation-board').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function zoomToHalf(page) {
  const board = page.locator('.system-workflow__presentation-board').first();
  const text = page.locator('.text-window').first();
  const beforeBoard = await board.boundingBox(), beforeText = await text.boundingBox();
  const joined = Math.abs(beforeText.x + beforeText.width - beforeBoard.x) < .02 && Math.abs(beforeText.y - beforeBoard.y) < .02;
  for (let i = 0; i < 5; i++) {
    await board.dispatchEvent('wheel', { deltaY: Math.log(2) / .003 / 5, ctrlKey: true, bubbles: true, cancelable: true });
    await settle(page);
    if (joined) {
      const b = await board.boundingBox(), t = await text.boundingBox();
      assert.ok(Math.abs(t.x + t.width - b.x) < .02, 'no subpixel gap between joined windows');
      assert.ok(Math.abs(t.y - b.y) < .02, 'joined top edges share the same pixel');
      if (i === 3) await page.screenshot({ path: '.browser-test-runtime/workbench-seam-67.png', clip: { x: Math.max(0, Math.floor(b.x) - 20), y: Math.floor(b.y), width: 80, height: Math.floor(Math.min(t.height, b.height)) } });
    }
  }
  assert.ok(Math.abs(Number(await board.getAttribute('data-workbench-scale')) - .5) < 1e-9);
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const text = document.querySelector('.text-window');
    const paragraph = text.querySelector('.text-document p');
    const range = document.createRange(); range.selectNodeContents(paragraph);
    return {
      board: rect(document.querySelector('.system-workflow__presentation-board')), text: rect(text),
      dock: rect(document.querySelector('.system-workflow__global-bar, .visitor-grid-world__dock')),
      shortcut: rect(document.querySelector('.system-workflow__desktop-shortcut')),
      lines: [...range.getClientRects()].map(rectangle => ({ x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height })),
      scroll: [text.querySelector('.text-module-scroll').clientWidth, text.querySelector('.text-module-scroll').scrollHeight],
    };
  });
}

test('fractional adjoining windows leave no painted seam while zooming and scrolling', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const deviceScaleFactor of [1, 1.25, 2]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor, reducedMotion: 'reduce' });
      await mount(page, visitor, true);
      if (!visitor) {
        await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
        await page.locator('main').first().focus();
      }
      // A contrasting Workbench exposes even a partially transparent raster gap.
      await page.addStyleTag({ content: 'main, .system-workflow__workbench { background: rgb(0,255,0) !important; background-image: none !important; }' });
      await page.mouse.move(1400, 900);
      const board = page.locator('.system-workflow__presentation-board');
      for (let step = 0; step < 8; step++) {
        if (step) await board.dispatchEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true });
        await page.locator('.text-module-scroll').evaluate((node, step) => { node.scrollTop = step; }, step);
        await settle(page);
        const b = await board.boundingBox(), t = await page.locator('.text-window').boundingBox();
        const clip = { x: Math.floor(b.x) - 3, y: Math.floor(Math.min(b.y, t.y)) - 3, width: 6,
          height: Math.floor(Math.min(b.height, t.height)) };
        const png = await page.screenshot({ path: '.browser-test-runtime/seam-pixel-probe.png' });
        const result = await page.evaluate(async ({ png, density, clip }) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = Math.floor(clip.width * density); canvas.height = Math.floor(clip.height * density);
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, -Math.round(clip.x * density), -Math.round(clip.y * density));
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let exposed = 0, background = false;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const green = pixels[i + 1] > pixels[i] + 35 && pixels[i + 1] > pixels[i + 2] + 35;
            if (y < density && green) background = true;
            if (y > 5 * density && y < canvas.height - 3 * density && green) exposed++;
          }
          return { exposed, background };
        }, { png: png.toString('base64'), density: deviceScaleFactor, clip });
        assert.ok(result.background, 'pixel probe sees the contrasting Workbench above the modules');
        assert.equal(result.exposed, 0, `no painted gap for ${visitor ? 'Visitor' : 'Owner'} at density ${deviceScaleFactor}, zoom step ${step}`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
});

for (const visitor of [false, true]) test(`${visitor ? 'Visitor' : 'Owner'} scales composition and text without reflow or saved changes`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await mount(page, visitor);
    if (!visitor) {
      await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
      const tools = page.locator('.text-tools-window'); const before = await tools.boundingBox();
      await zoomToHalf(page);
      assert.deepEqual(await tools.boundingBox(), before, 'Text tools retain their size and position');
      await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).click();
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    }
    for (const [name, viewport] of [['wide', { width: 1440, height: 1000 }], ['narrow', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(350);
      const before = await measure(page);
      const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      await page.screenshot({ path: `.browser-test-runtime/workbench-scale-${visitor ? 'visitor' : 'owner'}-${name}-100.png` });
      await zoomToHalf(page);
      const after = await measure(page);
      for (const item of ['board', 'text']) for (const key of ['x', 'y', 'width', 'height']) closeTo(after[item][key], before[item][key] / 2, `${item} ${key}`);
      assert.deepEqual(after.dock, before.dock, 'dock unchanged');
      assert.deepEqual(after.shortcut, before.shortcut, 'shortcut unchanged');
      sameTextLayout(after.scroll, before.scroll);
      assert.equal(after.lines.length, before.lines.length, 'same line breaks');
      for (let i = 0; i < after.lines.length; i++) for (const key of ['x', 'y', 'width', 'height']) closeTo(after.lines[i][key], before.lines[i][key] / 2, `text glyph line ${key}`);
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), storage, 'zoom writes no content or local layout');
      await page.screenshot({ path: `.browser-test-runtime/workbench-scale-${visitor ? 'visitor' : 'owner'}-${name}-50.png` });
      const host = page.locator('main').first(); await host.focus(); await page.keyboard.press('Control+0'); await settle(page);
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      assert.deepEqual(await measure(page), before, 'reset restores exact composition');
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.waitForTimeout(300);
    const board = page.locator('.system-workflow__presentation-board');
    const original = await measure(page);
    const groupRight = Math.max(original.board.x + original.board.width, original.text.x + original.text.width);
    const groupBottom = Math.max(original.board.y + original.board.height, original.text.y + original.text.height);
    await page.mouse.move(groupRight + 20, groupBottom + 20); await page.mouse.down();
    await page.mouse.move(Math.max(1, Math.min(original.board.x, original.text.x) - 20), Math.max(1, Math.min(original.board.y, original.text.y) - 20), { steps: 5 });
    await page.mouse.up(); await settle(page);
    const selection = page.getByRole('group', { name: '2 selected Workbench modules', exact: true }); await selection.waitFor();
    const group = await selection.boundingBox();
    const handle = page.getByRole('button', { name: 'Scale selected modules from se', exact: true });
    const corner = await handle.boundingBox();
    await page.mouse.move(corner.x + 14, corner.y + 14); await page.mouse.down();
    await page.mouse.move(corner.x + 14 - group.width * .4, corner.y + 14 - group.height * .4, { steps: 5 });
    await page.mouse.up(); await settle(page);
    const smaller = await measure(page);
    closeTo(smaller.board.width, original.board.width * .6, 'marquee Display width');
    closeTo(smaller.text.width, original.text.width * .6, 'marquee Text width');
    closeTo(smaller.board.x - smaller.text.x, (original.board.x - original.text.x) * .6, 'marquee relative spacing');
    sameTextLayout(smaller.scroll, original.scroll);
    await page.screenshot({ path: `.browser-test-runtime/workbench-marquee-${visitor ? 'visitor' : 'owner'}.png` });
    // Escape rolls back an unfinished resize; a completed gesture remains.
    const nextCorner = await handle.boundingBox();
    await page.mouse.move(nextCorner.x + 14, nextCorner.y + 14); await page.mouse.down(); await page.mouse.move(nextCorner.x - 30, nextCorner.y - 20);
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await measure(page), smaller, 'Escape cancels group resize');
    const savedBeforeMove = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    // Drag through artwork, text and both title bars: the selection owns the
    // gesture, so neither authored content nor individual window layout changes.
    for (const [module, fraction] of [['board', .5], ['text', .5], ['board', .02], ['text', .02]]) {
      const beforeMove = await measure(page), rectangle = beforeMove[module];
      const x = rectangle.x + rectangle.width / 2, y = rectangle.y + rectangle.height * fraction;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 24, y + 16, { steps: 4 }); await page.mouse.up(); await settle(page);
      const moved = await measure(page);
      for (const item of ['board', 'text']) {
        closeTo(moved[item].x - beforeMove[item].x, 24, `${module} drag moves ${item} x`);
        closeTo(moved[item].y - beforeMove[item].y, 16, `${module} drag moves ${item} y`);
        closeTo(moved[item].width, beforeMove[item].width, 'moving retains width');
      }
      assert.equal(moved.lines.length, beforeMove.lines.length, 'moving retains text wrapping');
    }
    assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), savedBeforeMove, 'group movement does not edit assets or saved module geometry');
    await selection.focus(); const beforeNudge = await measure(page); await page.keyboard.press('Shift+ArrowRight');
    closeTo((await measure(page)).board.x - beforeNudge.board.x, 10, 'keyboard moves group in screen pixels');
    const beforeCancel = await measure(page);
    for (const [dx, dy] of [[2000, 1500], [-2000, -1500]]) {
      await page.mouse.move(beforeCancel.board.x + 50, beforeCancel.board.y + 50); await page.mouse.down();
      await page.mouse.move(beforeCancel.board.x + 50 + dx, beforeCancel.board.y + 50 + dy); await settle(page);
      const edge = await selection.boundingBox();
      assert.ok(edge.x >= 7 && edge.y >= 7 && edge.x + edge.width <= 7993 && edge.y + edge.height <= 7993, 'entire group stays inside the Workbench area');
      const edgeModules = await measure(page);
      closeTo(edgeModules.board.x - edgeModules.text.x, beforeCancel.board.x - beforeCancel.text.x, 'boundary retains composition');
      await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    }
    await page.mouse.move(beforeCancel.board.x + 50, beforeCancel.board.y + 50); await page.mouse.down();
    await page.mouse.move(beforeCancel.board.x + 90, beforeCancel.board.y + 80); await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await measure(page), beforeCancel, 'Escape restores group movement');
    await page.screenshot({ path: `.browser-test-runtime/workbench-group-move-${visitor ? 'visitor' : 'owner'}.png` });
    // The narrow-viewport pass can leave the two headers overlapping. Focus
    // identifies the intended module without relying on which header paints last.
    await page.getByLabel('Move Text window', { exact: true }).focus(); await page.keyboard.press('Shift+Enter');
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    await page.getByLabel('Move Text window', { exact: true }).focus(); await page.keyboard.press('Shift+Enter');
    await selection.waitFor();
    await page.mouse.click(1400, 900); await selection.waitFor({ state: 'detached' });
    await page.locator('main').first().focus(); await page.keyboard.press('Control+0'); await page.keyboard.press('Escape'); await settle(page);
    await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
    // Selecting Text does not change the scope of camera zoom.
    await page.getByLabel('Move Text window', { exact: true }).focus(); await page.keyboard.press('Shift+Enter');
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    const untouched = await board.boundingBox();
    await page.locator('.text-window').dispatchEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true }); await settle(page);
    closeTo((await board.boundingBox()).width, untouched.width * Math.exp(-.3), 'wheel zoom includes unselected modules');
    await page.locator('main').first().focus(); await page.keyboard.press('Control+0'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
    await zoomToHalf(page);
    for (const name of ['Move Text window', 'Move Display Module: DISPLAY MODULE']) {
      await page.getByLabel(name, { exact: true }).focus(); await page.keyboard.press('Shift+Enter');
    }
    const halfStart = await measure(page);
    await page.mouse.move(halfStart.board.x + 40, halfStart.board.y + 40); await page.mouse.down();
    await page.mouse.move(halfStart.board.x + 60, halfStart.board.y + 50); await page.mouse.up(); await settle(page);
    for (const item of ['board', 'text']) closeTo((await measure(page))[item].x - halfStart[item].x, 20, 'group drag at 50% follows pointer');
    await page.keyboard.press('Escape');
    // Deselecting a shrunk group must not restore the old unscaled drag limits.
    for (const name of ['Move Text window', 'Move Display Module: DISPLAY MODULE']) {
      const moveHeader = page.getByLabel(name, { exact: true }), headerBox = await moveHeader.boundingBox();
      const module = name === 'Move Text window' ? 'text' : 'board', beforeFreeMove = await measure(page);
      await moveHeader.focus();
      await page.keyboard.down('Alt'); await page.mouse.move(headerBox.x + 35, headerBox.y + headerBox.height / 2); await page.mouse.down();
      await page.mouse.move(headerBox.x + 635, headerBox.y + headerBox.height / 2, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
      closeTo((await measure(page))[module].x - beforeFreeMove[module].x, 600, `resized ${module} uses available screen space`);
    }
    const text = page.locator('.text-window'), header = page.getByLabel('Move Text window', { exact: true });
    const start = await text.boundingBox(), h = await header.boundingBox();
    await page.keyboard.down('Alt'); await page.mouse.move(h.x + 5, h.y + h.height / 2); await page.mouse.down();
    await page.mouse.move(h.x + 25, h.y + h.height / 2 + 20, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const moved = await text.boundingBox(); closeTo(moved.x - start.x, 20, 'drag follows pointer x'); closeTo(moved.y - start.y, 20, 'drag follows pointer y');
    if (!visitor) {
      // At 50%, move Text to the Display's visible right edge. Edge snapping
      // operates on screen rectangles, then returns logical window coordinates.
      const b = await page.locator('.system-workflow__presentation-board').boundingBox();
      const current = await text.boundingBox(), handle = await header.boundingBox();
      const dx = b.x + b.width - current.x + 3, dy = b.y - current.y;
      await page.mouse.move(handle.x + 5, handle.y + handle.height / 2); await page.mouse.down();
      await page.mouse.move(handle.x + 5 + dx, handle.y + handle.height / 2 + dy, { steps: 5 }); await page.mouse.up();
      closeTo((await text.boundingBox()).x, b.x + b.width, 'scaled edge snapping');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
