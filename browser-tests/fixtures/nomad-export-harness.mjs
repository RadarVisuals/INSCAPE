import { handler } from '../../netlify/functions/artwork-document.mjs';
const origin = 'http://127.0.0.1:5173';
export async function pageFor(browser, width = 1440, dpr = 1, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, reducedMotion });
  await page.route(origin + '/quality', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#cccac1"></body>' }));
  await page.route(origin + '/.netlify/functions/artwork-document', async route => {
    const response = await handler(); await route.fulfill({ status: response.statusCode, headers: response.headers, body: response.body });
  });
  await page.goto(origin + '/quality'); return page;
}
export async function mount(page, svg, pixels = 720, dpr = 1) {
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
  if (!runtime) throw new Error('No artwork document');
  await runtime.waitForFunction(() => window.nomadPerf?.snapshot().status !== 'loading');
  const status = await snapshot(runtime); if (status.status !== 'ready') throw new Error(JSON.stringify(status));
  await page.waitForTimeout(150); return { host, runtime };
}
export const snapshot = runtime => runtime.evaluate(() => nomadPerf.snapshot());
export const send = (host, data) => host.evaluate(data => document.querySelector('iframe').contentWindow.postMessage(data, '*'), data);
