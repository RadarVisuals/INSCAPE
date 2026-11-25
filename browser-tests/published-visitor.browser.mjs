import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createBrowserTestCleanup,
  createLifecycleDiagnostics,
  runBrowserSetupWithCleanup,
  withinDeadline
} from './browser-test-lifecycle.mjs';
import {
  createPlaywrightRouteController,
  launchPlaywrightEdge,
  waitForCspFixtureReady
} from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, `.browser-test-runtime-published-visitor-${process.pid}-${Date.now()}-${randomUUID()}`);
const profileA = '0x1111111111111111111111111111111111111111';
const profileB = '0x2222222222222222222222222222222222222222';
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(Boolean);

let vite;
let browser;
let context;
let page;
let cleanupBrowserTest;
let pageCdp;
let baseUrl;
let setupAbortController;
let interceptionInstalled = false;
let routeController;
let activeViewport = { width: 1280, height: 720, touch: false };
let navigationSequence = 0;
const resources = {};
const browserProblems = [];
const expectedCspProblems = [];
let acceptingExpectedCspProblems = false;
const recordBrowserProblem = (problem) => {
  const expectedBlockedFixtureRequest = /^Request failed: https:\/\/csp-blocked\.invalid csp$/iu.test(problem);
  const expectedReplacedFixtureImage = /^Request failed: https:\/\/published-images\.invalid net::ERR_ABORTED$/u.test(problem);
  const expectedReplacedProfileRead = /^Request failed: https:\/\/rpc\.mainnet\.lukso\.network net::ERR_ABORTED$/u.test(problem);
  if (expectedBlockedFixtureRequest || expectedReplacedFixtureImage || expectedReplacedProfileRead
      || (acceptingExpectedCspProblems && /content security policy|refused to connect/iu.test(problem))) {
    expectedCspProblems.push(problem);
    return;
  }
  browserProblems.push(problem);
};
const imageRequests = [];
const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwHjWQAAAABJRU5ErkJggg==';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const lifecycleDiagnostic = createLifecycleDiagnostics();

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolvePort(port));
    });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a local browser-test port', () => socket.close());
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try {
      await withinDeadline(access(candidate), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, `Timed out inspecting browser candidate: ${candidate}`);
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error('No Chromium browser found. Set BROWSER_PATH to Edge, Chrome, or Chromium.');
}

// A cold HTML/dependency transform exceeded five seconds in the audit repair run.
// Keep it bounded within the separate 60-second overall setup deadline.
async function waitForViteReadiness(url, signal, timeoutMs = 30_000) {
  const started = Date.now(); let lastError;
  while (Date.now() - started < timeoutMs) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(2_000)]) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await delay(50);
  }
  throw new Error(`Test-owned Vite did not become HTTP-ready within ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ''}`);
}

async function evaluate(expression) {
  return page.evaluate(expression);
}

async function waitFor(expression, label, timeout = 10_000) {
  try { const handle = await page.waitForFunction(expression, undefined, { timeout, polling: 50 }); await handle.dispose(); }
  catch (error) { throw Object.assign(new Error(`Timed out waiting for ${label}: ${error.message}`, { cause: error }), { code: 'ETIMEDOUT' }); }
}

async function viewport(width, height, touch = false) {
  activeViewport = { width, height, touch };
  await page.setViewportSize({ width, height });
  await pageCdp.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  await waitFor(`innerWidth === ${width} && innerHeight === ${height}`, `${width}x${height} viewport`);
}

