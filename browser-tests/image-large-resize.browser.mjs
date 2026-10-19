import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/image-large-resize';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b, label) => assert.ok(Math.abs(a-b) < 1.2, `${label}: ${a} vs ${b}`);

for (const [width, density] of [[1440, 1], [390, 1.25]]) test(`large Image corners keep responding on every axis and after reload at ${width}px`, { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = []; let page;
  try {
    page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.stack));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://image.fit.test/source.png', async route => {
      const source = await page.evaluate(() => imageFitFixture.source);
      await route.fulfill({ contentType: 'image/png', body: Buffer.from(source.split(',')[1], 'base64') });
    });
    await page.route(`${origin}/__large_image_resize__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = async () => {
      await page.evaluate(async () => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        (await import('/browser-tests/image-fit-fixture.jsx')).mount({ persistent: true });
      });
      await page.locator('.image-module__window').first().waitFor();
    };
    await page.goto(`${origin}/__large_image_resize__`); await mount();
    let sequence = 0;
    const configure = async () => {
      await page.evaluate(() => {
        const api = imageFitFixture;
        api.setPreferences({ edge: false, grid: false }); api.selection([]); api.single(true);
        api.select(api.store.getDraft().imageModules[0].id); api.camera(.25, { x: -102, y: -30 });
      });
      await settle(page);
      // The movable Properties window can overlap a tall Image in a narrow
      // viewport. Park it below the artwork through its real move handle.
      const header = await page.locator('[aria-label="Move Properties window"]').boundingBox();
      if (header && header.y < 430) {
        await page.mouse.move(header.x+header.width/2, header.y+header.height/2); await page.mouse.down();
        await page.mouse.move(header.x+header.width/2, 450, { steps: 4 }); await page.mouse.up(); await settle(page);
      }
    };
    const reset = async size => {
      await page.evaluate(({ size, sequence }) => {
        const api = imageFitFixture, draft = api.store.getDraft(), id = `image:large${sequence}`;
        draft.imageModules = [{ ...draft.imageModules[0], ...size, id,
          sides: draft.imageModules[0].sides.map(side => ({ ...side, crop: null })) }];
        draft.workbench.area = { width: 6000, height: 6000 };
        draft.workbench.imageModules = [{ id, open: true, position: { left: 600, top: 600 } }];
        api.failSave = false; api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() });
      }, { size, sequence: ++sequence });
      await configure(); await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
    };
    const draft = () => page.evaluate(() => imageFitFixture.store.getDraft());
    const frame = page.locator('.image-module__window');
    const drag = async (selector, dx, dy) => {
      const r = await page.locator(selector).boundingBox();
      assert.ok(await page.locator(selector).evaluate(node => {
        const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x+box.width/2, box.y+box.height/2));
      }), `resize target must be uncovered: ${selector}`);
      await page.mouse.move(r.x+r.width/2, r.y+r.height/2); await page.mouse.down();
      await page.mouse.move(r.x+r.width/2+dx, r.y+r.height/2+dy, { steps: 4 }); await settle(page);
    };
    const measurements = [];
    for (const size of [{ width: 239, height: 1053 }, { width: width === 390 ? 1200 : 1800, height: 400 }]) {
      for (const corner of ['se','ne','sw','nw']) for (const axis of ['horizontal','vertical','diagonal']) for (const factor of [.9,1.1]) {
        await reset(size); const before = await draft(), rect = await frame.boundingBox();
        const fx = axis === 'vertical' ? 1 : factor, fy = axis === 'horizontal' ? 1 : factor;
        const dx = axis === 'vertical' ? 0 : (corner.includes('w') ? -1 : 1)*size.width*.25*(factor-1);
        const dy = axis === 'horizontal' ? 0 : (corner.includes('n') ? -1 : 1)*size.height*.25*(factor-1);
        await drag(`.image-module__resize.is-${corner}`, dx, dy);
        const preview = await frame.boundingBox();
        near(preview.width, size.width*.25*fx, `${corner} ${axis} visible width must follow the resize`);
        near(preview.height, size.height*.25*fy, `${corner} ${axis} visible height must follow the resize`);
        near(preview.x+(corner.includes('w') ? preview.width : 0), rect.x+(corner.includes('w') ? rect.width : 0), 'opposite x');
        near(preview.y+(corner.includes('n') ? preview.height : 0), rect.y+(corner.includes('n') ? rect.height : 0), 'opposite y');
        assert.deepEqual(await draft(), before, 'preview remains unsaved');
        await page.mouse.up(); await settle(page);
        const after = await draft();
        assert.equal(after.imageModules[0].width, Math.round(size.width*fx));
        assert.equal(after.imageModules[0].height, Math.round(size.height*fy));
        assert.deepEqual(after.imageModules[0].sides, before.imageModules[0].sides, 'source, crop and transforms unchanged');
        assert.deepEqual(await frame.boundingBox(), preview, 'release keeps the preview');
        await page.evaluate(() => imageFitFixture.store.undo()); await settle(page); assert.deepEqual(await draft(), before);
        measurements.push({ size, corner, axis, factor, before: rect, preview });
      }
    }
    // Larger than the viewport, but not fitted back down by a selection resize.
    await reset({ width: 239, height: 1053 });
    await page.evaluate(() => imageFitFixture.selection([imageFitFixture.store.getDraft().imageModules[0].id])); await settle(page);
    await drag('.workbench-selection .is-se', 23.9, 0); await page.mouse.up(); await settle(page);
    const saved = await draft(), savedFrame = await frame.boundingBox();
    assert.equal(saved.imageModules[0].width, 335); assert.equal(saved.imageModules[0].height, 1053);
    assert.equal(saved.imageModules[0].sides[0].crop, null);
    await page.screenshot({ path: join(output, `large-before-reload-${width}.png`) });
    // Reload the actual page and hydrate the real store from browser storage.
    await page.reload(); await mount(); await configure();
    assert.deepEqual(await draft(), saved, 'reload restores the real saved draft');
    assert.deepEqual(await frame.boundingBox(), savedFrame, 'reload cannot choose another Image fit');
    const reloadFrame = await frame.boundingBox();
    await drag('.image-module__resize.is-se', 0, 20); await page.mouse.up(); await settle(page);
    const afterReloadDrag = await frame.boundingBox();
    near(afterReloadDrag.height, reloadFrame.height+20, 'vertical resize remains responsive after refresh');
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page); assert.deepEqual(await draft(), saved);
    // Merely changing browser width or height does not reinterpret world size.
    await page.setViewportSize({ width, height: 700 }); await settle(page);
    assert.deepEqual(await frame.boundingBox(), savedFrame); assert.deepEqual(await draft(), saved);
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 }); await settle(page);
    assert.deepEqual(await frame.boundingBox(), savedFrame); assert.deepEqual(await draft(), saved);
    await page.setViewportSize({ width, height: 900 }); await settle(page);
    await page.screenshot({ path: join(output, `large-after-reload-${width}.png`) });
    await page.evaluate(() => imageFitFixture.owner(false)); await settle(page);
    assert.deepEqual(await frame.boundingBox(), savedFrame, 'Visitor uses the same world frame');
    assert.equal(await frame.locator('[role="separator"]').count(), 0);
    assert.deepEqual(await draft(), saved);
    await writeFile(join(output, `large-corners-${width}.json`), JSON.stringify(measurements, null, 2));
    assert.deepEqual(errors, []);
  } catch (error) {
    await page?.screenshot({ path: join(output, `failure-final-${width}.png`) });
    await writeFile(join(output, `failure-final-${width}.json`), JSON.stringify({ error: error.message, pageErrors: errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
});
