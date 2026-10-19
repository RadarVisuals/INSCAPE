import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';

test('Owner runtime keeps Image recovery reachable beside Properties on pointer and touch layouts', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 640, 390]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', hasTouch: touch });
      page.setDefaultTimeout(6000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320, seamReview: 'single' });
      let fail = true;
      await page.route('https://recovery.test/failed.webp', route => fail
        ? route.fulfill({ status: 404, body: 'Unavailable' })
        : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }));
      await page.evaluate(() => {
        const draft = JSON.parse(localStorage.getItem(window.__motionKey));
        draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
        draft.imageModules = [{ ...draft.imageModules[0], name: 'Recovery image', width: 320, height: 280,
          sides: [{ ...draft.imageModules[0].sides[0], asset: { ...draft.imageModules[0].sides[0].asset,
            media: { ...draft.imageModules[0].sides[0].asset.media, url: 'https://recovery.test/failed.webp' } } }] }];
        draft.workbench.imageModules = [{ id: draft.imageModules[0].id, open: true, position: { left: 32, top: 64 } }];
        localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
      });
      await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).waitFor();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await page.locator('.image-module__canvas').focus();
      await page.locator('[data-context-tools] .context-toolbar').waitFor({ state: 'visible' });
      const close = page.getByRole('button', { name: 'Close Recovery image', exact: true });
      // The bounded Properties window must still expose its last field through
      // its own scroll area, without sacrificing the recovery controls.
      await page.locator('[data-context-tools]').getByRole('checkbox', { name: 'Include Image in publication' }).click({ trial: true });
      await close.click({ trial: true });
      const status = await page.locator('.image-module__flip-status').boundingBox();
      const inspect = await page.locator('.image-module__window > .image-module__inspect').boundingBox();
      assert.ok(status.y + status.height <= inspect.y, `Recovery text overlaps Inspect: ${JSON.stringify({ status, inspect })}`);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/recovery-${width}-${touch ? 'touch' : 'pointer'}.png` });
      fail = false;
      if (touch) await close.tap(); else await close.click();
      const reopen = page.getByRole('button', { name: 'Recovery image', exact: true });
      if (touch) await reopen.tap(); else await reopen.click();
      await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'retry never rewrites authored content');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
