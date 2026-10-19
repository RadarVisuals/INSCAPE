import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { ARTWORK_DOCUMENT_HEADERS } from '../scripts/artworkDocumentHost.js';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5188';
const output = process.env.INSCAPE_SVG_TEST_OUTPUT || process.env.INSCAPE_BROWSER_OUTPUT || '.svg-lifecycle-results';
const open = async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  return { browser, page };
};

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
