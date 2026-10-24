import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5198';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
for (const kind of ['raster', 'svg']) test(`Image ${kind} Retry isolates attempts without authoring; Visitor also retains close and reopen`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  await mkdir(output, { recursive: true });
  try {
    for (const width of [1440, 640, 390]) for (const owner of [true, false]) for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: touch, reducedMotion: 'reduce' });
      page.setDefaultTimeout(6000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let fail = true, requests = 0, retryGate = null, releaseRetry;
      const sourceUrl = `https://load.test/artwork.${kind === 'svg' ? 'svg' : 'webp'}`;
      const ready = () => kind === 'svg'
        ? page.frameLocator('.image-module__canvas iframe').frameLocator('iframe').locator('#recovered-artwork').waitFor()
        : page.locator('.image-module__artwork[data-media-state="ready"]').waitFor();
      let releaseLate, lateRequests = 0;
      const late = new Promise(resolve => { releaseLate = resolve; });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route(sourceUrl, async route => {
        requests++;
        if (retryGate) await retryGate;
        return fail ? route.fulfill({ status: 404, body: 'Unavailable' })
          : kind === 'svg' ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><circle id="recovered-artwork" cx="1000" cy="1000" r="800" fill="#602ccd"/></svg>' })
          : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' });
      });
      await page.route('https://load.test/late.svg', async route => {
        if (++lateRequests === 1) return route.fulfill({ status: 404, body: 'Unavailable' });
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
      await page.evaluate(sourceUrl => {
        const api = imageFitFixture, draft = api.store.getDraft(), source = draft.imageModules[0];
        draft.imageModules = [{ ...source, id: 'image:load', name: 'Loading test', width: 320, height: 280,
          sides: [{ ...source.sides[0], asset: { ...source.sides[0].asset,
            media: { ...source.sides[0].asset.media, url: sourceUrl, width: 2000, height: 2000 } } }] }];
        draft.workbench.imageModules = [{ id: 'image:load', open: true, position: { left: 32, top: 64 } }];
        if (!api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() })) throw Error('Fixture failed to save');
        window.setImageTestUrl = url => {
          const next = api.store.getDraft();
          next.imageModules[0].sides[0].asset.media.url = url;
          if (!api.store.commitCompletedOperation(next, { expectedGeneration: api.store.getGeneration() })) throw Error('Source replacement failed');
        };
      }, sourceUrl);
      const saved = await page.evaluate(() => imageFitFixture.store.getDraft());
      await page.evaluate(owner => imageFitFixture.owner(owner), owner);
      // This isolated fixture forces its dock open even on narrow screens.
      // Move it using its real keyboard controls to uncover the Image.
      const dockMove = page.locator('.workbench-tool-panel-grip');
      if (await dockMove.count()) {
        await dockMove.focus();
        for (let i = 0; i < 32; i++) await dockMove.press('Shift+ArrowDown');
      }
      await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).waitFor().catch(async error => {
        await page.screenshot({ path: `${output}/missing-${kind}-${width}-${owner}-${touch}.png` });
        await writeFile(`${output}/missing-${kind}-${width}-${owner}-${touch}.json`, JSON.stringify({ errors, requests, state: await page.evaluate(() => ({ text: document.body.innerText, images: [...document.querySelectorAll('.image-module__window')].map(node => node.outerHTML) })) }, null, 2));
        throw error;
      });
      assert.ok(requests > 0, 'the original saved URL was requested');
      const canvas = page.locator('.image-module__canvas'), frame = page.locator('.image-module__window');
      const geometry = await frame.boundingBox();
      const inspect = page.locator('.image-module__window > .image-module__inspect');
      const modeChecks = width === 1440;
      const cropCheck = modeChecks && owner && !touch;
      const loadingCropCheck = modeChecks && owner && touch;
      if (modeChecks) {
        await inspect.focus(); await inspect.press('Enter');
        const back = page.getByRole('button', { name: 'Return to Image', exact: true });
        await back.getByRole('status').filter({ hasText: 'Artwork unavailable. Return to Image to retry.' }).waitFor();
        await back.click(); await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor({ state: 'hidden' });
        assert.deepEqual(await frame.boundingBox(), geometry, 'failed Inspect and Return do not move the camera or artwork');
        if (cropCheck) {
          await page.getByRole('button', { name: 'Crop', exact: true }).click();
          assert.equal(await canvas.getAttribute('data-cropping'), 'true');
        }
      }
      const history = await page.evaluate(() => ({ generation: imageFitFixture.store.getGeneration(), history: imageFitFixture.store.getHistory() }));
      const retry = page.getByRole('button', { name: kind === 'svg' ? 'Artwork unavailable — retry' : 'Retry artwork', exact: true });
      assert.equal(await retry.evaluate(node => Boolean(node.closest('.image-module__canvas') || node.parentElement.closest('button'))), false, 'Retry is outside the artwork button');
      await page.screenshot({ path: `${output}/image-${kind}-failed-${owner ? 'owner' : 'visitor'}-${width}-${touch ? 'touch' : 'pointer'}.png` });
      const beforeRetry = requests; fail = false;
      retryGate = new Promise(resolve => { releaseRetry = resolve; });
      const retriedRequest = page.waitForRequest(sourceUrl);
      if (touch) await retry.tap(); else { await retry.focus(); await retry.press('Enter'); }
      await retriedRequest;
      await page.getByRole('status').filter({ hasText: 'Loading artwork' }).waitFor();
      assert.ok(requests > beforeRetry, 'Retry genuinely requests the original source again');
      assert.equal(await retry.count(), 0, 'a pending attempt cannot be retried twice');
      if (modeChecks && !cropCheck) {
        await inspect.focus(); await inspect.press('Enter');
        const back = page.getByRole('button', { name: 'Return to Image', exact: true });
        await back.getByRole('status').filter({ hasText: 'Loading artwork' }).waitFor();
        await back.click(); await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor({ state: 'hidden' });
        assert.deepEqual(await frame.boundingBox(), geometry, 'loading Inspect and Return do not move the camera or artwork');
        if (loadingCropCheck) {
          await page.getByRole('button', { name: 'Crop', exact: true }).click();
          assert.equal(await canvas.getAttribute('data-cropping'), 'true');
          await page.getByRole('status').filter({ hasText: 'Loading artwork' }).waitFor();
        }
      }
      await page.locator('main.system-workflow').focus();
      retryGate = null; releaseRetry();
      await ready();
      await page.getByRole('status').filter({ hasText: 'Loading artwork' }).waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).count(), 0);
      assert.equal(await page.locator('main.system-workflow').evaluate(node => node === document.activeElement), true, 'load completion does not steal newer focus');
      assert.deepEqual(await frame.boundingBox(), geometry);
      assert.equal(await page.locator('.image-lift').count(), 0, 'Retry never invokes Inspect');
      assert.deepEqual(await page.evaluate(() => ({ generation: imageFitFixture.store.getGeneration(), history: imageFitFixture.store.getHistory() })), history, 'Retry makes no content, layout or history commit');
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), saved, 'media recovery does not edit saved content');
      if (cropCheck || loadingCropCheck) {
        assert.equal(await canvas.getAttribute('data-cropping'), 'true', 'Retry preserves the crop session');
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await canvas.getAttribute('data-cropping'), null);
        assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), saved, 'cancelling recovery crop authors nothing');
      }
      await page.screenshot({ path: `${output}/image-${kind}-recovered-${owner ? 'owner' : 'visitor'}-${width}-${touch ? 'touch' : 'pointer'}.png` });
      if (!owner) {
        const originalCanvas = await canvas.elementHandle();
        await canvas.focus();
        const close = page.getByRole('button', { name: 'Close Loading test', exact: true });
        if (touch) await close.tap(); else await close.click();
        await page.getByRole('button', { name: 'Loading test', exact: true }).focus();
        await page.keyboard.press('Enter');
        await ready();
        assert.equal(await originalCanvas.evaluate(node => node.isConnected), false, 'Visitor close and reopen mounts a fresh media instance');
        assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), saved);
      }
      await page.evaluate(() => setImageTestUrl('https://load.test/late.svg'));
      const lateRetry = page.getByRole('button', { name: 'Artwork unavailable — retry', exact: true });
      await lateRetry.waitFor();
      await lateRetry.click();
      await page.getByRole('status').filter({ hasText: 'Loading artwork' }).waitFor();
      await page.evaluate(url => setImageTestUrl(url), sourceUrl);
      await ready();
      const replaced = await page.evaluate(() => imageFitFixture.store.getDraft());
      releaseLate(); await page.waitForTimeout(100);
      assert.equal(await page.getByRole('status').filter({ hasText: 'Artwork unavailable' }).count(), 0, 'obsolete failure cannot replace the new ready state');
      await ready();
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), replaced, 'a late media result never writes a draft');
      if (owner && width === 1440 && !touch) {
        // Exercise the ordinary animated transition after recovery, including
        // a failed incoming side. Its existing Next action owns that retry.
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        let nextFailed = true, releaseNext;
        const nextGate = new Promise(resolve => { releaseNext = resolve; });
        const nextUrl = `https://load.test/next.${kind === 'svg' ? 'svg' : 'webp'}`;
        await page.route(nextUrl, async route => {
          if (nextFailed) return route.fulfill({ status: 404, body: 'Unavailable' });
          await nextGate;
          return kind === 'svg' ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><rect width="2000" height="2000" fill="#d44831"/></svg>' })
            : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' });
        });
        await page.evaluate(url => {
          const store = imageFitFixture.store, draft = store.getDraft(), first = draft.imageModules[0].sides[0];
          draft.imageModules[0].sides.push({ ...first, id: 'side:recovery-next', asset: { ...first.asset, media: { ...first.asset.media, url } } });
          store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
        }, nextUrl);
        const originalSide = await canvas.getAttribute('data-side-id');
        const currentArtwork = await canvas.locator(kind === 'svg' ? 'iframe' : '.image-module__artwork').elementHandle();
        const beforeFlip = await page.evaluate(() => ({ draft: imageFitFixture.store.getDraft(), generation: imageFitFixture.store.getGeneration(), history: imageFitFixture.store.getHistory() }));
        const next = page.getByRole('button', { name: 'Next Image side', exact: true });
        await next.focus(); await next.press('Enter');
        await canvas.getByRole('alert').filter({ hasText: 'Next side unavailable' }).waitFor({ timeout: 17000 });
        assert.equal(await canvas.getAttribute('data-side-id'), originalSide);
        assert.equal(await currentArtwork.evaluate(node => node.isConnected), true, 'failed preparation preserves the current artwork');
        assert.equal(await page.getByRole('button', { name: /retry/i }).count(), 0, 'incoming-side recovery stays with Next');
        nextFailed = false;
        await next.press('Enter');
        await canvas.getByRole('status').filter({ hasText: 'Loading next side' }).waitFor();
        releaseNext();
        await canvas.locator('.image-module__turn').waitFor();
        const preparedArtwork = await canvas.locator('.image-module__face--back').locator(kind === 'svg' ? 'iframe' : '.image-module__artwork').elementHandle();
        await canvas.locator('.image-module__turn').evaluate(node => node.getAnimations().forEach(animation => animation.finish()));
        await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:recovery-next');
        assert.equal(await preparedArtwork.evaluate(node => node.isConnected), true, 'promotion retains the prepared artwork instance');
        await next.press('Enter');
        await page.waitForFunction(id => document.querySelector('.image-module__canvas').dataset.sideId === id, originalSide);
        await ready();
        assert.deepEqual(await page.evaluate(() => ({ draft: imageFitFixture.store.getDraft(), generation: imageFitFixture.store.getGeneration(), history: imageFitFixture.store.getHistory() })), beforeFlip);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
