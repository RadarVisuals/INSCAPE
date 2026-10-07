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
const closePage = async page => { await page.unrouteAll({ behavior: 'wait' }); await page.close(); };
const closeBrowser = async browser => {
  for (const context of browser.contexts()) for (const page of context.pages()) await page.unrouteAll({ behavior: 'wait' });
  await browser.close();
};

async function mount(page, visitor = false, fractional = false) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
  });
  if (fractional) {
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 4636; canvas.height = 2000;
      const context = canvas.getContext('2d'); context.fillStyle = '#2763c5'; context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.route('**/assets/stage/backdrops/backdrop_moonpurple.webp', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
  }
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
      draft.workbench.display.window = { left: 460, top: 100, width: 800, height: 450 };
      draft.workbench.identity.open = false;
      // Keep the authored resize scenario above Text's minimum width even
      // after shrinking to 60%; limit clamping is covered independently.
      draft.workbench.texts = [{ ...createTextPresentation('text:zoom'), window: { left: 100, top: 100, width: 360, height: 450 } }];
      if (fractional) {
        draft.grids[0].placements[0].crop = { x: .5, y: .5, zoom: 1 };
        draft.workbench.texts[0].window = { left: 100.3, top: 100.7, width: 360.3, height: 450.3 };
        draft.workbench.display.window = { left: 460.6, top: 100.7, width: 800.4, height: 450.3 };
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
  const cameraScale = await page.locator('main').first().getAttribute('data-workbench-camera-scale');
  assert.ok(Math.abs(Number(cameraScale) - .5) < 1e-9, 'the Workbench camera reaches 50%, independently of module resizing');
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const text = document.querySelector('.text-window');
    // Owner keeps the Write editor mounted while Read is active. Measure the
    // visible article, never the hidden editor's zero-size paragraph ranges.
    const paragraph = [...text.querySelectorAll('.text-document p')].find(node => node.getClientRects().length);
    if (!paragraph) throw new Error('The fixture must expose a visible article paragraph');
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
        await page.locator('.text-tools-window').waitFor({ state: 'detached' });
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
          let exposed = 0;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const green = pixels[i + 1] > pixels[i] + 35 && pixels[i + 1] > pixels[i + 2] + 35;
            if (y > 5 * density && y < canvas.height - 3 * density && green) exposed++;
          }
          // The title strip may occupy the pixels immediately above a join.
          // Prove the contrast on a known empty Workbench point independently.
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, -Math.round(1000 * density), -Math.round(800 * density));
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return { exposed, background: g > r + 35 && g > b + 35 };
        }, { png: png.toString('base64'), density: deviceScaleFactor, clip });
        assert.ok(result.background, 'pixel probe sees the contrasting empty Workbench');
        assert.equal(result.exposed, 0, `no painted gap for ${visitor ? 'Visitor' : 'Owner'} at density ${deviceScaleFactor}, zoom step ${step}`);
      }
      await closePage(page);
    }
  } finally { await closeBrowser(browser); }
});

