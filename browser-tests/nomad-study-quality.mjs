// Actual opaque artwork host, separate from CPU timing. No user browser/storage.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { handler } from '../netlify/functions/artwork-document.mjs';
import { nomadStudy } from './fixtures/nomad-study.mjs';

const loadingStudy = process.env.INSCAPE_NOMAD_LOADING === '1';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/nomad-study/quality';
await mkdir(output, { recursive: true });
const source = await readFile('../../nomad-webp-svg/NOMAD-animated.svg', 'utf8');
const revised = loadingStudy ? await readFile('output/nomad-loading-2026-10-21/NOMAD-incremental-loading.svg', 'utf8') : source;
const originalImages = source.match(/<image\b[^>]+>/g);
assert.equal(originalImages.length, 39);
const variants = loadingStudy ? [{ name: 'reference', fps: 60 }, { name: 'incremental', fps: 60 }] :
  [{ name: 'uncapped', fps: 0 }, { name: '60', fps: 60 }, { name: '30', fps: 30 }, { name: '60-native', fps: 60, oversample: 1 }];
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const origin = 'http://127.0.0.1:5173', evidence = [], hash = data => createHash('sha256').update(data).digest('hex');
const pose = { time: 3, x: 120, y: 20, vx: 0, vy: 0, speed: .5 };
async function pageFor(width, dpr, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, reducedMotion });
  await page.route(origin + '/quality', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#cccac1"></body>' }));
  await page.route(origin + '/.netlify/functions/artwork-document', async route => {
    const response = await handler(); await route.fulfill({ status: response.statusCode, headers: response.headers, body: response.body });
  });
  await page.goto(origin + '/quality'); return page;
}
async function mount(page, svg, pixels, dpr) {
  const index = await page.evaluate(async ({ svg, pixels, dpr }) => {
    const index = document.querySelectorAll('iframe').length, frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.style.cssText = `position:absolute;left:${index * (pixels + 20)}px;top:0;width:720px;height:800px;border:0;transform-origin:0 0;transform:scale(${pixels/720})`;
    frame.src = '/.netlify/functions/artwork-document';
    const loaded = new Promise(resolve => frame.onload = resolve); document.body.append(frame); await loaded;
    frame.contentWindow.postMessage({ type: 'inscape:artwork-density', scale: pixels/720*dpr }, '*');
    frame.contentWindow.postMessage({ type: 'inscape:artwork-source', svg }, '*'); return index;
  }, { svg, pixels, dpr });
  const host = page.frames().filter(f => f.url().endsWith('/artwork-document'))[index];
  for (let i = 0; i < 100 && !host.childFrames().length; i++) await page.waitForTimeout(30);
  const runtime = host.childFrames()[0];
  await runtime.waitForFunction(() => window.nomadPerf?.snapshot().status === 'ready');
  await page.waitForTimeout(200); return { host, runtime };
}
const snapshot = runtime => runtime.evaluate(() => nomadPerf.snapshot());
const send = (host, data) => host.evaluate(data => document.querySelector('iframe').contentWindow.postMessage(data, '*'), data);
try {
  for (const [width, pixels, dpr] of [[1440, 120, 1], [1440, 800, 1], [390, 320, 2]]) {
    let reference, simulation;
    for (const variant of variants) {
      const svg = nomadStudy(variant.name === 'incremental' ? revised : source, variant); assert.deepEqual(svg.match(/<image\b[^>]+>/g), originalImages);
      const page = await pageFor(width, dpr), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const { host, runtime } = await mount(page, svg, pixels, dpr);
      const capture = async name => page.screenshot({ clip: { x: 0, y: 0, width: pixels, height: Math.ceil(pixels * 800 / 720) },
        ...(name ? { path: `${output}/${variant.name}-${pixels}-${dpr}-${name}.png` } : {}) });
      const a = await runtime.evaluate(() => nomadPerf.capture()); await page.waitForTimeout(350);
      assert.notEqual(hash(a), hash(await runtime.evaluate(() => nomadPerf.capture())), 'WebGL pixels change, not merely a clock');
      await runtime.evaluate(() => nomadPerf.run(false)); const paused = await snapshot(runtime);
      await page.waitForTimeout(180); assert.equal((await snapshot(runtime)).paints, paused.paints, 'pause stops drawing');
      await runtime.evaluate(() => nomadPerf.run(true)); await page.waitForTimeout(100);
      await send(host, { type: 'inscape:html-artwork-visibility', visible: false }); await page.waitForTimeout(100);
      const hidden = await snapshot(runtime); await page.waitForTimeout(180);
      assert.equal((await snapshot(runtime)).callbacks, hidden.callbacks, 'hidden artwork stops RAF');
      await send(host, { type: 'inscape:html-artwork-visibility', visible: true }); await page.waitForTimeout(160);
      assert.ok((await snapshot(runtime)).state.time > hidden.state.time, 'visibility resumes existing clock');
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(120);
      const reduced = await snapshot(runtime); assert.equal(reduced.running, false);
      await page.waitForTimeout(120); assert.equal((await snapshot(runtime)).callbacks, reduced.callbacks);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      // Preserve the original semantics: motion remains paused until explicit Play.
      assert.equal((await snapshot(runtime)).running, false);
      await runtime.evaluate(pose => nomadPerf.pose(pose), pose); await page.waitForTimeout(100);
      const pixelsAtPose = await runtime.evaluate(() => nomadPerf.capture());
      await writeFile(`${output}/${variant.name}-${pixels}-${dpr}-canvas.png`, Buffer.from(pixelsAtPose.split(',')[1], 'base64'));
      if (reference === undefined) reference = pixelsAtPose;
      const comparison = variant.oversample === 1 ? null : await page.evaluate(async ({ a, b }) => {
        const decode = async url => { const image = new Image(); image.src = url; await image.decode();
          const canvas = new OffscreenCanvas(image.width, image.height), ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
          return { size: [image.width, image.height], pixels: ctx.getImageData(0, 0, image.width, image.height).data }; };
        const left = await decode(a), right = await decode(b);
        if (String(left.size) !== String(right.size)) return { left: left.size, right: right.size, sameSize: false };
        let max = 0, sum = 0, changed = 0;
        for (let i = 0; i < left.pixels.length; i++) { const delta = Math.abs(left.pixels[i] - right.pixels[i]); max = Math.max(max, delta); sum += delta; if (delta) changed++; }
        return { sameSize: true, maxChannelDelta: max, meanChannelDelta: sum / left.pixels.length, changedChannels: changed };
      }, { a: reference, b: pixelsAtPose });
      if (comparison && (!comparison.sameSize || comparison.maxChannelDelta > 1)) {
        await writeFile(`${output}/pose-mismatch.json`, JSON.stringify({ variant, pixels, dpr, comparison, snapshot: await snapshot(runtime) }, null, 2));
        assert.fail('Pose mismatch: ' + JSON.stringify(comparison));
      }
      const times = Array.from({ length: 601 }, (_, i) => 100 + i * 8);
      const model = await runtime.evaluate(times => nomadPerf.simulate(times), times);
      if (!simulation) simulation = model; else assert.deepEqual(model, simulation, 'flight integration is unchanged');
      await capture('pose');
      const beforeResize = await snapshot(runtime);
      for (const scale of [.1, .3, 1, 4, 32]) await send(host, { type: 'inscape:artwork-density', scale });
      await page.waitForTimeout(200); const huge = await snapshot(runtime);
      assert.ok(huge.buffer[0] * huge.buffer[1] <= 8_000_000 && Math.max(...huge.buffer) <= 4096);
      await send(host, { type: 'inscape:artwork-density', scale: pixels / 720 * dpr });
      await page.waitForTimeout(150); const afterResize = await snapshot(runtime);
      assert.equal(afterResize.uploads, 39, 'zoom never reuploads source textures in a surviving document');
      assert.deepEqual(afterResize.buffer, beforeResize.buffer);
      const gpuMs = variant.name === '60' || variant.name === '60-native' ? await runtime.evaluate(() => nomadPerf.gpuSamples()) : null;
      await runtime.evaluate(() => nomadPerf.loseContext());
      await runtime.waitForFunction(() => nomadPerf.snapshot().status === 'failed');
      assert.equal((await snapshot(runtime)).posterVisible, true, 'context loss restores still image');
      await runtime.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const fallbackPixels = await capture('fallback');
      const fallbackInk = await page.evaluate(async base64 => {
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height), context = canvas.getContext('2d');
        context.drawImage(image, 0, 0); const { data } = context.getImageData(0, 0, image.width, image.height);
        let dark = 0, sampled = 0;
        for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
          // Exclude the central failure dialog and bottom corner gear. A visible
          // DOM group is insufficient evidence that the character was painted.
          if (x < image.width * .1 || x > image.width * .9 || (y > image.height * .35 && y < image.height * .6)) continue;
          const i = (y * image.width + x) * 4; sampled++;
          if (Math.max(data[i], data[i + 1], data[i + 2]) < 80 && data[i + 3] > 128) dark++;
        }
        return dark / sampled;
      }, fallbackPixels.toString('base64'));
      assert.ok(fallbackInk > .01, 'the fallback character must actually paint, not only become DOM-visible');
      assert.deepEqual(errors, []);
      evidence.push({ variant, width, pixels, dpr, poseHash: hash(pixelsAtPose), poseComparison: comparison,
        beforeResize, afterResize, hugeBuffer: huge.buffer, gpuMs, motion: true, pause: true, visibility: true,
        reducedMotion: true, contextLossFallback: true, fallbackInk, errors });
      await writeFile(`${output}/partial-results.json`, JSON.stringify(evidence, null, 2));
      await page.close(); console.log(JSON.stringify({ variant: variant.name, pixels, dpr, comparison, passed: true }));
    }
  }
  // Initial reduced motion and independent placements, not shared global state.
  const page = await pageFor(1440, 1, 'reduce');
  const a = await mount(page, nomadStudy(revised, { fps: 60 }), 320, 1);
  const b = await mount(page, nomadStudy(revised, { fps: 60 }), 320, 1);
  assert.equal((await snapshot(a.runtime)).running, false); assert.equal((await snapshot(b.runtime)).running, false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await a.runtime.evaluate(pose => nomadPerf.pose(pose), pose);
  await b.runtime.evaluate(() => nomadPerf.run(true)); const first = await snapshot(a.runtime), second = await snapshot(b.runtime);
  await page.waitForTimeout(500);
  assert.equal((await snapshot(a.runtime)).state.time, first.state.time);
  assert.ok((await snapshot(b.runtime)).state.time > second.state.time + .4);
  await page.screenshot({ path: `${output}/independent-copies.png` });
  await page.evaluate(() => document.querySelectorAll('iframe').forEach(f => f.remove()));
  await page.waitForTimeout(100); assert.equal(page.frames().length, 1);
  await page.close();
  // An image-only context cannot execute the renderer; the SVG poster remains visible.
  const fallback = await pageFor(800, 1);
  await fallback.evaluate(source => { const img = document.createElement('img'); img.src = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    img.style.cssText = 'width:720px;height:800px'; document.body.append(img); }, revised);
  await fallback.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth === 720);
  await fallback.screenshot({ path: `${output}/image-only-fallback.png` }); await fallback.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ sourceSha256: hash(source), revisedSha256: hash(revised), evidence, independentCopies: true,
    initialReducedMotion: true, finalUnmount: true, imageOnlyFallback: true }, null, 2));
} finally { await browser.close(); }
