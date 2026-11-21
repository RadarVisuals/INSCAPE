import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { openSharedTool, sharedToolPanel, sharedToolTab, detachTool } from './fixtures/shared-tools.mjs';

const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const screenshots = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR;

async function localArtwork(page) {
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === root) return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' });
    return route.abort();
  });
}

test('Library shared-window resizing preserves artwork, browsing and scroll position', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000); await localArtwork(page);
    await page.goto(root + '/development/owner/system-workflow');
    const trigger = page.getByRole('button', { name: 'Artwork library', exact: true });
    await trigger.click(); await detachTool(page, 'Library');
    const panel = sharedToolPanel(page, 'Library'), library = page.getByRole('region', { name: 'Library workspace', exact: true });
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const boardBefore = await board.boundingBox();
    await page.evaluate(() => { window.__libraryDraftWrites = 0; addEventListener('inscape:review-storage-write', event => {
      if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__libraryDraftWrites++;
    }); });
    const edge = panel.locator('[data-edge="e"]'), corner = panel.locator('[data-edge="se"]');
    for (let i = 0; i < 6; i++) await edge.press('Shift+ArrowLeft');
    const minimum = await panel.boundingBox();
    await edge.press('ArrowLeft'); assert.deepEqual(await panel.boundingBox(), minimum, 'keyboard resize clamps at minimum');
    await edge.press('Shift+ArrowRight');
    const wider = await panel.boundingBox(); assert.ok(wider.width > minimum.width);
    assert.deepEqual([wider.x, wider.y, wider.height], [minimum.x, minimum.y, minimum.height]);
    const box = await edge.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
    assert.ok(Math.abs((await panel.boundingBox()).width - wider.width - 100) < 1, 'pointer resize follows its edge');
    for (let i = 0; i < 9; i++) await corner.press('Shift+ArrowUp');
    const scrolling = library.locator('.lattice-browser-results');
    await scrolling.evaluate(node => { node.scrollTop = 150; });
    const scrollTop = await scrolling.evaluate(node => node.scrollTop);
    assert.ok(scrollTop > 0, 'content really scrolls');
    assert.equal(await library.evaluate(node => node.scrollWidth <= node.clientWidth), true);
    const controls = library.locator('.library-browse-controls');
    assert.equal(await controls.evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.getByRole('button', { name: 'Close Library', exact: true }).click();
    await trigger.click(); assert.equal(await scrolling.evaluate(node => node.scrollTop), scrollTop);
    await library.getByRole('navigation', { name: 'Browser navigation' }).getByRole('button', { name: 'PORTFOLIO', exact: true }).click();
    await page.getByRole('button', { name: 'Close Library', exact: true }).click(); await trigger.click();
    assert.equal(await library.getByRole('navigation', { name: 'Browser navigation' }).getByRole('button', { name: 'PORTFOLIO', exact: true }).getAttribute('aria-pressed'), 'true');
    await library.getByRole('button', { name: 'All Assets', exact: true }).click();
    await library.getByLabel('Search', { exact: true }).fill('ZEBRA');
    await page.waitForFunction(() => document.querySelectorAll('.system-workflow__library .lattice-browser-asset').length === 1);
    const retained = await panel.boundingBox();
    await page.getByRole('button', { name: 'Close Library', exact: true }).click(); await trigger.click();
    assert.deepEqual(await panel.boundingBox(), retained);
    assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ZEBRA');
    await page.locator('main.system-workflow').focus();
    assert.equal(await library.isVisible(), true, 'canvas interactions do not close Library');
    const layers = await openSharedTool(page, 'Layers');
    assert.equal(await library.isVisible(), true, 'separate tools coexist');
    await layers.getByRole('button', { name: 'Close Workbench Layers', exact: true }).click();
    assert.equal(await library.isVisible(), true);
    assert.deepEqual(await board.boundingBox(), boardBefore);
    assert.equal(await page.evaluate(() => window.__libraryDraftWrites), 0);
    await page.setViewportSize({ width: 800, height: 700 });
    await page.waitForFunction(() => { const r = document.querySelector('[data-tool-tab="Library"]')?.closest('.workbench-tool-dock').getBoundingClientRect();
      return r && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
  } finally { await browser.close(); }
});

for (const width of [1440, 800]) test(`Library detaches, moves, resizes and docks without losing its workspace (${width}px)`, { timeout: 60000 }, async () => {
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
    await detachTool(page, 'Library');
    const floating = page.getByRole('region', { name: 'Library', exact: true });
    await floating.waitFor();
    assert.notEqual(await floating.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'Library uses the shared opaque window material');
    const grip = floating.getByRole('button', { name: 'Move Library panel', exact: true });
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Library');
    assert.equal(await library.evaluate((node, original) => node === original, content), true, 'detaching retains the Library instance');
    assert.equal(await card.evaluate((node, original) => node === original, selected), true, 'selected artwork stays mounted');
    assert.equal(await card.getAttribute('aria-pressed'), 'true');
    assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ABYSSAL');
    assert.equal(await library.getByRole('button', { name: 'All Assets', exact: true }).isVisible(), true, 'navigation travels with the detached Library');
    await floating.locator('[data-edge="e"]').press('Shift+ArrowRight');
    await floating.locator('[data-edge="e"]').press('Shift+ArrowRight');
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
    await sharedToolTab(page, 'Library').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Dock with Layers', exact: true }).click();
    await floating.waitFor({ state: 'detached' });
    assert.equal(await library.evaluate((node, original) => node === original, content), true, 'docking retains the Library instance');
    await page.waitForFunction(() => document.activeElement?.dataset.toolTab === 'Library');
    assert.equal(await library.getByLabel('Search', { exact: true }).inputValue(), 'ABYSSAL');
    await detachTool(page, 'Library'); await floating.waitFor();
    assert.equal(await library.evaluate((node, original) => node === original, content), true, 'another detach still keeps the same workspace');
    assert.equal(await page.evaluate(() => window.libraryWindowWrites), 0, 'layout and browsing never save artwork');
    if (width === 1440) {
      const beforeImages = await page.locator('.image-module__window').count();
      await card.scrollIntoViewIfNeeded();
      const start = await card.boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + 30); await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + 40, { steps: 3 });
      const destination = await page.evaluate(() => {
        const host = document.querySelector('main.system-workflow'), canvas = host.querySelector('[data-workbench-area]');
        const bounds = host.getBoundingClientRect(), scale = Number(host.dataset.workbenchCameraScale);
        const [width, height] = canvas.dataset.workbenchArea.split('x').map(Number);
        const left = bounds.left + Number(host.dataset.workbenchCameraX) + Number(canvas.dataset.canvasLeft) * scale;
        const top = bounds.top + Number(host.dataset.workbenchCameraY) + Number(canvas.dataset.canvasTop) * scale;
        for (let y = Math.max(200, top + 20); y < Math.min(innerHeight - 120, top + height * scale - 20); y += 30)
          for (let x = Math.min(innerWidth - 30, left + width * scale - 20); x > Math.max(250, left + 20); x -= 30) {
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
    await page.waitForFunction(() => { const box = document.querySelector('[data-tool-tab="Library"]')?.closest('.workbench-tool-dock').getBoundingClientRect();
      return box && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; });
    assert.equal(await page.evaluate(() => window.libraryWindowWrites), width === 1440 ? 1 : 0, 'viewport changes never save artwork');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
