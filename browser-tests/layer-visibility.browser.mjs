import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('layer eye is temporary editor state and preserves Preview, selection, and narrow access', { timeout: 60_000 }, async () => {
  const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const bay = page.getByRole('complementary', { name: 'Display Module instruments', exact: true });
    await bay.waitFor();
    const placements = page.locator('[data-system-workflow-placement-id]');
    const initialCount = await placements.count();
    await page.evaluate(() => { window.__eyeWrites = 0; addEventListener('inscape:review-storage-write', () => window.__eyeWrites++); });
    const asset = bay.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true });
    await asset.click();
    const selectedId = await placements.filter({ has: page.locator('img') }).evaluateAll(nodes => nodes.find(n => n.getAttribute('aria-pressed') === 'true')?.dataset.systemWorkflowPlacementId);
    assert.ok(selectedId);
    await bay.getByRole('button', { name: 'Hide MOUNTAIN SIGNAL II in editor', exact: true }).click();
    assert.equal(await placements.count(), initialCount - 1);
    assert.equal(await asset.isDisabled(), true);
    assert.equal(await bay.getByRole('button', { name: 'Rotate', exact: true }).isDisabled(), true);
    assert.equal(await bay.getByRole('button', { name: 'Show MOUNTAIN SIGNAL II in editor', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__eyeWrites), 0);
    await page.screenshot({ path: '.browser-test-runtime/layer-eye-wide.png' });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator(`.lattice-production-placement[data-placement-id="${selectedId}"]`).waitFor();
    assert.equal(await page.evaluate(() => window.__eyeWrites), 0);
    // Reload resets only the temporary eye state; the fixture draft still has both placements.
    await page.reload();
    await bay.waitFor();
    assert.equal(await placements.count(), initialCount);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const hide = bay.getByRole('button', { name: 'Hide MOUNTAIN SIGNAL II in editor', exact: true });
    await hide.focus();
    await page.keyboard.press('Enter');
    assert.equal(await placements.count(), initialCount - 1);
    const show = bay.getByRole('button', { name: 'Show MOUNTAIN SIGNAL II in editor', exact: true });
    const bounds = await show.boundingBox();
    assert.ok(bounds.width >= 28 && bounds.x >= 0 && bounds.x + bounds.width <= 390);
    await page.screenshot({ path: '.browser-test-runtime/layer-eye-narrow.png' });
    await show.click();
    assert.equal(await placements.count(), initialCount);
    await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).click();
    assert.equal(await hide.isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
