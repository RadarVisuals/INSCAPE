import assert from 'node:assert/strict';
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
  settlePlaywrightAnimationFrames,
  waitForCspFixtureReady
} from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, '.browser-test-runtime');
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
const imageRequests = [];
const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwHjWQAAAABJRU5ErkJggg==';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const lifecycleDiagnostic = createLifecycleDiagnostics();

function recordBrowserProblem(problem) {
  const expectedNavigationAbort = problem === 'Request failed: loopback net::ERR_ABORTED';
  const expectedFixtureImageAbort = problem === 'Request failed: https://published-images.invalid net::ERR_ABORTED';
  if (!expectedNavigationAbort && !expectedFixtureImageAbort) browserProblems.push(problem);
}

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

async function navigate(address = profileA, { identityRack = false } = {}) {
  const run = String(++navigationSequence);
  const fixtureUrl = `${baseUrl}/browser-tests/fixture.html?view=${address}&run=${run}${identityRack ? '&rack=identity' : ''}`;
  try {
    assert.equal(interceptionInstalled, true, 'Playwright routing must exist before navigation');
    const response = await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.ok(response?.ok(), `Fixture navigation returned HTTP ${response?.status() ?? 'unknown'}`);
    lifecycleDiagnostic('bootstrap:document-loaded');
    await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(address)}`, 'published fixture');
    lifecycleDiagnostic('bootstrap:fixture-mounted');
    await waitFor(`document.querySelector('.published-home-world') && window.__fixture`, 'published visitor world');
    lifecycleDiagnostic('bootstrap:published-ready');
  } catch (error) {
    await collectBootstrapDiagnostics(error, fixtureUrl);
    throw error;
  }
  await waitFor(`(()=>{const n=document.querySelector('.published-home-world__spatial');if(!n||getComputedStyle(n).zIndex!=='93')return false;return innerWidth>=720||getComputedStyle(n).overflowY==='auto'})()`, 'published visitor responsive styles');
}

async function collectBootstrapDiagnostics(error, fixtureUrl) {
  let state = {}; let viteReachable = false;
  try { state = await evaluate(`(()=>{const root=document.querySelector('[data-browser-fixture]');return {href:location.href,readyState:document.readyState,root:Boolean(root),rootChildren:Math.min(root?.childElementCount||0,100),published:Boolean(document.querySelector('.published-home-world')&&window.__fixture)}})()`); } catch { state = { evaluation: 'unavailable' }; }
  try { viteReachable = (await fetch(fixtureUrl, { signal: AbortSignal.timeout(BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs) })).ok; } catch { /* bounded diagnostic only */ }
  lifecycleDiagnostic('bootstrap:failed-state', {
    code: error.code || 'ERROR', location: state.href?.startsWith(baseUrl) ? 'fixture' : state.href || 'unknown', readyState: state.readyState || 'unknown',
    fixtureRoot: state.root ?? 'unknown', rootChildren: state.rootChildren ?? 'unknown', published: state.published ?? 'unknown',
    interceptionBeforeNavigation: interceptionInstalled, viteReachable
  });
}

async function navigateCsp(address = profileA) {
  const run = String(++navigationSequence);
  await page.goto(`${baseUrl}/browser-tests/fixture.html?view=${address}&run=${run}&csp=1`, { waitUntil: 'domcontentloaded', timeout: 10_000 });
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

async function reachablePoint(selector, ancestorSelector = selector) {
  const result = await evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)});const ancestor=document.querySelector(${JSON.stringify(ancestorSelector)});const r=target.getBoundingClientRect();for(const y of [0.2,0.5,0.8])for(const x of [0.05,0.2,0.5,0.8,0.95]){const px=r.left+r.width*x,py=r.top+r.height*y;if(document.elementFromPoint(px,py)?.closest?.(${JSON.stringify(ancestorSelector)})===ancestor)return {x:px,y:py}}return null})()`);
  assert.ok(result, `No reachable browser point for ${selector}`);
  return result;
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
async function accessibilityNode(selector) {
  const { root: documentNode } = await pageCdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await pageCdp.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector });
  assert.ok(nodeId, `No DOM node for accessibility selector ${selector}`);
  const { node } = await pageCdp.send('DOM.describeNode', { nodeId });
  const { nodes } = await pageCdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false });
  const target = nodes.find((entry) => entry.backendDOMNodeId === node.backendNodeId) || nodes[0];
  return { role: target?.role?.value, name: target?.name?.value, description: target?.description?.value };
}
async function touch(type, points) { await pageCdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((entry, index) => ({ x: entry.x, y: entry.y, id: entry.id ?? index + 1, radiusX: 2, radiusY: 2, force: 1 })) }); }
async function collapseFixtureRacks() {
  await waitFor(`!!document.querySelector('[aria-label="Public inventory rack"] [data-rack-module]')`, 'published rack board');
  await evaluate(`[...document.querySelectorAll('[aria-label^="Collapse all "]')].forEach((button) => button.click())`);
  await waitFor(`[...document.querySelectorAll('.published-rack-module')].every((module) => !module.hasAttribute('data-open'))`, 'fixture rack modules collapse');
  await settlePlaywrightAnimationFrames(page);
  assert.equal(await evaluate(`document.querySelectorAll('.published-rack-module[data-open]').length`), 0, 'fixture rack modules remained collapsed after settlement');
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
      if (request.url?.startsWith('/browser-tests/fixture.html') && request.url.includes('csp=1')) response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://published-images.invalid; connect-src 'self' ws:; frame-ancestors 'self'");
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
    'https://api.universalprofile.cloud', 'https://envio.lukso-mainnet.universal.tech',
    'https://fonts.googleapis.com', 'https://fonts.gstatic.com'
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
  if (browserProblems.length) failures.push(new Error(`Unexpected browser diagnostics:\n${browserProblems.join('\n')}`));
  if (failures.length) throw new AggregateError(failures, 'Published visitor browser after-hook failed');
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

test('desktop empty-world click moves the Keeper exactly once', async () => {
  await evaluate(`window.__fixture.resetMoves()`);
  const surface = await point('.home-world-surface', 0.48, 0.86);
  await mouse('mousePressed', surface.x, surface.y); await mouse('mouseReleased', surface.x, surface.y);
  await waitFor(`window.__fixture.moves.length === 1`, 'one Keeper move');
  assert.equal(await evaluate(`window.__fixture.moves.length`), 1);
});

test('v5 Identity Rack replaces duplicate identity chrome and stays ephemeral, keyboard operable, and mobile bounded', async () => {
  await viewport(1280, 720); await navigate(profileA, { identityRack: true });
  await waitFor(`!!document.querySelector('.published-identity-rack')`, 'published Identity Rack');
  assert.equal(await evaluate(`!!document.querySelector('.published-home-world__header,.published-home-world__identity')`), false);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.published-identity-rack [data-rack-module]')].map((node)=>node.dataset.rackModule)`), ['profile', 'bio', 'links-tags']);
  assert.equal(await evaluate(`document.querySelector('[data-rack-module="profile"] .published-rack-module__name').textContent`), 'Alpha Visitor Fixture');
  assert.equal(await evaluate(`!!document.querySelector('[data-rack-module="profile"] .published-rack-module__body,[aria-label="Collapse PROFILE"],[aria-label="Expand PROFILE"]')`), false);
  await click('[data-rack-module="profile"] .published-rack-module__name');
  await waitFor(`document.querySelector('[data-rack-module="profile"] .published-rack-module__name').textContent.startsWith('0x111111')`, 'scrambled profile address');
  await click('[data-rack-module="profile"] .published-rack-module__name');
  await waitFor(`document.querySelector('[data-rack-module="profile"] .published-rack-module__name').textContent === 'Alpha Visitor Fixture'`, 'scrambled profile name');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Copy Alpha Visitor Fixture profile address"]')?.tagName`), 'BUTTON');
  await click('[aria-label="Expand BIO"]');
  assert.equal(await evaluate(`document.querySelector('[data-rack-module="bio"] .published-rack-module__body').hidden`), false);
  await click('.published-identity-rack__master button:last-child');
  await evaluate(`document.querySelector('[data-rack-module="bio"] .published-rack-module__name').focus()`);
  await pressKey('ArrowDown', 1);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.published-identity-rack [data-rack-module]')].map((node)=>node.dataset.rackModule)`), ['profile', 'links-tags', 'bio']);
  await viewport(390, 844, true);
  const bounds = await evaluate(`(()=>{const rack=document.querySelector('.published-identity-rack').getBoundingClientRect();return {left:rack.left,right:rack.right,top:rack.top,bottom:rack.bottom,viewport:innerHeight}})()`);
  assert.ok(bounds.left >= 0 && bounds.right <= 390 && bounds.top >= 0 && bounds.bottom <= bounds.viewport);
  await viewport(320, 844, true);
  const narrowBounds = await evaluate(`(()=>{const rack=document.querySelector('.published-identity-rack').getBoundingClientRect();return {left:rack.left,right:rack.right,top:rack.top,bottom:rack.bottom,viewport:innerHeight}})()`);
  assert.ok(narrowBounds.left >= 0 && narrowBounds.right <= 320 && narrowBounds.top >= 0 && narrowBounds.bottom <= narrowBounds.viewport);
  await viewport(1280, 720, false);
  await navigate();
});

test('desktop drag, cancellation, lost capture, and wheel obey browser pointer semantics', async () => {
  const surface = await point('.home-world-surface', 0.45, 0.82);
  const before = await evaluate(`document.querySelector('.home-world-surface__world').style.transform`);
  await mouse('mousePressed', surface.x, surface.y); await mouse('mouseMoved', surface.x - 90, surface.y - 55, { buttons: 1 });
  await waitFor(`document.querySelector('.home-world-surface__world').style.transform !== ${JSON.stringify(before)}`, 'camera pan while held');
  const held = await evaluate(`document.querySelector('.home-world-surface__world').style.transform`);
  await mouse('mouseReleased', surface.x - 90, surface.y - 55); await mouse('mouseMoved', surface.x - 180, surface.y - 100, { buttons: 0 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), held, 'camera stopped after release');
  await mouse('mousePressed', surface.x, surface.y);
  await evaluate(`document.querySelector('.home-world-surface').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1,pointerType:'mouse',clientX:${surface.x},clientY:${surface.y}}))`);
  await mouse('mouseMoved', surface.x + 80, surface.y + 80, { buttons: 1 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), held, 'pointercancel cleared dragging');
  await mouse('mouseReleased', surface.x + 80, surface.y + 80);
  await mouse('mousePressed', surface.x, surface.y);
  await evaluate(`document.querySelector('.home-world-surface').dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:1,pointerType:'mouse',clientX:${surface.x},clientY:${surface.y}}))`);
  await mouse('mouseMoved', surface.x + 120, surface.y + 80, { buttons: 1 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), held, 'lostpointercapture cleared dragging');
  await mouse('mouseReleased', surface.x + 120, surface.y + 80);
  await mouse('mouseWheel', surface.x, surface.y, { buttons: 0, deltaX: 42, deltaY: 68 });
  await waitFor(`document.querySelector('.home-world-surface__world').style.transform !== ${JSON.stringify(held)}`, 'wheel camera pan');
});

test('published spaces render as inline Inventory modules that push following rails downward', async () => {
  await viewport(1280, 720); await navigate(); await collapseFixtureRacks();
  const module = '[aria-label="Public inventory rack"] [data-rack-module="space:Alpha:0"]';
  const next = '[aria-label="Public inventory rack"] [data-rack-module="space:Alpha:1"]';
  const before = await evaluate(`document.querySelector(${JSON.stringify(next)}).getBoundingClientRect().top`);
  await click(`${module} .published-rack-module__name`);
  await waitFor(`document.querySelector(${JSON.stringify(module)}).hasAttribute('data-open')`, 'Inventory module opens inline');
  const after = await evaluate(`document.querySelector(${JSON.stringify(next)}).getBoundingClientRect().top`);
  assert.ok(after > before, `opening a module did not push the next rail downward: ${before} -> ${after}`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-launcher-id],.published-home-world__window,[data-resize-control]').length`), 0, 'legacy launchers and floating windows are absent');
  await click(`[aria-label="Collapse Alpha Archive 1"]`);
  await waitFor(`!document.querySelector(${JSON.stringify(module)}).hasAttribute('data-open')`, 'Inventory module collapses');
});

test('Inventory module controls are keyboard operable and Arrange order is ephemeral', async () => {
  await viewport(1280, 720); await navigate(); await collapseFixtureRacks();
  const module = '[aria-label="Public inventory rack"] [data-rack-module="space:Alpha:6"]';
  const name = `${module} .published-rack-module__name`;
  const nameLocator = page.locator(name);
  await nameLocator.focus();
  await nameLocator.press('Enter');
  await waitFor(`document.querySelector(${JSON.stringify(module)}).hasAttribute('data-open')`, 'keyboard-opened Inventory module');
  assert.deepEqual(await accessibilityNode(`[aria-label="Collapse Alpha Archive 7"]`), { role: 'button', name: 'Collapse Alpha Archive 7', description: undefined });
  await click('[aria-label="Arrange inventory modules"]');
  await nameLocator.focus(); await pressKey('ArrowUp', 1);
  const arranged = await evaluate(`[...document.querySelectorAll('[aria-label="Public inventory rack"] [data-rack-module]')].map((node)=>node.dataset.rackModule)`);
  assert.equal(arranged.at(-2), 'space:Alpha:6');
  await click('[aria-label="Finish arranging inventory modules"]');
  await navigate();
  await waitFor(`!!document.querySelector('[aria-label="Public inventory rack"] [data-rack-module="space:Alpha:6"]')`, 'reset Inventory rack');
  const reset = await evaluate(`[...document.querySelectorAll('[aria-label="Public inventory rack"] [data-rack-module]')].map((node)=>node.dataset.rackModule)`);
  assert.equal(reset.at(-1), 'space:Alpha:6', 'route navigation resets ephemeral rack order');
  assert.equal(await evaluate(`document.querySelector('[data-rack-module="space:Alpha:6"]').hasAttribute('data-open')`), false, 'route navigation resets ephemeral open state');
});

test('artwork preview is read-only and right-click exposes no authoring commands', async () => {
  await viewport(1280, 720); await navigate(); await collapseFixtureRacks();
  assert.equal(await evaluate(`document.querySelectorAll('.canvas-artwork__edit,[aria-label^="Edit artwork"]').length`), 0);
  await click('[aria-label="Open artwork: Alpha Artwork 1"]'); await waitFor(`!!document.querySelector('[aria-label="Artwork preview: Alpha Artwork 1"]')`, 'read-only artwork preview');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Artwork preview: Alpha Artwork 1"]').textContent.includes('Edit')`), false);
  await click('[aria-label="Close artwork preview"]'); await waitFor(`!document.querySelector('[aria-label^="Artwork preview:"]')`, 'artwork preview closes');
  const target = await point('[aria-label="Public inventory rack"] [data-rack-module="space:Alpha:0"]');
  await mouse('mousePressed', target.x, target.y, { button: 'right', buttons: 2 }); await mouse('mouseReleased', target.x, target.y, { button: 'right', buttons: 0 });
  assert.equal(await evaluate(`document.querySelectorAll('[role="menu"],.context-menu').length`), 0);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some((button) => /edit|author|private|start window/i.test(button.textContent+' '+button.getAttribute('aria-label')))`), false);
});

test('published HTTPS and IPFS-projected images render with no referrer', async () => {
  await viewport(1280, 720, false); await navigate();
  await waitFor(`document.querySelector('.published-identity-rack__mark img')?.complete && document.querySelector('[data-rack-module="space:Alpha:0"] .asset-grid img')?.complete && document.querySelector('[data-canvas-object-id="art:Alpha:0"] img')?.complete`, 'published images');
  const policy = await evaluate(`[...document.querySelectorAll('.published-home-world img[src^="https://"]')].map((image)=>image.referrerPolicy)`);
  assert.ok(policy.length >= 3); assert.ok(policy.every((value) => value === 'no-referrer'));
  assert.ok(imageRequests.some((url) => url.includes('/ipfs/') && url.includes('space-Alpha.png')), 'IPFS space image used the configured HTTPS gateway');
});

test('rejected HTTP artwork never requests while broken HTTPS falls back and recovers on src change', async () => {
  await viewport(1280, 720, false); await navigate();
  const insecure = 'http://published-images.invalid/insecure.png';
  await evaluate(`window.__fixture.setArtworkUrl(${JSON.stringify(insecure)})`);
  await waitFor(`!!document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'HTTP artwork fallback');
  assert.equal(imageRequests.includes(insecure), false);
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/broken-art.png')`);
  await waitFor(`!!document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'broken image fallback');
  const fallbackSize = await evaluate(`(()=>{const r=document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]').getBoundingClientRect();return {width:r.width,height:r.height}})()`);
  assert.ok(fallbackSize.width > 0 && fallbackSize.height > 0);
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/recovered-art.png')`);
  await waitFor(`document.querySelector('[data-canvas-object-id="art:Alpha:0"] img')?.complete && !document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'new source recovery');
});

test('failed artwork modal stays focus-contained and shows the controlled fallback', async () => {
  await viewport(1280, 720, false); await navigate(); await collapseFixtureRacks();
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/broken-modal.png')`);
  await waitFor(`!!document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'failed artwork frame');
  await click('[aria-label="Open artwork: Alpha Artwork 1"]');
  const dialog = '[aria-label="Artwork preview: Alpha Artwork 1"]';
  await waitFor(`!!document.querySelector(${JSON.stringify(dialog)})?.querySelector('[data-published-image-fallback]')`, 'modal image fallback');
  assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Close artwork preview');
  await pressKey('Tab'); assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Close artwork preview');
  const size = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(dialog)}).getBoundingClientRect();return {width:r.width,height:r.height}})()`);
  assert.ok(size.width > 200 && size.height > 200);
  await click('[aria-label="Close artwork preview"]');
});

test('an actual CSP response header blocks a disallowed image and the UI falls back', async () => {
  await viewport(1280, 720, false); await navigateCsp();
  const beforeProblems = browserProblems.length;
  await evaluate(`window.__fixture.setArtworkUrl('https://csp-blocked.invalid/art.png')`);
  await page.locator('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]').waitFor({ state: 'visible', timeout: 10_000 });
  const newProblems = browserProblems.splice(beforeProblems);
  const cspProblems = newProblems.filter((problem) => /csp-blocked\.invalid|content security policy/iu.test(problem));
  browserProblems.push(...newProblems.filter((problem) => !cspProblems.includes(problem)));
  assert.ok(cspProblems.length >= 1, 'browser reported CSP enforcement for the deliberately disallowed image');
  assert.equal(imageRequests.some((url) => url.startsWith('https://csp-blocked.invalid/')), false, 'CSP stopped the image before an outbound request');
});

test('artwork modal traps keyboard focus, isolates background, and restores exact keyboard and pointer triggers', async () => {
  await viewport(1280, 720); await navigate(); await collapseFixtureRacks();
  const trigger = '[aria-label="Open artwork: Alpha Artwork 1"]';
  await evaluate(`document.querySelector(${JSON.stringify(trigger)}).focus()`); await pressKey('Space');
  const dialog = '[aria-label="Artwork preview: Alpha Artwork 1"]';
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Close artwork preview'`, 'modal focus entry');
  assert.deepEqual(await accessibilityNode(dialog), { role: 'dialog', name: 'Artwork preview: Alpha Artwork 1', description: undefined });
  assert.ok(await evaluate(`document.querySelectorAll('[inert]').length >= 3`), 'modal isolated application background branches');
  await pressKey('Tab');
  assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Close artwork preview');
  await pressKey('Tab', 8);
  assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Close artwork preview');
  await evaluate(`document.querySelector('[data-rack-module="space:Alpha:6"] .published-rack-module__name').focus()`);
  assert.equal(await evaluate(`document.activeElement?.getAttribute('aria-label')`), 'Close artwork preview', 'background focus was redirected into modal');
  await pressKey('Escape');
  await waitFor(`document.activeElement === document.querySelector(${JSON.stringify(trigger)})`, 'Escape trigger focus restoration');
  assert.equal(await evaluate(`document.querySelectorAll('[inert]').length`), 0, 'Escape cleared modal isolation');

  await pressKey('Space'); await waitFor(`!!document.querySelector(${JSON.stringify(dialog)})`, 'modal reopen');
  await click('[aria-label="Close artwork preview"]');
  await waitFor(`document.activeElement === document.querySelector(${JSON.stringify(trigger)})`, 'pointer trigger focus restoration');
  assert.equal(await evaluate(`document.querySelectorAll('[inert]').length`), 0, 'pointer close cleared modal isolation');
});

test('390x844 touch tap moves once while a vertical swipe remains native scrolling', async () => {
  await viewport(390, 844, true); await navigate(); await collapseFixtureRacks(); await evaluate(`window.__fixture.resetMoves()`);
  const spatial = await evaluate(`(()=>{const s=document.querySelector('.published-home-world__spatial').getBoundingClientRect();return {x:s.right-3,y:s.bottom-24}})()`);
  await evaluate(`(()=>{const n=document.querySelector('.published-home-world__spatial');const init={bubbles:true,pointerId:21,pointerType:'touch',isPrimary:true,clientX:${spatial.x},clientY:${spatial.y}};n.dispatchEvent(new PointerEvent('pointerdown',init));n.dispatchEvent(new PointerEvent('pointerup',init))})()`);
  await waitFor(`window.__fixture.moves.length === 1`, 'narrow Keeper tap');
  await evaluate(`document.querySelector('[aria-label="Expand Alpha Archive 1"]').click();document.querySelector('[aria-label="Expand Alpha Archive 2"]').click()`);
  const count = await evaluate(`window.__fixture.moves.length`);
  const swipe = await evaluate(`(()=>{const board=document.querySelector('.published-rack-board');board.scrollTop=0;const n=document.querySelector('[data-rack-module="space:Alpha:0"] .published-rack-module__body');const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:Math.max(r.top+12,Math.min(r.bottom-12,700))}})()`);
  const scrollBefore = await evaluate(`document.querySelector('.published-rack-board').scrollTop`);
  await touch('touchStart', [{ x: swipe.x, y: swipe.y, id: 22 }]);
  for (let step = 1; step <= 8; step += 1) { await touch('touchMove', [{ x: swipe.x + 1, y: swipe.y - step * 28, id: 22 }]); await delay(20); }
  await touch('touchEnd', []);
  await delay(100);
  const scrolled = await evaluate(`(()=>{const s=document.querySelector('.published-rack-board');const n=document.elementFromPoint(${swipe.x},${swipe.y});return {top:s.scrollTop,scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,target:n?.className,touchAction:n&&getComputedStyle(n).touchAction,overflow:getComputedStyle(s).overflowY}})()`);
  assert.ok(scrolled.top > scrollBefore, `native vertical scroll did not advance: ${JSON.stringify(scrolled)}`);
  assert.equal(await evaluate(`window.__fixture.moves.length`), count, 'vertical swipe did not move Keeper');
});

test('320px racks stack, keep compact header controls, and remain scroll-reachable', async () => {
  await viewport(320, 844, true); await navigate(); await collapseFixtureRacks();
  const layout = await evaluate(`(()=>{const board=document.querySelector('.published-rack-board');const racks=[...board.querySelectorAll('.published-identity-rack,.published-inventory-rack')].map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}});const masters=[...board.querySelectorAll('.published-identity-rack__master,.published-inventory-rack__master')].map(n=>n.getBoundingClientRect().height);return {racks,masters,clientHeight:board.clientHeight,scrollHeight:board.scrollHeight,controls:[...board.querySelectorAll('.published-rack-master-control')].map(n=>({width:n.getBoundingClientRect().width,text:n.textContent.trim()}))}})()`);
  assert.equal(layout.racks.length, 2); assert.ok(layout.racks[1].top >= layout.racks[0].bottom);
  assert.ok(layout.racks.every((entry) => entry.left >= 10 && entry.right <= 310));
  assert.ok(layout.masters.every((height) => height === 60), `mobile rack masters diverged: ${layout.masters}`);
  assert.ok(layout.controls.every((control) => control.width === 34), `mobile rack controls are not compact icons: ${JSON.stringify(layout.controls)}`);
  await evaluate(`document.querySelector('[data-rack-module="space:Alpha:6"] .published-rack-module__name').scrollIntoView({block:'center'})`);
  await click('[data-rack-module="space:Alpha:6"] .published-rack-module__name');
  await waitFor(`document.querySelector('[data-rack-module="space:Alpha:6"]').hasAttribute('data-open')`, 'narrow Inventory module opens');
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0, '320px layout exposes no legacy resize control');
});

test('390px narrow accessibility tree exposes no misleading resize control', async () => {
  await viewport(390, 844, true); await navigate();
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0);
  const tree = await pageCdp.send('Accessibility.getFullAXTree');
  assert.equal(tree.nodes.some((node) => /^Resize .* window$/.test(node.name?.value || '')), false);
});

