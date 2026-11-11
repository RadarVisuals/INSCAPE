// Separate media quality/lifecycle checks; never mixed into CPU timing windows.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { handler } from '../netlify/functions/artwork-document.mjs';

const output = process.env.INSCAPE_QUALITY_OUTPUT || '.browser-test-runtime/svg-animation-study/quality';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const evidence = [], origin = 'http://127.0.0.1:5173';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  for (const [width, pixels, dpr] of [[1440, 120, 1], [1440, 800, 1], [390, 320, 2]]) {
    for (const mode of (process.env.INSCAPE_QUALITY_MODES || 'raf-30,css-30,css-60,loop').split(',')) {
      const source = await readFile(`.browser-test-runtime/svg-animation-study/media/${mode}.svg`, 'utf8');
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
      await page.route(origin + '/quality', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#cccac1"></body>' }));
      await page.route(origin + '/.netlify/functions/artwork-document', async route => {
        const response = await handler(); await route.fulfill({ status: response.statusCode, headers: response.headers, body: response.body });
      });
      await page.goto(origin + '/quality');
      await page.evaluate(async ({ source, pixels, dpr }) => {
        const frame = document.createElement('iframe'); frame.sandbox = 'allow-scripts';
        frame.style.cssText = `width:2048px;height:2048px;border:0;transform-origin:0 0;transform:scale(${pixels/2048})`;
        frame.src = '/.netlify/functions/artwork-document';
        const loaded = new Promise(resolve => frame.onload = resolve); document.body.append(frame); await loaded;
        frame.contentWindow.postMessage({ type: 'inscape:artwork-density', scale: pixels/2048*dpr }, '*');
        frame.contentWindow.postMessage({ type: 'inscape:artwork-source', svg: source }, '*');
      }, { source, pixels, dpr });
      const host = page.frames().find(f => f.url().endsWith('/artwork-document'));
      for (let i = 0; i < 100 && !host.childFrames().length; i++) await page.waitForTimeout(20);
      const runtime = host.childFrames()[0]; await runtime.waitForFunction(() => typeof perfControl === 'function');
      await page.waitForTimeout(500);
      const capture = async name => page.screenshot({ clip: { x: 0, y: 0, width: pixels, height: pixels },
        ...(name ? { path: `${output}/${mode}-${width}-${pixels}-${name}.png` } : {}) });
      const motionA = hash(await capture('playing')); await page.waitForTimeout(220); const motionB = hash(await capture());
      assert.notEqual(motionA, motionB, `${mode} must visibly animate`);
      await runtime.evaluate(() => perfControl('pause')); await page.waitForTimeout(100);
      const pausedA = hash(await capture()); await page.waitForTimeout(220); const pausedB = hash(await capture());
      assert.equal(pausedA, pausedB, `${mode} must stop`);
      await runtime.evaluate(() => perfControl('resume')); await page.waitForTimeout(220);
      assert.notEqual(hash(await capture()), pausedA, `${mode} must resume`);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(150);
      const reducedA = hash(await capture()); await page.waitForTimeout(220); const reducedB = hash(await capture());
      assert.equal(reducedA, reducedB, `${mode} must respect reduced motion`);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(220);
      assert.notEqual(hash(await capture()), reducedA, `${mode} must resume after reduced motion is disabled`);
      await runtime.evaluate(() => { perfControl('pause'); if (window.perfMode === 'css') document.getAnimations().forEach(a => a.currentTime = 0); else window.perfPose?.(0); });
      await page.waitForTimeout(150); await capture('pose-zero');
      evidence.push({ mode, width, pixels, dpr, motion: true, pause: true, resume: true, reducedMotion: true,
        resumeSemantics: mode === 'loop' ? 'returns to loop playback; poster stop is not frame-accurate seeking' : 'continues timeline' });
      await page.close(); console.log(JSON.stringify(evidence.at(-1)));
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
