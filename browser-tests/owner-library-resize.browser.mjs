import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { openSharedTool } from './fixtures/shared-tools.mjs';

const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const screenshots = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR;

async function localArtwork(page) {
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === root) return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' });
    return route.abort();
  });
}

test('Library resizes with inset scrolling, accessible controls, and retained state', async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    if (screenshots) await mkdir(screenshots, { recursive: true });
    const page = await browser.newPage();
    await localArtwork(page);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${root}/development/owner/system-workflow`, { waitUntil: 'networkidle' });
      const collapse = page.locator('.editor-menu-brand[aria-expanded="true"]');
      if (await collapse.isVisible()) await collapse.click();
      await page.evaluate(() => { window.__libraryDraftWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__libraryDraftWrites += 1; }); });
      const board = page.getByRole('article', { name: 'Display Module', exact: true });
      const grip = board.getByLabel(/Move Display Module:/);
      await grip.focus();
      const initialGrip = await grip.boundingBox();
      await page.mouse.move(initialGrip.x + 80, initialGrip.y + initialGrip.height / 2);
      await page.mouse.down();
      await page.mouse.move(650, initialGrip.y + initialGrip.height / 2, { steps: 8 });
      await page.mouse.up();
      const beforeLibrary = await board.boundingBox();
      const trigger = page.getByRole('button', { name: 'Library', exact: true });
      await trigger.click();
      const library = page.getByRole('region', { name: 'Library workspace' });
      await page.waitForFunction(() => document.querySelector('[aria-label="Library workspace"]')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
      const original = await library.boundingBox();
      assert.deepEqual(await board.boundingBox(), beforeLibrary, 'opening Library never shifts or resizes Display');
      const handle = library.getByRole('button', { name: 'Resize Library', exact: true });
      await handle.press('Home');
      const minimum = (await library.boundingBox()).width;
      await handle.press('End');
      const maximum = (await library.boundingBox()).width;
      assert.ok(minimum > 0 && maximum > minimum && maximum <= width, 'keyboard endpoints define a nonempty, viewport-contained resize range');
      const edge = await handle.boundingBox();
      const shrink = (maximum - minimum) / 2;
      await page.mouse.move(edge.x + edge.width / 2, edge.y + 100);
      await page.mouse.down();
      await page.mouse.move(edge.x - shrink + edge.width / 2, edge.y + 100, { steps: 8 });
      await page.mouse.up();
      const smaller = await library.boundingBox();
      assert.ok(Math.abs(smaller.width - (maximum - shrink)) < 1, 'inside its limits, Library follows the dragged edge exactly');
      assert.deepEqual([smaller.x, smaller.y, smaller.height], [original.x, original.y, original.height], 'resizing preserves the sidebar clearance and top inset');
      await handle.focus();
      await handle.press('Home');
      assert.equal((await library.boundingBox()).width, minimum);
      await handle.press('ArrowLeft');
      assert.equal((await library.boundingBox()).width, minimum, 'resize clamps at the lower endpoint');
      assert.deepEqual(await board.boundingBox(), beforeLibrary, 'resizing Library never shifts or resizes Display');
      await page.mouse.click(width - 30, 50);
      await page.waitForTimeout(350);
      assert.equal(await library.isVisible(), true, 'outside clicks keep Library open');
      const boardBounds = await board.boundingBox();
      await grip.focus();
      const gripBounds = await grip.boundingBox();
      await page.mouse.move(gripBounds.x + 80, gripBounds.y + gripBounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(gripBounds.x + 125, gripBounds.y + gripBounds.height / 2 + 40, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(350);
      assert.equal(await library.isVisible(), true, 'Display Module interactions keep Library open');
      assert.notDeepEqual(await board.boundingBox(), boardBounds, 'the Display Module actually moves while Library stays open');
      const layers = await openSharedTool(page, 'Layers');
      await layers.getByRole('tab', { name: 'Layers', exact: true }).waitFor();
      assert.equal(await library.isVisible(), true, 'Layers can be used alongside Library');
      await page.getByRole('button', { name: 'Close Workbench Layers', exact: true }).press('Enter');
      const containment = await library.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const dock = { top: innerHeight };
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
      assert.equal((await library.boundingBox()).width, minimum, 'reopening retains resized width');
      assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ZEBRA');
      await handle.press('ArrowRight');
      assert.ok((await library.boundingBox()).width > minimum, 'ArrowRight expands Library');
      await handle.press('End');
      assert.equal((await library.boundingBox()).width, maximum);
      await handle.press('ArrowRight');
      assert.equal((await library.boundingBox()).width, maximum, 'resize clamps at the upper endpoint');
      assert.equal(await page.evaluate(() => window.__libraryDraftWrites), 0, 'Library resizing and browsing never edits the draft');
      await library.getByLabel('Search', { exact: true }).fill('');
      if (screenshots) await page.screenshot({ path: resolve(screenshots, `library-expanded-${width}.png`) });
    }
    await page.setViewportSize({ width: 800, height: 900 });
    assert.ok((await page.getByRole('region', { name: 'Library workspace' }).boundingBox()).width <= 800);
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`Library detaches, moves, resizes and docks without losing its workspace (${width}px)`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await localArtwork(page);
    await page.goto(`${root}/development/owner/system-workflow`);
    const trigger = page.getByRole('button', { name: 'Artwork library', exact: true });
    await trigger.click();
    const library = page.getByRole('region', { name: 'Library workspace', exact: true });
    await library.waitFor();
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const boardBefore = await board.boundingBox();
    await page.evaluate(() => { window.libraryWindowWrites = 0; addEventListener('inscape:review-storage-write', event => {
      if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.libraryWindowWrites++;
    }); });
    await library.getByLabel('Search', { exact: true }).fill('ABYSSAL');
    const card = library.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
    await card.click();
    const content = await library.elementHandle(), selected = await card.elementHandle();
    await library.getByRole('button', { name: 'Detach Library', exact: true }).click();
    const floating = page.getByRole('region', { name: 'Library window', exact: true });
    await floating.waitFor();
    assert.notEqual(await floating.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'Library uses the shared opaque window material');
    const grip = floating.getByRole('button', { name: 'Move Library panel', exact: true });
    assert.equal(await grip.evaluate(node => node === document.activeElement), true, 'detaching restores keyboard focus');
    assert.equal(await library.evaluate((node, original) => node === original, content), true, 'detaching retains the Library instance');
    assert.equal(await card.evaluate((node, original) => node === original, selected), true, 'selected artwork stays mounted');
    assert.equal(await card.getAttribute('aria-pressed'), 'true');
    assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ABYSSAL');
    assert.equal(await library.getByRole('button', { name: 'All Assets', exact: true }).isVisible(), true, 'navigation travels with the detached Library');
    const corner = floating.getByRole('button', { name: 'Resize Library panel', exact: true });
    await corner.press('Shift+ArrowUp');
    await corner.press('Shift+ArrowUp');
    const initial = await floating.boundingBox();
    await grip.press('ArrowDown');
    assert.equal((await floating.boundingBox()).y, initial.y + 8);
    const moving = await floating.boundingBox(), gripBox = await grip.boundingBox();
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down(); await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2 + 24, { steps: 4 });
    assert.equal((await floating.boundingBox()).y, moving.y + 24);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await floating.boundingBox(), moving, 'Escape cancels movement without closing Library');
    await corner.press('ArrowUp');
    assert.equal((await floating.boundingBox()).height, moving.height - 8);
    const edge = await corner.boundingBox();
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2); await page.mouse.down();
    await page.mouse.move(edge.x + edge.width / 2 - 30, edge.y + edge.height / 2 - 40, { steps: 5 }); await page.mouse.up();
    const resized = await floating.boundingBox();
    assert.ok(resized.height < moving.height - 8 && resized.width < moving.width, 'corner resizing changes both dimensions');
    assert.deepEqual(await board.boundingBox(), boardBefore, 'tool geometry never changes authored objects');
    if (screenshots) { await mkdir(screenshots, { recursive: true }); await page.screenshot({ path: resolve(screenshots, `library-detached-${width}.png`) }); }
    assert.equal(await library.evaluate(node => node.scrollWidth <= node.clientWidth), true, JSON.stringify(await library.evaluate(node => ({width: node.clientWidth, scroll: node.scrollWidth,
      overflowing: [...node.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > node.getBoundingClientRect().right + 1).map(child => ({className: child.className, width: child.getBoundingClientRect().width})).slice(0, 12)}))));
    await floating.getByRole('button', { name: 'Close Library', exact: true }).click();
    await floating.waitFor({ state: 'hidden' }); await trigger.click(); await floating.waitFor();
    assert.deepEqual(await floating.boundingBox(), resized, 'closing and reopening retains the floating frame');
    await floating.getByRole('button', { name: 'Dock Library', exact: true }).click();
    await floating.waitFor({ state: 'detached' });
    assert.equal(await library.evaluate((node, original) => node === original, content), true, 'docking retains the Library instance');
    assert.equal(await library.getByRole('button', { name: 'Detach Library' }).evaluate(node => node === document.activeElement), true);
    assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ABYSSAL');
    await library.getByRole('button', { name: 'Detach Library' }).click(); await floating.waitFor();
    assert.deepEqual(await floating.boundingBox(), resized, 'detaching again restores the last floating frame');
    assert.equal(await page.evaluate(() => window.libraryWindowWrites), 0, 'layout and browsing never save artwork');
    if (width === 1440) {
      const beforeImages = await page.locator('.image-module__window').count();
      await card.scrollIntoViewIfNeeded();
      const start = await card.boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + 30); await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + 40, { steps: 3 });
      const destination = await page.evaluate(() => {
        for (let y = 200; y < innerHeight - 120; y += 30) for (let x = innerWidth - 30; x > 250; x -= 30) {
          if (document.elementFromPoint(x, y)?.matches('.system-workflow, .system-workflow__workbench, .system-workflow__display-instance')) return { x, y };
        }
        throw Error('No exposed Workbench drop target');
      });
      await page.mouse.move(destination.x, destination.y, { steps: 10 });
      await page.getByText('Release to place Image', { exact: true }).waitFor();
      await page.keyboard.press('Escape'); await page.mouse.up();
      assert.equal(await page.locator('.image-module__window').count(), beforeImages, 'cancelled floating-Library drop adds nothing');
      assert.equal(await page.evaluate(() => window.libraryWindowWrites), 0);
      assert.equal(await floating.isVisible(), true, 'cancelling the artwork drag keeps Library open');
      await card.click({ trial: true });
      const resumed = await card.boundingBox();
      await page.mouse.move(resumed.x + resumed.width / 2, resumed.y + 30); await page.mouse.down();
      await page.mouse.move(destination.x, destination.y, { steps: 10 });
      await page.getByText('Release to place Image', { exact: true }).waitFor(); await page.mouse.up();
      await page.waitForFunction(count => document.querySelectorAll('.image-module__window').length === count + 1, beforeImages);
      assert.equal(await floating.isVisible(), true, 'placing artwork leaves the floating Library available');
      assert.equal(await page.evaluate(() => window.libraryWindowWrites), 1, 'a completed drop makes exactly one artwork save');
    }
    await page.setViewportSize({ width: 320, height: 560 });
    await page.waitForFunction(() => { const box = document.querySelector('.workbench-library-window')?.getBoundingClientRect();
      return box && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; });
    assert.equal(await page.evaluate(() => window.libraryWindowWrites), width === 1440 ? 1 : 0, 'viewport changes never save artwork');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