test('profile transition and route reload discard ephemeral visitor state', async () => {
  await viewport(1280, 720, false); await navigate(); await collapseFixtureRacks(); await click('[aria-label="Open artwork: Alpha Artwork 1"]'); await evaluate(`document.querySelector('[data-rack-module="space:Alpha:6"] .published-rack-module__name').click()`);
  await evaluate(`window.__fixture.visit(${JSON.stringify(profileB)})`); await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'profile transition');
  await waitFor(`!!document.querySelector('[data-rack-module="space:Beta:0"]')`, 'Beta document');
  assert.equal(await evaluate(`document.querySelectorAll('[data-rack-module^="space:Alpha:"]').length`), 0); assert.equal(await evaluate(`!!document.querySelector('[aria-label^="Artwork preview:"]')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Public inventory rack"] [data-open]').length`), 2, 'only Beta start-open modules remain');
  await evaluate(`document.querySelector('[data-rack-module="space:Beta:6"] .published-rack-module__name').click()`); const priorLoad = await evaluate(`performance.timeOrigin`); await page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 });
  await waitFor(`performance.timeOrigin !== ${priorLoad}`, 'route reload navigation');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'reloaded Beta route'); await waitFor(`document.querySelectorAll('[aria-label="Public inventory rack"] [data-open]').length === 2`, 'reload default rack state');
  assert.equal(await evaluate(`document.querySelector('[data-rack-module="space:Beta:6"]').hasAttribute('data-open')`), false);
});

test('profile transition while artwork modal is open removes isolation and uses the published fallback', async () => {
  await viewport(1280, 720, false); await navigate(); await collapseFixtureRacks();
  await evaluate(`document.querySelector('[aria-label="Open artwork: Alpha Artwork 1"]').click()`);
  await waitFor(`document.querySelectorAll('[inert]').length >= 3`, 'modal background isolation');
  await evaluate(`window.__fixture.visit(${JSON.stringify(profileB)})`);
  await waitFor(`!!document.querySelector('[data-rack-module="space:Beta:0"]') && !document.querySelector('[aria-label^="Artwork preview:"]')`, 'modal route cleanup');
  assert.equal(await evaluate(`document.querySelectorAll('[inert]').length`), 0);
  assert.equal(await evaluate(`document.activeElement?.hasAttribute('data-published-focus-fallback')`), true);
});

test('visitor load performs no owner storage reads or writes', async () => { assert.deepEqual(await evaluate(`window.__visitorStorageOps`), []); });
});
