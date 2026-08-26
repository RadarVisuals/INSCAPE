import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
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
let browserServer;
let browser;
let context;
let page;
let browserTree;
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

async function waitForViteReadiness(url, signal, timeoutMs = 5_000) {
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

async function navigate(address = profileA, runtime = 'grid') {
  const run = String(++navigationSequence);
  const fixtureUrl = `${baseUrl}/browser-tests/fixture.html?view=${address}&runtime=${runtime}&run=${run}`;
  try {
    assert.equal(interceptionInstalled, true, 'Playwright routing must exist before navigation');
    const response = await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assert.ok(response?.ok(), `Fixture navigation returned HTTP ${response?.status() ?? 'unknown'}`);
    lifecycleDiagnostic('bootstrap:document-loaded');
    await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(address)} && window.__fixture?.ready === true && window.__fixture?.runtime === ${JSON.stringify(runtime)}`, 'published fixture');
    lifecycleDiagnostic('bootstrap:fixture-mounted');
    await waitFor(`document.querySelector('.visitor-grid-world') && window.__fixture`, 'v9 published visitor world');
    lifecycleDiagnostic('bootstrap:published-ready');
  } catch (error) {
    await collectBootstrapDiagnostics(error, fixtureUrl);
    throw error;
  }
  await waitFor(`document.querySelectorAll('.visitor-grid-renderer').length === 1`, 'one active ordered Grid projection');
  await waitFor(`document.querySelector('.visitor-grid-world__viewport')?.dataset.activeGridId?.endsWith('-home')`, 'first public Grid visitor entry');
}

async function collectBootstrapDiagnostics(error, fixtureUrl) {
  let state = {}; let viteReachable = false;
  try { state = await evaluate(`(()=>{const root=document.querySelector('[data-browser-fixture]');return {href:location.href,readyState:document.readyState,root:Boolean(root),rootChildren:Math.min(root?.childElementCount||0,100),published:Boolean(document.querySelector('.visitor-grid-world')&&window.__fixture),runtime:window.__fixture?.runtime||null}})()`); } catch { state = { evaluation: 'unavailable' }; }
  try { viteReachable = (await fetch(fixtureUrl, { signal: AbortSignal.timeout(BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs) })).ok; } catch { /* bounded diagnostic only */ }
  lifecycleDiagnostic('bootstrap:failed-state', {
    code: error.code || 'ERROR', location: state.href?.startsWith(baseUrl) ? 'fixture' : state.href || 'unknown', readyState: state.readyState || 'unknown',
    fixtureRoot: state.root ?? 'unknown', rootChildren: state.rootChildren ?? 'unknown', published: state.published ?? 'unknown', runtime: state.runtime ?? 'unknown',
    interceptionBeforeNavigation: interceptionInstalled, viteReachable
  });
}

async function navigateCsp(address = profileA) {
  const run = String(++navigationSequence);
  await page.goto(`${baseUrl}/browser-tests/fixture.html?view=${address}&runtime=grid&run=${run}&csp=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
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
async function pressKey(key, modifiers = 0) {
  const supported = new Set(['Tab', 'Enter', 'Space', 'Escape', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']);
  assert.ok(supported.has(key), `Unsupported test key ${key}`);
  const modifierKeys = [[1, 'Alt'], [2, 'Control'], [4, 'Meta'], [8, 'Shift']].filter(([mask]) => modifiers & mask).map(([, name]) => name);
  for (const modifier of modifierKeys) await page.keyboard.down(modifier);
  try { await page.keyboard.press(key); } finally { for (const modifier of modifierKeys.reverse()) await page.keyboard.up(modifier); }
}
async function enterGallery() {
  await click('[aria-label="Move to Gallery level"]');
  await page.locator('.gallery-world[data-transition-phase="gallery"]').waitFor({ state: 'visible', timeout: 10_000 });
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
  const viteCreation = createViteServer({ root, logLevel: 'error', define: { 'import.meta.env.VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL': JSON.stringify('https://published-images.invalid/ipfs/') }, plugins: [{ name: 'published-csp-browser-fixture', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.startsWith('/browser-tests/fixture.html') && request.url.includes('csp=1')) response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://published-images.invalid; connect-src 'self' ws:; frame-ancestors 'self'");
      next();
    });
  } }], server: { host: '127.0.0.1', port: vitePort, strictPort: true } });
  let viteCreationExpired = false;
  viteCreation.then((lateVite) => {
    if (!viteCreationExpired) return;
    lateVite.httpServer?.closeAllConnections?.();
    void lateVite.close().catch(() => {});
  }).catch(() => {});
  vite = await withinDeadline(viteCreation, BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Vite creation deadline exceeded', () => { viteCreationExpired = true; });
  resources.vite = vite;
  signal.throwIfAborted();
  lifecycleDiagnostic('setup:vite-create:complete');
  await withinDeadline(vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Test-owned Vite listen deadline exceeded', () => {
    vite.httpServer?.closeAllConnections?.();
    void vite.close().catch(() => {});
  });
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
      browserTree = processTree;
      cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic: lifecycleDiagnostic });
    }
  });
  ({ browserServer, browser, context, page } = resources);
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
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); }
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

