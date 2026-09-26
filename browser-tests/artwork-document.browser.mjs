import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { handler } from '../netlify/functions/artwork-document.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';

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
