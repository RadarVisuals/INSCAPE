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

async function navigate(address = profileA) {
  const run = String(++navigationSequence);
  const fixtureUrl = `${baseUrl}/browser-tests/fixture.html?view=${address}&run=${run}`;
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
  await waitFor(`(()=>{const n=document.querySelector('.published-home-world__spatial');if(!n||getComputedStyle(n).zIndex!=='15')return false;return innerWidth>=720||getComputedStyle(n).overflowY==='auto'})()`, 'published visitor responsive styles');
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
function styleRect(selector) { return `(()=>{const n=document.querySelector(${JSON.stringify(selector)});return n&&['left','top','width','height','zIndex'].reduce((o,k)=>(o[k]=parseFloat(n.style[k])||0,o),{})})()`; }
async function closeFixtureWindows() {
  await evaluate(`[...document.querySelectorAll('[aria-label^="Close Alpha Archive"],[aria-label^="Close Beta Archive"]')].forEach((button) => button.click())`);
  await waitFor(`document.querySelectorAll('.published-home-world__window').length === 0`, 'fixture windows close');
  await settlePlaywrightAnimationFrames(page);
  assert.equal(await evaluate(`document.querySelectorAll('.published-home-world__window').length`), 0, 'fixture windows remained closed after focus restoration settled');
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
    routeController, resources, diagnostic: lifecycleDiagnostic, onBrowserProblem: (problem) => browserProblems.push(problem),
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

test('shared visitor profile card preserves its anchor through avatar, compact, expanded, avatar states', async () => {
  await viewport(1280, 720, false); await navigate();
  const card = '.profile-identity-card';
  const avatar = `${card} .profile-identity-card__avatar`;
  const categories = '.category-navigation-card';
  const initial = await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(card)}).getBoundingClientRect();const a=document.querySelector(${JSON.stringify(avatar)}).getBoundingClientRect();return {state:document.querySelector(${JSON.stringify(card)}).dataset.state,left:c.left,top:c.top,width:c.width,height:c.height,avatarLeft:a.left,avatarTop:a.top,avatarWidth:a.width,avatarHeight:a.height}})()`);
  assert.deepEqual(initial, { state: 'avatar', left: 18, top: 20, width: 68, height: 68, avatarLeft: 23, avatarTop: 25, avatarWidth: 58, avatarHeight: 58 });
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(categories)}).getAttribute('aria-hidden')`), 'true');
  await click(avatar); await waitFor(`document.querySelector(${JSON.stringify(card)}).dataset.state === 'compact' && document.querySelector(${JSON.stringify(card)}).getBoundingClientRect().width >= 217.9`, 'compact profile identity');
  assert.deepEqual(await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(card)}).getBoundingClientRect();const a=document.querySelector(${JSON.stringify(avatar)}).getBoundingClientRect();return {width:Math.round(c.width),height:Math.round(c.height),avatarLeft:a.left,avatarTop:a.top,avatarWidth:a.width,avatarHeight:a.height}})()`), { width: 218, height: 68, avatarLeft: 23, avatarTop: 25, avatarWidth: 58, avatarHeight: 58 });
  await waitFor(`document.querySelector(${JSON.stringify(categories)}).hasAttribute('data-visible')`, 'categories control follows compact profile');
  assert.equal(await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(card)}).getBoundingClientRect();const n=document.querySelector(${JSON.stringify(categories)}).getBoundingClientRect();return Math.round(n.top-c.bottom)})()`), 8);
  await click(avatar); await waitFor(`(()=>{const c=document.querySelector(${JSON.stringify(card)});const d=c?.querySelector('.profile-identity-card__details');return c?.dataset.state === 'expanded' && c.getBoundingClientRect().width >= 339.9 && c.getBoundingClientRect().height >= 67 + d.scrollHeight})()`, 'expanded profile identity');
  const expanded = await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(card)}).getBoundingClientRect();const a=document.querySelector(${JSON.stringify(avatar)}).getBoundingClientRect();const d=document.querySelector('.profile-identity-card__details').getBoundingClientRect();return {width:Math.round(c.width),contentAligned:Math.abs(c.bottom-d.bottom)<=1,avatarLeft:a.left,avatarTop:a.top}})()`);
  assert.deepEqual(expanded, { width: 340, contentAligned: true, avatarLeft: 23, avatarTop: 25 });
  const typography = await evaluate(`(()=>{const cardStyle=getComputedStyle(document.querySelector(${JSON.stringify(card)}));const bioStyle=getComputedStyle(document.querySelector('.profile-identity-card__details > p'));return {textTransform:cardStyle.textTransform,fontVariantCaps:cardStyle.fontVariantCaps,fontStretch:cardStyle.fontStretch,bioFontSize:parseFloat(bioStyle.fontSize)}})()`);
  assert.deepEqual(typography, { textTransform: 'none', fontVariantCaps: 'normal', fontStretch: '100%', bioFontSize: 12.16 });
  await evaluate(`window.__fixture.resetMoves()`); await click('.profile-identity-card__details p');
  assert.equal(await evaluate(`window.__fixture.moves.length`), 0, 'card surface blocks click-through world movement');
  await click(avatar);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(card)})).transitionDelay.split(',')[0].trim()`), '0.08s', 'card width waits for the detail fade on close');
  await waitFor(`document.querySelector(${JSON.stringify(card)}).dataset.state === 'avatar' && document.querySelector(${JSON.stringify(card)}).getBoundingClientRect().width <= 68.1 && parseFloat(getComputedStyle(document.querySelector('.profile-identity-card__details')).opacity) === 0`, 'collapsed profile identity');
  await waitFor(`document.querySelector(${JSON.stringify(categories)}).getAttribute('aria-hidden') === 'true'`, 'categories control hides with avatar profile');
});

