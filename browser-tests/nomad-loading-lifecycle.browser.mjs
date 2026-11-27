import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { nomadStudy } from './fixtures/nomad-study.mjs';
import { ARTWORK_DOCUMENT_PATH, ARTWORK_DOCUMENT_HEADERS, ARTWORK_DOCUMENT_HTML } from '../scripts/artworkDocumentHost.js';

const source = await readFile('output/nomad-loading-2026-10-21/NOMAD-incremental-loading.svg', 'utf8');
// Validate the actual deliverable's inline JavaScript, without test probes.
for (const script of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
  new Script(script[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, ''));

test('the exported SVG runs and reloads without any measurement probes', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('output/nomad-loading-2026-10-21/NOMAD-incremental-loading.svg')).href);
    for (let visit = 0; visit < 2; visit++) {
      if (visit) await page.reload();
      await page.waitForFunction(() => document.getElementById('stage')?.dataset.ready === 'true');
      assert.equal(await page.evaluate(() => Boolean(window.nomadPerf)), false);
      assert.equal(await page.locator('#stage').getAttribute('data-uploads'), '39');
      assert.equal(await page.locator('#stage').getAttribute('data-mode'), 'hover');
      await page.locator('#fly').evaluate(button => button.click());
      const before = await page.locator('#stage').getAttribute('data-time');
      await page.waitForTimeout(160);
      assert.notEqual(await page.locator('#stage').getAttribute('data-time'), before);
      assert.equal(await page.locator('#stage').getAttribute('data-mode'), 'fly');
      await page.locator('#pause').evaluate(button => button.click());
      const paused = await page.locator('#stage').getAttribute('data-time');
      await page.waitForTimeout(120);
      assert.equal(await page.locator('#stage').getAttribute('data-time'), paused);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const interruption of ['dispose', 'context-loss', 'decode-failure']) {
  test(`Nomad loading handles ${interruption} during an awaited texture`, { timeout: 30000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const origin = 'http://127.0.0.1:5173';
      await page.route(origin + '/test', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
      await page.route(origin + ARTWORK_DOCUMENT_PATH, route => route.fulfill({ headers: ARTWORK_DOCUMENT_HEADERS, body: ARTWORK_DOCUMENT_HTML }));
      await page.addInitScript(() => {
        // Pause the fourth upload's re-decode, after three real textures have
        // been allocated. The host's optional thumbnail decode is not gated.
        const decode = HTMLImageElement.prototype.decode;
        const counts = new WeakMap();
        let repeats = 0;
        HTMLImageElement.prototype.decode = function () {
          const count = (counts.get(this) || 0) + 1; counts.set(this, count);
          if (count === 2 && ++repeats === 4) return new Promise((resolve, reject) => {
            window.textureGate = { resume: () => decode.call(this).then(resolve, reject), fail: () => reject(new Error('Test decode failure')) };
          });
          return decode.call(this);
        };
      });
      await page.goto(origin + '/test');
      await page.evaluate(async ({ svg, path }) => {
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        if (parsed.querySelector('parsererror')) throw new Error('Invalid SVG XML');
        const frame = document.createElement('iframe'); frame.sandbox = 'allow-scripts';
        frame.style.cssText = 'width:360px;height:400px'; frame.src = path;
        const loaded = new Promise(resolve => frame.onload = resolve); document.body.append(frame); await loaded;
        frame.contentWindow.postMessage({ type: 'inscape:artwork-source', svg }, '*');
      }, { svg: nomadStudy(source), path: ARTWORK_DOCUMENT_PATH });
      const host = page.frames().find(frame => frame.url().endsWith(ARTWORK_DOCUMENT_PATH));
      for (let i = 0; !host.childFrames().length && i < 100; i++) await page.waitForTimeout(20);
      const runtime = host.childFrames()[0];
      await runtime.waitForFunction(() => Boolean(window.textureGate));
      const before = await runtime.evaluate(() => nomadPerf.snapshot());
      assert.equal(before.uploads, 3); assert.equal(before.status, 'loading'); assert.equal(before.posterVisible, true);
      if (interruption === 'dispose') {
        await runtime.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
      } else if (interruption === 'context-loss') {
        await runtime.evaluate(() => nomadPerf.loseContext());
        await runtime.waitForFunction(() => nomadPerf.snapshot().status === 'failed');
      }
      await runtime.evaluate(fail => { if (fail) textureGate.fail(); else textureGate.resume(); }, interruption === 'decode-failure');
      if (interruption !== 'dispose') await runtime.waitForFunction(() => nomadPerf.snapshot().status === 'failed' && nomadPerf.snapshot().layers === 0);
      await page.waitForTimeout(200);
      const after = await runtime.evaluate(() => nomadPerf.snapshot());
      assert.equal(after.uploads, 3, 'resolving stale decode cannot allocate another texture');
      assert.equal(after.layers, 0, 'all already prepared GPU layers are released');
      assert.equal(after.posterVisible, true);
      if (interruption === 'dispose') assert.equal(after.disposed, true);
      else assert.equal(await runtime.locator('#retry').isVisible(), true);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
