import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const url = origin + '/browser-tests/profile-overview-fixture.html?view=0x' + '1'.repeat(40);

for (const [width, height] of [[390, 320], [1440, 900]]) {
  test(`direct artist profile and account controls remain reachable at ${width}x${height}`, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(6000);
      const errors = [];
      const directoryRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (request.postData()?.includes('InscapeDirectory')) directoryRequests.push(request.url());
      });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(url);
      const home = page.getByRole('link', { name: 'Inscape home' });
      assert.equal(await home.getAttribute('href'), '/');
      const header = page.locator('.visitor-header');
      assert.deepEqual(await header.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button').allTextContents(), ['Profile', 'Gallery', 'Writing']);
      await page.goto(url + '&viewer=1');
      const account = header.getByRole('button', { name: 'Reader account' });
      await account.click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const settings = page.getByRole('button', { name: 'Close Settings' });
      await settings.waitFor();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Reader account');
      await page.emulateMedia({ forcedColors: 'active' });
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      assert.ok(await account.evaluate(node => node.matches(':focus-visible') && getComputedStyle(node).outlineStyle !== 'none'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await account.click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      assert.ok(await page.evaluate(() => window.__fixtureDisconnected));
      assert.deepEqual(errors, []);
      assert.deepEqual(directoryRequests, []);
    } finally {
      await browser.close();
    }
  });
}
