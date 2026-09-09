import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const URL = `${ROOT}/development/owner/system-workflow`;
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

test('crop Done, Cancel, outside completion and Native Fit remain distinct canonical outcomes', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const start = async (name = 'ABYSSAL STUDY') => {
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; }); });
      const placement = page.getByRole('button', { name: new RegExp(`Select ${name}`) });
      await placement.click();
      await page.getByRole('button', { name: 'Crop', exact: true }).click();
      await page.getByRole('region', { name: 'Crop controls' }).waitFor();
      return placement;
    };

    let placement = await start();
    await page.getByLabel('Crop zoom').fill('1.5');
    const imageBeforePan = await placement.locator('img').getAttribute('style');
    const box = await placement.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    assert.notEqual(await placement.locator('img').getAttribute('style'), imageBeforePan);
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
    await page.getByRole('region', { name: 'Crop controls' }).waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await placement.getAttribute('data-cropped'), 'true');
    assert.equal(await page.locator('.system-workflow__selection-chrome').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.system-workflow__resize-handle').first().isDisabled(), true);

    placement = await start('MOUNTAIN SIGNAL II');
    await page.getByRole('button', { name: /^Native fit$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await placement.getAttribute('data-cropped'), null);
    const nativeImageBox = await placement.locator('img').boundingBox();
    assert.ok(Math.abs(nativeImageBox.width / nativeImageBox.height - 1) < 0.01,
      'Native Fit restores the square Mountain Signal source without stretching it wide');
  } finally {
    await browser.close();
  }
});

test('crop keyboard nudge and placement resize preview before separate completions', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; }); });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    await page.getByLabel('Crop zoom').fill('1.5');
    const beforeNudge = await placement.locator('img').getAttribute('style');
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await placement.locator('img').getAttribute('style'), beforeNudge);
    assert.equal(await page.evaluate(() => window.__workflowWrites), 0);
    const imageBeforeResize = await placement.locator('img').boundingBox();
    const handle = page.getByRole('button', { name: 'Resize selection from se' });
    const handleRect = await handle.boundingBox();
    await page.mouse.move(handleRect.x + 4, handleRect.y + 4);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 49, handleRect.y + 49, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(({ height, width }) => {
      const image = document.querySelector('[aria-label^="Select ABYSSAL STUDY"] img');
      if (!image) return false;
      const rectangle = image.getBoundingClientRect();
      return Math.abs(rectangle.width - width) < 1 && Math.abs(rectangle.height - height) < 1;
    }, imageBeforeResize);
    const imageAfterResize = await placement.locator('img').boundingBox();
    assert.ok(Math.abs(imageAfterResize.width - imageBeforeResize.width) < 1, 'crop handles preserve rendered image width');
    assert.ok(Math.abs(imageAfterResize.height - imageBeforeResize.height) < 1, 'crop handles preserve rendered image height');
    assert.equal(await page.getByLabel('Crop zoom').inputValue(), '1.5', 'crop handles leave the explicit zoom control untouched');
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1, 'resize is one completed canonical operation');
    await page.getByRole('button', { name: /^Done$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 2, 'crop completion is one separate canonical operation');
  } finally {
    await browser.close();
  }
});
