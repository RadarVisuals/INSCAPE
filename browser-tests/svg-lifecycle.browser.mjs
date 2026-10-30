import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { ARTWORK_DOCUMENT_HEADERS } from '../scripts/artworkDocumentHost.js';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5188';
const output = process.env.INSCAPE_SVG_TEST_OUTPUT || process.env.INSCAPE_BROWSER_OUTPUT || '.svg-lifecycle-results';
test('cold SVG loading stays accessible without a visible label; failure still offers Retry', { timeout: 30000 }, async () => {
  const { browser, page } = await open();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    await page.route('**/svg-lifecycle-source.svg', async route => {
      await gate;
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Unavailable test artwork' });
    });
    await page.goto(`${origin}/browser-tests/svg-lifecycle-fixture.html`);
    const plain = page.getByRole('region', { name: 'Plain host', exact: true });
    await plain.locator('[data-artwork-loading]').waitFor({ state: 'attached' });
    assert.equal(await plain.locator('[data-artwork-loading]').textContent(), 'Loading artwork…');
    const paint = await plain.locator('[data-artwork-loading]').evaluate(node => ({ clip: getComputedStyle(node).clipPath,
      width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
    assert.equal(paint.clip, 'inset(50%)'); assert.equal(paint.width, 1); assert.equal(paint.height, 1);
    release();
    await plain.getByRole('button', { name: 'Artwork unavailable — retry', exact: true }).waitFor();
    assert.equal(await plain.locator('[data-artwork-loading]').count(), 0, 'failure is not hidden like loading');
  } finally { release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
});
const open = async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  return { browser, page };
};

test('animated SVG and HTML release observers, subscriptions, listeners and attempt timers across repeated A/B/A activation', { timeout: 45000 }, async () => {
  const { browser, page } = await open();
  try {
    let pendingDownload, markRequested;
    const downloadRequested = new Promise(resolve => { markRequested = resolve; });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('**/svg-lifecycle-source.svg?activation=cancelled', route => { pendingDownload = route; markRequested(); });
    await page.route(`${origin}/__resource_cycles__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.route(`${origin}/__animated_html__*`, route => route.fulfill({ contentType: 'text/html', body: `<canvas width="100" height="100"></canvas><script>
      const ctx=document.querySelector('canvas').getContext('2d');
      function paint(t){ctx.clearRect(0,0,100,100);ctx.fillRect((t/20)%80,20,20,20);parent.postMessage({type:'resource-cycle-tick'},'*');requestAnimationFrame(paint)}requestAnimationFrame(paint);
    </script>` }));
    await page.goto(`${origin}/__resource_cycles__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Projected = (await import('/src/artwork/ProjectedSvgArtwork.jsx')).default;
      const Html = (await import('/src/miniApps/HtmlArtworkFrame.jsx')).default;
      const { ArtworkGeometry } = await import('/src/artwork/ArtworkGeometry.jsx');
      const observers = new Set(), listeners = new Map(), timers = new Set(), subscriptions = new Set();
      for (const name of ['ResizeObserver', 'IntersectionObserver']) {
        const Native = window[name];
        window[name] = class extends Native {
          observe(node, options) { observers.add(this); return super.observe(node, options); }
          disconnect() { observers.delete(this); return super.disconnect(); }
        };
      }
      const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
      window.addEventListener = (type, listener, options) => {
        if (type === 'resize' || type === 'message') {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type).add(listener);
        }
        return add(type, listener, options);
      };
      window.removeEventListener = (type, listener, options) => { listeners.get(type)?.delete(listener); return remove(type, listener, options); };
      const set = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => {
        const id = set(() => { timers.delete(id); callback(...args); }, delay);
        if ([1500, 15000, 20000].includes(delay)) timers.add(id);
        return id;
      };
      window.clearTimeout = id => { timers.delete(id); return clear(id); };
      const geometry = { isProjected: () => false, subscribe(callback) { subscriptions.add(callback); return () => subscriptions.delete(callback); } };
      window.resourceSnapshot = () => ({ observers: observers.size, listeners: [...listeners.values()].reduce((n, set) => n + set.size, 0), timers: timers.size, subscriptions: subscriptions.size });
      window.htmlTicks = 0;
      window.resourceAborts = 0; window.svgReadySources = [];
      const fetchSource = window.fetch.bind(window);
      window.fetch = (url, options) => {
        if (String(url).includes('activation=cancelled')) options?.signal?.addEventListener('abort', () => window.resourceAborts++, { once: true });
        return fetchSource(url, options);
      };
      add('message', event => { if (event.data?.type === 'resource-cycle-tick') window.htmlTicks++; });
      function Fixture() {
        const [active, setActive] = React.useState(null), [ready, setReady] = React.useState(false);
        window.activateResource = value => { setReady(false); setActive(value); };
        return React.createElement(ArtworkGeometry.Provider, { value: geometry },
          React.createElement('output', null, active ? (ready ? 'ready' : 'loading') : 'closed'),
          active && React.createElement(React.StrictMode, { key: active },
            React.createElement('div', { style: { width: 280, height: 240 } }, React.createElement(Projected, {
              src: `/browser-tests/svg-lifecycle-source.svg?activation=${active}`, width: 280, height: 240,
              dimensions: { width: 280, height: 240 }, onReady: () => { window.svgReadySources.push(active); setReady(true); },
            })),
            React.createElement('div', { style: { width: 100, height: 100 } }, React.createElement(Html, {
              url: new URL(`/__animated_html__?activation=${active}`, location.origin), name: 'Resource animation', width: 100, height: 100,
            }))));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    });
    await page.getByText('closed', { exact: true }).waitFor();
    const baseline = await page.evaluate(() => window.resourceSnapshot());
    await page.evaluate(() => window.activateResource('cancelled'));
    await downloadRequested;
    await page.evaluate(() => window.activateResource('replacement'));
    await page.getByText('ready', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => window.resourceAborts > 0), 'source replacement aborts the pending fetch');
    await pendingDownload.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><text>obsolete</text></svg>' }).catch(() => {});
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.svgReadySources.includes('cancelled')), false, 'late source cannot become the new ready document');
    await page.evaluate(() => window.activateResource(null));
    await page.getByText('closed', { exact: true }).waitFor();
    await page.waitForFunction(expected => JSON.stringify(window.resourceSnapshot()) === JSON.stringify(expected), baseline);
    for (const activation of ['A', 'B', 'A', 'B', 'A']) {
      const ticks = await page.evaluate(() => window.htmlTicks);
      await page.evaluate(value => window.activateResource(value), activation);
      await page.getByText('ready', { exact: true }).waitFor();
      await page.waitForFunction(previous => window.htmlTicks > previous + 2, ticks);
      assert.equal(await page.locator('iframe').count(), 2, 'both real documents are active');
      assert.ok((await page.evaluate(() => window.resourceSnapshot())).subscriptions > baseline.subscriptions);
      await page.evaluate(() => window.activateResource(null));
      await page.getByText('closed', { exact: true }).waitFor();
      await page.waitForFunction(expected => JSON.stringify(window.resourceSnapshot()) === JSON.stringify(expected), baseline);
      assert.equal(await page.locator('iframe').count(), 0);
      await page.waitForTimeout(50); // Drain already queued cross-frame messages.
      const stopped = await page.evaluate(() => window.htmlTicks);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.htmlTicks), stopped, 'disposed HTML animation no longer executes');
    }
  } finally { await browser.close(); }
});

