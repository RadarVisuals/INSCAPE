import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const URL = `${ROOT}/development/owner/system-workflow`;
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;
const settle = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => {})));
});

async function routeSquareArtwork(page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2000;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0030ff'; ctx.fillRect(0, 0, 2000, 2000);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(600, 600, 800, 800);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.route('**/assets/{actors/abyssal_eye/full,stage/mountains/mountain_02}.webp', route =>
    route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
}

async function paintedSourceMark(page, placement) {
  const png = await placement.screenshot();
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let left = Infinity, right = -1, top = Infinity, bottom = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (pixels[i] > 200 && pixels[i + 1] < 50 && pixels[i + 2] < 50) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
  }, png.toString('base64'));
}

test('crop Done, Cancel, outside completion and Native Fit remain distinct canonical outcomes', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', (route) => new globalThis.URL(route.request().url()).origin === ROOT ? route.continue() : route.abort());
    await routeSquareArtwork(page);
    const start = async (name = 'ABYSSAL STUDY') => {
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__workflowWrites += 1; }); });
      const placement = page.getByRole('button', { name: new RegExp(`Select ${name}`) });
      await placement.focus(); await placement.press('Space');
      await page.getByRole('button', { name: 'Crop', exact: true }).click();
      await page.locator('.system-workflow__crop-controls').waitFor();
      return placement;
    };

    let placement = await start();
    await page.getByLabel('Crop zoom').fill('1.5');
    const imageBeforePan = await placement.locator('img:last-child').getAttribute('style');
    const box = await placement.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    assert.notEqual(await placement.locator('img:last-child').getAttribute('style'), imageBeforePan);
    assert.equal(await page.evaluate(() => window.__workflowWrites), 0);
    assert.equal(await placement.evaluate((node) => getComputedStyle(node).outlineWidth), '1px');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-crop-1440x900.png') });
    await page.getByRole('button', { name: /^Done$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await placement.getAttribute('data-cropped'), 'true');

    placement = await start();
    await page.getByLabel('Crop zoom').fill('1.6');
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 0);
    assert.equal(await placement.getAttribute('data-cropped'), null);

    placement = await start();
    await page.getByLabel('Crop zoom').fill('1.7');
    await page.mouse.click(18, 300);
    await page.locator('.system-workflow__crop-controls').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await placement.getAttribute('data-cropped'), 'true');
    assert.equal(await page.locator('.system-workflow__selection-chrome').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.system-workflow__resize-handle').first().isDisabled(), true);

    placement = await start('MOUNTAIN SIGNAL II');
    await page.getByRole('button', { name: /^Native fit$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await placement.getAttribute('data-cropped'), null);
    const nativeMark = await paintedSourceMark(page, placement);
    const placementBox = await placement.boundingBox();
    assert.ok(nativeMark, 'the source mark is visibly painted');
    assert.ok(Math.abs(nativeMark.width - nativeMark.height) <= 1,
      `Native Fit preserves the square source mark: ${JSON.stringify(nativeMark)}`);
    assert.ok(Math.abs(nativeMark.width - placementBox.height * .4) <= 1,
      'Native Fit contains the complete source at the placement height');
    assert.ok(Math.abs(nativeMark.left + nativeMark.width / 2 - placementBox.width / 2) <= 1,
      'Native Fit centres the source horizontally');
  } finally {
    await browser.close();
  }
});

test('crop keyboard nudge and placement resize preview before separate completions', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', (route) => new globalThis.URL(route.request().url()).origin === ROOT ? route.continue() : route.abort());
    await routeSquareArtwork(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__workflowWrites += 1; }); });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    await page.getByLabel('Crop zoom').fill('1.5');
    const beforeNudge = await placement.locator('img:last-child').getAttribute('style');
    await placement.focus();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await placement.locator('img:last-child').getAttribute('style'), beforeNudge);
    assert.equal(await page.evaluate(() => window.__workflowWrites), 0);
    await settle(page);
    const imageBeforeResize = await paintedSourceMark(page, placement);
    assert.ok(imageBeforeResize, 'cropped source mark is visibly painted before resize');
    const placementBeforeResize = await placement.boundingBox();
    const handle = page.getByRole('button', { name: 'Resize selection from se' });
    const handleRect = await handle.boundingBox();
    await page.mouse.move(handleRect.x + handleRect.width / 2, handleRect.y + handleRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + handleRect.width / 2 + 45, handleRect.y + handleRect.height / 2 + 45, { steps: 4 });
    await page.mouse.up();
    await settle(page);
    const imageAfterResize = await paintedSourceMark(page, placement);
    assert.ok(imageAfterResize, 'cropped source mark remains visibly painted after resize');
    assert.ok((await placement.boundingBox()).width > placementBeforeResize.width, 'crop resize changes the clipping area');
    assert.ok(Math.abs(imageAfterResize.width - imageBeforeResize.width) <= 1, 'crop handles preserve painted source width');
    assert.ok(Math.abs(imageAfterResize.height - imageBeforeResize.height) <= 1, 'crop handles preserve painted source height');
    assert.equal(await page.getByLabel('Crop zoom').inputValue(), '1.5', 'crop handles leave the explicit zoom control untouched');
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1, 'resize is one completed canonical operation');
    await page.getByRole('button', { name: /^Done$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 2, 'crop completion is one separate canonical operation');
  } finally {
    await browser.close();
  }
});
