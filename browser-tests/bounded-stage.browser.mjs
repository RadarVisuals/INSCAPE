import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5239';
const fixture = origin + '/browser-tests/profile-overview-fixture.html?view=0x1111111111111111111111111111111111111111&bounded=1';

test('bento expansion contains media and motion without changing layout or Display state', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage();
    for (const [width, linked, reducedMotion] of [[1280, true, 'no-preference'], [800, true, 'no-preference'], [480, false, 'reduce']]) {
      await page.setViewportSize({ width, height: 1050 });
      await page.emulateMedia({ reducedMotion });
      await page.goto(fixture + (linked ? '&linked=1' : ''));
      await page.locator('[data-bento-stage]').waitFor();
      await page.locator('[data-display-instance="display:primary"] [aria-label="Next Grid"]').waitFor();
      await page.getByRole('button', { name: 'Run stage checks' }).click();
      await page.waitForFunction(() => /PASS|FAIL/.test(document.querySelector('output').textContent));
      assert.match(await page.locator('output').textContent(), /— PASS$/);
      await page.getByRole('link', { name: 'Open A closer look' }).click();
      await page.getByRole('dialog', { name: 'Expanded work' }).waitFor();
      await page.setViewportSize({ width: width + 120, height: 1050 });
      await page.waitForTimeout(400);
      const bounds = await page.locator('[data-bento-stage]').evaluate(node => {
        const a = node.getBoundingClientRect(), b = node.querySelector('.bento-stage__expansion').getBoundingClientRect();
        return ['x','y','width','height'].every(key => Math.abs(a[key] - b[key]) < 1);
      });
      assert.ok(bounds);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: 'Expanded work' }).waitFor({ state: 'detached' });
    }
  } finally { await browser.close(); }
});
