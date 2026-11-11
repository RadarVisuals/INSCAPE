import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { mountFilledDisplay } from './fixtures/display-filled-fixture.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const placementClass of ['system-workflow__placement', 'lattice-production-placement']) test(`33 decoded cutouts retain correct repeated alpha picking for ${placementClass}`, async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage();
    await page.route(`${origin}/__filled_picking__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__filled_picking__`);
    await page.evaluate(async placementClass => {
      const { createArtworkPicker } = await import('/src/public/ownerSystemWorkflow/artworkPicking.js');
      const root = document.getElementById('root'); root.style.cssText = 'position:absolute;left:20px;top:20px;width:200px;height:200px';
      const picker = window.filledPicker = createArtworkPicker();
      window.maskReads = 0;
      const read = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) { window.maskReads++; return read.apply(this, args); };
      window.restoreMaskProbe = () => { CanvasRenderingContext2D.prototype.getImageData = read; };
      window.pickHits = [];
      for (let i = 0; i < 33; i++) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
        const context = canvas.getContext('2d'); context.fillStyle = `rgb(${i * 7 % 255}, ${i * 11 % 255}, ${i * 13 % 255})`;
        context.fillRect(0, 0, i ? 32 : 128, i ? 32 : 128);
        const node = document.createElement('div'); node.className = placementClass; node.dataset.layer = i;
        node.style.cssText = `position:absolute;inset:0;z-index:${i}`;
        const image = new Image(); image.style.cssText = 'width:200px;height:200px;pointer-events:none'; image.src = canvas.toDataURL();
        node.append(image); root.append(node); await image.decode(); picker.prepare(image);
        node.addEventListener('pointerdown', event => picker.pick(event, root));
        node.addEventListener('click', event => pickHits.push(picker.pick(event, root)?.dataset.layer));
      }
    }, placementClass);
    await page.waitForFunction(() => maskReads >= 33);
    for (let i = 0; i < 5; i++) { await page.mouse.click(170, 170); await settle(page); }
    assert.deepEqual(await page.evaluate(() => pickHits), ['0', '0', '0', '0', '0']);
    await page.mouse.click(35, 35);
    assert.equal(await page.evaluate(() => pickHits.at(-1)), '32');
    await page.evaluate(() => { filledPicker.dispose(); restoreMaskProbe(); });
  } finally { await browser.close(); }
});

