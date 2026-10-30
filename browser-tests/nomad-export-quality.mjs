import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { nomadExport } from './fixtures/nomad-exports.mjs';
import { pageFor, mount, snapshot, send } from './fixtures/nomad-export-harness.mjs';
const output = '.browser-test-runtime/nomad-export-study/quality';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const variants = (process.env.NOMAD_VARIANTS || 'full,half,quarter,vector,loop').split(',');
const evidence = [], hash = data => createHash('sha256').update(data).digest('hex');
const pose = { time: 3, x: 120, y: 20, vx: 0, vy: 0, speed: .5 };
try {
  for (const [width, pixels, dpr] of [[1440, 120, 1], [1440, 800, 1], [390, 320, 2]]) {
    let simulation;
    for (const variant of variants) {
      const page = await pageFor(browser, width, dpr), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const { host, runtime } = await mount(page, await nomadExport(variant), pixels, dpr);
      const capture = name => page.screenshot({ path: `${output}/${variant}-${pixels}-${dpr}-${name}.png`,
        clip: { x: 0, y: 0, width: pixels, height: Math.ceil(pixels * 800 / 720) } });
      const a = await runtime.evaluate(() => nomadPerf.capture()); await page.waitForTimeout(250);
      assert.notEqual(hash(a), hash(await runtime.evaluate(() => nomadPerf.capture())), 'rendered geometry changes');
      if (variant === 'loop') {
        await runtime.evaluate(() => nomadPerf.loopPreview(true));
        const a = await capture('cloth-a'); await page.waitForTimeout(500);
        assert.notEqual(hash(a), hash(await capture('cloth-b')), 'baked cloth changes with frozen live transform');
        await runtime.evaluate(() => nomadPerf.loopPreview(false)); await page.waitForTimeout(100);
        const b = await capture('cloth-stopped'); await page.waitForTimeout(250);
        assert.equal(hash(b), hash(await capture('cloth-still')), 'poster stops baked animation');
      }
      await runtime.evaluate(() => nomadPerf.run(false)); const paused = await snapshot(runtime);
      await page.waitForTimeout(150); assert.equal((await snapshot(runtime)).paints, paused.paints);
      await runtime.evaluate(() => nomadPerf.run(true)); await page.waitForTimeout(80);
      await send(host, { type: 'inscape:html-artwork-visibility', visible: false }); await page.waitForTimeout(80);
      const hidden = await snapshot(runtime); await page.waitForTimeout(150);
      assert.equal((await snapshot(runtime)).callbacks, hidden.callbacks);
      await send(host, { type: 'inscape:html-artwork-visibility', visible: true }); await page.waitForTimeout(150);
      assert.ok((await snapshot(runtime)).state.time > hidden.state.time);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(80);
      const reduced = await snapshot(runtime); assert.equal(reduced.running, false);
      await page.waitForTimeout(100); assert.equal((await snapshot(runtime)).callbacks, reduced.callbacks);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); assert.equal((await snapshot(runtime)).running, false);
      await runtime.evaluate(pose => nomadPerf.pose(pose), pose); await page.waitForTimeout(80);
      await capture('pose');
      const encoded = await runtime.evaluate(() => nomadPerf.capture());
      await writeFile(`${output}/${variant}-${pixels}-${dpr}-capture.${['vector', 'loop'].includes(variant) ? 'svg' : 'png'}`, Buffer.from(encoded.split(',')[1], 'base64'));
      const beforeResize = await snapshot(runtime);
      for (const scale of [.1, .3, 1, 4, 32]) await send(host, { type: 'inscape:artwork-density', scale });
      await page.waitForTimeout(100); const huge = await snapshot(runtime);
      assert.ok(huge.buffer[0] * huge.buffer[1] <= 8_000_000 && Math.max(...huge.buffer) <= 4096);
      await send(host, { type: 'inscape:artwork-density', scale: pixels / 720 * dpr }); await page.waitForTimeout(100);
      const afterResize = await snapshot(runtime);
      assert.equal(afterResize.uploads, ['vector', 'loop'].includes(variant) ? 0 : 39);
      assert.deepEqual(afterResize.buffer, beforeResize.buffer);
      const times = Array.from({ length: 601 }, (_, i) => 100 + i * 8);
      const model = await runtime.evaluate(times => nomadPerf.simulate(times), times);
      if (!simulation) simulation = model; else assert.deepEqual(model, simulation);
      const reactive = await runtime.evaluate(() => {
        nomadPerf.pose({ time: 3, x: 0, y: 0, speed: 0 });
        const before = nomadPerf.capture(); const wind = document.getElementById('wind');
        wind.value = '100'; wind.dispatchEvent(new Event('input')); return before !== nomadPerf.capture();
      });
      assert.equal(reactive, variant !== 'loop');
      if (!['vector', 'loop'].includes(variant)) {
        await runtime.evaluate(() => nomadPerf.loseContext());
        await runtime.waitForFunction(() => nomadPerf.snapshot().status === 'failed');
        assert.equal((await snapshot(runtime)).posterVisible, true); await capture('fallback');
      }
      assert.deepEqual(errors, []);
      evidence.push({ variant, pixels, dpr, beforeResize, afterResize, motion: true, pause: true, visibility: true,
        reducedMotion: true, reactiveWind: reactive, flightIntegrationUnchanged: true, errors });
      await page.close(); console.log(JSON.stringify({ variant, pixels, dpr, passed: true }));
    }
  }
  for (const variant of variants) {
    const page = await pageFor(browser, 1440, 1, 'reduce');
    const a = await mount(page, await nomadExport(variant), 320), b = await mount(page, await nomadExport(variant), 320);
    assert.equal((await snapshot(a.runtime)).running, false); assert.equal((await snapshot(b.runtime)).running, false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await a.runtime.evaluate(pose => nomadPerf.pose(pose), pose); await b.runtime.evaluate(() => nomadPerf.run(true));
    const first = await snapshot(a.runtime), second = await snapshot(b.runtime); await page.waitForTimeout(400);
    assert.equal((await snapshot(a.runtime)).state.time, first.state.time);
    assert.ok((await snapshot(b.runtime)).state.time > second.state.time + .3);
    await page.evaluate(() => document.querySelectorAll('iframe').forEach(f => f.remove()));
    for (let i = 0; i < 20 && page.frames().length > 1; i++) await page.waitForTimeout(50);
    assert.equal(page.frames().length, 1); await page.close();
    const fallback = await pageFor(browser, 800);
    await fallback.evaluate(svg => { const img = new Image(); img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.style.cssText = 'width:720px;height:800px'; document.body.append(img); }, await nomadExport(variant, { probe: false }));
    await fallback.waitForFunction(() => document.images[0]?.complete && document.images[0].naturalWidth === 720);
    await fallback.screenshot({ path: `${output}/${variant}-image-only.png` }); await fallback.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ evidence, independentCopies: true, imageOnlyFallback: true }, null, 2));
} finally { await browser.close(); }
