import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

test('canvas move resize nudge marquee lock and keyboard selection use completed-operation commits', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByRole('slider', { name: 'Board zoom' }).fill('100');
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; }); });
    const abyssal = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await abyssal.click();
    const renderedCell = await page.locator('.system-workflow__canvas').evaluate((node) => {
      const logicalCell = Number.parseFloat(getComputedStyle(node).getPropertyValue('--world-cell-size'));
      return Math.round(logicalCell * node.getBoundingClientRect().width / node.offsetWidth);
    });
    const placementRect = await abyssal.boundingBox();
    assert.equal(await page.locator('.system-workflow__resize-handle').count(), 4);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-selection-1440x900.png') });

    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.mouse.move(placementRect.x + placementRect.width / 2, placementRect.y + placementRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(placementRect.x + placementRect.width / 2 + 45, placementRect.y + placementRect.height / 2, { steps: 4 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.ok(Math.abs(Math.round((await abyssal.boundingBox()).x - placementRect.x) - renderedCell) <= 1);

    await page.evaluate(() => { window.__workflowWrites = 0; });
    const southeast = page.getByRole('button', { name: 'Resize selection from se' });
    const handleRect = await southeast.boundingBox();
    const beforeResize = await abyssal.boundingBox();
    await page.mouse.move(handleRect.x + 4, handleRect.y + 4);
    await page.mouse.down();
    await page.mouse.move(handleRect.x + 49, handleRect.y + 49, { steps: 4 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.ok(Math.abs(Math.round((await abyssal.boundingBox()).width - beforeResize.width) - renderedCell) <= 1);

    await page.evaluate(() => { window.__workflowWrites = 0; });
    const beforeNudge = await abyssal.boundingBox();
    await abyssal.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.ok(Math.abs(Math.round((await abyssal.boundingBox()).x - beforeNudge.x) - renderedCell) <= 1);

    const mountain = page.getByRole('button', { name: /Select MOUNTAIN SIGNAL II/ });
    const first = await abyssal.boundingBox();
    const second = await mountain.boundingBox();
    await page.mouse.move(Math.min(first.x, second.x) - 8, Math.min(first.y, second.y) - 8);
    await page.mouse.down();
    await page.mouse.move(Math.max(first.x + first.width, second.x + second.width) + 8, Math.max(first.y + first.height, second.y + second.height) + 8, { steps: 5 });
    await page.mouse.up();
    assert.match(await page.locator('.system-workflow__layers-header strong').textContent(), /2 SELECTED/);
    assert.equal(await page.locator('.system-workflow__selection-chrome').getAttribute('data-group'), 'true');

    await abyssal.click();
    await mountain.click({ modifiers: ['Shift'] });
    assert.match(await page.locator('.system-workflow__layers-header strong').textContent(), /2 SELECTED/, 'Shift-click adds a Grid placement');
    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), 4);
    assert.equal(await page.locator('.system-workflow__layer-row[data-selected]').count(), 2, 'duplicated group becomes selected');
    const selectedDuplicateRow = page.locator('.system-workflow__layer-row[data-selected]').first();
    await selectedDuplicateRow.getByRole('button', { name: /Remove .* from Grid/ }).click();
    const groupRemoval = page.getByRole('alertdialog', { name: 'Remove selected placements from Grid' });
    assert.match(await groupRemoval.innerText(), /Remove 2 selected/i);
    await groupRemoval.getByRole('button', { name: /^Remove$/i }).click();
    assert.equal(await page.locator('.system-workflow__placement').count(), 2);
    assert.equal(await page.locator('.system-workflow__selection-chrome').getAttribute('data-selected'), null);

    await abyssal.click();
    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.getByRole('button', { name: 'Lock ABYSSAL STUDY', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await abyssal.getAttribute('data-locked'), 'true');
    assert.equal(await abyssal.evaluate((node) => getComputedStyle(node).pointerEvents), 'none');
    assert.equal(await page.locator('.system-workflow__selection-chrome').getAttribute('data-selected'), null);
    assert.equal(await page.locator('.system-workflow__placement-label').count(), 0);
    assert.equal(await page.locator('.system-workflow__canvas > h1').count(), 0);
    await page.getByRole('button', { name: 'Unlock ABYSSAL STUDY', exact: true }).click();

    const canvas = page.locator('.system-workflow__canvas');
    const canvasRect = await canvas.boundingBox();
    await page.mouse.click(canvasRect.x + canvasRect.width - 20, canvasRect.y + 20);
    const idleInspector = page.getByRole('complementary', { name: 'Selection and layers inspector' });
    assert.equal(await idleInspector.count(), 1, 'Layers remains reachable without a Grid selection');
    assert.equal(await idleInspector.getByRole('navigation', { name: 'Selection actions' }).count(), 0, 'selection tools disappear without a Grid selection');
    assert.equal(await idleInspector.locator('.system-workflow__layer-row').count(), 2);

    await abyssal.focus();
    await page.keyboard.press('Enter');
    assert.equal(await abyssal.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.lattice-focus-viewer').count(), 0);
    assert.equal(await abyssal.evaluate((node) => node === document.activeElement), true);
  } finally {
    await browser.close();
  }
});

test('selection chrome never paints a stroke over an artwork edge', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    assert.equal(await page.locator('.system-workflow__selection-outline').count(), 0);
    const chrome = page.locator('.system-workflow__selection-chrome');
    assert.equal(await chrome.locator('.system-workflow__resize-handle').count(), 4);
    assert.equal(await chrome.evaluate((node) => node.parentElement?.classList.contains('system-workflow__stage-viewport')), true);
  } finally {
    await browser.close();
  }
});
