import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { productionResponseSecurityHeaders } from '../scripts/productionSecurityPolicy.js';

const origin = 'http://127.0.0.1:5193', appOrigin = 'https://new-mini-app.test';
const secondOrigin = 'https://another-mini-app.test', radarOrigin = 'https://radar725.netlify.app';
const profile = `0x${'1'.repeat(40)}`, account = `0x${'2'.repeat(40)}`;
const headers = productionResponseSecurityHeaders();
const bundle = await build({ entryPoints: ['browser-tests/mini-app-fixture.js'], bundle: true, write: false, format: 'iife' });
await mkdir('output/mini-apps', { recursive: true });
const server = await preview({ configFile: false, build: { outDir: 'dist' }, preview: { host: '127.0.0.1', port: 5193, strictPort: true, headers } });
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  for (const origin of [appOrigin, secondOrigin, radarOrigin]) await context.grantPermissions(['microphone'], { origin });
  await context.addInitScript(() => {
    if (location.origin !== 'https://radar725.netlify.app' || !navigator.mediaDevices) return;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await getUserMedia(constraints); window.testAudioStream = stream; return stream;
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(`${origin}/__production_host__`, route => route.fulfill({ headers, contentType: 'text/html',
    body: '<!doctype html><title>Built mini app host check</title><body style="margin:0"></body>' }));
  for (const app of [appOrigin, secondOrigin]) {
    await page.route(`${app}/fixture`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script src="/fixture-client.js"></script></body>' }));
    await page.route(`${app}/fixture-client.js`, route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
  }
  await page.goto(`${origin}/__production_host__`);
  const open = async (url, microphone, { live = false, p1 = false } = {}) => {
    await page.evaluate(({ url, microphone, profile }) => {
      document.body.replaceChildren(); window.hostPort?.close(); window.hostReady = false; window.hostRequests = [];
      const frame = document.createElement('iframe'); frame.title = 'Production bridge';
      frame.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
      frame.allow = `autoplay; fullscreen; microphone ${microphone ? `'self' ${new URL(url).origin}` : "'none'"}; camera 'none'; geolocation 'none'`;
      window.hostState = { connected: false, canConnect: true, accounts: [], contextAccounts: [profile], chainId: 42,
        rpcUrls: ['https://rpc.mainnet.lukso.network'], generation: 0 };
      frame.onload = () => {
        const transport = new MessageChannel(); window.hostPort = transport.port1;
        hostPort.onmessage = ({ data }) => {
          if (data.type === 'ready') window.hostReady = true;
          if (data.type === 'request') {
            hostRequests.push(data.request);
            hostPort.postMessage({ type: 'response', id: data.id, error: { code: 4100, message: 'Test harness has no wallet authority.' } });
          }
        };
        hostPort.start(); frame.contentWindow.postMessage({ type: 'inscape:mini-app-init', url, name: 'RADAR', microphone,
          state: hostState }, location.origin, [transport.port2]);
      };
      frame.src = '/mini-app-host.html'; document.body.append(frame);
    }, { url, microphone, profile });
    if (live) {
      await page.frameLocator('iframe').frameLocator('iframe').getByText('PLAYER', { exact: true }).click({ timeout: 45000 });
    }
    if (p1) await page.frameLocator('iframe').frameLocator('iframe').locator('.chassis-topbar').waitFor({ timeout: 30000 });
    else await page.waitForFunction(() => hostReady);
    return page.frames().find(frame => frame.url() === url);
  };
  let app = await open(`${appOrigin}/fixture`, false);
  assert.ok(app);
  await app.waitForFunction(profile => miniAppFixture.provider.contextAccounts[0] === profile, profile);
  assert.deepEqual(await app.evaluate(() => miniAppFixture.provider.accounts), []);
  await app.getByRole('button', { name: 'Start microphone' }).click();
  await app.getByText('Microphone unavailable', { exact: true }).waitFor();
  await page.evaluate(account => {
    hostState = { ...hostState, connected: true, accounts: [account] };
    hostPort.postMessage({ type: 'state', state: hostState });
  }, account);
  await app.waitForFunction(account => miniAppFixture.provider.accounts[0] === account, account);
  app = await open(`${appOrigin}/fixture`, true);
  await app.getByRole('button', { name: 'Start microphone' }).click();
  await app.getByText('Microphone active', { exact: true }).waitFor();
  // A new URL uses the same production build, with fresh connection state and
  // no inherited microphone delegation even after another origin used Mic.
  app = await open(`${secondOrigin}/fixture`, false);
  await app.waitForFunction(profile => miniAppFixture.provider.contextAccounts[0] === profile, profile);
  assert.deepEqual(await app.evaluate(() => miniAppFixture.provider.accounts), []);
  await app.getByRole('button', { name: 'Start microphone' }).click();
  await app.getByText('Microphone unavailable', { exact: true }).waitFor();
  app = await open(`${secondOrigin}/fixture`, true);
  await app.getByRole('button', { name: 'Start microphone' }).click();
  await app.getByText('Microphone active', { exact: true }).waitFor();
  app = await open(`${secondOrigin}/fixture`, false);
  await app.getByRole('button', { name: 'Start microphone' }).click();
  await app.getByText('Microphone unavailable', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS built bridge: production CSP, scoped microphone policy, context and connection events');

  if (process.env.INSCAPE_TEST_LIVE_P1 === '1') {
    app = await open('https://p1.upturn.live/', false, { p1: true });
    assert.ok(app);
    await app.getByRole('button', { name: 'Connect', exact: true }).waitFor();
    assert.ok((await page.locator('iframe').getAttribute('allow')).includes("microphone 'none'"));
    assert.equal(await app.evaluate(() => document.featurePolicy.allowsFeature('microphone')), false);
    await page.screenshot({ path: 'output/mini-apps/p1-production.png' });
    console.log('PASS deployed P1: player and its own Connect control render under production headers; microphone starts denied');
  }
  if (process.env.INSCAPE_TEST_LIVE_RADAR === '1') {
    const response = await context.request.head(radarOrigin);
    console.log('RADAR deployment:', response.status(), 'framing policy:', response.headers()['x-frame-options'] || response.headers()['content-security-policy'] || 'no restrictive framing header');
    app = await open(`${radarOrigin}/`, true, { live: true });
    assert.ok(app); await app.locator('canvas').first().waitFor();
    await app.getByText('Fetching Setlist...', { exact: true }).waitFor({ state: 'hidden', timeout: 45000 });
    await app.locator('.menu-dot').click();
    await app.getByRole('button', { name: 'Enable Mic Sync' }).click();
    await app.waitForFunction(() => window.testAudioStream?.getAudioTracks().some(track => track.readyState === 'live'));
    console.log('Live RADAR accepted the browser synthetic microphone');
    await app.locator('.player-menu-modal').click({ position: { x: 8, y: 8 } });
    await app.locator('canvas').first().evaluate(canvas => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: 'output/mini-apps/radar-production-wide.png' });
    console.log('Live RADAR UI:', (await app.locator('body').innerText()).slice(0, 3000));
    console.log('Live RADAR canvases:', await app.locator('canvas').count());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/mini-apps/radar-production-narrow.png' });
    console.log('Live RADAR browser errors:', errors);
    assert.equal(await page.evaluate(() => hostRequests.some(request => ['eth_sendTransaction', 'personal_sign'].includes(request.method))), false);
    console.log('PASS deployed RADAR: unchanged website loaded and completed the standard provider handshake inside the built host');
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
