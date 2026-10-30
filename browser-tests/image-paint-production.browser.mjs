import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { productionResponseSecurityHeaders } from '../scripts/productionSecurityPolicy.js';

test('built Image worker runs under production headers; native-size and forbidden sources fall back', { timeout: 30000 }, async () => {
  const workers = (await readdir('dist/assets')).filter(file => /^imagePaint\.worker-.*\.js$/.test(file));
  assert.equal(workers.length, 1);
  const workerPath = `/assets/${workers[0]}`;
  const script = await readFile(`dist${workerPath}`), source = await readFile('public/assets/actors/abyssal_eye/full.webp');
  const security = productionResponseSecurityHeaders();
  const server = createServer((request, response) => {
    const body = request.url === workerPath ? script : request.url === '/source.webp' ? source : '<!doctype html><title>Paint worker test</title>';
    response.writeHead(200, { ...security, 'Content-Type': request.url === workerPath ? 'application/javascript' : request.url === '/source.webp' ? 'image/webp' : 'text/html' });
    response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin);
    const results = await page.evaluate(async workerPath => {
      const worker = new Worker(workerPath, { type: 'module' });
      let id = 0;
      const prepare = (source, width) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Worker did not finish')), 8000);
        worker.onerror = event => { clearTimeout(timeout); reject(Error(event.message)); };
        worker.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data); };
        worker.postMessage({ type: 'prepare', id: ++id, source, width, height: width });
      });
      try {
        const small = await prepare(location.origin + '/source.webp', 512);
        const pixels = await createImageBitmap(small.blob);
        const result = { type: small.blob.type, width: pixels.width, height: pixels.height };
        pixels.close();
        result.native = (await prepare(location.origin + '/source.webp', 2000)).blob;
        result.forbidden = (await prepare('https://unlisted.invalid/source.webp', 512)).blob;
        return result;
      } finally { worker.terminate(); }
    }, workerPath);
    assert.deepEqual(results, { type: 'image/png', width: 512, height: 512, native: null, forbidden: null });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
