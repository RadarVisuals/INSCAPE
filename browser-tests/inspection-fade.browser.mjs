import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
test('Image and Display dimming follow Lift progress in both directions', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: 600 });
      await page.locator('.image-module__canvas').first().waitFor();
      for (const kind of ['image', 'display']) {
        if (kind === 'image') { await page.locator('.image-module__canvas').first().focus(); await page.keyboard.press('Enter'); }
        else { await page.locator('.system-workflow__presentation-board').locator('.system-workflow__placement[tabindex="0"], .lattice-production-placement[tabindex="0"]').first().dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); }
        await page.locator('.system-workflow__lift-artwork').waitFor();
        const sample = () => page.evaluate(async kind => {
          const samples = [];
          for (let i = 0; i < 20; i++) {
            const lift = document.querySelector('.system-workflow__lift-artwork'); if (!lift) break;
            const host = lift.parentElement, p = Number(getComputedStyle(host).getPropertyValue('--inspection-lift-progress'));
            const backdrop = kind === 'image' ? getComputedStyle(host).backgroundColor
              : getComputedStyle(document.querySelector('[data-inspection-context="background"]')).filter;
            samples.push({ p, backdrop }); await new Promise(requestAnimationFrame);
          }
          return samples;
        }, kind);
        const opening = await sample();
        await page.waitForTimeout(480);
        await page.screenshot({ path: `.browser-test-runtime/inspect-fade-${kind}-${visitor}-${width}.png` });
        await page.keyboard.press('Escape'); const closing = await sample();
        assert.ok(opening.some(s => s.p > 0 && s.p < 1), `${kind} opening has intermediate progress`);
        assert.ok(closing.some(s => s.p > 0 && s.p < 1), `${kind} return has intermediate progress`);
        for (const s of [...opening, ...closing]) {
          const value = kind === 'image' ? Number(s.backdrop.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)?.[1] || 0)
            : Number(s.backdrop.match(/brightness\(([\d.]+)\)/)?.[1]);
          assert.ok(Math.abs(value - (kind === 'image' ? .65 * s.p : 1 - .82 * s.p)) < .01, `${kind} backdrop shares animation progress`);
        }
        await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.locator('[data-inspection-lift]').count(), 0);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('.image-module__canvas').first().focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.image-lift')).getPropertyValue('--inspection-lift-progress') === '1');
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
      await page.close();
    }
  } finally { await browser.close(); }
});
