import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/image-corner-resize';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1.1, `${label}: ${actual} vs ${expected}`);

for (const [width, density] of [[1440, 1], [390, 1.25]]) test(`Image corners resize width and height freely without stretching artwork at ${width}px / DPR ${density}`, { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://image.fit.test/source.png', async route => {
      const src = await page.evaluate(() => imageFitFixture.source);
      await route.fulfill({ contentType: 'image/png', body: Buffer.from(src.split(',')[1], 'base64') });
    });
    await page.route(`${origin}/__image_corner_resize__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_corner_resize__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/image-fit-fixture.jsx')).mount();
    });
    await page.locator('.image-module__window').first().waitFor();
    // This fixture forces a dock open on narrow screens. Shorten and park it
    // through its own controls, leaving every Image corner reachable.
    if (width === 390) {
      const dock = page.locator('.workbench-tool-dock');
      const resize = dock.locator('.workbench-tool-panel-resize[data-edge="se"]');
      await resize.focus(); for (let i = 0; i < 10; i++) await resize.press('Shift+ArrowUp');
      const move = dock.getByRole('button', { name: 'Move Transform, Color and Info panel', exact: true });
      await move.focus(); for (let i = 0; i < 20; i++) await move.press('Shift+ArrowDown');
      await settle(page);
    }
    let sequence = 0;
    const reset = async (scale = 1, crop = null) => {
      await page.evaluate(({ scale, crop, sequence }) => {
        const api = imageFitFixture, draft = api.store.getDraft(), id = `image:corner${sequence}`;
        draft.imageModules = [{ ...draft.imageModules[0], id, width: 240, height: 180,
          sides: draft.imageModules[0].sides.map(side => ({ ...side, crop })) }];
        draft.workbench.imageModules = [{ id, open: true, position: { left: 72, top: 180 } }];
        api.failSave = false;
        api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() });
        api.selection([]); api.select(id); api.single(true); api.setPreferences({ edge: false, grid: false });
        api.camera(scale, { x: 0, y: 0 });
      }, { scale, crop, sequence: ++sequence });
      await settle(page);
      await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
    };
    const draft = () => page.evaluate(() => imageFitFixture.store.getDraft());
    const surface = page.locator('.image-module__window');
    const artwork = () => surface.locator('svg image').evaluate(node => ({ width: Number(node.getAttribute('width')), height: Number(node.getAttribute('height')) }));
    const start = async (selector, dx, dy) => {
      const box = await page.locator(selector).boundingBox();
      assert.ok(await page.locator(selector).evaluate(node => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), `resize target must be uncovered: ${selector}`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 3 }); await settle(page);
    };
    const measurements = [];
    for (const scale of [.55, .9, 1]) for (const corner of ['nw', 'ne', 'sw', 'se']) {
      for (const axis of ['horizontal', 'vertical', 'diagonal', 'mixed']) for (const factor of [.8, 1.2]) {
        await reset(scale);
        const before = await draft(), rect = await surface.boundingBox();
        const fx = axis === 'vertical' ? 1 : factor, fy = axis === 'horizontal' ? 1 : axis === 'mixed' ? 2-factor : factor;
        const dx = (corner.includes('w') ? -1 : 1) * 240 * scale * (fx - 1);
        const dy = (corner.includes('n') ? -1 : 1) * 180 * scale * (fy - 1);
        await start(`.image-module__resize.is-${corner}`, dx, dy);
        assert.deepEqual(await draft(), before, 'pointer preview does not write storage');
        const preview = await surface.boundingBox(), media = await artwork();
        near(preview.width, 240 * scale * fx, `${corner} ${axis} width`);
        near(preview.height, 180 * scale * fy, `${corner} ${axis} height`);
        near(preview.x + (corner.includes('w') ? preview.width : 0), rect.x + (corner.includes('w') ? rect.width : 0), 'fixed opposite x');
        near(preview.y + (corner.includes('n') ? preview.height : 0), rect.y + (corner.includes('n') ? rect.height : 0), 'fixed opposite y');
        assert.ok(Math.abs(media.width / media.height - 2560 / 1440) < 1e-9, 'media retains source aspect ratio');
        await page.mouse.up(); await settle(page);
        const after = await draft();
        assert.equal(after.imageModules[0].width, Math.round(240 * fx));
        assert.equal(after.imageModules[0].height, Math.round(180 * fy));
        assert.deepEqual(after.imageModules[0].sides, before.imageModules[0].sides, 'source, fit and transforms are untouched');
        assert.deepEqual(await surface.boundingBox(), preview, 'no release jump');
        await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
        assert.deepEqual(await draft(), before, 'one undo restores the entire resize');
        await page.evaluate(() => imageFitFixture.store.redo()); await settle(page);
        assert.deepEqual(await draft(), after);
        measurements.push({ scale, corner, axis, factor, before: rect, preview, media });
      }
    }
    // Custom crop is retained, and both cancellation and storage failure restore
    // the complete rendered frame as well as its saved content.
    for (const selected of [false, true]) for (const outcome of ['cancel', 'save-failure', 'commit']) {
      await reset(.9, { x: .3, y: .7, zoom: 1.4 });
      if (selected) { await page.evaluate(() => imageFitFixture.selection([imageFitFixture.store.getDraft().imageModules[0].id])); await settle(page); }
      const before = await draft(), rect = await surface.boundingBox();
      if (outcome === 'save-failure') await page.evaluate(() => { imageFitFixture.failSave = true; });
      await start(selected ? '.workbench-selection .is-se' : '.image-module__resize.is-se', 43.2, 0);
      if (outcome === 'cancel') await page.keyboard.press('Escape');
      await page.mouse.up(); await settle(page);
      if (outcome === 'commit') {
        assert.deepEqual((await draft()).imageModules[0].sides, before.imageModules[0].sides);
        await page.screenshot({ path: join(output, `corner-horizontal-${width}.png`) });
      } else { assert.deepEqual(await draft(), before); assert.deepEqual(await surface.boundingBox(), rect); }
    }
    // Keyboard and single-Image selection corners use the same free dimensions.
    await reset();
    await page.locator('.image-module__resize.is-se').focus(); await page.keyboard.press('Shift+ArrowRight'); await settle(page);
    assert.equal((await draft()).imageModules[0].width, 250);
    assert.equal((await draft()).imageModules[0].height, 180);
    await reset(); await start('.image-module__resize.is-e', 24, 0); await page.mouse.up(); await settle(page);
    assert.equal((await draft()).imageModules[0].width, 264); assert.equal((await draft()).imageModules[0].height, 180);
    for (const axis of ['horizontal', 'vertical']) {
      await reset(); const before = await draft();
      await page.evaluate(() => imageFitFixture.selection([imageFitFixture.store.getDraft().imageModules[0].id])); await settle(page);
      await start('.workbench-selection .is-se', axis === 'horizontal' ? 48 : 0, axis === 'vertical' ? 36 : 0);
      await page.mouse.up(); await settle(page);
      assert.equal((await draft()).imageModules[0].width, axis === 'horizontal' ? 288 : 240);
      assert.equal((await draft()).imageModules[0].height, axis === 'vertical' ? 216 : 180);
      assert.deepEqual((await draft()).imageModules[0].sides, before.imageModules[0].sides);
      await page.evaluate(() => imageFitFixture.store.undo()); assert.deepEqual(await draft(), before);
    }
    await reset();
    const beforeKeyboardSelection = await draft();
    await page.evaluate(() => imageFitFixture.selection([imageFitFixture.store.getDraft().imageModules[0].id])); await settle(page);
    await page.locator('.workbench-selection .is-nw').focus();
    await page.keyboard.press('Shift+ArrowLeft'); await settle(page);
    assert.equal((await draft()).imageModules[0].width, 250);
    assert.equal((await draft()).imageModules[0].height, 180);
    await page.keyboard.press('ArrowUp'); await settle(page);
    assert.equal((await draft()).imageModules[0].width, 250);
    assert.equal((await draft()).imageModules[0].height, 181);
    await page.evaluate(() => { imageFitFixture.store.undo(); imageFitFixture.store.undo(); }); await settle(page);
    assert.deepEqual(await draft(), beforeKeyboardSelection, 'keyboard selection resize uses independent axes and undo');
    await writeFile(join(output, `corners-${width}.json`), JSON.stringify(measurements, null, 2));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
