import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Image body distinguishes inspection, movement, cancellation, flip, crop and Workbench selection', { timeout: 60000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://image.fit.test/source.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.route(`${origin}/__image_interaction__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_interaction__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/image-fit-fixture.jsx')).mount();
    });
    const windows = page.locator('.image-module__window'), first = windows.first(); await first.waitFor();
    await page.evaluate(() => {
      const api = imageFitFixture, draft = api.store.getDraft();
      draft.imageModules = draft.imageModules.slice(0, 2).map(image => ({ ...image, id: `${image.id}-gesture`, width: 320, height: 240,
        sides: [image.sides[0], { ...image.sides[0], id: `${image.sides[0].id}-second`, transform: { quarterTurns: 0, mirrorX: true, mirrorY: false } }],
      }));
      draft.workbench.imageModules = draft.workbench.imageModules.slice(0, 2).map((image, i) => ({ ...image, id: `${image.id}-gesture`, position: { left: 80 + i * 400, top: 160 } }));
      if (!api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() })) throw Error('Interaction fixture failed to save');
    }); await settle(page);
    const canvas = first.locator('.image-module__canvas'), next = first.getByRole('button', { name: 'Next Image side' });
    const dialog = page.getByRole('dialog', { name: 'Inspect Image' });
    const rectangle = () => first.evaluate(node => node.getBoundingClientRect().toJSON());
    const initial = await rectangle(), draft = await page.evaluate(() => imageFitFixture.store.getDraft());
    assert.ok(initial.x >= 0 && initial.right <= 1440 && initial.y >= 0 && initial.bottom <= 1000, JSON.stringify(initial));
    await page.screenshot({ path: '.browser-test-runtime/image-interaction-initial.png' });
    // Pointer jitter stays a click; keyboard inspection retains normal button semantics.
    await page.mouse.move(initial.x + 70, initial.y + 90); await page.mouse.down();
    await page.mouse.move(initial.x + 72, initial.y + 91); await page.mouse.up();
    await dialog.waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(await rectangle(), initial);
    await canvas.focus(); await page.keyboard.press('Enter'); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });

    for (const ending of ['Escape', 'pointercancel', 'blur', 'commit']) {
      const before = await rectangle();
      await page.keyboard.down('Alt');
      await page.mouse.move(before.x + 70, before.y + 90); await page.mouse.down();
      await page.mouse.move(before.x + 130, before.y + 130, { steps: 6 }); await settle(page);
      assert.equal((await rectangle()).x, before.x + 60, 'artwork follows the pointer');
      if (ending === 'Escape') await page.keyboard.press('Escape');
      if (ending === 'pointercancel') await canvas.dispatchEvent('pointercancel', { pointerId: 1, bubbles: true });
      if (ending === 'blur') await page.evaluate(() => dispatchEvent(new Event('blur')));
      await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
      assert.equal(await dialog.count(), 0, `${ending} does not inspect on release`);
      const after = await rectangle();
      if (ending === 'commit') { assert.equal(after.x, before.x + 60); assert.equal(after.y, before.y + 40); }
      else assert.deepEqual(after, before, `${ending} restores the entire preview`);
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), draft, 'movement preserves authored size, crop and source');
    }
    // Flip remains a separate action, with no visible count or accidental movement.
    const moved = await rectangle(), firstSide = await canvas.getAttribute('data-side-id');
    await canvas.hover();
    assert.equal((await next.innerText()).trim(), '');
    await next.click(); await settle(page);
    assert.notEqual(await canvas.getAttribute('data-side-id'), firstSide);
    assert.deepEqual(await rectangle(), moved); assert.equal(await dialog.count(), 0);
    await next.focus(); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await canvas.getAttribute('data-side-id'), firstSide, 'keyboard flipping wraps');
    await page.screenshot({ path: '.browser-test-runtime/image-interaction-wide.png' });
    // Crop owns its drag; closing it restores the ordinary body interaction.
    const dock = page.locator('[data-context-tools]');
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider', { name: 'Crop zoom' }).fill('2');
    const projection = () => canvas.locator('image').getAttribute('transform'), beforeCrop = await projection();
    await page.mouse.move(moved.x + 70, moved.y + 90); await page.mouse.down();
    await page.mouse.move(moved.x + 130, moved.y + 130, { steps: 6 }); await page.mouse.up(); await settle(page);
    assert.notEqual(await projection(), beforeCrop); assert.deepEqual(await rectangle(), moved);
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
    const resize = first.getByRole('separator', { name: 'Resize Image top', exact: true }), resizeBox = await resize.boundingBox();
    await page.keyboard.down('Shift'); await page.keyboard.down('Alt');
    await page.mouse.move(resizeBox.x + 14, resizeBox.y + 14); await page.mouse.down();
    await page.mouse.move(resizeBox.x + 14, resizeBox.y - 10, { steps: 4 }); await page.mouse.up();
    await page.keyboard.up('Alt'); await page.keyboard.up('Shift'); await settle(page);
    assert.equal((await rectangle()).height, moved.height + 24, 'Shift on a resize target still resizes instead of selecting');
    assert.equal(await page.locator('.workbench-selection').count(), 0);
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
    assert.deepEqual(await rectangle(), moved);
    // Both pointer and keyboard selection act on the artwork without opening it.
    await canvas.click({ modifiers: ['Shift'] }); await settle(page);
    assert.equal(await dialog.count(), 0);
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    await windows.nth(1).locator('.image-module__canvas').focus(); await page.keyboard.press('Shift+Enter');
    await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0);
    const selectedImage = await rectangle();
    await page.keyboard.down('Shift'); await page.mouse.click(selectedImage.x + 70, selectedImage.y + 90); await page.keyboard.up('Shift');
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0, 'deselecting through the selection overlay does not inspect');
    await page.keyboard.press('Escape');

    // Visitor uses identical click/drag/flip behavior and never writes the draft.
    await page.evaluate(() => imageFitFixture.owner(false)); await settle(page);
    const visitorStart = await rectangle();
    await page.mouse.move(visitorStart.x + 60, visitorStart.y + 70); await page.mouse.down();
    await page.mouse.move(visitorStart.x + 90, visitorStart.y + 100, { steps: 5 }); await page.mouse.up(); await settle(page);
    assert.equal((await rectangle()).x, visitorStart.x + 30); assert.equal(await dialog.count(), 0);
    await canvas.click(); await dialog.waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), draft);
    await page.evaluate(() => imageFitFixture.camera(1, { x: -100, y: 0 }));
    await page.setViewportSize({ width: 390, height: 844 }); await canvas.hover();
    await page.screenshot({ path: '.browser-test-runtime/image-interaction-narrow.png' });
    const closeRect = await first.locator('.image-module__close').boundingBox();
    assert.ok(closeRect.x >= 0 && closeRect.x + closeRect.width <= 390, 'close remains reachable');
    await page.mouse.click(10, 700); await settle(page);
    assert.equal(await next.evaluate(node => getComputedStyle(node).opacity), '0', 'resting artwork has no flip tag');
    await page.screenshot({ path: '.browser-test-runtime/image-interaction-rest.png' });
    // Minimum-size artwork retains a real drag/inspection target. Hover controls
    // sit outside both it and the resize targets, and stay reachable on narrow screens.
    await page.evaluate(() => {
      imageFitFixture.owner(true);
      const store = imageFitFixture.store, draft = store.getDraft();
      draft.imageModules[0] = { ...draft.imageModules[0], width: 32, height: 32 };
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Minimum-size fixture failed to save');
    }); await settle(page);
    await canvas.hover();
    assert.ok(await canvas.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node; }), 'minimum canvas centre remains grabbable');
    for (const control of [next, first.locator('.image-module__close')]) {
      assert.ok(await control.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + 14, r.y + 14)?.closest('button') === node; }), 'minimum canvas controls have distinct hit targets');
    }
    await next.click(); await settle(page); assert.equal(await dialog.count(), 0);
    await page.screenshot({ path: '.browser-test-runtime/image-interaction-minimum.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
