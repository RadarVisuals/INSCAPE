import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { hideWorkspaceSidebar } from './fixtures/workspace-sidebar.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/canvas-crop';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const saved = page => page.evaluate(() => canvasSaved());
const imageAt = (page, index) => page.locator('.image-module__window').nth(index);
const visibleHit = (page, x, y) => page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.image-module__window')), { x, y });
async function mount(page, query = '') {
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 32; const ctx = c.getContext('2d'); ctx.fillStyle = '#e83e3e'; ctx.fillRect(0, 0, 32, 32); return c.toDataURL().split(',')[1]; });
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://assets.example/crop-proof.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
  await page.route('https://assets.example/crop-proof.svg', route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#e83e3e"/><circle cx="512" cy="512" r="300" fill="#ffd166"/></svg>' }));
  await page.goto(`${origin}/browser-tests/workbench-canvas-crop-fixture.html${query}`);
  await imageAt(page, 0).waitFor();
  await page.locator('[data-media-state="ready"]').first().waitFor();
  await imageAt(page, 0).locator('.artwork-svg-status').waitFor({ state: 'detached' });
  await hideWorkspaceSidebar(page);
}
async function overview(page, belowToolbar = false) {
  const host = page.locator('main.system-workflow').first();
  for (let i = 0; i < 7; i++) await host.dispatchEvent('wheel', { ctrlKey: true, deltaY: 120, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
  await settle(page);
  assert.equal(await host.getAttribute('data-workbench-camera-scale'), '0.25', 'the crop fixture starts at quarter scale');
  if (belowToolbar) {
    // Keep the original quarter-scale hit and marquee probes below fixed
    // workspace chrome, using the same ordinary camera pan as the user.
    await host.dispatchEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true });
    await settle(page);
  }
}
async function controls(page) {
  const trigger = page.getByRole('button', { name: 'Canvas size', exact: true });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
}
async function size(page, width, height) {
  await controls(page);
  for (const [axis, value, label] of [['width', width, 'Resize canvas width'], ['height', height, 'Resize canvas height']]) {
    const current = (await saved(page)).workbench.area[axis];
    const handle = page.getByRole('button', { name: label, exact: true });
    await handle.focus();
    const key = axis === 'width' ? value < current ? 'ArrowLeft' : 'ArrowRight' : value < current ? 'ArrowUp' : 'ArrowDown';
    for (let n = 0; n < Math.floor(Math.abs(value - current) / 100); n++) await page.keyboard.press(`Shift+${key}`);
    for (let n = 0; n < Math.abs(value - current) % 100 / 10; n++) await page.keyboard.press(key);
  }
  await settle(page);
}

