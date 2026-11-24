import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';

async function sampleBackdrop(page, action) {
  await page.evaluate(() => {
    window.fadeSamples = [];
    let seen = false;
    function record() {
      const host = document.querySelector('.image-lift');
      if (!host && seen) return;
      if (host) {
        seen = true;
        const style = getComputedStyle(host);
        window.fadeSamples.push({
          progress: Number(style.getPropertyValue('--inspection-lift-progress')),
          alpha: Number(style.backgroundColor.match(/,\s*([\d.]+)\)$/)?.[1] || 0),
        });
      }
      window.fadeFrame = requestAnimationFrame(record);
    }
    record();
  });
  await action();
  return page.evaluate(() => {
    cancelAnimationFrame(window.fadeFrame);
    return window.fadeSamples;
  });
}

test('Image dimming follows Lift progress when opening and returning', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    for (const owner of [true, false]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://image.fit.test/source.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
      await page.goto(origin + '/browser-tests/image-fit-fixture.html');
      await page.locator('.image-module__canvas').first().waitFor();
      await page.evaluate(owner => { imageFitFixture.owner(owner); imageFitFixture.single(true); }, owner);
      const canvas = page.locator('.image-module__canvas').first();
      const dialog = page.getByRole('dialog', { name: 'Inspect Image' });
      const open = async () => {
        await canvas.focus(); await canvas.press('i'); await dialog.waitFor();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.image-lift')).getPropertyValue('--inspection-lift-progress').trim() === '1');
      };
      const close = async () => {
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await canvas.evaluate(node => document.activeElement === node), true);
        assert.equal(await page.locator('[data-inspection-lift], [data-lift-source]').count(), 0);
      };
      for (const action of [open, close]) {
        const samples = await sampleBackdrop(page, action);
        assert.ok(samples.some(s => s.progress > 0 && s.progress < 1), 'the transition has intermediate frames');
        for (const { progress, alpha } of samples) assert.ok(Math.abs(alpha - .65 * progress) < .01);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(); await close();
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
