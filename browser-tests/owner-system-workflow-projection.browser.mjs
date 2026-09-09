import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;
const VIEWPORTS = [[1440, 900], [1920, 1080], [2560, 1440], [1080, 950], [390, 720]];

const roundedRect = (rect) => Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value * 10) / 10 : value]));
const assertRectClose = (actual, expected) => {
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'number') assert.ok(Math.abs(actual[key] - value) <= 1, `${key}: expected ${value}, received ${actual[key]}`);
    else assert.equal(actual[key], value);
  }
};

test('review Grid fills the usable viewport while retaining one canonical 32 by 18 reference scale', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${ROOT}/development/owner/system-workflow`, { waitUntil: 'networkidle' });
    const inspect = async () => ({
      stage: roundedRect(await page.locator('.system-workflow__stage').boundingBox()),
      artboard: roundedRect(await page.locator('.system-workflow__canvas').boundingBox()),
      placements: (await page.locator('.system-workflow__placement').evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { label: node.getAttribute('aria-label'), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }))).map(roundedRect),
    });
    const ledger = [];
    for (const [width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      const expectedLayout = width <= 760 ? 'narrow' : width <= 1100 ? 'compact' : 'wide';
      await page.locator('.system-workflow').waitFor({ state: 'visible' });
      await page.waitForFunction((layout) => document.querySelector('.system-workflow')?.dataset.layout === layout, expectedLayout);
      const actual = await inspect();
      const dockHeight = await page.locator('.system-workflow').evaluate((node) =>
        Number.parseFloat(getComputedStyle(node).getPropertyValue('--workflow-dock-height')));
      const stageHeight = height - dockHeight;
      const cellSize = Math.min(width / 32, stageHeight / 18);
      const reference = roundedRect({
        x: (width - cellSize * 32) / 2,
        y: (stageHeight - cellSize * 18) / 2,
        width: cellSize * 32,
        height: cellSize * 18,
      });
      assert.deepEqual(actual.stage, { x: 0, y: 0, width, height: stageHeight });
      assert.deepEqual(actual.artboard, actual.stage);
      const expectedPlacements = [
        roundedRect({ label: 'Select ABYSSAL STUDY', x: reference.x + cellSize * 15, y: reference.y + cellSize * 4, width: cellSize * 4, height: cellSize * 4 }),
        roundedRect({ label: 'Select MOUNTAIN SIGNAL II', x: reference.x + cellSize * 20, y: reference.y + cellSize * 9, width: cellSize * 5, height: cellSize * 3 }),
      ];
      actual.placements.forEach((placement, index) => assertRectClose(placement, expectedPlacements[index]));
      ledger.push({
        viewport: { width, height },
        ...actual,
        reference,
        viewportMatte: { top: 0, right: 0, bottom: 0, left: 0 },
        interactionBounds: actual.stage,
      });
      if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, `review-artboard-${width}x${height}.png`) });
    }
    assert.ok(await page.locator('.system-workflow__placement').nth(1).locator('img').evaluate((image) => image.naturalWidth > 1 && image.naturalHeight > 1));
    if (SCREENSHOT_DIR) await writeFile(resolve(SCREENSHOT_DIR, 'review-artboard-geometry.json'), JSON.stringify(ledger, null, 2));

  } finally {
    await browser.close();
  }
});
