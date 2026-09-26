import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
test('inspection lands on the original shared artwork edge at fractional sizes', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const displayWidth of [601.3, 601.7, 427.6]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194', visitor, heavy: true, displayWidth, seamReview: true });
      const placement = page.locator('.system-workflow__presentation-board .system-workflow__placement[tabindex="0"], .system-workflow__presentation-board .lattice-production-placement[tabindex="0"]').first();
      await placement.waitFor();
      for (const zoom of [1, .73, .41]) {
        await setWorkbenchZoom(page, zoom);
        await placement.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        await page.waitForFunction(() => Number(document.querySelector('.system-workflow__lift-artwork')?.parentElement.style.getPropertyValue('--inspection-lift-progress')) === 1);
        await page.evaluate(() => {
          window.landing = null;
          const sample = () => {
            const lift = document.querySelector('.system-workflow__lift-artwork');
            if (!lift) return;
            if (Number(lift.parentElement.style.getPropertyValue('--inspection-lift-progress')) === 0) {
              const source = document.querySelector('[data-lift-source]').getBoundingClientRect(), target = lift.getBoundingClientRect();
              window.landing = Object.fromEntries(['left', 'top', 'right', 'bottom'].map(key => [key, target[key] - source[key]]));
              const sourceImage = document.querySelector('[data-lift-source] img[data-resolution="high"], [data-lift-source] img').getBoundingClientRect();
              const liftImage = lift.querySelector('img').getBoundingClientRect();
              for (const key of ['left', 'top', 'right', 'bottom']) window.landing[`media-${key}`] = liftImage[key] - sourceImage[key];
            }
            requestAnimationFrame(sample);
          }; requestAnimationFrame(sample);
        });
        await page.keyboard.press('Escape');
        await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
        const landing = await page.evaluate(() => window.landing);
        assert.ok(landing, 'captured final landing frame');
        for (const [edge, delta] of Object.entries(landing)) assert.ok(Math.abs(delta) < .04, `${visitor ? 'Visitor' : 'Owner'} zoom ${zoom} ${edge} drift ${delta}`);
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), await page.evaluate(() => window.__motionSaved), 'inspection does not rewrite placement geometry');
      if (displayWidth === 601.7) await page.screenshot({ path: `.browser-test-runtime/display-seam-return-${visitor}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});
