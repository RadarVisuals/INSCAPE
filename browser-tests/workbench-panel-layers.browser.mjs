import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';

for (const width of [1440, 390]) test(`Activity history remains operable above Workbench controls (${width}px)`, { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => {
      const asset = new URL(route.request().url()).pathname.split('/public/')[1];
      return route.fulfill({ path: `public/${asset}` });
    });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await page.getByRole('button', { name: 'Open full activity history' }).click();
    const history = page.getByRole('region', { name: 'Full activity history' });
    await history.waitFor();
    for (const name of ['Mark all activity read', 'Refresh activity', 'Close full activity history']) {
      const button = history.getByRole('button', { name, exact: true });
      assert.equal(await button.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      }), true, `${name} must receive pointer input`);
    }
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: `.browser-test-runtime/workbench-activity-layer-${width}.png` });
    await history.getByRole('button', { name: 'Mark all activity read', exact: true }).click();
    assert.equal(await history.getByRole('button', { name: 'Mark all activity read', exact: true }).isDisabled(), true);
    await history.getByRole('button', { name: 'Close full activity history', exact: true }).click();
    await page.getByRole('complementary', { name: 'Activity notifications' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