async function navigate(address = profileA) {
  const run = String(++navigationSequence);
  const fixtureUrl = `${baseUrl}/browser-tests/fixture.html?view=${address}&run=${run}`;
  try {
    assert.equal(interceptionInstalled, true, 'Playwright routing must exist before navigation');
    const response = await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.ok(response?.ok(), `Fixture navigation returned HTTP ${response?.status() ?? 'unknown'}`);
    lifecycleDiagnostic('bootstrap:document-loaded');
    await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(address)} && window.__fixture?.ready === true`, 'published fixture');
    lifecycleDiagnostic('bootstrap:fixture-mounted');
    await waitFor(`document.querySelector('.visitor-grid-world') && window.__fixture`, 'v9 published visitor world');
    lifecycleDiagnostic('bootstrap:published-ready');
  } catch (error) {
    await collectBootstrapDiagnostics(error, fixtureUrl);
    throw error;
  }
  await page.locator('.image-module__canvas').first().waitFor();
}

async function collectBootstrapDiagnostics(error, fixtureUrl) {
  let state = {}; let viteReachable = false;
  try { state = await evaluate(`(()=>{const root=document.querySelector('[data-browser-fixture]');return {href:location.href,readyState:document.readyState,root:Boolean(root),rootChildren:Math.min(root?.childElementCount||0,100),published:Boolean(document.querySelector('.visitor-grid-world')&&window.__fixture)}})()`); } catch { state = { evaluation: 'unavailable' }; }
  try { viteReachable = (await fetch(fixtureUrl, { signal: AbortSignal.timeout(BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs) })).ok; } catch { /* bounded diagnostic only */ }
  lifecycleDiagnostic('bootstrap:failed-state', {
    code: error.code || 'ERROR', location: state.href?.startsWith(baseUrl) ? 'fixture' : state.href || 'unknown', readyState: state.readyState || 'unknown',
    fixtureRoot: state.root ?? 'unknown', rootChildren: state.rootChildren ?? 'unknown', published: state.published ?? 'unknown',
    interceptionBeforeNavigation: interceptionInstalled, viteReachable
  });
}

async function navigateCsp(address = profileA) {
  const run = String(++navigationSequence);
  await page.goto(`${baseUrl}/browser-tests/fixture.html?view=${address}&run=${run}&csp=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForCspFixtureReady(page, { fixtureOrigin: baseUrl });
  await viewport(activeViewport.width, activeViewport.height, activeViewport.touch);
}

async function navigateProviderFixture() {
  await page.goto(`${baseUrl}/browser-tests/provider-lifecycle-fixture.html`, { waitUntil: 'domcontentloaded', timeout: 10_000 });
  await waitFor(`!!window.__providerFixture`, 'provider lifecycle fixture');
}