test('categories card uses published spaces, keeps numeric labels, and opens the selected space', async () => {
  await viewport(1280, 720, false); await navigate(); await closeFixtureWindows();
  await click('.profile-identity-card__avatar');
  await waitFor(`document.querySelector('.category-navigation-card').hasAttribute('data-visible')`, 'categories control visible');
  assert.equal(await evaluate(`document.querySelector('.category-navigation-card > header strong').textContent`), 'CATEGORIES');
  assert.equal(await evaluate(`document.querySelector('.category-navigation-card > header small')`), null, 'closed control has no subtitle');
  assert.equal(await evaluate(`document.querySelector('.category-navigation-card > footer')`), null, 'expanded card has no legacy navigation footer');
  await click('.category-navigation-card > header > button');
  await waitFor(`document.querySelector('.category-navigation-card').hasAttribute('data-expanded')`, 'categories card expanded');
  await waitFor(`(()=>{const matrix=new DOMMatrix(getComputedStyle(document.querySelector('.category-navigation-card > header i')).transform);return Math.abs(matrix.a) < 0.001 && matrix.b < -0.999})()`, 'categories collapse chevron rotation');
  const collapseIndicator = await evaluate(`(()=>{const indicator=document.querySelector('.category-navigation-card > header i');const matrix=new DOMMatrix(getComputedStyle(indicator).transform);return {glyph:indicator.textContent,rotation:Math.round(Math.atan2(matrix.b,matrix.a)*180/Math.PI)}})()`);
  assert.deepEqual(collapseIndicator, { glyph: '›', rotation: -90 }, 'expanded categories control rotates its chevron toward collapse');
  const rows = await evaluate(`[...document.querySelectorAll('.category-navigation-card nav button')].map((button)=>({code:button.querySelector('small').textContent,label:button.querySelector('span').textContent}))`);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map((row) => row.code), ['01', '02', '03', '04', '05', '06', '07']);
  assert.equal(await evaluate(`(()=>{const nav=document.querySelector('.category-navigation-card nav');return nav.scrollHeight===nav.clientHeight})()`), true, 'complete category list does not create a false scrollbar');
  await click('.category-navigation-card nav button:last-of-type');
  await waitFor(`document.querySelector('[data-launcher-id="space:Alpha:6"]').dataset.windowState === 'open'`, 'category opens selected published space');
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

test('desktop drag stays inert while wheel navigation remains vertical-only', async () => {
  await evaluate(`window.__fixture.resetMoves()`);
  const surface = await point('.home-world-surface', 0.45, 0.82);
  const before = await evaluate(`document.querySelector('.home-world-surface__world').style.transform`);
  await mouse('mousePressed', surface.x, surface.y); await mouse('mouseMoved', surface.x - 90, surface.y - 55, { buttons: 1 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), before, 'drag did not pan the world');
  await mouse('mouseReleased', surface.x - 90, surface.y - 55); await mouse('mouseMoved', surface.x - 180, surface.y - 100, { buttons: 0 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), before, 'release did not change the camera');
  assert.equal(await evaluate(`window.__fixture.moves.length`), 0, 'drag did not activate an empty-world click');
  await mouse('mousePressed', surface.x, surface.y);
  await evaluate(`document.querySelector('.home-world-surface').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1,pointerType:'mouse',clientX:${surface.x},clientY:${surface.y}}))`);
  await mouse('mouseMoved', surface.x + 80, surface.y + 80, { buttons: 1 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), before, 'pointercancel left the camera unchanged');
  await mouse('mouseReleased', surface.x + 80, surface.y + 80);
  await mouse('mousePressed', surface.x, surface.y);
  await evaluate(`document.querySelector('.home-world-surface').dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:1,pointerType:'mouse',clientX:${surface.x},clientY:${surface.y}}))`);
  await mouse('mouseMoved', surface.x + 120, surface.y + 80, { buttons: 1 });
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), before, 'lostpointercapture left the camera unchanged');
  await mouse('mouseReleased', surface.x + 120, surface.y + 80);
  await mouse('mouseWheel', surface.x, surface.y, { buttons: 0, deltaX: 42, deltaY: 0 });
  await settlePlaywrightAnimationFrames(page);
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), before, 'horizontal wheel input was ignored');
  const beforeMatrix = await evaluate(`(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('.home-world-surface__world')).transform);return {x:m.m41,y:m.m42}})()`);
  await mouse('mouseWheel', surface.x, surface.y, { buttons: 0, deltaX: 42, deltaY: 68 });
  await waitFor(`document.querySelector('.home-world-surface__world').style.transform !== ${JSON.stringify(before)}`, 'vertical wheel camera movement');
  const afterMatrix = await evaluate(`(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('.home-world-surface__world')).transform);return {x:m.m41,y:m.m42}})()`);
  assert.equal(afterMatrix.x, beforeMatrix.x, 'vertical wheel preserved the fixed horizontal camera');
  assert.notEqual(afterMatrix.y, beforeMatrix.y, 'vertical wheel moved the camera');
});

