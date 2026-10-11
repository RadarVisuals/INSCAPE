import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { openDisplayTool } from './fixtures/display-controls.mjs';
import { routeOpaqueWorkflowArtwork } from './fixtures/legacy-workflow-artwork.mjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

test('accepted icon rail and layers operate through canonical commands', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await routeOpaqueWorkflowArtwork(page);
    await page.goto(`${ROOT}/development/owner/system-workflow`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__workflowWrites += 1; }); });
    await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).click();
    await openDisplayTool(page, page.locator('.system-workflow__presentation-board'), 'LAYERS');
    const inspector = page.getByRole('region', { name: 'Selection and layers inspector' });
    const layersWindow = page.locator('[data-shared-tool="layers"]').locator('xpath=ancestor::aside');
    const rect = await layersWindow.boundingBox();
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 1440 && rect.y + rect.height <= 900,
      'the shared Layers window fits the viewport');
    assert.equal(await page.getByRole('navigation', { name: 'Selection actions' }).getByRole('button').count(), 9);
    assert.equal(await inspector.locator('.system-workflow__layer-row').count(), 2);
    assert.equal(await inspector.locator('.system-workflow__layer-row[data-selected]').count(), 1);
    const selectedRowActions = inspector.locator('.system-workflow__layer-row[data-selected] > button');
    const selectedRowActionCount = await selectedRowActions.count();
    assert.match(await selectedRowActions.nth(selectedRowActionCount - 2).getAttribute('aria-label'), /^Lock /,
      'lock precedes the final destructive layer action');
    assert.match(await selectedRowActions.nth(selectedRowActionCount - 1).getAttribute('aria-label'), /^Remove /,
      'remove remains the final layer action');
    assert.equal(await inspector.getByRole('button', { name: 'Lock ABYSSAL STUDY', exact: true }).getAttribute('aria-pressed'), 'false');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-inspector-1440x900.png') });

    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.match(await page.locator('.system-workflow__placement[aria-label^="Select ABYSSAL STUDY"] img').first().getAttribute('style'), /90deg/);
    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), 3);
    assert.equal(await inspector.locator('.system-workflow__layer-row').count(), 3);
    assert.equal(await inspector.locator('.system-workflow__layer-row[data-selected]').count(), 1, 'the new duplicate becomes the active selection');

    const duplicateRow = inspector.locator('.system-workflow__layer-row').first();
    await duplicateRow.getByRole('button', { name: /Remove ABYSSAL STUDY from Grid/ }).click();
    assert.equal(await duplicateRow.getByText(/Remove from Grid\?/i).isVisible(), true);
    await duplicateRow.getByRole('button', { name: /^Cancel$/i }).click();
    assert.equal(await duplicateRow.getByText(/Remove from Grid\?/i).count(), 0);
    await duplicateRow.getByRole('button', { name: /Remove ABYSSAL STUDY from Grid/ }).click();
    await page.evaluate(() => { window.__workflowWrites = 0; });
    await duplicateRow.getByRole('button', { name: /^Remove$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), 2);

    await page.locator('.system-workflow__placement[aria-label^="Select ABYSSAL STUDY"]').click();
    assert.equal(await page.getByRole('button', { name: /Frame and/ }).count(), 0);

    const mountain = page.locator('.system-workflow__placement[aria-label^="Select MOUNTAIN SIGNAL II"]');
    await mountain.click();
    assert.deepEqual(await mountain.evaluate((node) => ({
      outlineStyle: getComputedStyle(node).outlineStyle,
      pointerFocus: node.hasAttribute('data-system-workflow-pointer-focus'),
    })), { outlineStyle: 'none', pointerFocus: true },
    'ordinary pointer selection does not paint a native placement outline');
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    const edgeCoverage = async () => {
      const png = await mountain.screenshot();
      return page.evaluate(async data => {
        const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const sample = x => [...context.getImageData(x, Math.floor(canvas.height / 4), 1, 1).data];
        return [sample(1), sample(canvas.width - 2)];
      }, png.toString('base64'));
    };
    for (const row of [0, 1]) {
      if (row) await page.keyboard.press('ArrowUp');
      const pixels = await edgeCoverage();
      assert.ok(pixels.every(([r, g, b, a]) => b > r + 50 && b > g + 40 && a === 255),
        `rotated opaque media covers both edges on Grid row ${row}: ${JSON.stringify(pixels)}`);
    }
    const source = await mountain.boundingBox();
    const inspection = page.getByRole('group', { name: 'Artwork inspection', exact: true });
    const samples = async closing => page.evaluate(closing => new Promise((resolve, reject) => {
      const frames = [], started = performance.now();
      const tick = () => {
        const image = document.querySelector('.system-workflow__lift-artwork .lattice-production-focus-artwork__media');
        const plane = document.querySelector('[data-inspection-context="selected"]')?.parentElement;
        const progress = Number(plane?.style.getPropertyValue('--inspection-lift-progress'));
        if (image) {
          const r = image.getBoundingClientRect(), style = getComputedStyle(image);
          const insets = (image.closest('.display-artwork-surface').style.getPropertyValue('--display-media-viewbox').match(/-?[\d.]+(?=%)/g) || ['0','0','0','0']).map(value => Number(value) / 100);
          const sourceRatio = (parseFloat(style.width) / (1 - insets[1] - insets[3])) / (parseFloat(style.height) / (1 - insets[0] - insets[2]));
          if (r.width && r.height) frames.push({ x: r.x, y: r.y, width: r.width, height: r.height, sourceRatio, progress });
        }
        if (closing ? !image : progress === 1 && frames.length >= 3) resolve(frames);
        else if (performance.now() - started > 4000) reject(new Error('Lift did not complete'));
        else requestAnimationFrame(tick);
      }; tick();
    }), closing);
    for (const width of [1440, 1439, 1920, 1921]) {
      await page.setViewportSize({ width, height: 900 });
      await mountain.dblclick(); await inspection.waitFor();
      const opening = await samples(false);
      assert.ok(opening.length >= 3, 'Lift exposes a measurable opening');
      for (const frame of opening) assert.ok(Math.abs(frame.sourceRatio - 1) < .002,
        `the uncropped square source retains its ratio during rotated Lift: ${JSON.stringify(frame)}`);
      const last = opening.at(-1);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const stable = await page.locator('.system-workflow__lift-artwork .lattice-production-focus-artwork__media').boundingBox();
      for (const axis of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(last[axis] - stable[axis]) < .01,
        `Lift has no endpoint jump at ${width}px (${axis})`);
      await page.getByRole('button', { name: 'Close artwork viewer' }).click();
      const closing = await samples(true);
      assert.ok(closing.length >= 3, 'Lift exposes a measurable return');
      for (const frame of closing) assert.ok(Math.abs(frame.sourceRatio - 1) < .002, 'return retains the source ratio');
      await inspection.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement === document.querySelector('.system-workflow__placement[aria-label^="Select MOUNTAIN SIGNAL II"]'));
      assert.equal(await mountain.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'artwork has no rectangular focus halo after return');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.deepEqual(await mountain.boundingBox(), source, 'inspection never changes authored placement geometry');
    const deselectCanvas = async () => {
      const box = await page.locator('.system-workflow__canvas').boundingBox();
      await page.mouse.click(box.x + box.width - 3, box.y + box.height - 3);
      assert.equal(await mountain.getAttribute('aria-pressed'), 'false');
      assert.equal(await mountain.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
    };
    await deselectCanvas(); await mountain.click(); await deselectCanvas();
    await mountain.focus(); await page.keyboard.press('Enter'); await inspection.waitFor();
    await page.keyboard.press('Escape'); await inspection.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('.system-workflow__placement[aria-label^="Select MOUNTAIN SIGNAL II"]'));
    assert.equal(await mountain.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'keyboard return focuses artwork without an image-edge halo');
    await mountain.click();
    await page.getByRole('button', { name: 'Lock MOUNTAIN SIGNAL II', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Bring to front', exact: true }).isDisabled(), true);
    const beforeDrag = await layersWindow.boundingBox();
    const dragHandle = layersWindow.getByLabel('Move Layers window', { exact: true });
    const dragRect = await dragHandle.boundingBox();
    await page.mouse.move(dragRect.x + 80, dragRect.y + dragRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragRect.x - 70, dragRect.y - 80, { steps: 4 });
    await page.mouse.up();
    const afterDrag = await layersWindow.boundingBox();
    assert.ok(afterDrag.x < beforeDrag.x - 100 && afterDrag.y < beforeDrag.y - 50, 'desktop Layers panel follows its drag handle');
    await layersWindow.getByRole('button', { name: 'Close Layers', exact: true }).click();
    await layersWindow.waitFor({ state: 'detached' });
    await openDisplayTool(page, page.locator('.system-workflow__presentation-board'), 'LAYERS');
    await inspector.waitFor();
    assert.deepEqual(await layersWindow.boundingBox(), afterDrag, 'Layers position survives close and reopen');
    await page.getByRole('button', { name: /^Grids$/i }).click();
    await page.locator('.system-workflow__grid-switcher').waitFor();
    assert.equal(await layersWindow.count(), 1, 'opening Grids retains the shared Layers window');
    await page.getByRole('button', { name: /^Grids$/i }).click();
    await page.locator('.system-workflow__grid-switcher').waitFor({ state: 'detached' });
    assert.equal(await layersWindow.isVisible(), true);
    assert.deepEqual(await layersWindow.boundingBox(), afterDrag, 'closing Grids restores Layers at its saved position');

  } finally {
    await browser.close();
  }
});