test('a disposed tool source cannot unregister its same-ID replacement or another activation', { timeout: 20000 }, async () => {
  const { browser, page } = await open();
  try {
    await page.route(`${origin}/__registration_lifecycle__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__registration_lifecycle__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { WorkbenchView, useWorkbenchToolSource } = await import('/src/public/ownerSystemWorkflow/WorkbenchViewContext.js');
      const maps = { A: new Map(), B: new Map() };
      const views = Object.fromEntries(Object.entries(maps).map(([id, toolSources]) => [id, { store: {}, toolSources, toolsChanged() {} }]));
      window.registrationValue = activation => maps[activation].get('text:replacement')?.current.label || null;
      function Source({ label }) { useWorkbenchToolSource('text:replacement', { label, controls: null }); return null; }
      function Fixture() {
        const [old, setOld] = React.useState(true), [next, setNext] = React.useState(false), [activation, setActivation] = React.useState('A');
        window.replaceSource = () => setNext(true); window.removeOldSource = () => setOld(false); window.switchRegistration = setActivation;
        return React.createElement(WorkbenchView.Provider, { value: views[activation] }, React.createElement(React.StrictMode, { key: activation },
          old && React.createElement(Source, { key: 'old', label: 'old' }),
          next && React.createElement(Source, { key: 'new', label: 'new' })));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    });
    await page.waitForFunction(() => window.registrationValue('A') === 'old');
    await page.evaluate(() => window.replaceSource());
    await page.waitForFunction(() => window.registrationValue('A') === 'new');
    await page.evaluate(() => window.removeOldSource());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.registrationValue('A')), 'new');
    for (const activation of ['B', 'A']) {
      await page.evaluate(value => window.switchRegistration(value), activation);
      await page.waitForFunction(value => window.registrationValue(value) === 'new' && window.registrationValue(value === 'A' ? 'B' : 'A') === null, activation);
    }
  } finally { await browser.close(); }
});

test('real SVG host loads plain, projected and StrictMode documents and remounts cleanly', { timeout: 45000 }, async () => {
  const { browser, page } = await open();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await mkdir(output, { recursive: true });
    await page.goto(`${origin}/browser-tests/svg-lifecycle-fixture.html`);
    for (const name of ['Plain host', 'Projected host', 'Strict projected host']) {
      await page.getByLabel(`${name} ready`, { exact: true }).filter({ hasText: 'Ready' }).waitFor({ timeout: 20000 });
    }
    await page.screenshot({ path: `${output}/local-svg-ready.jpg` });
    await page.getByRole('button', { name: 'Unmount artwork', exact: true }).click();
    assert.equal(await page.locator('iframe').count(), 0);
    await page.getByRole('button', { name: 'Mount artwork', exact: true }).click();
    for (const name of ['Plain host', 'Projected host', 'Strict projected host']) {
      await page.getByLabel(`${name} ready`, { exact: true }).filter({ hasText: 'Ready' }).waitFor({ timeout: 20000 });
    }
    assert.deepEqual(errors, []);
    await writeFile(`${output}/normal-host.json`, JSON.stringify({ status:'passed', browser:await browser.version(), errors, text:await page.locator('main').innerText() }, null, 2));
  } finally { await browser.close(); }
});

test('projected artwork coalesces resize notifications and retains idle documents without measuring them', { timeout: 30000 }, async () => {
  const { browser, page } = await open();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/browser-tests/svg-lifecycle-fixture.html`);
    for (const name of ['Projected host', 'Strict projected host'])
      await page.getByLabel(`${name} ready`, { exact: true }).filter({ hasText: 'Ready' }).waitFor();
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settle();
    const frames = await page.locator('[data-svg-artwork-host] iframe').elementHandles();
    assert.equal(frames.length, 2);
    await page.evaluate(() => {
      window.projectionReads = 0;
      const read = SVGGraphicsElement.prototype.getScreenCTM;
      SVGGraphicsElement.prototype.getScreenCTM = function (...args) {
        if (this.localName === 'foreignObject') window.projectionReads++;
        return read.apply(this, args);
      };
      for (let i = 0; i < 40; i++) dispatchEvent(new Event('resize'));
    });
    await settle();
    assert.equal(await page.evaluate(() => window.projectionReads), 2, 'one measurement per live artwork for a burst of resize notifications');
    for (let index = 0; index < frames.length; index++)
      assert.equal(await page.locator('[data-svg-artwork-host] iframe').nth(index).evaluate((node, original) => node === original, frames[index]), true);
    await page.locator('[data-svg-artwork-host]').evaluateAll(nodes => nodes.forEach(node => node.parentElement.style.transform = 'translateY(2000px)'));
    await page.waitForTimeout(150); // Deliver the viewport observer after the transform.
    assert.equal(await page.locator('[data-svg-artwork-host] iframe').count(), 2);
    await settle();
    await page.evaluate(() => {
      window.projectionReads = 0;
      for (let i = 0; i < 40; i++) dispatchEvent(new Event('resize'));
    });
    await settle();
    assert.equal(await page.evaluate(() => window.projectionReads), 0, 'offscreen documents consume no density measurements');
    await page.locator('[data-svg-artwork-host]').evaluateAll(nodes => nodes.forEach(node => node.parentElement.style.transform = ''));
    await settle();
    for (let index = 0; index < frames.length; index++)
      assert.equal(await page.locator('[data-svg-artwork-host] iframe').nth(index).evaluate((node, original) => node === original, frames[index]), true,
        'returning uses the original isolated document');
    await page.getByRole('button', { name: 'Unmount artwork', exact: true }).click();
    await settle();
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a host navigation that never finishes offers bounded failure and a working retry', { timeout: 45000 }, async () => {
  const { browser, page } = await open();
  let stalled = true;
  const pending = [];
  try {
    await mkdir(output, { recursive: true });
    await page.route('**/.netlify/functions/artwork-document', route => {
      if (!stalled) return route.continue();
      return new Promise(resolve => pending.push({ route, resolve }));
    });
    await page.goto(`${origin}/browser-tests/svg-lifecycle-fixture.html`, { waitUntil:'domcontentloaded' });
    const plain = page.getByRole('region', { name:'Plain host', exact:true });
    await plain.getByRole('button', { name:'Artwork unavailable — retry', exact:true }).waitFor({ timeout:20000 });
    await page.screenshot({ path:`${output}/stalled-host-retry.jpg` });
    stalled = false;
    await plain.getByRole('button', { name:'Artwork unavailable — retry', exact:true }).click();
    await page.getByLabel('Plain host ready', { exact:true }).filter({ hasText:'Ready' }).waitFor({ timeout:10000 });
    assert.equal(await plain.getByText('Loading artwork…', { exact:true }).count(), 0);
    await writeFile(`${output}/stalled-host.json`, JSON.stringify({ status:'passed', text:await plain.innerText() }, null, 2));
  } finally {
    for (const entry of pending) { await entry.route.abort().catch(()=>{}); entry.resolve(); }
    await browser.close();
  }
});

test('a late ready message cannot clear a timed-out attempt; retry mounts a fresh host', { timeout:45000 }, async () => {
  const { browser, page } = await open();
  let late = true;
  try {
    await page.route('**/.netlify/functions/artwork-document', route => late ? route.fulfill({
      headers: ARTWORK_DOCUMENT_HEADERS,
      body: `<html><body><script>addEventListener('message', event => {
        if (event.source !== parent || event.data?.type !== 'inscape:artwork-source') return;
        setTimeout(() => { document.body.textContent='Late ready sent'; parent.postMessage({type:'inscape:artwork-loaded'}, '*'); }, 17000);
      });</script></body></html>`,
    }) : route.continue());
    await page.goto(`${origin}/browser-tests/svg-lifecycle-fixture.html`);
    const plain = page.getByRole('region', { name:'Plain host', exact:true });
    const retry = plain.getByRole('button', { name:'Artwork unavailable — retry', exact:true });
    await retry.waitFor({ timeout:20000 });
    await plain.frameLocator('iframe').getByText('Late ready sent', { exact:true }).waitFor({ timeout:5000 });
    assert.equal(await retry.isVisible(), true, 'a failed attempt stays failed after a late message');
    assert.equal(await page.getByLabel('Plain host ready', { exact:true }).innerText(), 'Waiting');
    late = false;
    await retry.click();
    await page.getByLabel('Plain host ready', { exact:true }).filter({ hasText:'Ready' }).waitFor({ timeout:10000 });
  } finally { await browser.close(); }
});

test('an unavailable SVG source fails visibly and a new attempt recovers', { timeout:20000 }, async () => {
  const { browser, page } = await open();
  let unavailable = true;
  const requests = [], errors = [];
  page.on('response', response => {
    if (/svg-lifecycle-source\.svg|artwork-document/.test(response.url())) requests.push({ url:response.url(), status:response.status() });
  });
  page.on('requestfailed', request => requests.push({ url:request.url(), failure:request.failure() }));
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/svg-lifecycle-source.svg', route => unavailable
      ? route.fulfill({ status:503, contentType:'text/plain', body:'Temporarily unavailable' }) : route.continue());
    await page.goto(`${origin}/browser-tests/svg-lifecycle-fixture.html`);
    const plain = page.getByRole('region', { name:'Plain host', exact:true });
    await plain.getByRole('button', { name:'Artwork unavailable — retry', exact:true }).waitFor();
    unavailable = false;
    await plain.getByRole('button', { name:'Artwork unavailable — retry', exact:true }).click();
    await page.getByLabel('Plain host ready', { exact:true }).filter({ hasText:'Ready' }).waitFor({ timeout:10000 });
  } catch (error) {
    await mkdir(output, { recursive:true });
    const state = await page.getByRole('region', { name:'Plain host', exact:true }).innerText().catch(() => null);
    await writeFile(`${output}/source-retry-failure.json`, JSON.stringify({ error:error.message, requests, errors, state,
      frames:page.frames().map(frame => frame.url()) }, null, 2));
    await page.screenshot({ path:`${output}/source-retry-failure.png` }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
});
