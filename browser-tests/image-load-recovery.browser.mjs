import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5198';
test('Image first raster reports failure and recovers on reopen without authoring content', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  await mkdir('.browser-test-runtime', { recursive: true });
  try {
    for (const width of [1440, 390]) for (const owner of [true, false]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(6000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let fail = true, requests = 0;
      let releaseLate;
      const late = new Promise(resolve => { releaseLate = resolve; });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route('https://load.test/artwork.webp', route => {
        requests++;
        return fail ? route.fulfill({ status: 404, body: 'Unavailable' })
          : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' });
      });
      await page.route('https://load.test/late.webp', async route => {
        await late;
        // Source replacement can cancel the original request before release.
        await route.fulfill({ status: 404, body: 'Late failure' }).catch(() => {});
      });
      await page.route(`${origin}/__image_loading__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__image_loading__`);
      await page.evaluate(async () => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        (await import('/browser-tests/image-fit-fixture.jsx')).mount();
      });
      await page.locator('.image-module__window').first().waitFor();
      await page.evaluate(() => {
        const api = imageFitFixture, draft = api.store.getDraft(), source = draft.imageModules[0];
        draft.imageModules = [{ ...source, id: 'image:load', name: 'Loading test', width: 320, height: 280,
          sides: [{ ...source.sides[0], asset: { ...source.sides[0].asset,
            media: { ...source.sides[0].asset.media, url: 'https://load.test/artwork.webp', width: 2000, height: 2000 } } }] }];
        draft.workbench.imageModules = [{ id: 'image:load', open: true, position: { left: 32, top: 64 } }];
        if (!api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() })) throw Error('Fixture failed to save');
        window.setImageTestUrl = url => {
          const next = api.store.getDraft();
          next.imageModules[0].sides[0].asset.media.url = url;
          if (!api.store.commitCompletedOperation(next, { expectedGeneration: api.store.getGeneration() })) throw Error('Source replacement failed');
        };
      });
      const saved = await page.evaluate(() => imageFitFixture.store.getDraft());
      await page.evaluate(owner => imageFitFixture.owner(owner), owner);
      await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).waitFor();
      assert.ok(requests > 0, 'the original saved URL was requested');
      await page.screenshot({ path: `.browser-test-runtime/image-load-failed-${owner ? 'owner' : 'visitor'}-${width}.png` });
      const beforeRetry = requests; fail = false;
      await page.locator('.image-module__window').focus();
      await page.getByRole('button', { name: 'Close Loading test', exact: true }).click();
      await page.getByRole('button', { name: 'Loading test', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      assert.ok(requests > beforeRetry, 'reopening genuinely retries the source');
      assert.equal(await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).count(), 0);
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), saved, 'media recovery does not edit saved content');
      await page.screenshot({ path: `.browser-test-runtime/image-load-recovered-${owner ? 'owner' : 'visitor'}-${width}.png` });
      await page.evaluate(() => setImageTestUrl('https://load.test/late.webp'));
      await page.getByRole('status').filter({ hasText: 'Loading artwork' }).waitFor();
      await page.evaluate(() => setImageTestUrl('https://load.test/artwork.webp'));
      await page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      const replaced = await page.evaluate(() => imageFitFixture.store.getDraft());
      releaseLate(); await page.waitForTimeout(100);
      assert.equal(await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).count(), 0, 'obsolete failure cannot replace the new ready state');
      assert.equal(await page.locator('.image-module__artwork').getAttribute('data-media-state'), 'ready');
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), replaced, 'a late media result never writes a draft');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
