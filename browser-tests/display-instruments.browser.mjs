import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { activate, openDisplayTool } from './fixtures/display-controls.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
async function setup(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/development/owner/system-workflow`);
  const board = page.getByRole('article', { name: 'Display Module', exact: true });
  await board.waitFor();
  await page.evaluate(() => {
    window.__instrumentWrites = 0;
    addEventListener('inscape:review-storage-write', event => {
      if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__instrumentWrites++;
    });
  });
  return { page, board, errors };
}

test('shared Layers and Artwork info preserve Display geometry and independent window placement', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const { page, board, errors } = await setup(browser);
    const before = await board.boundingBox();
    assert.equal(await page.locator('[data-shared-tool="layers"], [data-shared-tool="metadata"]').count(), 0);
    await openDisplayTool(page, board, 'LAYERS');
    const layers = page.locator('[data-shared-tool="layers"]');
    await layers.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true }).click();
    await openDisplayTool(page, board, 'METADATA');
    const metadata = page.locator('[data-shared-tool="metadata"]');
    assert.match(await metadata.locator('xpath=ancestor::aside').getAttribute('aria-label'), /MOUNTAIN SIGNAL II/);
    assert.deepEqual(await board.boundingBox(), before);
    const grip = page.getByLabel('Move Artwork info window', { exact: true });
    const infoWindow = metadata.locator('xpath=ancestor::aside');
    const initialInfo = await infoWindow.boundingBox();
    await grip.focus(); await page.keyboard.press('ArrowRight'); await settle(page);
    const moved = await infoWindow.boundingBox();
    assert.ok(moved.x > initialInfo.x);
    assert.deepEqual(await board.boundingBox(), before);
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    await openDisplayTool(page, board, 'METADATA');
    assert.deepEqual(await infoWindow.boundingBox(), moved);
    const resize = page.getByRole('button', { name: 'Resize Display Module from se', exact: true });
    await resize.focus(); await page.keyboard.press('ArrowLeft'); await settle(page);
    const resized = await board.boundingBox(); assert.ok(resized.width < before.width);
    await activate(page, board.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }));
    await activate(page, page.locator('.system-workflow__desktop-shortcut'));
    assert.deepEqual(await board.boundingBox(), resized);
    await board.getByLabel(/Move Display Module:/).focus();
    assert.equal(await layers.count(), 1); assert.equal(await metadata.count(), 1);
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Layers selection uses the shared authoring dock and Library remains an overlay', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const { page, board, errors } = await setup(browser);
    await openDisplayTool(page, board, 'LAYERS');
    const layers = page.locator('[data-shared-tool="layers"]');
    await layers.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true }).click();
    const dock = page.locator('[data-context-tools]');
    await dock.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(await board.locator('[data-system-workflow-placement-id]').count(), 3);
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 1);
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider', { name: 'Crop zoom' }).fill('1.2');
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 1);
    await activate(page, board.getByRole('button', { name: 'Lock Display Module composition', exact: true }));
    assert.equal(await dock.getByRole('button', { name: 'Rotate', exact: true }).isEnabled(), false);
    const before = await board.boundingBox();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
    assert.deepEqual(await board.boundingBox(), before);
    assert.equal(await layers.count(), 1);
    await page.getByRole('button', { name: 'Close workspace', exact: true }).click();
    await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.matches('[data-system-workflow-panel-trigger][aria-label="Library"]'));
    await activate(page, board.getByRole('button', { name: 'Unlock Display Module composition', exact: true }));
    assert.equal(await dock.getByRole('button', { name: 'Rotate', exact: true }).isEnabled(), true);
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('shared metadata stays bounded and scrollable across viewport changes without reflowing Display', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const { page, board, errors } = await setup(browser);
    await openDisplayTool(page, board, 'METADATA');
    const metadata = page.locator('[data-shared-tool="metadata"]');
    const infoWindow = metadata.locator('xpath=ancestor::aside');
    // Overflowing source content exercises the reading container, not authored state.
    await metadata.evaluate(node => {
      const extra = document.createElement('p'); extra.textContent = 'Long artwork source description. '.repeat(500); node.append(extra);
    });
    for (const viewport of [{ width: 960, height: 640 }, { width: 959, height: 640 }, { width: 760, height: 720 }, { width: 390, height: 560 }]) {
      await page.setViewportSize(viewport); await settle(page);
      const before = await board.boundingBox();
      const bounds = await infoWindow.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
      const scrolling = await metadata.evaluate(node => {
        let scroll = node;
        while (scroll && scroll.scrollHeight <= scroll.clientHeight) scroll = scroll.parentElement;
        if (!scroll) return false;
        scroll.scrollTop = scroll.scrollHeight;
        return scroll.scrollTop > 0;
      });
      assert.equal(scrolling, true);
      assert.deepEqual(await board.boundingBox(), before);
      await page.screenshot({ path: `.browser-test-runtime/instruments-${viewport.width}x${viewport.height}.png` });
    }
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