test('exact v9 mounts one semantic ordered-Grid surface without owner, Library, or legacy topology', async () => {
  await viewport(1280, 720, false); await navigate();
  const state = await evaluate(`(()=>({runtime:window.__fixture.runtime,worlds:document.querySelectorAll('.visitor-grid-world').length,renderers:document.querySelectorAll('.visitor-grid-renderer').length,active:document.querySelector('.visitor-grid-renderer')?.dataset.gridId,legacy:document.querySelectorAll('.visitor-lattice-world,.published-home-world,[data-table-id]').length,ownerControls:document.querySelectorAll('[data-owner-route="true"],[data-resize-control]').length}))()`);
  assert.deepEqual(state, { runtime: 'grid', worlds: 1, renderers: 1, active: 'grid:alpha-home', legacy: 0, ownerControls: 0 });
});

test('Directory visits a published workspace, Close remains Close, and Return restores the connected workspace', async () => {
  await viewport(1280, 720, false); await navigate();
  await click('.visitor-grid-world__actions button');
  await waitFor(`!!document.querySelector('.profile-discovery__panel')`, 'directory opens');
  const directoryStyle = await evaluate(`(()=>{const root=document.querySelector('.profile-discovery');const panel=document.querySelector('.profile-discovery__panel');const result=document.querySelector('.profile-discovery__result');const title=document.querySelector('#profile-discovery-title');const rect=panel.getBoundingClientRect();return{menuSurface:root.dataset.menuSurface,background:getComputedStyle(panel).backgroundColor,color:getComputedStyle(panel).color,titleFont:getComputedStyle(title).fontFamily,resultDisplay:getComputedStyle(result).display,width:rect.width,height:rect.height}})()`);
  assert.equal(directoryStyle.menuSurface, 'mist');
  assert.match(directoryStyle.background, /215, 211, 202/);
  assert.match(directoryStyle.color, /17, 19, 19/);
  assert.match(directoryStyle.titleFont, /Inscape Sora/);
  assert.equal(directoryStyle.resultDisplay, 'grid');
  assert.equal(directoryStyle.width, 760);
  assert.equal(directoryStyle.height, 560);
  await evaluate(`document.querySelector('[aria-label="Close INSCAPE directory"]').focus()`);
  await pressKey('Enter');
  await waitFor(`!document.querySelector('.profile-discovery__panel')`, 'directory closes with Enter on Close');
  assert.equal(await evaluate(`window.__fixture.address`), profileA);

  await click('.visitor-grid-world__actions button');
  await page.locator('.profile-discovery__search input').fill('Beta');
  await waitFor(`document.querySelectorAll('.profile-discovery__result').length === 1`, 'directory search result');
  await click('.profile-discovery__result');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'directory profile visit');
  await waitFor(`!!document.querySelector('.visitor-grid-world__actions button:nth-child(2)')`, 'Return command');
  await click('.visitor-grid-world__actions button:nth-child(2)');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileA)}`, 'connected workspace return');
});

test('canonical Grid placement opens the focus viewer, hides its source, and restores exact focus', async () => {
  await viewport(1280, 720, false); await navigate();
  await waitFor(`document.querySelector('[data-placement-id="art:Alpha:https"]')?.dataset.mediaState === 'ready'`, 'canonical placement media');
  await click('[data-placement-id="art:Alpha:https"]');
  await page.locator('.lattice-focus-viewer').waitFor({ state: 'visible', timeout: 10_000 });
  await waitFor(`document.querySelector('.lattice-focus-viewer')?.dataset.phase === 'open'`, 'production focus viewer open phase');
  assert.equal(await evaluate(`document.querySelector('.lattice-focus-viewer').getAttribute('aria-label')`), 'Artwork focus viewer');
  assert.equal(await evaluate(`document.querySelector('[data-placement-id="art:Alpha:https"]').hasAttribute('data-viewer-source-hidden')`), true);
  await pressKey('Escape');
  await waitFor(`!document.querySelector('.lattice-focus-viewer')`, 'production focus viewer closes');
  await waitFor(`!document.querySelector('[data-placement-id="art:Alpha:https"]').hasAttribute('data-viewer-source-hidden')`, 'placement source restored');
  assert.equal(await evaluate(`document.activeElement?.dataset.placementId`), 'art:Alpha:https');
});

test('public identity rack replaces its source and returns to the persistent compact card', async () => {
  await viewport(1280, 720, false); await navigate();
  await click('[data-visitor-profile-trigger]');
  await waitFor(`!!document.querySelector('[data-identity-dossier-source="true"]')`, 'public compact identity source');
  await click('[data-identity-dossier-source="true"]');
  const identityViewer = page.locator('#lattice-profile-dossier');
  await identityViewer.waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await evaluate(`document.querySelectorAll('[data-identity-dossier-source="true"]').length`), 0);
  assert.match(await evaluate(`document.querySelector('.lattice-production-identity-dossier').textContent`), /Alpha Visitor Fixture/i);
  await page.getByRole('button', { name: 'Close profile' }).click();
  await waitFor(`document.querySelector('#lattice-profile-dossier')?.dataset.phase === 'compact'`, 'persistent compact identity card');
  assert.equal(await identityViewer.count(), 1);
  await waitFor(`document.activeElement?.classList.contains('lattice-production-identity-dossier__source-summary')`,
    'persistent compact identity focus');
  assert.equal(await identityViewer.locator('.lattice-production-identity-dossier__source-summary')
    .evaluate((node) => node === document.activeElement), true);
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

test('semantic controls and owned keyboard input navigate dynamic ordered Grids', async () => {
  await viewport(1280, 720, false); await navigate();
  await click('[aria-label="Next Grid"]');
  await waitFor(`document.querySelector('.visitor-grid-renderer')?.dataset.gridId === 'grid:alpha-archive'`, 'next ordered Grid');
  await evaluate(`document.querySelector('.visitor-grid-world').focus()`); await pressKey('ArrowLeft');
  await waitFor(`document.querySelector('.visitor-grid-renderer')?.dataset.gridId === 'grid:alpha-home'`, 'keyboard returns to entry Grid');
  assert.equal(await evaluate(`document.querySelectorAll('.visitor-grid-renderer').length`), 1);
});

test('canonical published HTTPS and IPFS media render with no referrer', async () => {
  await viewport(1280, 720, false); await navigate();
  await waitFor(`document.querySelectorAll('.visitor-grid-renderer [data-media-state="ready"]').length === 2`, 'canonical published images');
  const policy = await evaluate(`[...document.querySelectorAll('.visitor-grid-renderer img')].map((image)=>image.referrerPolicy)`);
  assert.equal(policy.length, 2); assert.ok(policy.every((value) => value === 'no-referrer'));
  assert.ok(imageRequests.some((url) => url.includes('/ipfs/') && url.includes('space-Alpha.png')), 'IPFS media used the configured HTTPS gateway');
  assert.equal(await evaluate(`document.querySelector('[data-placement-id="art:Alpha:https"] img').loading`), 'eager');
  const transformed = await evaluate(`(()=>{const n=document.querySelector('[data-placement-id="art:Alpha:ipfs"] img');return {transform:n.style.transform}})()`);
  assert.match(transformed.transform, /scale\(-1, 1\) rotate\(90deg\)/);
  const fit = await evaluate(`(()=>{const dimensions=(id)=>{const p=document.querySelector('[data-placement-id="'+id+'"]');const opening=p.querySelector('.lattice-production-placement__opening');const o=opening.getBoundingClientRect();const i=p.querySelector('img').getBoundingClientRect();return {opening:{w:o.width,h:o.height,overflow:getComputedStyle(opening).overflow},image:{w:i.width,h:i.height}}};return {native:dimensions('art:Alpha:https'),cropped:dimensions('art:Alpha:ipfs')}})()`);
  assert.equal(fit.native.opening.overflow, 'hidden');
  assert.ok(fit.native.image.w <= fit.native.opening.w + 2 && fit.native.image.h <= fit.native.opening.h + 2,
    `native no-crop media is contained: ${JSON.stringify(fit.native)}`);
  assert.ok(fit.cropped.image.w >= fit.cropped.opening.w - 1 && fit.cropped.image.h >= fit.cropped.opening.h - 1,
    `cropped media covers its opening: ${JSON.stringify(fit.cropped)}`);
});

test('canonical broken media reaches fallback after retries and recovers on a new source', async () => {
  await navigate();
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/broken-art.png')`);
  await waitFor(`document.querySelector('[data-placement-id="art:Alpha:https"]')?.dataset.mediaState === 'failed'`, 'canonical broken media fallback');
  assert.match(await evaluate(`document.querySelector('[data-placement-id="art:Alpha:https"] .lattice-production-placement__status').textContent`), /Artwork unavailable/);
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/recovered-art.png')`);
  await waitFor(`document.querySelector('[data-placement-id="art:Alpha:https"]')?.dataset.mediaState === 'ready'`, 'canonical media recovery');
});

