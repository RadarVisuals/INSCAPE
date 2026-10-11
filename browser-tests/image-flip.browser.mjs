import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5198';
const baseline = Boolean(process.env.INSCAPE_FLIP_BASELINE);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Image flip: loaded transparent artwork, midpoint, wraparound, reduced motion and saved-state isolation', { timeout: 90000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const measurements = [];
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25 });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let releaseBack;
      const backGate = new Promise(resolve => { releaseBack = resolve; });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route('https://flip.test/front.webp', route => route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }));
      await page.route('https://flip.test/back.webp', async route => { await backGate; await route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' }); });
      await page.route('https://flip.test/document', route => route.fulfill({ contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"><rect width="2000" height="2000" fill="#d44831"/><circle cx="1000" cy="1000" r="650" fill="#602ccd"/></svg>' }));
      await page.route(`${origin}/__image_flip__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__image_flip__`);
      await page.evaluate(async () => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        (await import('/browser-tests/image-fit-fixture.jsx')).mount();
      });
      await page.locator('.image-module__window').first().waitFor();
      await page.evaluate(() => {
        const api = imageFitFixture, draft = api.store.getDraft(), source = draft.imageModules[0];
        const sides = ['front', 'back'].map(name => ({ ...source.sides[0], id: `side:${name}`, crop: { x: .5, y: .5, zoom: 1.2 },
          asset: { ...source.sides[0].asset, media: { ...source.sides[0].asset.media, url: `https://flip.test/${name}.webp`, width: 2000, height: 2000 } },
        }));
        draft.imageModules = [{ ...source, id: 'image:flip', width: innerWidth > 600 ? 720 : 320, height: innerWidth > 600 ? 600 : 280, sides }];
        draft.workbench.imageModules = [{ id: 'image:flip', open: true, position: { left: 32, top: 64 } }];
        if (!api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() })) throw Error('Flip fixture failed to save');
      }); await settle(page);
      const canvas = page.locator('.image-module__canvas'), next = page.getByRole('button', { name: 'Next Image side' });
      await canvas.hover();
      await page.evaluate(async () => {
        const image = new Image(); image.src = 'https://flip.test/front.webp'; await image.decode();
        window.originalArt = document.querySelector('.image-module__artwork');
        window.pauseFlip = true;
        document.addEventListener('animationstart', event => {
          if (event.animationName !== 'image-side-turn') return;
          window.flipAnimation = event.target.getAnimations().find(animation => animation.animationName === event.animationName);
          if (window.pauseFlip) for (const animation of event.target.getAnimations({ subtree: true })) animation.pause();
        });
      });
      const saved = await page.evaluate(() => imageFitFixture.store.getDraft());
      await next.click();
      await page.getByRole('status').filter({ hasText: 'Loading next side' }).waitFor();
      assert.equal(await page.locator('.image-module__turn').count(), 0, 'cold media cannot start a half-loaded rotation');
      assert.equal(await canvas.getAttribute('data-side-id'), 'side:front', 'the current side stays visible while the next loads');
      assert.ok(await page.evaluate(() => originalArt.isConnected), 'requesting a flip does not remount the visible artwork');
      await page.evaluate(() => { window.incomingArt = document.querySelector('.image-module__side[data-preparing] .image-module__artwork'); });
      releaseBack();
      await page.waitForFunction(() => Boolean(window.flipAnimation));
      const duration = await page.evaluate(() => flipAnimation.effect.getTiming().duration);
      const samples = [];
      for (const fraction of [.25, .35, .45, .5, .55, .65, .75]) {
        await page.evaluate(time => { for (const animation of document.querySelector('.image-module__turn').getAnimations({ subtree: true })) animation.currentTime = time; }, duration * fraction); await settle(page);
        samples.push(await page.locator('.image-module__turn').evaluate((node, fraction) => {
          const m = new DOMMatrix(getComputedStyle(node).transform);
          return { fraction, angle: Math.atan2(m.m13, m.m11) * 180 / Math.PI,
            front: node.querySelector('.image-module__face')?.getBoundingClientRect().toJSON(),
            back: node.querySelector('.image-module__face--back')?.getBoundingClientRect().toJSON() };
        }, fraction));
        if ([.35, .5, .65].includes(fraction)) await page.screenshot({ path: `.browser-test-runtime/flip-${baseline ? 'before' : 'after'}-${width}-${fraction}.png` });
        if (fraction === .65) {
          const screenshot = await page.screenshot();
          const paintedOutside = await canvas.evaluate(async (node, png) => {
            const source = new Image(); source.src = `data:image/png;base64,${png}`; await source.decode();
            const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0);
            const r = node.getBoundingClientRect(), d = devicePixelRatio; let colored = 0;
            for (let y = Math.max(0, Math.floor((r.top - 80) * d)); y < Math.floor((r.top - 2) * d); y++)
              for (let x = Math.ceil(r.left * d); x < Math.floor(r.right * d); x++) {
                const [red, green, blue] = ctx.getImageData(x, y, 1, 1).data;
                if (Math.max(red, green, blue) - Math.min(red, green, blue) > 40) colored++;
              }
            return colored;
          }, screenshot.toString('base64'));
          if (width > 600) assert.ok(paintedOutside > 20, `the rotating artwork paints beyond its resting crop: ${paintedOutside}`);
        }
      }
      await page.evaluate(() => flipAnimation.finish());
      await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:back');
      assert.equal(await page.locator('.image-module__turn').count(), 0, 'resting artwork has no rotating layers');
      assert.equal(await canvas.evaluate(node => getComputedStyle(node).perspective), 'none');
      assert.ok(await page.evaluate(() => incomingArt.isConnected && document.querySelector('.image-module__artwork') === incomingArt), 'the prepared side becomes the resting artwork without remounting');
      assert.ok(Math.abs(samples.find(sample => sample.fraction === .5).angle - 90) < .01, 'the rotation crosses its edge at the midpoint of its duration');
      const frames = await page.evaluate(() => {
        window.pauseFlip = false;
        return new Promise(resolve => {
          const samples = []; let previous; const start = performance.now();
          document.querySelector('.image-module__next').click();
          const sample = now => {
            if (previous) samples.push(now - previous); previous = now;
            if (now - start < 900) requestAnimationFrame(sample);
            else resolve(samples);
          }; requestAnimationFrame(sample);
        });
      });
      assert.equal(await canvas.getAttribute('data-side-id'), 'side:front', 'last side wraps to the first');
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), saved, 'flipping never saves content or layout');
      await page.emulateMedia({ reducedMotion: 'reduce' }); await settle(page); await next.click();
      await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:back');
      assert.equal(await page.locator('.image-module__turn').count(), 0, 'reduced motion changes sides immediately');
      await next.click(); await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:front');
      await page.evaluate(() => imageFitFixture.owner(false)); await settle(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await settle(page);
      await next.click(); await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:back');
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), saved, 'Visitor uses the same transition without saving');
      // Extensionless SVGs wait for their live document, then retain that exact
      // document when the incoming face becomes the resting side.
      await page.emulateMedia({ reducedMotion: 'reduce' }); await settle(page); await next.click();
      await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:front');
      await page.evaluate(() => {
        const store = imageFitFixture.store, draft = store.getDraft();
        draft.imageModules[0].sides[1].asset.media.url = 'https://flip.test/document';
        if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('SVG fixture failed to save');
        window.flipAnimation = null; window.pauseFlip = true;
      }); await settle(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await settle(page); await next.click();
      await page.waitForFunction(() => Boolean(window.flipAnimation));
      assert.equal(await canvas.locator('.artwork-svg-status').count(), 0, 'the document is ready before its rotation begins');
      const document = await canvas.locator('iframe').elementHandle();
      await page.evaluate(() => flipAnimation.finish());
      await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:back');
      assert.ok(await canvas.locator('iframe').evaluate((node, original) => node === original, document), 'SVG flip completion retains its prepared runtime');
      if (width > 600) {
        let fail = true;
        await page.route('https://flip.test/retry.webp', route => fail ? route.abort()
          : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }));
        await page.evaluate(() => {
          const store = imageFitFixture.store, draft = store.getDraft();
          draft.imageModules[0].sides[0].asset.media.url = 'https://flip.test/retry.webp';
          store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
          window.flipAnimation = null;
        }); await settle(page); await canvas.hover(); await next.click();
        await canvas.getByRole('alert').waitFor();
        assert.equal(await canvas.getAttribute('data-side-id'), 'side:back', 'failed loading retains the current side');
        assert.equal(await page.locator('.image-module__turn').count(), 0);
        assert.equal(await next.isEnabled(), true, 'failed loading releases the Next action for retry');
        fail = false; await next.click(); await page.waitForFunction(() => Boolean(window.flipAnimation));
        await page.evaluate(() => flipAnimation.finish());
        await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:front');
        assert.equal(await canvas.getByRole('alert').count(), 0, 'retry performs a new load and clears the failure');

        let releaseLate;
        const lateGate = new Promise(resolve => { releaseLate = resolve; });
        await page.route('https://flip.test/late.webp', async route => { await lateGate; await route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' }); });
        await page.evaluate(() => {
          const store = imageFitFixture.store, draft = store.getDraft();
          draft.imageModules[0].sides[1].asset.media.url = 'https://flip.test/late.webp';
          store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
          window.flipAnimation = null;
        }); await settle(page); await next.click();
        await canvas.getByRole('status').waitFor();
        await page.locator('.image-module__close').click();
        await canvas.waitFor({ state: 'detached' }); releaseLate();
        await page.locator('.image-module__shortcut').click(); await canvas.waitFor(); await settle(page);
        assert.equal(await canvas.getAttribute('data-side-id'), 'side:front', 'closing cancels preparation instead of changing sides after reopening');
        assert.equal(await page.locator('.image-module__turn,[data-preparing]').count(), 0);
      }
      // Worst-case opaque black artwork must not remain a solid dark stripe
      // immediately around the edge-on frame. Compare actual painted pixels
      // with the same paused rotation without the brief opacity treatment.
      const blackImage = await page.evaluate(() => {
        const image = document.createElement('canvas'); image.width = 128; image.height = 128;
        const ctx = image.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128);
        return image.toDataURL('image/png').split(',')[1];
      });
      await page.route('https://flip.test/opaque.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(blackImage, 'base64') }));
      await page.evaluate(() => {
        const store = imageFitFixture.store, draft = store.getDraft(), source = draft.imageModules[0];
        draft.imageModules = [{ ...source, id: 'image:opaque', sides: source.sides.map(side => ({ ...side,
          asset: { ...side.asset, media: { ...side.asset.media, url: 'https://flip.test/opaque.png', width: 128, height: 128 } },
        })) }];
        draft.workbench.imageModules = [{ id: 'image:opaque', open: true, position: { left: 32, top: 64 } }];
        if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Opaque fixture failed to save');
        window.flipAnimation = null; window.pauseFlip = true;
      }); await settle(page); await canvas.hover(); await next.click();
      await page.waitForFunction(() => Boolean(window.flipAnimation));
      const seek = async fraction => {
        await page.evaluate(fraction => {
          for (const animation of document.querySelector('.image-module__turn').getAnimations({ subtree: true }))
            animation.currentTime = animation.effect.getTiming().duration * fraction;
        }, fraction); await settle(page);
      };
      const brightness = async () => {
        const png = await page.screenshot();
        return canvas.evaluate(async (node, png) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height;
          const ctx = surface.getContext('2d'); ctx.drawImage(image, 0, 0);
          const r = node.getBoundingClientRect(), x = Math.round((r.left + r.width / 2) * devicePixelRatio), y = Math.round((r.top + r.height / 2) * devicePixelRatio);
          const pixels = ctx.getImageData(x - 1, y - 1, 3, 3).data; let total = 0;
          for (let i = 0; i < pixels.length; i += 4) total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          return total / 9;
        }, png.toString('base64'));
      };
      await seek(.5); const background = await brightness();
      assert.ok(background > 30, 'the comparison point has a visible Workbench background');
      const edgeSamples = [];
      for (const fraction of [.35, .45, .49, .51, .55, .65]) {
        await seek(fraction); const soft = await brightness();
        if (fraction === .49) await page.screenshot({ path: `.browser-test-runtime/flip-opaque-edge-${width}.png` });
        const solidStyle = await page.addStyleTag({ content: '.image-module__artwork { opacity: 1 !important; }' }); await settle(page);
        const solid = await brightness(); await solidStyle.evaluate(node => node.remove()); await settle(page);
        const contrast = background - solid;
        assert.ok(contrast > 25, 'the untreated edge is visibly dark');
        if (fraction === .49 || fraction === .51)
          assert.ok(background - soft < contrast * .25, `edge-on dark contrast is softened on both sides: ${fraction}, ${soft}, ${solid}`);
        else assert.ok(Math.abs(soft - solid) < 2, `artwork stays opaque outside the short edge interval: ${fraction}`);
        edgeSamples.push({ fraction, soft, solid, background });
      }
      await page.evaluate(() => flipAnimation.finish());
      await page.waitForFunction(() => document.querySelector('.image-module__canvas').dataset.sideId === 'side:back');
      assert.equal(await canvas.locator('.image-module__artwork').evaluate(node => getComputedStyle(node).opacity), '1', 'the resting artwork is fully opaque');
      assert.equal(await canvas.evaluate(node => node.getAnimations({ subtree: true }).length), 0, 'no opacity or rotation animation remains at rest');
      measurements.push({ width, duration, samples, frames, edgeSamples });
      console.log(JSON.stringify({ width, duration, angles: samples.map(({ fraction, angle }) => ({ fraction, angle })), maxFrameMs: Math.max(...frames) }));
      assert.deepEqual(errors, []);
      await page.close();
    }
    await writeFile(`.browser-test-runtime/flip-${baseline ? 'before' : 'after'}.json`, JSON.stringify(measurements, null, 2));
  } finally { await browser.close(); }
});
