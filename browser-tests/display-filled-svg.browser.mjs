import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountFilledDisplay } from './fixtures/display-filled-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

test('filled animated SVG scene retains runtime through inspection and disposes hidden documents', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await mountFilledDisplay(page, 'http://127.0.0.1:5173', { svg: true });
      if (width === 390) await setWorkbenchZoom(page, .67);
      const source = page.locator('.system-workflow__grid-plane--current [data-system-workflow-placement-id]').last();
      await source.focus();
      const iframe = await source.locator('iframe').elementHandle();
      assert.ok(iframe, 'live isolated document, not static image');
      assert.equal(await iframe.getAttribute('sandbox'), 'allow-scripts');
      const host = await iframe.contentFrame();
      const runtime = host.childFrames()[0];
      await runtime.waitForFunction(() => window.__filledSvgTicks > 1);
      const sample = () => runtime.evaluate(() => ({ id: window.__filledSvgInstance, ticks: window.__filledSvgTicks, x: document.getElementById('pulse').getAttribute('cx') }));
      const before = await sample();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor();
      await page.waitForTimeout(650);
      const during = await sample();
      assert.equal(during.id, before.id); assert.ok(during.ticks > before.ticks); assert.notEqual(during.x, before.x);
      await page.screenshot({ path: `output/display-filled-audit/filled-svg-inspection-${width}.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Close artwork viewer', exact: true }).waitFor({ state: 'hidden' });
      const after = await sample();
      assert.equal(after.id, before.id); assert.ok(after.ticks > during.ticks);
      assert.equal(await source.locator('iframe').evaluate((node, original) => node === original, iframe), true);
      await page.waitForTimeout(250);
      const documents = await page.locator('.artwork-svg-document').count();
      assert.equal(documents, 30, 'six SVGs in each of the five prepared rail slots');
      assert.equal(await page.locator('[data-svg-artwork-host]').count(), 30);
      assert.equal(await page.evaluate(() => JSON.stringify(filledDisplay.draft()) === JSON.stringify(filledDisplay.initialDraft)), true);
      await page.screenshot({ path: `output/display-filled-audit/filled-svg-composition-${width}.png` });
      const minimize = page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true });
      const detached = page.waitForEvent('framedetached', { predicate: frame => frame === runtime });
      await minimize.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('.artwork-svg-document'));
      await detached;
      assert.equal(runtime.isDetached(), true, 'hidden module disposes script document');
      console.log(JSON.stringify({ width, documents, svgHosts: 30, animationContinued: true, disposed: true }));
      await page.close();
    }
  } finally { await browser.close(); }
});