test('launcher open, minimize, restore, toggle-close, and explicit close controls stay distinct', async () => {
  await viewport(1280, 720); await navigate(); await closeFixtureWindows();
  const launcher = '[data-launcher-id="space:Alpha:6"]';
  await click(launcher); await waitFor(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState === 'open'`, 'launcher opens');
  await evaluate(`document.querySelector('[aria-label="Minimize Alpha Archive 7"]').click()`); await waitFor(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState === 'minimized'`, 'window minimizes');
  await evaluate(`document.querySelector('[aria-label="Restore Alpha Archive 7"]').click()`); await waitFor(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState === 'open'`, 'window restores');
  await click(launcher); await waitFor(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState === 'closed'`, 'launcher toggles closed');
  await click(launcher); await evaluate(`document.querySelector('[aria-label="Close Alpha Archive 7"]').click()`);
  await waitFor(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState === 'closed'`, 'distinct close control closes');
});

test('window controls expose semantic actions and preserve focus across minimize, restore, and close', async () => {
  await viewport(1280, 720); await navigate(); await closeFixtureWindows();
  const launcher = '[data-launcher-id="space:Alpha:6"]';
  const launcherLocator = page.locator(launcher);
  await launcherLocator.focus();
  const beforeKey = await launcherLocator.evaluate((node) => ({
    active: document.activeElement === node,
    activeLabel: document.activeElement?.getAttribute('aria-label'),
    activeLauncherId: document.activeElement?.dataset?.launcherId,
    state: node.dataset.windowState
  }));
  assert.equal(beforeKey.state, 'closed', `Archive 7 launcher was not closed before Enter: ${JSON.stringify(beforeKey)}`);
  assert.equal(beforeKey.active, true, `Archive 7 launcher lost focus before Enter: ${JSON.stringify(beforeKey)}`);
  await launcherLocator.press('Enter');
  await waitFor(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState === 'open'`, 'keyboard-opened launcher state');
  await waitFor(`!!document.querySelector('[aria-label="Minimize Alpha Archive 7"]')`, 'keyboard-opened window');
  assert.deepEqual(await accessibilityNode('[aria-label="Minimize Alpha Archive 7"]'), { role: 'button', name: 'Minimize Alpha Archive 7', description: undefined });
  await evaluate(`document.querySelector('[data-resize-control]').focus();document.querySelector('[aria-label="Minimize Alpha Archive 7"]').click()`);
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Restore Alpha Archive 7'`, 'visible restore control focus');
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Published space: Alpha Archive 7"] [data-resize-control]')`), false, 'minimized content is not focusable');
  await pressKey('Enter');
  await waitFor(`!!document.querySelector('[aria-label="Published space: Alpha Archive 7"] [data-resize-control]')`, 'restored window content');
  await evaluate(`document.querySelector('[aria-label="Close Alpha Archive 7"]').click()`);
  await waitFor(`document.activeElement === document.querySelector(${JSON.stringify(launcher)})`, 'launcher focus after close');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(launcher)}).dataset.windowState`), 'closed');
});

test('visitor windows focus, drag, resize, and snap on desktop', async () => {
  await viewport(1280, 720); await navigate();
  const first = '[aria-label="Published space: Alpha Archive 1"]'; const second = '[aria-label="Published space: Alpha Archive 2"]';
  const firstBefore = await evaluate(styleRect(first));
  await evaluate(`document.querySelector(${JSON.stringify(first)}).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:31,pointerType:'mouse',button:0}))`);
  const z = await evaluate(`({first:parseInt(document.querySelector(${JSON.stringify(first)}).style.zIndex),second:parseInt(document.querySelector(${JSON.stringify(second)}).style.zIndex)})`);
  assert.ok(z.first > z.second, `focused window is topmost: ${JSON.stringify(z)}`);
  const handle = await reachablePoint(`${first} .published-space-window__drag-handle`, first);
  await mouse('mousePressed', handle.x, handle.y); await mouse('mouseMoved', handle.x + 87, handle.y + 51, { buttons: 1 }); await mouse('mouseReleased', handle.x + 87, handle.y + 51);
  await waitFor(`${styleRect(first)}.left !== ${firstBefore.left} || ${styleRect(first)}.top !== ${firstBefore.top}`, 'window drag result');
  const moved = await evaluate(styleRect(first));
  assert.equal(moved.width, firstBefore.width); assert.equal(moved.height, firstBefore.height); assert.equal(moved.left % 40, 0); assert.equal(moved.top % 40, 0);
  const resizeHandle = await reachablePoint(`${first} [data-resize-control]`, first);
  await mouse('mousePressed', resizeHandle.x, resizeHandle.y); await mouse('mouseMoved', resizeHandle.x + 83, resizeHandle.y + 77, { buttons: 1 }); await mouse('mouseReleased', resizeHandle.x + 83, resizeHandle.y + 77);
  await waitFor(`${styleRect(first)}.width !== ${moved.width}`, 'window resize result');
  const resized = await evaluate(styleRect(first));
  assert.equal(resized.left, moved.left); assert.equal(resized.top, moved.top); assert.equal(resized.width % 40, 0); assert.equal(resized.height % 40, 0);
});

test('desktop resize button has a browser accessibility name and arrow-key grid behavior without world panning', async () => {
  await viewport(1280, 720); await navigate();
  const windowSelector = '[aria-label="Published space: Alpha Archive 1"]';
  const resize = `${windowSelector} [data-resize-control]`;
  const ax = await accessibilityNode(resize);
  assert.deepEqual(ax, { role: 'button', name: 'Resize Alpha Archive 1 window', description: 'USE THE ARROW KEYS TO RESIZE IN 40 PIXEL STEPS.' });
  await evaluate(`document.querySelector(${JSON.stringify(resize)}).focus()`);
  const before = await evaluate(styleRect(windowSelector));
  const cameraBefore = await evaluate(`document.querySelector('.home-world-surface__world').style.transform`);
  await pressKey('ArrowRight'); await pressKey('ArrowDown');
  const grown = await evaluate(styleRect(windowSelector));
  assert.equal(grown.width - before.width, 40); assert.equal(grown.height - before.height, 40);
  assert.equal(await evaluate(`document.querySelector('.home-world-surface__world').style.transform`), cameraBefore, 'resize arrows did not pan the world');
  for (let index = 0; index < 30; index += 1) { await pressKey('ArrowLeft'); await pressKey('ArrowUp'); }
  const minimum = await evaluate(styleRect(windowSelector));
  assert.equal(minimum.width, 320); assert.equal(minimum.height, 260);
  for (let index = 0; index < 40; index += 1) { await pressKey('ArrowRight'); await pressKey('ArrowDown'); }
  const maximum = await evaluate(styleRect(windowSelector));
  assert.ok(maximum.left >= 24 && maximum.top >= 64 && maximum.left + maximum.width <= 1256 && maximum.top + maximum.height <= 696, `keyboard resize escaped viewport: ${JSON.stringify(maximum)}`);
});

test('artwork preview is read-only and right-click exposes no authoring commands', async () => {
  await viewport(1280, 720); await navigate(); await closeFixtureWindows();
  assert.equal(await evaluate(`document.querySelectorAll('.canvas-artwork__edit,[aria-label^="Edit artwork"]').length`), 0);
  await click('[aria-label="Open artwork: Alpha Artwork 1"]'); await waitFor(`!!document.querySelector('[aria-label="Artwork preview: Alpha Artwork 1"]')`, 'read-only artwork preview');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Artwork preview: Alpha Artwork 1"]').textContent.includes('Edit')`), false);
  await click('[aria-label="Close artwork preview"]'); await waitFor(`!document.querySelector('[aria-label^="Artwork preview:"]')`, 'artwork preview closes');
  const target = await point('[data-launcher-id="space:Alpha:0"]');
  await mouse('mousePressed', target.x, target.y, { button: 'right', buttons: 2 }); await mouse('mouseReleased', target.x, target.y, { button: 'right', buttons: 0 });
  assert.equal(await evaluate(`document.querySelectorAll('[role="menu"],.context-menu').length`), 0);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some((button) => /edit|author|private|start window/i.test(button.textContent+' '+button.getAttribute('aria-label')))`), false);
});

test('published HTTPS and IPFS-projected images render with no referrer', async () => {
  await viewport(1280, 720, false); await navigate();
  await waitFor(`document.querySelector('.profile-identity-card img')?.complete && document.querySelector('[data-canvas-object-id="art:Alpha:0"] img')?.complete`, 'published images');
  const policy = await evaluate(`[...document.querySelectorAll('.published-home-world img')].map((image)=>image.referrerPolicy)`);
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
  await viewport(1280, 720, false); await navigate(); await closeFixtureWindows();
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
  await viewport(1280, 720); await navigate(); await closeFixtureWindows();
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
  await evaluate(`document.querySelector('[data-launcher-id="space:Alpha:6"]').focus()`);
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
  await viewport(390, 844, true); await navigate(); await closeFixtureWindows(); await evaluate(`window.__fixture.resetMoves()`);
  const spatial = await evaluate(`(()=>{const s=document.querySelector('.published-home-world__spatial').getBoundingClientRect();const first=document.querySelector('[data-launcher-id]').getBoundingClientRect();return {x:s.left+2,y:first.bottom+4,centerX:s.left+s.width/2,swipeY:Math.min(700,s.bottom-24)}})()`);
  await evaluate(`(()=>{const n=document.querySelector('.published-home-world__spatial');const init={bubbles:true,pointerId:21,pointerType:'touch',isPrimary:true,clientX:${spatial.x},clientY:${spatial.y}};n.dispatchEvent(new PointerEvent('pointerdown',init));n.dispatchEvent(new PointerEvent('pointerup',init))})()`);
  await waitFor(`window.__fixture.moves.length === 1`, 'narrow Keeper tap');
  const count = await evaluate(`window.__fixture.moves.length`); const scrollBefore = await evaluate(`document.querySelector('.published-home-world__spatial').scrollTop`);
  const swipe = await evaluate(`(()=>{const candidates=[...document.querySelectorAll('[data-launcher-id]')].map(n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});return candidates.find(p=>p.y>350&&p.y<650)||candidates.find(p=>p.y>180&&p.y<700)})()`);
  await touch('touchStart', [{ x: swipe.x, y: swipe.y, id: 22 }]);
  for (let step = 1; step <= 8; step += 1) { await touch('touchMove', [{ x: swipe.x + 1, y: swipe.y - step * 28, id: 22 }]); await delay(20); }
  await touch('touchEnd', []);
  await delay(100);
  const scrolled = await evaluate(`(()=>{const s=document.querySelector('.published-home-world__spatial');const n=document.elementFromPoint(${swipe.x},${swipe.y});return {top:s.scrollTop,scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,target:n?.className,touchAction:n&&getComputedStyle(n).touchAction,overflow:getComputedStyle(s).overflowY}})()`);
  assert.ok(scrolled.top > scrollBefore, `native vertical scroll did not advance: ${JSON.stringify(scrolled)}`);
  assert.equal(await evaluate(`window.__fixture.moves.length`), count, 'vertical swipe did not move Keeper');
});

test('320px narrow launchers stack and windows remain reachable', async () => {
  await viewport(320, 844, true); await navigate(); await closeFixtureWindows();
  const layout = await evaluate(`(()=>{const s=document.querySelector('.published-home-world__spatial');const launchers=[...s.querySelectorAll('[data-launcher-id]')].map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}});return {launchers,clientHeight:s.clientHeight,scrollHeight:s.scrollHeight}})()`);
  assert.equal(layout.launchers.length, 7); assert.ok(layout.launchers.every((entry, index) => index === 0 || entry.top >= layout.launchers[index - 1].bottom));
  assert.ok(layout.launchers.every((entry) => entry.left >= 12 && entry.right <= 308)); assert.ok(layout.scrollHeight > layout.clientHeight, 'narrow content remains scroll-reachable');
  await evaluate(`document.querySelector('[data-launcher-id="space:Alpha:6"]').scrollIntoView({block:'center'});document.querySelector('[data-launcher-id="space:Alpha:6"]').click()`);
  await waitFor(`!!document.querySelector('[aria-label="Close Alpha Archive 7"]')`, 'narrow window control');
  const closeRect = await point('[aria-label="Close Alpha Archive 7"]'); assert.ok(closeRect.x >= 0 && closeRect.x <= 320 && closeRect.y >= 0 && closeRect.y <= 844);
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0, '320px layout exposes no resize control');
});

test('390px narrow accessibility tree exposes no misleading resize control', async () => {
  await viewport(390, 844, true); await navigate();
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0);
  const tree = await pageCdp.send('Accessibility.getFullAXTree');
  assert.equal(tree.nodes.some((node) => /^Resize .* window$/.test(node.name?.value || '')), false);
});

test('profile transition and route reload discard ephemeral visitor state', async () => {
  await viewport(1280, 720, false); await navigate(); await closeFixtureWindows(); await click('[aria-label="Open artwork: Alpha Artwork 1"]'); await evaluate(`document.querySelector('[data-launcher-id="space:Alpha:6"]').click()`);
  await evaluate(`window.__fixture.visit(${JSON.stringify(profileB)})`); await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'profile transition');
  await waitFor(`!!document.querySelector('[data-launcher-id="space:Beta:0"]')`, 'Beta document');
  assert.equal(await evaluate(`document.querySelectorAll('[data-launcher-id^="space:Alpha:"]').length`), 0); assert.equal(await evaluate(`!!document.querySelector('[aria-label^="Artwork preview:"]')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.published-home-world__window').length`), 2, 'only Beta start-open windows remain');
  await evaluate(`document.querySelector('[data-launcher-id="space:Beta:6"]').click()`); const priorLoad = await evaluate(`performance.timeOrigin`); await page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 });
  await waitFor(`performance.timeOrigin !== ${priorLoad}`, 'route reload navigation');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'reloaded Beta route'); await waitFor(`document.querySelectorAll('.published-home-world__window').length === 2`, 'reload default window state');
  assert.equal(await evaluate(`document.querySelector('[data-launcher-id="space:Beta:6"]').dataset.windowState`), 'closed');
});

test('profile transition while artwork modal is open removes isolation and uses the published fallback', async () => {
  await viewport(1280, 720, false); await navigate(); await closeFixtureWindows();
  await evaluate(`document.querySelector('[aria-label="Open artwork: Alpha Artwork 1"]').click()`);
  await waitFor(`document.querySelectorAll('[inert]').length >= 3`, 'modal background isolation');
  await evaluate(`window.__fixture.visit(${JSON.stringify(profileB)})`);
  await waitFor(`!!document.querySelector('[data-launcher-id="space:Beta:0"]') && !document.querySelector('[aria-label^="Artwork preview:"]')`, 'modal route cleanup');
  assert.equal(await evaluate(`document.querySelectorAll('[inert]').length`), 0);
  assert.equal(await evaluate(`document.activeElement?.hasAttribute('data-published-focus-fallback')`), true);
});

test('visitor load performs no owner storage reads or writes', async () => { assert.deepEqual(await evaluate(`window.__visitorStorageOps`), []); });
});
