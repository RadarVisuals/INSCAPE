import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/image-corner-resize';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1.1, `${label}: ${actual} vs ${expected}`);

for (const [width, density] of [[1440, 1], [390, 1.25]]) test(`Image corner resizing preserves frame, artwork and undo at ${width}px / DPR ${density}`, { timeout: 120000 }, async () => {
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
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 3 }); await settle(page);
    };
    const measurements = [];
    for (const scale of [.55, .9, 1]) for (const corner of ['nw', 'ne', 'sw', 'se']) {
      for (const axis of ['horizontal', 'vertical', 'diagonal']) for (const factor of [.8, 1.2]) {
        await reset(scale);
        const before = await draft(), rect = await surface.boundingBox();
        const dx = axis === 'vertical' ? 0 : (corner.includes('w') ? -1 : 1) * 240 * scale * (factor - 1);
        const dy = axis === 'horizontal' ? 0 : (corner.includes('n') ? -1 : 1) * 180 * scale * (factor - 1);
        await start(`.image-module__resize.is-${corner}`, dx, dy);
        assert.deepEqual(await draft(), before, 'pointer preview does not write storage');
        const preview = await surface.boundingBox(), media = await artwork();
        near(preview.width, 240 * scale * factor, `${corner} ${axis} width`);
        near(preview.height, 180 * scale * factor, `${corner} ${axis} height`);
        near(preview.x + (corner.includes('w') ? preview.width : 0), rect.x + (corner.includes('w') ? rect.width : 0), 'fixed opposite x');
        near(preview.y + (corner.includes('n') ? preview.height : 0), rect.y + (corner.includes('n') ? rect.height : 0), 'fixed opposite y');
        assert.ok(Math.abs(media.width / media.height - 2560 / 1440) < 1e-9, 'media retains source aspect ratio');
        await page.mouse.up(); await settle(page);
        const after = await draft();
        assert.equal(after.imageModules[0].width, Math.round(240 * factor));
        assert.equal(after.imageModules[0].height, Math.round(180 * factor));
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
    for (const outcome of ['cancel', 'save-failure', 'commit']) {
      await reset(.9, { x: .3, y: .7, zoom: 1.4 });
      const before = await draft(), rect = await surface.boundingBox();
      if (outcome === 'save-failure') await page.evaluate(() => { imageFitFixture.failSave = true; });
      await start('.image-module__resize.is-se', 43.2, 0);
      if (outcome === 'cancel') await page.keyboard.press('Escape');
      await page.mouse.up(); await settle(page);
      if (outcome === 'commit') {
        assert.deepEqual((await draft()).imageModules[0].sides, before.imageModules[0].sides);
        await page.screenshot({ path: join(output, `corner-horizontal-${width}.png`) });
      } else { assert.deepEqual(await draft(), before); assert.deepEqual(await surface.boundingBox(), rect); }
    }
    // Keyboard corner controls share the proportional path; side handles still
    // change one canvas dimension. Selection handles use the same pointer rule.
    await reset();
    await page.locator('.image-module__resize.is-se').focus(); await page.keyboard.press('Shift+ArrowRight'); await settle(page);
    assert.equal((await draft()).imageModules[0].width, 250);
    assert.equal((await draft()).imageModules[0].height, 188);
    await reset(); await start('.image-module__resize.is-e', 24, 0); await page.mouse.up(); await settle(page);
    assert.equal((await draft()).imageModules[0].width, 264); assert.equal((await draft()).imageModules[0].height, 180);
    for (const axis of ['horizontal', 'vertical']) {
      await reset(); const before = await draft();
      await page.evaluate(() => imageFitFixture.selection([imageFitFixture.store.getDraft().imageModules[0].id])); await settle(page);
      await start('.workbench-selection .is-se', axis === 'horizontal' ? 48 : 0, axis === 'vertical' ? 36 : 0);
      await page.mouse.up(); await settle(page);
      assert.equal((await draft()).imageModules[0].width, 288); assert.equal((await draft()).imageModules[0].height, 216);
      assert.deepEqual((await draft()).imageModules[0].sides, before.imageModules[0].sides);
      await page.evaluate(() => imageFitFixture.store.undo()); assert.deepEqual(await draft(), before);
    }
    await writeFile(join(output, `corners-${width}.json`), JSON.stringify(measurements, null, 2));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
