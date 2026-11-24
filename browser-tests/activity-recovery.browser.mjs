import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable as executablePath } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const url = origin + '/browser-tests/support-recovery-fixture.html';

for (const width of [1440, 390]) {
  test(`Signals rejected writes remain visible and retry persists; partial Activity appears in both views (${width}px)`, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const mountSettings = async () => {
        await page.goto(url);
        await page.getByRole('dialog', { name: 'Settings' }).waitFor();
      };
      await mkdir(output, { recursive: true });
      await mountSettings();
      const audio = page.getByLabel('Audio notifications', { exact: true });
      assert.equal(await audio.isChecked(), false);
      await page.evaluate(() => { window.blockSignalSave = true; });
      await audio.click();
      await page.getByRole('alert').filter({ hasText: 'Change not saved' }).waitFor();
      assert.equal(await audio.isChecked(), false);
      await page.screenshot({ path: `${output}/repairs-signals-error-${width}.png` });
      await page.evaluate(() => { window.blockSignalSave = false; });
      await audio.click();
      assert.equal(await audio.isChecked(), true);
      assert.equal(await page.getByRole('alert').count(), 0);
      await mountSettings();
      assert.equal(await audio.isChecked(), true);
      await page.goto(url + '?activity');
      await page.getByRole('status').filter({ hasText: 'Partial on-chain data' }).waitFor();
      await page.screenshot({ path: `${output}/repairs-activity-partial-${width}.png` });
      await page.getByRole('button', { name: 'Open full activity history' }).click();
      await page.getByRole('region', { name: 'Full activity history' }).waitFor();
      assert.equal(await page.getByRole('status').filter({ hasText: 'Partial on-chain data' }).count(), 1);
      await page.keyboard.press('Escape');
      await page.getByRole('complementary', { name: 'Activity notifications' }).waitFor();
      assert.equal(await page.getByRole('status').filter({ hasText: 'Partial on-chain data' }).count(), 1);
    } finally { await browser.close(); }
  });
}