async function point(selector, xRatio = 0.5, yRatio = 0.5) {
  const rect = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width*${xRatio},y:r.top+r.height*${yRatio},left:r.left,top:r.top,width:r.width,height:r.height}})()`);
  assert.ok(rect && Number.isFinite(rect.x) && Number.isFinite(rect.y), `No usable point for ${selector}`);
  return rect;
}

async function mouse(type, x, y, options = {}) {
  await page.mouse.move(x, y);
  if (type === 'mousePressed') await page.mouse.down({ button: options.button || 'left', clickCount: options.clickCount || 1 });
  else if (type === 'mouseReleased') await page.mouse.up({ button: options.button || 'left', clickCount: options.clickCount || 1 });
  else if (type === 'mouseWheel') await page.mouse.wheel(options.deltaX || 0, options.deltaY || 0);
}

async function click(selector) {
  const target = await point(selector);
  const hit = await evaluate(`(()=>{const n=document.elementFromPoint(${target.x},${target.y});const target=document.querySelector(${JSON.stringify(selector)});return {tag:n?.tagName,className:String(n?.className||''),label:n?.getAttribute?.('aria-label'),matches:Boolean(n?.closest?.(${JSON.stringify(selector)})),targetPointer:getComputedStyle(target).pointerEvents,targetZ:getComputedStyle(target).zIndex,parentPointer:getComputedStyle(target.parentElement).pointerEvents,parentZ:getComputedStyle(target.parentElement).zIndex,layers:document.elementsFromPoint(${target.x},${target.y}).slice(0,8).map(e=>e.tagName+'.'+String(e.className||''))}})()`);
  assert.equal(hit.matches, true, `${selector} is not reachable at ${Math.round(target.x)},${Math.round(target.y)}; hit ${JSON.stringify(hit)}`);
  await mouse('mousePressed', target.x, target.y); await mouse('mouseReleased', target.x, target.y);
}
describe('published visitor world', { concurrency: false }, () => {
before(async () => runBrowserSetupWithCleanup(async () => {
  setupAbortController = new AbortController();
  const { signal } = setupAbortController;
  const browserPath = await findBrowser();
  signal.throwIfAborted();
  const vitePort = await availablePort();
  signal.throwIfAborted();
  baseUrl = `http://127.0.0.1:${vitePort}`;
  cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic: lifecycleDiagnostic });
  lifecycleDiagnostic('setup:vite-create:start');
  const config = {
    configFile: false, root, logLevel: 'error',
    define: {
      __INSCAPE_RELEASE_COMMIT__: JSON.stringify('development'),
      'import.meta.env.VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL': JSON.stringify('https://published-images.invalid/ipfs/'),
    },
    build: {
      outDir: resolve(runtimeDir, 'preview'),
      rollupOptions: { input: ['fixture.html', 'provider-lifecycle-fixture.html'].map(name => resolve(root, 'browser-tests', name)) },
    },
    plugins: [react(), { name: 'published-csp-browser-fixture', configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.startsWith('/browser-tests/fixture.html') && request.url.includes('csp=1')) response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://published-images.invalid; connect-src 'self'; frame-ancestors 'self'");
      next();
    });
    } }],
    preview: { host: '127.0.0.1', port: vitePort, strictPort: true },
  };
  await build(config);
  signal.throwIfAborted();
  vite = await preview(config);
  resources.vite = vite;
  signal.throwIfAborted();
  lifecycleDiagnostic('setup:vite-listen:complete', { port: vitePort });
  lifecycleDiagnostic('setup:vite-readiness:start');
  await waitForViteReadiness(`${baseUrl}/browser-tests/fixture.html`, signal);
  lifecycleDiagnostic('setup:vite-readiness:complete');
  console.log('Browser setup: test-owned Vite listening');
  const knownExternalOrigins = [
    'https://published-images.invalid', 'http://published-images.invalid', 'https://rpc.mainnet.lukso.network',
    'https://api.universalprofile.cloud', 'https://envio.lukso-mainnet.universal.tech'
  ];
  routeController = createPlaywrightRouteController({ loopbackOrigin: baseUrl, knownOrigins: knownExternalOrigins,
    onUnexpected: (origin) => browserProblems.push(`Unexpected external request blocked: ${origin}`),
    decideKnown: ({ request, origin }) => {
      if (origin === 'https://published-images.invalid' || origin === 'http://published-images.invalid') {
        imageRequests.push(request.url());
        if (origin === 'http://published-images.invalid') return { action: 'abort', errorCode: 'blockedbyclient' };
        return { action: 'fulfill', options: { status: 200, contentType: 'image/png', headers: { 'Cache-Control': 'no-store' },
          body: request.url().includes('broken') ? Buffer.from('not-an-image') : Buffer.from(transparentPng, 'base64') } };
      }
      return { action: 'fulfill', options: { status: 204, contentType: 'text/plain', body: '' } };
    } });
  await launchPlaywrightEdge({ edgePath: browserPath, runtimePath: runtimeDir, workspaceRoot: root, loopbackOrigin: baseUrl,
    routeController, resources, diagnostic: lifecycleDiagnostic, onBrowserProblem: recordBrowserProblem,
    onOwnedProcess: ({ rootPid, processTree }) => {
      cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic: lifecycleDiagnostic });
    }
  });
  ({ browser, context, page } = resources);
  page.setDefaultTimeout(10000);
  pageCdp = await context.newCDPSession(page);
  resources.pageCdp = pageCdp;
  interceptionInstalled = true;
  signal.throwIfAborted();
  lifecycleDiagnostic('setup:playwright-ready', { routingBeforeNavigation: true });
  await viewport(1280, 720); await navigate();
  lifecycleDiagnostic('setup:fixture-ready');
  console.log('Browser setup complete');
}, async () => {
    cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic: lifecycleDiagnostic });
    await cleanupBrowserTest(resources);
  }, {
    timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs,
    diagnostic: lifecycleDiagnostic,
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserSession?.close().catch(() => {}); }
  }));

after(async () => {
  const failures = [];
  try {
    cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic: lifecycleDiagnostic });
    const result = await cleanupBrowserTest(resources);
    console.log(`Browser cleanup complete: root PID ${result.rootPid ?? 'not-started'}; shutdown ${result.shutdownMode}; forced PIDs ${result.forcedPids.length ? result.forcedPids.join(',') : 'none'}; remaining PIDs none; runtime removed; ${result.elapsedMs}ms`);
  } catch (error) { failures.push(error); }
  if (browserProblems.length) {
    const diagnostics = `Unexpected browser diagnostics:\n${browserProblems.join('\n')}`;
    console.error(diagnostics);
    failures.push(new Error(diagnostics));
  }
  if (failures.length) throw new AggregateError(failures, 'Published visitor browser after-hook failed');
});

