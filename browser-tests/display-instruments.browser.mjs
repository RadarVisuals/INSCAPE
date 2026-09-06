import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const stageSize = (page) => page.locator('[data-presentation-stage]').evaluate((node) => ({ width: node.clientWidth, height: node.clientHeight }));

test('Display interaction survives host window changes without draft writes', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const bay = page.getByRole('complementary', { name: 'Display Module instruments', exact: true });
    await bay.waitFor();
    await page.evaluate(() => { window.__displayWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__displayWrites += 1; }); });
    await bay.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true }).click();
    await bay.getByRole('tab', { name: 'Metadata', exact: true }).click();
    assert.match(await bay.innerText(), /MOUNTAIN SIGNAL II/);
    await page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
    await page.locator('.system-workflow__desktop-shortcut').dblclick();
    await bay.waitFor();
    assert.equal(await bay.getByRole('tab', { name: 'Metadata', exact: true }).getAttribute('aria-selected'), 'true');
    assert.match(await bay.innerText(), /MOUNTAIN SIGNAL II/);
    await page.getByRole('button', { name: 'Select MOUNTAIN SIGNAL II', exact: true }).dblclick();
    await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).click();
    await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor({ state: 'detached' });
    assert.match(await bay.innerText(), /MOUNTAIN SIGNAL II/);
    await page.getByRole('button', { name: 'Grids', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__displayWrites), 0);
    const grids = page.getByRole('listbox', { name: 'Ordered Grids', exact: true });
    const home = grids.getByRole('option').first();
    await page.getByRole('button', { name: 'New Grid', exact: true }).click();
    assert.equal(await home.getAttribute('aria-selected'), 'false');
    const writesAfterCreatingGrid = await page.evaluate(() => window.__displayWrites);
    await home.click();
    assert.equal(await home.getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => window.__displayWrites), writesAfterCreatingGrid);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Display Module instruments preserve selection, canonical writes, bounds, and Library access', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const bay = page.getByRole('complementary', { name: 'Display Module instruments', exact: true });
    await bay.waitFor();
    await settle(page);
    assert.equal(await bay.getAttribute('data-projection'), 'attached');
    const noise = await page.locator('.system-workflow__presentation-board').evaluate((node) => {
      const frame = getComputedStyle(node);
      const texture = getComputedStyle(node, '::after');
      return { right: parseFloat(texture.right), expected: -parseFloat(frame.getPropertyValue('--workflow-metadata-width'))
        - parseFloat(frame.getPropertyValue('--workflow-board-frame-gap')), pointerEvents: texture.pointerEvents };
    });
    assert.equal(noise.right, noise.expected, 'frame noise must extend across the attached instrument bay');
    assert.equal(noise.pointerEvents, 'none');
    assert.ok((await stageSize(page)).width > 900);
    await page.evaluate(() => { window.__instrumentWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__instrumentWrites += 1; }); });
    await bay.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true }).click();
    await bay.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(await page.locator('[data-system-workflow-placement-id]').count(), 3);
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 1);
    const beforeSwitch = await stageSize(page);
    await bay.getByRole('tab', { name: 'Metadata', exact: true }).click();
    await settle(page);
    assert.deepEqual(await stageSize(page), beforeSwitch);
    assert.match(await bay.innerText(), /MOUNTAIN SIGNAL II/);
    await bay.getByRole('button', { name: 'Detach Metadata', exact: true }).click();
    assert.equal(await page.locator('.system-workflow__instrument-window').count(), 1);
    assert.equal(await page.locator('.system-workflow__metadata-module-content').count(), 1);
    assert.equal(await page.getByRole('navigation', { name: 'Selection actions' }).count(), 1);
    await page.getByRole('button', { name: 'Attach Metadata', exact: true }).click();
    assert.equal(await page.locator('.system-workflow__instrument-window').count(), 0);
    await bay.getByRole('tab', { name: 'Metadata', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await bay.getByRole('tab', { name: 'Layers', exact: true }).getAttribute('aria-selected'), 'true');
    await bay.getByRole('button', { name: 'Crop', exact: true }).click();
    await bay.getByRole('slider', { name: 'Crop zoom' }).waitFor();
    await bay.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 1);
    await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).click();
    assert.equal(await bay.getByRole('button', { name: 'Rotate', exact: true }).isDisabled(), true);
    assert.equal(await bay.getByRole('button', { name: 'Bring to front', exact: true }).isDisabled(), true);
    if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: '.browser-test-runtime/instruments-verified-wide.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    await settle(page);
    assert.equal(await bay.getAttribute('data-projection'), 'overlay');
    const narrowStage = await stageSize(page);
    assert.ok(narrowStage.width >= 280);
    await bay.getByRole('tab', { name: 'Metadata', exact: true }).click();
    assert.deepEqual(await stageSize(page), narrowStage);
    const bounds = await bay.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 802);
    if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: '.browser-test-runtime/instruments-verified-narrow.png' });
    await bay.getByRole('button', { name: 'Close instrument bay', exact: true }).click();
    await settle(page);
    assert.equal(await page.getByRole('button', { name: 'Metadata', exact: true }).evaluate((node) => node === document.activeElement), true);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('region', { name: 'Library workspace', exact: true }).waitFor();
    await settle(page);
    const library = await page.locator('.system-workflow__library').boundingBox();
    const stage = await page.locator('[data-presentation-stage]').boundingBox();
    assert.ok(library.y > stage.y + stage.height, JSON.stringify({ library, stage }));
    assert.equal(await page.locator('.system-workflow__instrument-bay').count(), 0);
    if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: '.browser-test-runtime/instruments-library-narrow.png' });
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 1);
    assert.deepEqual(errors, []);
    await page.getByRole('button', { name: 'Unlock Display Module composition', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'wide');
    await settle(page);
    const wideLibrary = await page.locator('.system-workflow__library').boundingBox();
    const wideStage = await page.locator('[data-presentation-stage]').boundingBox();
    assert.ok(wideLibrary.x + wideLibrary.width <= wideStage.x);
    const resizeLibrary = page.getByRole('button', { name: 'Resize Library', exact: true });
    await resizeLibrary.focus();
    await page.keyboard.press('ArrowRight');
    await settle(page);
    assert.ok((await page.locator('.system-workflow__library').boundingBox()).width > wideLibrary.width);
    if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: '.browser-test-runtime/instruments-library-wide.png' });
    const card = page.locator('.system-workflow__library').getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
    await card.scrollIntoViewIfNeeded();
    const cardBox = await card.boundingBox();
    const target = await page.locator('.system-workflow__canvas').boundingBox();
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 30);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelectorAll('[data-system-workflow-placement-id]').length === 4);
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 2);
    await page.getByRole('button', { name: 'Close workspace', exact: true }).click();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await bay.getByRole('button', { name: 'Detach Layers', exact: true }).click();
    const detached = page.locator('.system-workflow__instrument-window');
    await detached.waitFor();
    const move = page.getByLabel('Move Layers window', { exact: true });
    await move.focus();
    const originalPosition = await detached.boundingBox();
    await page.keyboard.press('ArrowRight');
    assert.ok((await detached.boundingBox()).x > originalPosition.x);
    await page.getByRole('separator', { name: 'Resize Layers height', exact: true }).focus();
    await page.keyboard.press('ArrowUp');
    assert.ok((await detached.boundingBox()).height < originalPosition.height);
    await page.setViewportSize({ width: 390, height: 560 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    await settle(page);
    const detachedBounds = await detached.boundingBox();
    assert.ok(detachedBounds.x >= 0 && detachedBounds.x + detachedBounds.width <= 390);
    assert.ok(detachedBounds.y >= 0 && detachedBounds.y + detachedBounds.height <= 518);
    await page.getByRole('button', { name: 'Attach Layers', exact: true }).click();
    assert.equal(await page.getByRole('navigation', { name: 'Selection actions' }).count(), 1);
    assert.equal(await page.evaluate(() => window.__instrumentWrites), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('compact boundaries and long Metadata remain scroll-contained without changing the Stage', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const bay = page.locator('.system-workflow__instrument-bay');
    await bay.waitFor();
    for (const viewport of [{ width: 960, height: 640 }, { width: 959, height: 640 }, { width: 760, height: 720 }, { width: 390, height: 560 }]) {
      await page.setViewportSize(viewport);
      await settle(page);
      await page.getByRole('tab', { name: 'Metadata', exact: true }).click();
      await settle(page);
      const before = await stageSize(page);
      assert.ok(before.width >= 280);
      // Exercise the reading viewport with genuinely overflowing content; no draft is changed.
      const scroll = await page.getByRole('tabpanel', { name: 'Metadata', exact: true }).evaluate((node) => {
        const extra = document.createElement('p');
        extra.textContent = 'A long source description and its retained provenance. '.repeat(200);
        node.append(extra);
        const result = { client: node.clientHeight, scroll: node.scrollHeight };
        node.scrollTop = node.scrollHeight;
        result.position = node.scrollTop;
        return result;
      });
      assert.ok(scroll.scroll > scroll.client && scroll.position > 0);
      assert.deepEqual(await stageSize(page), before);
      const bounds = await bay.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height - 42);
      if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: `.browser-test-runtime/instruments-${viewport.width}x${viewport.height}.png` });
      await page.getByRole('tab', { name: 'Layers', exact: true }).click();
      assert.equal(await page.getByRole('navigation', { name: 'Selection actions' }).count(), 1);
    }
  } finally { await browser.close(); }
});
