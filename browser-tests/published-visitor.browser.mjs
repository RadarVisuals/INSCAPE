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
const expectedCspProblems = [];
let acceptingExpectedCspProblems = false;
const recordBrowserProblem = (problem) => {
  const expectedBlockedFixtureRequest = /^Request failed: https:\/\/csp-blocked\.invalid csp$/iu.test(problem);
  if (expectedBlockedFixtureRequest || (acceptingExpectedCspProblems && /content security policy|refused to connect/iu.test(problem))) {
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
  await waitFor(`getComputedStyle(document.querySelector('.published-home-world__header')).opacity === '1'`, 'published visitor commands resolve');
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

async function enterGallery() {
  await click('[aria-label="Move to Gallery level"]');
  await page.locator('.gallery-world[data-transition-phase="gallery"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function openGalleryArtwork(name = 'Alpha Artwork 1') {
  await enterGallery();
  const trigger = `[aria-label="Open artwork: ${name}"]`;
  await waitFor(`!!document.querySelector(${JSON.stringify(trigger)})`, `${name} Gallery artwork`);
  return trigger;
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
  const typography = await evaluate(`(()=>{const cardStyle=getComputedStyle(document.querySelector(${JSON.stringify(card)}));return {textTransform:cardStyle.textTransform,fontVariantCaps:cardStyle.fontVariantCaps,fontStretch:cardStyle.fontStretch}})()`);
  assert.deepEqual(typography, { textTransform: 'none', fontVariantCaps: 'normal', fontStretch: '100%' });
  assert.equal(await evaluate(`document.querySelector('.profile-identity-card__details > p')`), null, 'profile card invents no biography fallback');
  await evaluate(`window.__fixture.resetMoves()`); await click('.profile-identity-card__details');
  assert.equal(await evaluate(`window.__fixture.moves.length`), 0, 'card surface blocks click-through world movement');
  await click(avatar);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(card)})).transitionDelay.split(',')[0].trim()`), '0.08s', 'card width waits for the detail fade on close');
  await waitFor(`document.querySelector(${JSON.stringify(card)}).dataset.state === 'avatar' && document.querySelector(${JSON.stringify(card)}).getBoundingClientRect().width <= 68.1 && parseFloat(getComputedStyle(document.querySelector('.profile-identity-card__details')).opacity) === 0`, 'collapsed profile identity');
  await waitFor(`document.querySelector(${JSON.stringify(categories)}).getAttribute('aria-hidden') === 'true'`, 'categories control hides with avatar profile');
});

test('Directory visits a published workspace, Close remains Close, and Return restores the connected workspace', async () => {
  await viewport(1280, 720, false); await navigate();
  await click('.system-hud__commands button');
  await waitFor(`!!document.querySelector('.profile-discovery__panel')`, 'directory opens');
  await evaluate(`document.querySelector('[aria-label="Close INSCAPE directory"]').focus()`);
  await pressKey('Enter');
  await waitFor(`!document.querySelector('.profile-discovery__panel')`, 'directory closes with Enter on Close');
  assert.equal(await evaluate(`window.__fixture.address`), profileA);

  await click('.system-hud__commands button');
  await page.locator('.profile-discovery__search input').fill('Beta');
  await waitFor(`document.querySelectorAll('.profile-discovery__result').length === 1`, 'directory search result');
  await click('.profile-discovery__result');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'directory profile visit');
  await waitFor(`!!document.querySelector('.system-hud__commands button:nth-child(2)')`, 'Return command');
  await click('.system-hud__commands button:nth-child(2)');
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileA)}`, 'connected workspace return');
});