test('V9 opens standalone Image layers for visitors without owner controls', async () => {
  await viewport(1280, 720, false); await navigate();
  assert.equal(await page.locator('main.visitor-grid-world').count(), 1);
  assert.equal(await page.locator('.image-module__canvas').count(), 2);
  assert.equal(await page.locator('[data-owner-route="true"],[data-resize-control]').count(), 0);
});

test('a direct artist link opens their published workspace and Return restores the connected workspace', async () => {
  await viewport(1280, 720, false);
  await navigate(profileB);
  assert.equal(await evaluate('window.__fixture.address'), profileB);
  await page.getByRole('button', { name: 'RETURN', exact: true }).click();
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileA)}`, 'connected workspace return');
});

test('published Image opens the shared inspector and restores focus on return', async () => {
  await viewport(1280, 720, false); await navigate();
  const source = page.locator('[data-workbench-view-id="image:https"] .image-module__canvas');
  await source.locator('[data-media-state="ready"]').waitFor();
  await source.focus();
  await page.keyboard.press('i');
  await page.locator('.system-workflow__lift-artwork').waitFor();
  await page.getByRole('button', { name: 'Return to Image', exact: true }).click();
  await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
  assert.equal(await source.evaluate(node => node === document.activeElement), true);
});

test('public Identity remains interactive alongside Images and returns focus on close', async () => {
  await viewport(1280, 720, false); await navigate();
  await click('[data-visitor-profile-trigger]');
  const identityViewer = page.locator('.identity-module aside');
  await identityViewer.waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await evaluate(`document.querySelectorAll('[data-identity-dossier-source="true"]').length`), 0);
  assert.match(await identityViewer.innerText(), /Alpha Visitor Fixture/i);
  assert.equal(await identityViewer.count(), 1);
  await page.getByRole('button', { name: 'Close Identity' }).click();
  await identityViewer.waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-visitor-profile-trigger]').evaluate(node => node === document.activeElement), true);
});

test('React StrictMode reuses one factory provider while cleanup, replacement, and recovery stay safe', async () => {
  await navigateProviderFixture();
  await waitFor(`document.querySelector('[data-owner-route="true"]') && window.__providerFixture.factoryCalls() === 1`, 'Strict Mode owner route');
  const result = await evaluate(`(async()=>{
    const f=window.__providerFixture;const first=f.createdProviders[0];
    const strict={factoryCalls:f.factoryCalls(),providers:f.createdProviders.length,attach:{...first.attach},listeners:first.callbacks('accountsChanged').length,state:f.state(),route:document.querySelector('[data-owner-route]')?.dataset.ownerRoute};
    const captured=first.callbacks('accountsChanged')[0];
    first.chainId='0x1';first.emit('chainChanged','0x1');const immediate=f.state();await new Promise(r=>setTimeout(r,0));
    first.chainId='0x2a';first.accounts=['0x2222222222222222222222222222222222222222'];first.contextAccounts=[...first.accounts];
    const before=first.requests.length;first.emit('chainChanged','0x2a');await new Promise(r=>setTimeout(r,0));
    const recovered={state:f.state(),requests:first.requests.slice(before)};
    const next=f.createProvider({accounts:['0x3333333333333333333333333333333333333333'],contextAccounts:['0x3333333333333333333333333333333333333333']});
    await f.replace(next);captured(['0x1111111111111111111111111111111111111111']);await new Promise(r=>setTimeout(r,0));
    const replaced={state:f.state(),firstRemove:{...first.remove},nextAttach:{...next.attach},factoryCalls:f.factoryCalls()};
    f.unmountRoot();await new Promise(r=>setTimeout(r,0));
    return {strict,immediate,recovered,replaced,unmounted:{state:f.state(),nextRemove:{...next.remove}}};
  })()`);
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(result.strict.attach[event], 1);
    assert.equal(result.replaced.firstRemove[event], 1);
    assert.equal(result.replaced.nextAttach[event], 1);
    assert.equal(result.unmounted.nextRemove[event], 1);
  }
  assert.deepEqual({ factoryCalls: result.strict.factoryCalls, providers: result.strict.providers,
    listeners: result.strict.listeners, owner: result.strict.state.owner, route: result.strict.route },
  { factoryCalls: 1, providers: 1, listeners: 1, owner: true, route: 'true' });
  assert.equal(result.immediate.chainId, null); assert.equal(result.immediate.owner, false);
  assert.deepEqual(result.recovered.requests.sort(), ['eth_accounts', 'eth_chainId', 'up_contextAccounts']);
  assert.equal(result.recovered.state.owner, true); assert.equal(result.recovered.state.accounts[0], '0x2222222222222222222222222222222222222222');
  assert.equal(result.replaced.state.accounts[0], '0x3333333333333333333333333333333333333333');
  assert.equal(result.replaced.factoryCalls, 1, 'explicit provider replacement did not call the real provider factory');
  assert.equal(result.unmounted.state.owner, false); assert.equal(result.unmounted.state.provider, null);
  await navigate();
});

test('published HTTPS and IPFS Images both load', async () => {
  await viewport(1280, 720, false); await navigate();
  await waitFor(`document.querySelectorAll('.image-module__artwork[data-media-state="ready"]').length === 2`, 'published Images');
  assert.ok(imageRequests.some(url => url.includes('/ipfs/') && url.includes('space-Alpha.png')));
});

test('published Image exposes recovery and loads a replacement source', async () => {
  await navigate();
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/broken-art.png')`);
  const image = page.locator('[data-workbench-view-id="image:https"]');
  await image.getByText('Artwork unavailable.').waitFor();
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/recovered-art.png')`);
  await image.locator('[data-media-state="ready"]').waitFor();
});

