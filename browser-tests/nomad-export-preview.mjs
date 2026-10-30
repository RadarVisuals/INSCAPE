import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { startNomadPreview } from './serve-nomad-exports.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const output = '.browser-test-runtime/nomad-export-study/preview'; await mkdir(output, { recursive: true });
const { server, url } = await startNomadPreview();
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto(url);
    assert.equal(await page.evaluate(async () => { await document.fonts.ready;
      return document.fonts.check('14px Sora') && document.fonts.check('14px Plex'); }), true);
    for (const variant of ['full', 'half', 'quarter', 'vector', 'loop']) {
      await page.locator(`[data-variant="${variant}"]`).click();
      const frame = page.frameLocator('iframe'); await frame.locator('#stage[data-ready="true"]').waitFor();
      assert.equal(await page.locator('iframe').count(), 1);
      assert.equal(await frame.locator('#panel').isVisible(), false);
      const time = Number(await frame.locator('#stage').getAttribute('data-time'));
      await page.waitForTimeout(250); assert.ok(Number(await frame.locator('#stage').getAttribute('data-time')) > time);
      await page.getByRole('button', { name: 'Pauzeren', exact: true }).click(); await page.waitForTimeout(50);
      const paused = await frame.locator('#stage').getAttribute('data-time'); await page.waitForTimeout(150);
      assert.equal(await frame.locator('#stage').getAttribute('data-time'), paused);
      await page.getByRole('button', { name: 'Afspelen', exact: true }).click();
    }
    await page.locator('[data-variant="half"]').click(); await page.frameLocator('iframe').locator('#stage[data-ready="true"]').waitFor();
    await page.waitForTimeout(200); await page.screenshot({ path: `${output}/compare-${width}.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []); results.push({ width, variants: 5, oneLoaded: true, pauseResume: true, noHorizontalPageOverflow: true, errors });
    await page.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2)); console.log('Preview passed, wide and narrow.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
