import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountFilledDisplay } from './fixtures/display-filled-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
test('filled Display retains artwork, scoped inspection and draft at wide and narrow viewports', { timeout: 60000 }, async () => {
  await mkdir('output/display-filled-audit', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountFilledDisplay(page, origin);
      if (width === 390) await setWorkbenchZoom(page, .67);
      assert.equal(await page.locator('.system-workflow__canvas img').evaluateAll(nodes => nodes.every(node => node.complete && node.naturalWidth > 0)), true);
      const initial = await page.evaluate(() => filledDisplay.draft());
      const artwork = page.locator('.system-workflow__grid-plane--current [data-system-workflow-placement-id]').last();
      await artwork.focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor();
      await page.waitForFunction(() => {
        const background = document.querySelector('[data-inspection-context="background"]');
        return background && getComputedStyle(background).filter.includes('brightness(0.18)');
      });
      assert.equal(await page.locator('.system-workflow__grid-plane--adjacent .system-workflow__placement').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).filter === 'none')), true);
      await page.screenshot({ path: `output/display-filled-audit/filled-inspection-${width}.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-inspection-context]').count(), 0);
      assert.equal(await page.locator('[data-inspection-lift]').count(), 0);
      assert.deepEqual(await page.evaluate(() => filledDisplay.draft()), initial);
      await page.screenshot({ path: `output/display-filled-audit/filled-composition-${width}.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