test('an actual CSP response header blocks disallowed canonical media and exposes fallback', async () => {
  expectedCspProblems.length = 0;
  acceptingExpectedCspProblems = true;
  try {
    await viewport(1280, 720, false); await navigateCsp();
    await evaluate(`window.__fixture.setArtworkUrl('https://csp-blocked.invalid/art.png')`);
    await page.locator('[data-workbench-view-id="image:https"] [data-media-state="failed"]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(100);
  } finally {
    acceptingExpectedCspProblems = false;
  }
  assert.ok(expectedCspProblems.length >= 1, 'browser reported CSP enforcement for deliberately disallowed media');
  assert.equal(imageRequests.some((url) => url.startsWith('https://csp-blocked.invalid/')), false, 'CSP stopped media before an outbound request');
});

test('narrow touch entry opens the ordinary visitor with Return reachable', async () => {
  await viewport(390, 844, true); await navigate(profileB);
  const commands = await evaluate(`[...document.querySelectorAll('.visitor-grid-world__actions button')].map((button)=>({text:button.textContent.trim(),rect:button.getBoundingClientRect().toJSON()}))`);
  assert.deepEqual(commands.map(command => command.text), ['RETURN']);
  await page.screenshot({ path: '.browser-test-runtime/visitor-routing-390.png' });
  assert.ok(commands.every(({ rect }) => rect.left >= 0 && rect.right <= 390 && rect.top >= 0 && rect.bottom <= 844),
    `narrow commands escaped the viewport: ${JSON.stringify(commands)}`);
  await viewport(320, 844, true);
  const narrowBounds = await page.locator('.visitor-grid-world__dock button').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
  }));
  assert.ok(narrowBounds.every(Boolean), 'all dock actions remain on screen at 320px');
  await page.screenshot({ path: '.browser-test-runtime/visitor-routing-320.png' });
  await page.getByRole('button', { name: 'RETURN', exact: true }).click();
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileA)}`, 'narrow Return');
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0, 'narrow mode exposes no desktop resize control');
});

test('390px visitor exposes no misleading resize control', async () => {
  await viewport(390, 844, true); await navigate();
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0);
  const tree = await pageCdp.send('Accessibility.getFullAXTree');
  assert.equal(tree.nodes.some((node) => /^Resize .* window$/.test(node.name?.value || '')), false);
});

test('visitor load reads only device appearance preferences and performs no owner storage reads or writes', async () => {
  assert.deepEqual(await evaluate(`window.__visitorStorageOps`), [
    { storage: 'localStorage', method: 'getItem', args: ['inscape:interface-theme'] },
    { storage: 'localStorage', method: 'getItem', args: ['inscape:interface-palette'] }
  ]);
});
});