test('categories card opens the detached native-ratio asset browser without opening legacy space windows', async () => {
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
  assert.equal(await evaluate(`document.querySelector('.category-asset-browser')?.hasAttribute('data-visible') || false`), false, 'opening categories does not choose a folder implicitly');
  await click('.category-navigation-card nav button:first-of-type');
  await waitFor(`document.querySelector('.category-asset-browser')?.hasAttribute('data-visible')`, 'detached asset browser opens with categories');
  await waitFor(`document.querySelector('.category-asset-card img')?.complete && document.querySelector('.category-asset-card img')?.naturalWidth > 0`, 'category asset preview');
  const browser = await evaluate(`(()=>{const windowNode=document.querySelector('.category-asset-browser');const media=windowNode.querySelector('.category-asset-card__media');const image=media.querySelector('img');const mediaRect=media.getBoundingClientRect();return {label:windowNode.getAttribute('aria-label'),left:parseFloat(windowNode.style.left),top:parseFloat(windowNode.style.top),cards:windowNode.querySelectorAll('.category-asset-card').length,nativeRatio:image.naturalWidth/image.naturalHeight,renderedRatio:mediaRect.width/mediaRect.height,mediaHeight:mediaRect.height}})()`);
  assert.equal(browser.label, 'Alpha Archive 1 NFT browser');
  assert.equal(browser.left, 244); assert.equal(browser.top, 20); assert.equal(browser.cards, 1);
  assert.ok(Math.abs(browser.nativeRatio - browser.renderedRatio) < .02, `category preview changed native ratio: ${JSON.stringify(browser)}`);
  await evaluate(`(()=>{const input=document.querySelector('[aria-label="Thumbnail size"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'250');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(`document.querySelector('.category-asset-card__media').getBoundingClientRect().height > ${browser.mediaHeight + 30}`, 'thumbnail density slider');
  await click('.category-asset-card');
  await waitFor(`document.querySelector('.nft-flip-viewer__turntable') && document.activeElement === document.querySelector('.nft-flip-viewer__turntable')`, 'NFT viewer focus entry');
  assert.equal(await evaluate(`document.querySelector('.nft-flip-viewer').getAttribute('aria-modal')`), 'true');
  assert.ok(await evaluate(`document.querySelectorAll('body > [inert]').length > 0`), 'NFT viewer isolates the background');
  assert.match(await evaluate(`document.querySelector('.nft-flip-viewer__turntable').getAttribute('aria-label')`), /swipe left for next and right for previous/);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.nft-flip-viewer__turntable')).userSelect`), 'none');
  const viewerCenter = await point('.nft-flip-viewer__turntable');
  await mouse('mousePressed', viewerCenter.x + 36, viewerCenter.y); await mouse('mouseMoved', viewerCenter.x - 36, viewerCenter.y, { buttons: 1 }); await mouse('mouseReleased', viewerCenter.x - 36, viewerCenter.y);
  await waitFor(`document.querySelector('.nft-flip-viewer__progress strong').textContent === 'DESCRIPTION' && !document.querySelector('.nft-flip-viewer__turntable').hasAttribute('data-rotating')`, 'NFT description face');
  assert.match(await evaluate(`document.querySelector('.nft-dossier__body p').textContent`), /No description is available/);
  assert.equal(await evaluate(`(()=>{const text=document.querySelector('.nft-flip-viewer').textContent;return text.includes('VXCTXR')||text.includes('1 / 1')||text.includes('22 JUL 2026')})()`), false, 'viewer contains no synthetic profile or token facts');
  await click('[aria-label="Next NFT face"]');
  await waitFor(`document.querySelector('.nft-flip-viewer__progress strong').textContent === 'ATTRIBUTES' && !document.querySelector('.nft-flip-viewer__turntable').hasAttribute('data-rotating')`, 'NFT attributes face');
  await click('[aria-label="Next NFT face"]');
  await waitFor(`document.querySelector('.nft-flip-viewer__progress strong').textContent === 'RECORD' && !document.querySelector('.nft-flip-viewer__turntable').hasAttribute('data-rotating')`, 'NFT record face');
  await click('[aria-label="Next NFT face"]');
  await waitFor(`document.querySelector('.nft-flip-viewer__progress strong').textContent === 'IMAGE 1' && !document.querySelector('.nft-flip-viewer__turntable').hasAttribute('data-rotating')`, 'NFT viewer returns to its artwork face');
  await pressKey('Escape');
  await waitFor(`!document.querySelector('.nft-flip-viewer')`, 'NFT viewer closes');
  await waitFor(`document.activeElement === document.querySelector('.category-asset-card')`, 'NFT viewer restores trigger focus');
  assert.equal(await evaluate(`document.querySelectorAll('body > [inert]').length`), 0, 'NFT viewer clears background isolation');
  await evaluate(`document.querySelector('.category-navigation-card nav button:last-of-type').click()`);
  await waitFor(`document.querySelector('.category-asset-browser').getAttribute('aria-label') === 'Alpha Archive 7 NFT browser'`, 'category switches detached browser content');
  assert.equal(await evaluate(`document.querySelectorAll('.category-asset-card').length`), 0);
  assert.equal(await evaluate(`document.querySelector('[data-launcher-id^="space:"]')`), null, 'category selection does not restore legacy space launchers');
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

test('published HTTPS and IPFS-projected images render with no referrer', async () => {
  await viewport(1280, 720, false); await navigate();
  await enterGallery();
  await waitFor(`document.querySelector('.profile-identity-card img')?.complete && document.querySelector('[data-canvas-object-id="art:Alpha:0"] img')?.complete`, 'published images');
  const policy = await evaluate(`[...document.querySelectorAll('.application-root img')].map((image)=>image.referrerPolicy)`);
  assert.ok(policy.length >= 2); assert.ok(policy.every((value) => value === 'no-referrer'));
  assert.ok(imageRequests.some((url) => url.includes('/ipfs/') && url.includes('space-Alpha.png')), 'IPFS space image used the configured HTTPS gateway');
});

test('rejected HTTP artwork never requests while broken HTTPS falls back and recovers on src change', async () => {
  await viewport(1280, 720, false); await navigate();
  const insecure = 'http://published-images.invalid/insecure.png';
  await evaluate(`window.__fixture.setArtworkUrl(${JSON.stringify(insecure)})`);
  await enterGallery();
  await waitFor(`!!document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'HTTP artwork fallback');
  assert.equal(imageRequests.includes(insecure), false);
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/broken-art.png')`);
  await waitFor(`!document.querySelector('.gallery-world')`, 'Gallery resets for changed published document');
  await enterGallery();
  await waitFor(`!!document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'broken image fallback');
  const fallbackSize = await evaluate(`(()=>{const r=document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]').getBoundingClientRect();return {width:r.width,height:r.height}})()`);
  assert.ok(fallbackSize.width > 0 && fallbackSize.height > 0);
  await evaluate(`window.__fixture.setArtworkUrl('https://published-images.invalid/recovered-art.png')`);
  await waitFor(`!document.querySelector('.gallery-world')`, 'Gallery resets for recovered published document');
  await enterGallery();
  await waitFor(`document.querySelector('[data-canvas-object-id="art:Alpha:0"] img')?.complete && !document.querySelector('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]')`, 'new source recovery');
});

test('an actual CSP response header blocks a disallowed image and the UI falls back', async () => {
  expectedCspProblems.length = 0;
  acceptingExpectedCspProblems = true;
  try {
    await viewport(1280, 720, false); await navigateCsp();
    await evaluate(`window.__fixture.setArtworkUrl('https://csp-blocked.invalid/art.png')`);
    await enterGallery();
    await page.locator('[data-canvas-object-id="art:Alpha:0"] [data-published-image-fallback]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(100);
  } finally {
    acceptingExpectedCspProblems = false;
  }
  assert.ok(expectedCspProblems.length >= 1, 'browser reported CSP enforcement for the deliberately disallowed image');
  assert.equal(imageRequests.some((url) => url.startsWith('https://csp-blocked.invalid/')), false, 'CSP stopped the image before an outbound request');
});

test('narrow visitor mode keeps Directory and Return reachable without desktop authoring parity', async () => {
  await viewport(390, 844, true); await navigate(profileB);
  const commands = await evaluate(`[...document.querySelectorAll('.system-hud__commands button')].map((button)=>({text:button.textContent.trim(),rect:button.getBoundingClientRect().toJSON()}))`);
  assert.equal(commands.length, 2);
  assert.ok(commands.every(({ rect }) => rect.left >= 0 && rect.right <= 390 && rect.top >= 0 && rect.bottom <= 844));
  await click('.system-hud__commands button:first-child');
  await waitFor(`!!document.querySelector('.profile-discovery__panel')`, 'narrow directory opens');
  await click('[aria-label="Close INSCAPE directory"]');
  await waitFor(`!document.querySelector('.profile-discovery__panel')`, 'narrow directory closes');
  await click('.system-hud__commands button:nth-child(2)');
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