for (const width of [1440, 390]) test(`typed canvas dimensions save together, preserve origin and support undo (${width}px)`, { timeout: 90000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mount(page, '?edges'); await controls(page);
    await page.getByRole('button', { name: 'Fit canvas to content', exact: true }).click(); await settle(page);
    const before = await saved(page), original = before.workbench.area;
    const popup = page.getByRole('group', { name: 'Canvas size controls' });
    const field = axis => popup.getByRole('spinbutton', { name: `${axis} (px)` });
    const apply = popup.getByRole('button', { name: 'Apply', exact: true });
    assert.equal(original.left, 60); assert.equal(original.top, 60);
    assert.equal(await field('Width').inputValue(), String(original.width));
    assert.equal(await field('Height').inputValue(), String(original.height));
    assert.equal(await apply.isDisabled(), true);
    for (const invalid of ['', '0', '12.5', '16385', '16384']) {
      await field('Width').fill(invalid); await apply.click();
      assert.match(await popup.getByRole('alert').innerText(), /whole pixels/);
      assert.deepEqual(await saved(page), before, 'invalid input cannot change saved content or dimensions');
    }
    await field('Width').fill('1920'); await field('Height').fill('1080');
    assert.deepEqual(await saved(page), before, 'typing and moving between fields do not save early');
    await field('Height').press('Enter'); await settle(page);
    const expected = { ...original, width: 1920, height: 1080 }, after = await saved(page);
    assert.deepEqual(after.workbench.area, expected);
    assert.deepEqual(after.imageModules, before.imageModules); assert.deepEqual(after.shapes, before.shapes);
    assert.deepEqual(after.workbench.imageModules, before.workbench.imageModules);
    assert.deepEqual(after.workbench.shapes, before.workbench.shapes);
    assert.equal(await field('Height').evaluate(node => node === document.activeElement), true, 'applying keeps keyboard focus');
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    await page.keyboard.press('Control+z'); await settle(page);
    assert.deepEqual((await saved(page)).workbench.area, original, 'one undo restores both dimensions');
    await page.keyboard.press('Control+Shift+z'); await settle(page);
    assert.deepEqual((await saved(page)).workbench.area, expected);
    await controls(page); await field('Width').fill('3333'); await field('Width').press('Escape');
    await controls(page);
    assert.equal(await field('Width').inputValue(), '1920', 'closing discards unfinished input');
    await field('Width').fill('3333');
    await popup.getByRole('button', { name: 'Fit canvas to content', exact: true }).click(); await settle(page);
    assert.equal(await field('Width').inputValue(), String(original.width), 'another resize replaces stale field input');
    await field('Width').fill('2223'); await field('Height').fill('1429'); await apply.click(); await settle(page);
    await page.reload(); await imageAt(page, 0).waitFor(); await controls(page);
    assert.equal(await field('Width').inputValue(), '2223'); assert.equal(await field('Height').inputValue(), '1429');
    assert.deepEqual(await page.evaluate(() => canvasDocument().workbench.area), { ...original, width: 2223, height: 1429 });
    await popup.screenshot({ path: join(output, `numeric-size-${width}.png`) });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`canvas crops without loss; outside editing, restore and Visitor agree (${width}px)`, { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: width === 390 ? 1.25 : 1, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(8000);
  try {
    await mount(page);
    await overview(page, true);
    const before = await saved(page);
    assert.equal(await visibleHit(page, 90, 180), true, 'image initially extends through the future boundary');
    await controls(page);
    const edge = page.getByRole('button', { name: 'Resize canvas width', exact: true });
    let handle = await edge.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 20, handle.y + handle.height / 2, { steps: 4 });
    assert.equal((await saved(page)).workbench.area.width, 800, 'pointer preview does not save early');
    await page.mouse.up(); await settle(page);
    assert.equal((await saved(page)).workbench.area.width, 720, 'pointer release commits the crop');
    handle = await edge.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 20, handle.y + handle.height / 2, { steps: 4 });
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.equal((await saved(page)).workbench.area.width, 720, 'Escape cancels a live crop');
    await size(page, 800, 650);
    await size(page, 320, 300);
    await page.screenshot({ path: join(output, `controls-${width}.png`) });
    const cropped = await saved(page);
    assert.deepEqual(cropped.imageModules, before.imageModules, 'canvas shrink preserves source, size, fit and transforms');
    assert.deepEqual(cropped.workbench.imageModules, before.workbench.imageModules, 'canvas shrink preserves every authored Image position');
    assert.deepEqual(cropped.shapes, before.shapes);
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    assert.equal(await visibleHit(page, 75, 180), true, 'inside portion remains interactive');
    assert.equal(await visibleHit(page, 90, 180), false, 'outside portion is clipped and cannot be clicked');
    await page.keyboard.press('Control+z'); await settle(page);
    assert.equal((await saved(page)).workbench.area.height, 310, 'canvas resize participates in undo');
    await page.keyboard.press('Control+Shift+z'); await settle(page);
    assert.equal((await saved(page)).workbench.area.height, 300, 'redo restores the crop');
    await page.mouse.move(150, 150); await page.mouse.down();
    await page.mouse.move(210, 220, { steps: 4 }); await page.mouse.up();
    assert.equal(await page.locator('.workbench-selection').count(), 0, 'marquee cannot select fully clipped artwork');
    // A live SVG remains in its source DOM during inspection; the canvas
    // clipping ancestor must not trap it behind the full-screen backdrop.
    await imageAt(page, 0).locator('.image-module__canvas').focus(); await page.keyboard.press('i');
    await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.image-lift')?.style.getPropertyValue('--inspection-lift-progress') === '1');
    assert.equal(await page.locator('.workbench-canvas-content').evaluate(node => getComputedStyle(node).display), 'contents');
    await page.screenshot({ path: join(output, `svg-inspection-${width}.png`) });
    await page.getByRole('button', { name: 'Return to Image', exact: true }).click();
    await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor({ state: 'detached' });
    assert.notEqual(await page.locator('.workbench-canvas-content').evaluate(node => getComputedStyle(node).clipPath), 'none');
    assert.equal(await visibleHit(page, 90, 180), false, 'inspection return reinstates cropping');
    await page.screenshot({ path: join(output, `clipped-${width}.png`) });
    await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('100');
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click(); await settle(page);
    // Zooming around the viewport centre can briefly unload an offscreen SVG.
    // Wait for its existing document lifecycle before checking painted pixels.
    await imageAt(page, 0).locator('iframe.artwork-svg-document').waitFor({ state: 'attached' });
    await imageAt(page, 0).locator('.artwork-svg-status').waitFor({ state: 'detached' }); await settle(page);
    const screenshot = await page.screenshot({ path: join(output, `clipped-detail-${width}.png`) });
    const painted = await page.evaluate(async data => {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixel = (x, y) => [...ctx.getImageData(Math.floor(x * devicePixelRatio), Math.floor(y * devicePixelRatio), 1, 1).data];
      return { svg: pixel(140, 140), outside: pixel(350, 200) };
    }, screenshot.toString('base64'));
    assert.ok(painted.svg[0] > 230 && painted.svg[1] > 170 && painted.svg[2] < 140, 'live SVG paints after inspection and zoom');
    assert.deepEqual(painted.outside, [36, 38, 38, 255], 'cropped raster pixels do not leak outside the canvas');
    await overview(page, true);
    await controls(page);
    await page.getByRole('button', { name: 'Show outside canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    assert.equal(await visibleHit(page, 90, 180), true, 'outside content can be reached explicitly');
    await page.screenshot({ path: join(output, `outside-${width}.png`) });
    const second = imageAt(page, 1);
    const box = await second.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 30, { steps: 4 }); await page.mouse.up(); await settle(page);
    await page.waitForFunction(() => canvasLayout().imageModules[1].position.left > 320);
    const moved = await saved(page);
    assert.ok((await page.evaluate(() => canvasLayout())).imageModules[1].position.left > 320, 'moving an existing outlier does not snap into canvas');
    assert.deepEqual(moved.imageModules, cropped.imageModules, 'moving changes no source pixels or authored dimensions');
    await size(page, 800, 650);
    await page.getByRole('button', { name: 'Show outside canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    const thirdImagePoint = [180, 190];
    assert.equal(await visibleHit(page, ...thirdImagePoint), true, 'enlarging recovers the fully hidden third Image');
    await size(page, 320, 300);
    await page.reload(); await imageAt(page, 0).waitFor(); await overview(page, true);
    assert.equal(await visibleHit(page, ...thirdImagePoint), false, 'reload keeps clipping, outside visibility is session-only');
    const document = await page.evaluate(() => canvasDocument());
    assert.equal(document.imageModules.length, 3, 'public projection retains public source references non-destructively');
    const preserved = await saved(page);
    await page.goto(`${origin}/browser-tests/workbench-canvas-crop-fixture.html?visitor`);
    await imageAt(page, 0).waitFor(); await overview(page, true);
    assert.equal(await visibleHit(page, ...thirdImagePoint), false, 'Visitor uses the same crop');
    assert.equal(await page.getByRole('button', { name: 'Show outside canvas', exact: true }).count(), 0, 'Visitor has no editing recovery mode');
    await page.getByRole('button', { name: 'Crop group', exact: true }).click();
    await page.getByRole('group', { name: 'Open Workbench group', exact: true }).waitFor();
    assert.equal(await page.locator('.workbench-canvas-content').evaluate(node => getComputedStyle(node).display), 'contents', 'explicit group reading reveals its temporary layout');
    await page.getByRole('group', { name: 'Open Workbench group', exact: true }).getByRole('button', { name: 'Back', exact: true }).click();
    await settle(page);
    assert.notEqual(await page.locator('.workbench-canvas-content').evaluate(node => getComputedStyle(node).clipPath), 'none', 'returning from a group restores canvas clipping');
    assert.deepEqual(await saved(page), preserved, 'Visitor changes no local draft');
    await page.screenshot({ path: join(output, `visitor-${width}.png`) });
    assert.deepEqual(errors, []);
    await writeFile(join(output, `evidence-${width}.json`), JSON.stringify({ before: before.workbench.area, after: preserved.workbench.area, images: document.imageModules.length, painted, errors }, null, 2));
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`Fit has no padding; all canvas edges and corners preserve artwork (${width}px)`, { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: width === 390 ? 1.25 : 1, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(8000);
  try {
    await mount(page, '?edges'); await overview(page);
    await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaX: -40, deltaY: -120, bubbles: true, cancelable: true });
    await settle(page);
    const before = await saved(page);
    const exact = { left: 60, top: 60, width: 720, height: 484 };
    const fit = async () => {
      await controls(page); await page.getByRole('button', { name: 'Fit canvas to content', exact: true }).click(); await settle(page);
      assert.deepEqual((await saved(page)).workbench.area, exact, 'all four edges hug content without padding');
    };
    await fit();
    assert.equal(await page.locator('.workbench-canvas-edge').count(), 8);
    const projection = () => page.locator('.workbench-canvas-content').evaluate(node => Object.fromEntries(
      ['left', 'top', 'width', 'height'].map(key => [key, parseFloat(node.style.getPropertyValue(`--canvas-${key}`))])));
    assert.deepEqual(await projection(), { left: 55, top: 135, width: 180, height: 121 }, 'clip uses the authored origin and camera together');
    await page.screenshot({ path: join(output, `fit-exact-${width}.png`) });
    const gestures = [];
    for (const edge of ['w', 'n', 'e', 's', 'nw', 'ne', 'sw', 'se']) {
      const deltas = edge.length === 2 ? [[12, 0], [0, 10], [-24, -24]] : edge === 'w' || edge === 'e' ? [[12, 0]] : [[0, 10]];
      for (const [dx, dy] of deltas) {
        await fit();
        const handle = page.locator(`.workbench-canvas-edge.is-${edge}`), box = await handle.boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 4 });
        assert.deepEqual((await saved(page)).workbench.area, exact, 'drag preview does not persist early');
        await page.mouse.up(); await settle(page);
        const area = (await saved(page)).workbench.area;
        assert.equal(area.left, edge.includes('w') ? 60 + dx * 4 : 60, edge);
        assert.equal(area.top, edge.includes('n') ? 60 + dy * 4 : 60, edge);
        assert.equal(area.left + area.width, edge.includes('e') ? 780 + dx * 4 : 780, edge);
        assert.equal(area.top + area.height, edge.includes('s') ? 544 + dy * 4 : 544, edge);
        assert.deepEqual(await projection(), { left: 40 + area.left / 4, top: 120 + area.top / 4,
          width: area.width / 4, height: area.height / 4 }, 'clipping follows the origin even when it crosses world zero');
        gestures.push({ edge, dx, dy, area });
      }
    }
    await fit();
    const corner = page.locator('.workbench-canvas-edge.is-nw'), box = await corner.boundingBox();
    await page.mouse.move(box.x + 14, box.y + 14); await page.mouse.down();
    await page.mouse.move(box.x - 6, box.y - 6, { steps: 4 });
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual((await saved(page)).workbench.area, exact, 'Escape restores position as well as dimensions');
    const leftHandle = page.getByRole('button', { name: 'Resize canvas from left', exact: true });
    await leftHandle.focus(); await leftHandle.press('Alt+ArrowRight'); await settle(page);
    const changed = { ...exact, left: 61, width: 719 };
    assert.deepEqual((await saved(page)).workbench.area, changed, 'Alt permits a one-work-pixel edge adjustment');
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    await page.keyboard.press('Control+z'); await settle(page); assert.deepEqual((await saved(page)).workbench.area, exact);
    await page.keyboard.press('Control+Shift+z'); await settle(page); assert.deepEqual((await saved(page)).workbench.area, changed);
    const after = await saved(page);
    assert.deepEqual(after.imageModules, before.imageModules); assert.deepEqual(after.shapes, before.shapes);
    assert.deepEqual(after.workbench.imageModules, before.workbench.imageModules);
    assert.deepEqual(after.workbench.shapes, before.workbench.shapes, 'canvas edits never reposition the artwork');
    await page.reload(); await imageAt(page, 0).waitFor(); await overview(page);
    assert.deepEqual((await saved(page)).workbench.area, changed);
    assert.deepEqual(await page.evaluate(() => canvasDocument().workbench.area), changed, 'public projection preserves the origin');
    await page.goto(`${origin}/browser-tests/workbench-canvas-crop-fixture.html?edges&visitor`);
    await imageAt(page, 0).waitFor(); await overview(page);
    assert.deepEqual(await projection(), { left: 15.25, top: 15, width: 179.75, height: 121 }, 'Visitor restores the exact shifted boundary');
    assert.deepEqual(await saved(page), after);
    await page.screenshot({ path: join(output, `fit-visitor-${width}.png`) });
    assert.deepEqual(errors, []);
    await writeFile(join(output, `fit-edges-${width}.json`), JSON.stringify({ exact, gestures, restored: changed, errors }, null, 2));
  } finally { await browser.close(); }
});
