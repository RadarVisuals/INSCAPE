import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
test('captured native-fit seams can be filled without moving frames; Image resizing reaches the visible grid', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://image.fit.test/source.png', async route => {
      const src = await page.evaluate(() => imageFitFixture.source);
      await route.fulfill({ contentType: 'image/png', body: Buffer.from(src.split(',')[1], 'base64') });
    });
    await page.route(`${origin}/__image_fit__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_fit__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/image-fit-fixture.jsx')).mount();
    });
    const dock = page.locator('[data-context-tools]');
    await dock.getByRole('button', { name: 'Fill canvas', exact: true }).waitFor();
    await page.evaluate(async () => { const image = new Image(); image.src = 'https://image.fit.test/source.png'; await image.decode(); });
    const scale = 1.0976232973106559, offset = { x: -3541.289770546675, y: -1519.0376733143444 };
    await page.evaluate(({ scale, offset }) => imageFitFixture.camera(scale, offset), { scale, offset }); await settle(page);
    const initial = await page.evaluate(() => imageFitFixture.store.getDraft());
    await page.getByRole('button', { name: 'Meet Grid-naad', exact: true }).click();
    const report = JSON.parse(await page.getByRole('textbox', { name: 'Meetrapport' }).inputValue());
    assert.ok(report.imageJoins.every(join => join.canvasGapPhysicalPx === 0));
    assert.ok(report.imageJoins.some(join => join.mediaRectangleGapPhysicalPx > 2), 'reproduces the uploaded report: frames touch, native image rectangles do not');
    await page.getByRole('button', { name: 'Sluiten', exact: true }).click();
    const geometry = () => page.locator('.image-module__window').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    const beforeFrames = await geometry();
    await page.screenshot({ path: '.browser-test-runtime/image-fit-before.png' });
    for (const module of initial.imageModules) {
      await page.evaluate(id => imageFitFixture.select(id), module.id);
      await dock.getByRole('button', { name: 'Fill canvas', exact: true }).click(); await settle(page);
    }
    const filled = await page.evaluate(() => imageFitFixture.store.getDraft());
    assert.deepEqual(await geometry(), beforeFrames, 'filling changes no window geometry');
    assert.deepEqual(filled.workbench, initial.workbench, 'no layout rewrite');
    for (let i = 0; i < filled.imageModules.length; i++) {
      assert.deepEqual(filled.imageModules[i].sides[0].crop, { x: .5, y: .5, zoom: 1 });
      assert.deepEqual(filled.imageModules[i].sides[0].asset, initial.imageModules[i].sides[0].asset);
      assert.deepEqual(filled.imageModules[i].sides[0].transform, initial.imageModules[i].sides[0].transform);
    }
    await page.evaluate(() => imageFitFixture.select('image:one')); await settle(page);
    const clean = await page.addStyleTag({ content: '.image-module__close,.image-module__bounds,.image-module__resize {visibility:hidden!important;}' });
    const screenshot = await page.screenshot({ path: '.browser-test-runtime/image-fit-after.png' });
    const pixels = await page.evaluate(async png => {
      const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const nodes = [...document.querySelectorAll('.image-module__canvas')].map(node => node.getBoundingClientRect());
      const seam = nodes[2].left, y = nodes[1].top;
      // Both sides of the vertical join, the horizontal join and their intersection.
      return [[seam-1, 100], [seam, 100], [500, y-1], [500, y], [seam-1,y-1], [seam,y]].map(([x,y]) => [...ctx.getImageData(x,y,1,1).data]);
    }, screenshot.toString('base64'));
    assert.ok(pixels.every(pixel => pixel.slice(0, 3).join() === '222,118,51'), JSON.stringify(pixels));
    await clean.evaluate(node => node.remove());
    await dock.getByRole('button', { name: 'Fit inside', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal((await page.evaluate(() => imageFitFixture.store.getDraft())).imageModules[0].sides[0].crop, null);
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), filled, 'fit choice is one undoable edit');
    await page.evaluate(() => { imageFitFixture.failSave = true; });
    await dock.getByRole('button', { name: 'Fit inside', exact: true }).click();
    await dock.getByRole('alert').waitFor();
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), filled, 'failed save leaves the image and fit unchanged');
    await page.evaluate(() => { imageFitFixture.failSave = false; imageFitFixture.single(true); imageFitFixture.setPreferences({ edge:false, grid:true }); }); await settle(page);
    await dock.getByRole('button', { name: 'Fit inside', exact: true }).click(); await settle(page);
    const beforeResize = await page.evaluate(() => imageFitFixture.store.getDraft());
    const grip = page.locator('.image-module__resize.is-e');
    const handle = await grip.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    const target = 4608 * scale + offset.x;
    const edge = (await geometry())[0].right;
    await page.mouse.move(handle.x + handle.width / 2 + target - edge, handle.y + handle.height / 2, { steps: 6 }); await settle(page);
    assert.equal((await geometry())[0].right, Math.round(target), 'live right edge reaches the same rounded coordinate as the visible grid');
    const covers = () => page.locator('.image-module__canvas').first().evaluate(node => {
      const frame = node.getBoundingClientRect(), media = node.querySelector('image').getBoundingClientRect();
      return media.left <= frame.left + .01 && media.top <= frame.top + .01 && media.right >= frame.right - .01 && media.bottom >= frame.bottom - .01;
    });
    assert.ok(await covers(), 'resizing a native-fitted image fills the live preview automatically');
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'preview has not saved anything');
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.equal((await geometry())[0].right, edge, 'Escape restores the original frame');
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'Escape restores native fitting without a write');
    assert.equal(await covers(), false, 'cancel restores the original fitted media');
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + target - edge, handle.y + handle.height / 2, { steps: 6 }); await settle(page);
    await page.mouse.up(); await settle(page);
    assert.equal((await geometry())[0].right, Math.round(target), 'release preserves the snapped edge');
    assert.ok(await covers(), 'committed resize retains its filled preview');
    assert.deepEqual((await page.evaluate(() => imageFitFixture.store.getDraft())).imageModules[0].sides[0].crop, { x:.5, y:.5, zoom:1 });
    await page.screenshot({ path: '.browser-test-runtime/image-fit-resize-grid.png' });
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'undo restores dimensions, layout and legacy native fitting together');
    await dock.getByRole('spinbutton', { name: 'Image width', exact: true }).fill('1008');
    await dock.getByRole('button', { name: 'Set size', exact: true }).click(); await settle(page);
    assert.ok(await covers(), 'numeric resizing uses the same automatic filling behavior');
    assert.equal((await page.evaluate(() => imageFitFixture.store.getDraft())).imageModules[0].width, 1008);
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'numeric size and fitting form one undo step');
    await page.evaluate(() => {
      imageFitFixture.single(false); imageFitFixture.setPreferences({ edge:false, grid:false });
      imageFitFixture.selection(['image:one', 'image:two']);
    }); await settle(page);
    const beforeGroupFrames = await geometry();
    const groupGrip = page.getByRole('button', { name: 'Scale selected modules from se', exact: true });
    const beginGroupResize = async () => {
      const handle = await groupGrip.boundingBox();
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2 + 48, handle.y + handle.height / 2 + 64, { steps:6 }); await settle(page);
    };
    await beginGroupResize();
    assert.ok(await covers(), 'selection resizing fills native artwork during the preview');
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'selection preview has not saved');
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await geometry(), beforeGroupFrames, 'cancel restores every selected frame');
    assert.equal(await covers(), false, 'cancel restores native fit after selection resizing');
    await beginGroupResize();
    const groupPreview = await geometry();
    assert.equal(groupPreview[0].bottom, groupPreview[1].top, 'selected images retain their shared edge during resize');
    await page.mouse.up(); await settle(page);
    assert.deepEqual(await geometry(), groupPreview, 'selection preview and commit paint exactly the same frames');
    assert.ok(await covers(), 'selection commit retains its filled preview');
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'one undo restores the entire resized selection and its fitting');
    assert.deepEqual(await geometry(), beforeGroupFrames);
    await page.evaluate(() => { imageFitFixture.selection([]); imageFitFixture.single(true); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => imageFitFixture.camera(1, { x:-3568, y:-1312 })); await settle(page);
    await dock.getByRole('button', { name: 'Fill canvas', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.browser-test-runtime/image-fit-tools-narrow.png' });
    assert.ok(await dock.getByRole('button', { name: 'Fit inside', exact: true }).isVisible());
    await page.evaluate(() => imageFitFixture.owner(false)); await settle(page);
    assert.equal(await page.getByRole('button', { name: 'Fill canvas', exact: true }).count(), 0, 'Visitor has no fitting authoring control');
    const projection = () => page.locator('.image-module__artwork').first().evaluate(node => ({
      box: node.getAttribute('viewBox'), media: ['x', 'y', 'width', 'height'].map(key => node.querySelector('image').getAttribute(key)),
    }));
    const visitorProjection = await projection();
    const visitorWidth = (await geometry())[0].width;
    await page.evaluate(() => imageFitFixture.selection(['image:one'])); await settle(page);
    await groupGrip.focus(); await page.keyboard.press('ArrowLeft'); await settle(page);
    assert.ok((await geometry())[0].width < visitorWidth, 'Visitor can still scale a temporary selection');
    assert.deepEqual(await projection(), visitorProjection, 'Visitor scaling never selects a new fit or crop');
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), beforeResize, 'Visitor scaling never changes the saved draft');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