test('filled three-Grid Display preserves groups, stacking, transforms and crop across interaction and undo', { timeout: 120000 }, async () => {
  await mkdir('output/display-filled-audit', { recursive: true });
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountFilledDisplay(page, origin);
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const layers = page.getByRole('region', { name: 'Selection and layers inspector', exact: true });
    const select = index => page.locator(`[data-system-workflow-placement-id="filled-0-${index}"]`).focus().then(() => page.keyboard.press('Space'));
    const read = () => page.evaluate(() => filledDisplay.draft());
    const initial = await read();
    await select(1);
    await page.locator('[data-system-workflow-placement-id="filled-0-2"]').focus(); await page.keyboard.press('Shift+Space');
    await page.getByRole('button', { name: 'Group layers', exact: true }).click();
    const grouped = await read();
    assert.equal(grouped.grids[0].groups[0].placementIds.length, 2);
    assert.deepEqual(grouped.grids[0].placements, initial.grids[0].placements);
    await select(1); await page.keyboard.press('ArrowRight');
    const moved = await read();
    const delta = moved.grids[0].placements[1].column - grouped.grids[0].placements[1].column;
    assert.ok(delta > 0); assert.equal(moved.grids[0].placements[2].column - grouped.grids[0].placements[2].column, delta);
    await page.keyboard.press('Control+z'); assert.deepEqual(await read(), grouped);
    await page.getByRole('button', { name: 'Ungroup', exact: true }).click();
    await select(1);
    await page.getByRole('button', { name: 'Bring to front', exact: true }).click();
    assert.equal((await read()).grids[0].placements.find(item => item.id === 'filled-0-1').layer, 31);
    await page.keyboard.press('Control+z'); assert.deepEqual((await read()).grids[0].placements, initial.grids[0].placements);
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    assert.equal((await read()).grids[0].placements[1].transform.quarterTurns, 1);
    await page.keyboard.press('Control+z'); assert.deepEqual((await read()).grids[0].placements, initial.grids[0].placements);
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    const zoom = page.getByRole('slider', { name: 'Crop zoom' }); await zoom.focus(); await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.ok((await read()).grids[0].placements[1].crop.zoom > 1);
    await page.keyboard.press('Control+z'); assert.deepEqual((await read()).grids[0].placements, initial.grids[0].placements);
    await page.screenshot({ path: 'output/display-filled-audit/interactions-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/display-filled-audit/interactions-narrow.png' });
    assert.equal(await layers.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    assert.deepEqual((await read()).grids.filter(grid => ['grid:filled-1', 'grid:filled-2'].includes(grid.id)), initial.grids.slice(1).filter(grid => ['grid:filled-1', 'grid:filled-2'].includes(grid.id)));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('filled Display cancels abandoned selection resize on missed mouse release and hidden document', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await mountFilledDisplay(page, origin);
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const placement = page.locator('[data-system-workflow-placement-id="filled-0-1"]');
    await placement.focus(); await page.keyboard.press('Space'); await settle(page);
    const original = await page.evaluate(() => filledDisplay.draft());
    const before = await placement.boundingBox();
    for (const ending of ['released mouse', 'hidden document']) {
      await page.evaluate(() => {
        const handle = document.querySelector('[data-resize-corner="se"]'), box = handle.getBoundingClientRect();
        window.resizeOrigin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 71, pointerType: 'mouse', clientX: resizeOrigin.x, clientY: resizeOrigin.y }));
        dispatchEvent(new PointerEvent('pointermove', { buttons: 1, pointerId: 71, pointerType: 'mouse', clientX: resizeOrigin.x + 70, clientY: resizeOrigin.y + 70 }));
      }); await settle(page);
      assert.notDeepEqual(await placement.boundingBox(), before);
      await page.evaluate(ending => {
        if (ending === 'hidden document') {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
        } else dispatchEvent(new PointerEvent('pointermove', { buttons: 0, pointerId: 71, pointerType: 'mouse', clientX: resizeOrigin.x + 80, clientY: resizeOrigin.y + 80 }));
      }, ending); await settle(page);
      assert.deepEqual(await placement.boundingBox(), before, ending);
      await page.evaluate(() => {
        delete document.hidden;
        dispatchEvent(new PointerEvent('pointerup', { buttons: 0, pointerId: 71, pointerType: 'mouse', clientX: resizeOrigin.x + 80, clientY: resizeOrigin.y + 80 }));
      }); await settle(page);
      assert.deepEqual(await page.evaluate(() => filledDisplay.draft()), original);
    }
    // Movement uses the same gesture owner. Let actual pixel picking choose the
    // visible artwork at the overlap, then compare all placements after cancel.
    const bounds = () => page.locator('[data-system-workflow-placement-id]').evaluateAll(nodes => nodes.map(node => ({
      id: node.dataset.systemWorkflowPlacementId, box: node.getBoundingClientRect().toJSON(),
    })));
    const originalBounds = await bounds();
    await page.evaluate(() => {
      const top = document.querySelector('[data-system-workflow-placement-id="filled-0-31"]'), rect = top.getBoundingClientRect();
      window.moveOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      top.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, pointerId: 72, pointerType: 'mouse', clientX: moveOrigin.x, clientY: moveOrigin.y }));
      dispatchEvent(new PointerEvent('pointermove', { buttons: 1, pointerId: 72, pointerType: 'mouse', clientX: moveOrigin.x + 50, clientY: moveOrigin.y + 50 }));
    }); await settle(page);
    assert.notDeepEqual(await bounds(), originalBounds);
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { buttons: 0, pointerId: 72, pointerType: 'mouse', clientX: moveOrigin.x + 60, clientY: moveOrigin.y + 60 }))); await settle(page);
    assert.deepEqual(await bounds(), originalBounds);
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { buttons: 0, pointerId: 72, pointerType: 'mouse' }))); await settle(page);
    assert.deepEqual(await page.evaluate(() => filledDisplay.draft()), original);
  } finally { await browser.close(); }
});

test('filled animated SVG retains rectangular picking and transform/crop undo', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await mountFilledDisplay(page, origin, { svg: true });
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.getByRole('menuitem', { name: 'LAYERS', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const artwork = page.locator('[data-system-workflow-placement-id="filled-0-31"]');
    const frame = artwork.locator('iframe').first(); await frame.waitFor({ state: 'attached' });
    const outer = await (await frame.elementHandle()).contentFrame();
    const live = outer.childFrames()[0];
    assert.ok(live, 'animated SVG runtime exists');
    await live.waitForFunction(() => window.__filledSvgTicks > 2);
    const initialTicks = await live.evaluate(() => window.__filledSvgTicks);
    const read = () => page.evaluate(() => filledDisplay.draft().grids[0].placements.find(item => item.id === 'filled-0-31'));
    const initial = await read();
    // The fixture circle never covers this corner. Live SVG deliberately uses
    // its artwork rectangle; it must not inherit raster alpha pass-through.
    await artwork.click({ position: { x: 12, y: 12 } });
    assert.equal(await artwork.getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    assert.equal((await read()).transform.quarterTurns, (initial.transform.quarterTurns + 1) % 4);
    await page.keyboard.press('Control+z'); assert.deepEqual(await read(), initial);
    await page.getByRole('button', { name: 'Mirror horizontal', exact: true }).click();
    assert.equal((await read()).transform.mirrorX, !initial.transform.mirrorX);
    await page.keyboard.press('Control+z'); assert.deepEqual(await read(), initial);
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    const zoom = page.getByRole('slider', { name: 'Crop zoom' }); await zoom.focus(); await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.ok((await read()).crop.zoom > 1);
    await page.keyboard.press('Control+z'); assert.deepEqual(await read(), initial);
    assert.ok(await live.evaluate(() => window.__filledSvgTicks) > initialTicks, 'SVG animation survives interaction');
    await page.screenshot({ path: 'output/display-filled-audit/svg-interactions-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/display-filled-audit/svg-interactions-narrow.png' });
  } finally { await browser.close(); }
});
