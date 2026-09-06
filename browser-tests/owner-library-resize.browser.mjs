import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const screenshots = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR;

test('Library resizes with inset scrolling, accessible controls, and retained state', async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    if (screenshots) await mkdir(screenshots, { recursive: true });
    const page = await browser.newPage();
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${root}/development/owner/system-workflow`, { waitUntil: 'networkidle' });
      const initialBoard = await page.getByRole('article', { name: 'Display Module', exact: true }).boundingBox();
      await page.mouse.move(initialBoard.x + 25, initialBoard.y + 15);
      await page.mouse.down();
      await page.mouse.move(545, initialBoard.y + 15, { steps: 8 });
      await page.mouse.up();
      const trigger = page.getByRole('button', { name: 'Library', exact: true });
      await trigger.click();
      const library = page.getByRole('region', { name: 'Library workspace' });
      await page.waitForFunction(() => document.querySelector('[aria-label="Library workspace"]')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
      const original = await library.boundingBox();
      const handle = library.getByRole('button', { name: 'Resize Library', exact: true });
      const edge = await handle.boundingBox();
      await page.mouse.move(edge.x + edge.width / 2, edge.y + 100);
      await page.mouse.down();
      await page.mouse.move(edge.x - 195 + edge.width / 2, edge.y + 100, { steps: 8 });
      await page.mouse.up();
      const smaller = await library.boundingBox();
      assert.ok(Math.abs(smaller.width - (original.width - 195)) < 1);
      assert.deepEqual([smaller.x, smaller.y, smaller.height], [0, 0, original.height]);
      await handle.focus();
      await handle.press('Home');
      assert.equal((await library.boundingBox()).width, 480);
      await page.mouse.click(width - 30, 50);
      await page.waitForTimeout(350);
      assert.equal(await library.isVisible(), true, 'outside clicks keep Library open');
      const board = page.getByRole('article', { name: 'Display Module', exact: true });
      const boardBounds = await board.boundingBox();
      await page.mouse.move(Math.max(490, boardBounds.x + 35), boardBounds.y + 15);
      await page.mouse.down();
      await page.mouse.move(Math.max(490, boardBounds.x + 35) + 45, boardBounds.y + 55, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(350);
      assert.equal(await library.isVisible(), true, 'Display Module interactions keep Library open');
      assert.notDeepEqual(await board.boundingBox(), boardBounds, 'the Display Module actually moves while Library stays open');
      const layersToggle = page.getByRole('button', { name: /^(Open|Close) Layers window$/ });
      const layersBefore = await layersToggle.getAttribute('aria-pressed');
      await layersToggle.click();
      assert.equal(await library.isVisible(), true, 'Layers can be used alongside Library');
      assert.notEqual(await layersToggle.getAttribute('aria-pressed'), layersBefore);
      await layersToggle.click();
      const containment = await library.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const dock = document.querySelector('.system-workflow__global-bar').getBoundingClientRect();
        const controls = [...node.querySelectorAll('.system-workflow__workspace-rail-controls > *')];
        return { gutter: dock.top - box.bottom, controlsFit: controls.every((control) => {
          const rect = control.getBoundingClientRect(); return rect.left >= box.left && rect.right <= box.right;
        }), bodyFits: node.scrollWidth <= node.clientWidth };
      });
      assert.deepEqual(containment, { gutter: 0, controlsFit: true, bodyFits: true });
      const scrolling = library.locator('.lattice-browser-results');
      await scrolling.evaluate((node) => { node.scrollTop = 150; });
      const safeSpace = await scrolling.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const panel = node.closest('.lattice-browser-panel').getBoundingClientRect();
        return [rect.top - panel.top, panel.bottom - rect.bottom];
      });
      assert.deepEqual(safeSpace, [10, 10], 'scroll clipping remains inset even between cards');
      if (screenshots) await page.screenshot({ path: resolve(screenshots, `library-scrolling-${width}.png`) });
      const scrollTop = await scrolling.evaluate((node) => node.scrollTop);
      await library.getByRole('button', { name: 'Close workspace' }).click();
      await page.waitForTimeout(400);
      await trigger.click();
      await page.waitForTimeout(400);
      assert.equal(await scrolling.evaluate((node) => node.scrollTop), scrollTop, 'reopening retains scroll position');
      await library.getByRole('button', { name: 'PORTFOLIO', exact: true }).click();
      await library.getByRole('button', { name: 'Close workspace' }).click();
      await page.waitForTimeout(400);
      await trigger.click();
      await page.waitForTimeout(400);
      assert.equal(await library.getByRole('button', { name: 'PORTFOLIO', exact: true }).getAttribute('aria-pressed'), 'true');
      await library.getByRole('button', { name: 'All Assets', exact: true }).click();
      await library.getByLabel('Search', { exact: true }).fill('ZEBRA');
      await page.waitForFunction(() => document.querySelectorAll('.system-workflow__library .lattice-browser-asset').length === 1);
      if (screenshots) await page.screenshot({ path: resolve(screenshots, `library-minimum-${width}.png`) });
      await library.getByRole('button', { name: 'Close workspace' }).click();
      await page.waitForTimeout(400);
      await trigger.click();
      await page.waitForTimeout(400);
      assert.equal((await library.boundingBox()).width, 480);
      assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ZEBRA');
      await handle.press('ArrowRight');
      assert.equal((await library.boundingBox()).width, 500);
      await handle.press('End');
      assert.equal((await library.boundingBox()).width, width);
      await library.getByLabel('Search', { exact: true }).fill('');
      if (screenshots) await page.screenshot({ path: resolve(screenshots, `library-expanded-${width}.png`) });
    }
    await page.setViewportSize({ width: 800, height: 900 });
    assert.ok((await page.getByRole('region', { name: 'Library workspace' }).boundingBox()).width <= 800);
  } finally { await browser.close(); }
});
