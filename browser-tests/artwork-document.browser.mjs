import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { handler } from '../netlify/functions/artwork-document.mjs';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';

test('vector-editor SVG declarations load without fetching DTDs; custom entities and invalid documents remain rejected', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const declaration = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    const drawing = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 3000 2500"><path d="M0 0H3000V2500H0Z" fill="#237b93"/></svg>';
    const requests = []; page.on('request', request => requests.push(request.url()));
    await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 600, seamReview: 'single',
      artwork: { url: 'https://motion.invalid/export.svg', width: 180, height: 150, body: declaration + drawing } });
    const image = page.locator('.image-module__canvas').first();
    await image.locator('.artwork-svg-document').waitFor();
    await image.locator('.artwork-svg-status').waitFor({ state: 'detached' });
    const host = await (await image.locator('iframe').elementHandle()).contentFrame();
    const document = host.childFrames()[0];
    await document.locator('svg').waitFor();
    assert.equal(await document.locator('svg').getAttribute('viewBox'), '0 0 3000 2500');
    assert.equal(await document.locator('path').getAttribute('fill'), '#237b93');
    assert.equal(await document.evaluate(() => window.document.doctype), null);
    assert.deepEqual(await document.evaluate(() => ({ width: innerWidth, height: innerHeight })), { width: 3000, height: 2500 }, 'native SVG layout must not upscale the 180x150 image-decoder default');
    assert.equal(await image.locator('foreignObject').getAttribute('width'), '3000');
    const documents = [
      declaration + drawing,
      declaration.replaceAll('"', "'") + drawing,
      drawing,
      '<!DOCTYPE svg SYSTEM "https://untrusted.invalid/custom.dtd">' + drawing,
      '<!DOCTYPE svg [<!ENTITY custom "expanded">]>' + drawing,
      declaration.replace('>', ' [<!ENTITY custom "expanded">]>') + drawing,
      '<!DOCTYPE html><html/>',
      '<svg xmlns="http://www.w3.org/2000/svg"><broken></svg>',
    ];
    const results = await page.evaluate(async documents => {
      const { readSvgArtwork, svgPreview } = await import('/src/public/ownerSystemWorkflow/LibraryArtworkImage.jsx');
      const values = [];
      for (const text of documents) {
        const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
        try {
          const svg = await readSvgArtwork(url);
          const preview = await (await svgPreview(url)).text();
          values.push({ valid: true, declaration: Boolean(svg.ownerDocument.doctype), preview });
        } catch { values.push({ valid: false }); }
        finally { URL.revokeObjectURL(url); }
      }
      return values;
    }, documents);
    assert.deepEqual(results.map(result => result.valid), [true, true, true, false, false, false, false, false]);
    for (const result of results.filter(result => result.valid)) {
      assert.equal(result.declaration, false);
      assert.match(result.preview, /width="3000" height="2500"/);
    }
    assert.equal(requests.some(url => /\.dtd(?:$|\?)/.test(url)), false);
  } finally { await browser.close(); }
});

test('the deployed artwork host runs SVG scripts with isolated storage, parent and network authority', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.route(`${origin}/__artwork_isolation__`, route => route.fulfill({ contentType: 'text/html', body: '<main>Workbench</main>' }));
    await page.route(`${origin}/.netlify/functions/artwork-document`, async route => {
      const response = await handler();
      await route.fulfill({ status: response.statusCode, headers: response.headers, body: response.body });
    });
    await page.goto(`${origin}/__artwork_isolation__`);
    await page.evaluate(async () => {
      window.artworkReports = [];
      addEventListener('message', event => { if (event.data?.type === 'artwork-isolation-result') window.artworkReports.push(event.data); });
      const frame = document.createElement('iframe');
      frame.sandbox = 'allow-scripts';
      frame.src = '/.netlify/functions/artwork-document';
      const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
      document.body.append(frame);
      await loaded;
      frame.contentWindow.postMessage({ type: 'inscape:artwork-source', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100">
        <rect width="160" height="100" fill="purple"/>
        <script><![CDATA[
          (async () => {
            const result = { type: 'artwork-isolation-result', script: true };
            try { top.document.body.dataset.artworkAccess = 'unsafe'; result.parent = true; } catch { result.parent = false; }
            try { localStorage.setItem('artwork-test', 'unsafe'); result.storage = true; } catch { result.storage = false; }
            try { await fetch('https://blocked.inscape.test/should-not-load'); result.network = true; } catch { result.network = false; }
            top.postMessage(result, '*');
          })();
        ]]></script></svg>` }, '*');
    });
    await page.waitForFunction(() => window.artworkReports.length === 1);
    assert.deepEqual(await page.evaluate(() => window.artworkReports[0]), {
      type: 'artwork-isolation-result', script: true, parent: false, storage: false, network: false,
    });
    assert.equal(await page.evaluate(() => document.body.dataset.artworkAccess), undefined);
    assert.equal(requests.some(url => url.startsWith('https://blocked.inscape.test/')), false);
    const host = page.frames().find(frame => frame.url().endsWith('/artwork-document'));
    const artwork = host.childFrames()[0];
    assert.equal(await artwork.locator('rect').getAttribute('fill'), 'purple');
    await Promise.all([
      page.waitForEvent('framedetached', frame => frame === host),
      page.waitForEvent('framedetached', frame => frame === artwork),
      page.locator('iframe').evaluate(frame => frame.remove()),
    ]);
    assert.equal(page.frames().length, 1, 'closing the host disposes the artwork document');
  } finally { await browser.close(); }
});