test('an actual CSP response header blocks disallowed canonical media and exposes fallback', async () => {
  expectedCspProblems.length = 0;
  acceptingExpectedCspProblems = true;
  try {
    await viewport(1280, 720, false); await navigateCsp();
    await evaluate(`window.__fixture.setArtworkUrl('https://csp-blocked.invalid/art.png')`);
    await page.locator('[data-placement-id="art:Alpha:https"][data-media-state="failed"]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(100);
  } finally {
    acceptingExpectedCspProblems = false;
  }
  assert.ok(expectedCspProblems.length >= 1, 'browser reported CSP enforcement for deliberately disallowed media');
  assert.equal(imageRequests.some((url) => url.startsWith('https://csp-blocked.invalid/')), false, 'CSP stopped media before an outbound request');
});

test('narrow visitor mode keeps Directory and Return reachable without desktop authoring parity', async () => {
  await viewport(390, 844, true); await navigate(profileB);
  const commands = await evaluate(`[...document.querySelectorAll('.visitor-grid-world__actions button')].map((button)=>({text:button.textContent.trim(),rect:button.getBoundingClientRect().toJSON()}))`);
  assert.equal(commands.length, 2);
  assert.ok(commands.every(({ rect }) => rect.left >= 0 && rect.right <= 390 && rect.top >= 0 && rect.bottom <= 844),
    `narrow commands escaped the viewport: ${JSON.stringify(commands)}`);
  await click('.visitor-grid-world__actions button:first-child');
  await waitFor(`!!document.querySelector('.profile-discovery__panel')`, 'narrow directory opens');
  await click('[aria-label="Close INSCAPE directory"]');
  await waitFor(`!document.querySelector('.profile-discovery__panel')`, 'narrow directory closes');
  await click('.visitor-grid-world__actions button:nth-child(2)');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileA)}`, 'narrow Return');
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0, 'narrow mode exposes no desktop resize control');
});

test('390px narrow accessibility tree exposes no misleading resize control', async () => {
  await viewport(390, 844, true); await navigate();
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0);
  const tree = await pageCdp.send('Accessibility.getFullAXTree');
  assert.equal(tree.nodes.some((node) => /^Resize .* window$/.test(node.name?.value || '')), false);
});

test('visitor load performs no owner storage reads or writes', async () => { assert.deepEqual(await evaluate(`window.__visitorStorageOps`), []); });
});