for (const visitor of [false, true]) test(`${visitor ? 'Visitor' : 'Owner'} separates camera zoom from ${visitor ? 'temporary' : 'authored'} module resize and movement`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    let page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await mount(page, visitor);
    if (!visitor) {
      const tools = page.locator('.text-tools-window'); const before = await tools.boundingBox();
      await zoomToHalf(page);
      assert.deepEqual(await tools.boundingBox(), before, 'Text tools retain their size and position');
      await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).click();
      await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page);
      await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
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
    // Give proportional resizing its own wide composition. The narrow viewport
    // adapts Display's rendered size; carrying that adaptation into this case
    // would hit Display's minimum width before the requested 60% resize.
    await closePage(page);
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await mount(page, visitor);
    if (!visitor) {
      await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.locator('.text-tools-window').waitFor({ state: 'detached' });
    }
    const board = page.locator('.system-workflow__presentation-board');
    const original = await measure(page);
    const groupRight = Math.max(original.board.x + original.board.width, original.text.x + original.text.width);
    const groupBottom = Math.max(original.board.y + original.board.height, original.text.y + original.text.height);
    await page.mouse.move(groupRight + 20, groupBottom + 20); await page.mouse.down();
    await page.mouse.move(Math.max(1, Math.min(original.board.x, original.text.x) - 20), Math.max(1, Math.min(original.board.y, original.text.y) - 20), { steps: 5 });
    await page.mouse.up(); await settle(page);
    const selection = page.getByRole('group', { name: '2 selected Workbench modules', exact: true }); await selection.waitFor();
    const group = await selection.boundingBox();
    const draftBeforeResize = await page.evaluate(() => window.readZoomDraft());
    const handle = page.getByRole('button', { name: 'Scale selected modules from se', exact: true });
    const corner = await handle.boundingBox();
    await page.mouse.move(corner.x + 14, corner.y + 14); await page.mouse.down();
    await page.mouse.move(corner.x + 14 - group.width * .4, corner.y + 14 - group.height * .4, { steps: 5 });
    await page.mouse.up(); await settle(page);
    const smaller = await measure(page);
    closeTo(smaller.board.width, original.board.width * .6, 'marquee Display width');
    closeTo(smaller.text.width, original.text.width * .6, 'marquee Text width');
    closeTo(smaller.board.x - smaller.text.x, (original.board.x - original.text.x) * .6, 'marquee relative spacing');
    const draftAfterResize = await page.evaluate(() => window.readZoomDraft());
    assert.ok(smaller.scroll[0] < original.scroll[0], 'Text resize reduces its wrapping area');
    assert.ok(smaller.lines.length > original.lines.length, 'Text reflows into the smaller width');
    if (visitor) {
      assert.deepEqual(draftAfterResize, draftBeforeResize, 'Visitor resizing is temporary');
    } else {
      assert.notDeepEqual(draftAfterResize.workbench, draftBeforeResize.workbench, 'owner resize saves real window geometry');
      assert.deepEqual(draftAfterResize.texts, draftBeforeResize.texts, 'resize leaves article content and appearance unchanged');
      assert.deepEqual(draftAfterResize.grids, draftBeforeResize.grids, 'Display resize leaves its placements unchanged');
    }
    await page.screenshot({ path: `.browser-test-runtime/workbench-marquee-${visitor ? 'visitor' : 'owner'}.png` });
    // Escape rolls back an unfinished resize; a completed gesture remains.
    const nextCorner = await handle.boundingBox();
    await page.mouse.move(nextCorner.x + 14, nextCorner.y + 14); await page.mouse.down(); await page.mouse.move(nextCorner.x - 30, nextCorner.y - 20);
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await measure(page), smaller, 'Escape cancels group resize');
    const savedBeforeMove = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    // The selection owns drags through artwork, text and both title bars.
    // Owner positions persist; Visitor changes remain temporary.
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
    if (visitor) assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), savedBeforeMove, 'Visitor movement cannot save the maker arrangement');
    else {
      const shown = await measure(page);
      // Local workspace persistence is debounced; wait for the exact final
      // positions rather than mistaking a two-frame preview for a saved layout.
      await page.waitForFunction(({ board, text }) => {
        const key = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:layout:v1:'));
        const layout = key && JSON.parse(localStorage.getItem(key)).layout;
        return layout && Math.abs(layout.display.window.left - board.x) <= 1 && Math.abs(layout.display.window.top - board.y) <= 1
          && Math.abs(layout.texts[0].window.left - text.x) <= 1 && Math.abs(layout.texts[0].window.top - text.y) <= 1;
      }, shown);
      assert.notEqual(await page.evaluate(() => JSON.stringify({ ...localStorage })), savedBeforeMove, 'owner group movement persists window positions');
    }
    assert.deepEqual(await page.evaluate(() => window.readZoomDraft()), draftAfterResize, 'movement changes local layout without rewriting authored content');
    await selection.focus(); const beforeNudge = await measure(page); await page.keyboard.press('Shift+ArrowRight');
    closeTo((await measure(page)).board.x - beforeNudge.board.x, 10, 'keyboard moves group in screen pixels');
    const beforeCancel = await measure(page);
    for (const [dx, dy] of [[2000, 1500], [-2000, -1500]]) {
      await page.mouse.move(beforeCancel.board.x + 50, beforeCancel.board.y + 50); await page.mouse.down();
      await page.mouse.move(beforeCancel.board.x + 50 + dx, beforeCancel.board.y + 50 + dy); await settle(page);
      const edge = await selection.boundingBox();
      assert.ok(edge.x >= 0 && edge.y >= 0 && edge.x + edge.width <= 4000 && edge.y + edge.height <= 4000, 'entire group stays inside the 4000-pixel Workbench area');
      const edgeModules = await measure(page);
      closeTo(edgeModules.board.x - edgeModules.text.x, beforeCancel.board.x - beforeCancel.text.x, 'boundary retains composition');
      await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    }
    await page.mouse.move(beforeCancel.board.x + 50, beforeCancel.board.y + 50); await page.mouse.down();
    await page.mouse.move(beforeCancel.board.x + 90, beforeCancel.board.y + 80); await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await measure(page), beforeCancel, 'Escape restores group movement');
    await page.screenshot({ path: `.browser-test-runtime/workbench-group-move-${visitor ? 'visitor' : 'owner'}.png` });
    // Focus identifies the intended header when toggling group membership.
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
    await header.focus(); await settle(page);
    const start = await text.boundingBox(), h = await header.boundingBox();
    await page.keyboard.down('Alt'); await page.mouse.move(h.x + 5, h.y + h.height / 2); await page.mouse.down();
    await page.mouse.move(h.x + 25, h.y + h.height / 2 + 20, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const moved = await text.boundingBox(); closeTo(moved.x - start.x, 20, 'drag follows pointer x'); closeTo(moved.y - start.y, 20, 'drag follows pointer y');
    if (!visitor) {
      // At 50%, move Text to the Display's visible right edge. Edge snapping
      // operates on screen rectangles, then returns logical window coordinates.
      await header.focus(); await settle(page);
      const b = await page.locator('.system-workflow__presentation-board').boundingBox();
      const current = await text.boundingBox(), handle = await header.boundingBox();
      const dx = b.x + b.width - current.x + 3, dy = b.y - current.y;
      await page.mouse.move(handle.x + 5, handle.y + handle.height / 2); await page.mouse.down();
      await page.mouse.move(handle.x + 5 + dx, handle.y + handle.height / 2 + dy, { steps: 5 }); await page.mouse.up();
      closeTo((await text.boundingBox()).x, b.x + b.width, 'scaled edge snapping');
    }
    assert.deepEqual(errors, []);
  } finally { await closeBrowser(browser); }
});
