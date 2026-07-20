import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { createServer as createViteServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = resolve(root, '.browser-test-profile');
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
let cdp;
let baseUrl;
let activeViewport = { width: 1280, height: 720, touch: false };
let navigationSequence = 0;
const browserProblems = [];
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const socket = createServer();
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolvePort(port));
    });
  });
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  throw new Error('No Chromium browser found. Set BROWSER_PATH to Edge, Chrome, or Chromium.');
}

class CdpClient {
  constructor(url) { this.socket = new WebSocket(url); this.sequence = 0; this.pending = new Map(); this.listeners = new Map(); }
  async open() {
    await new Promise((resolveOpen, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out opening browser control socket')), 10_000);
      this.socket.once('open', () => { clearTimeout(timer); resolveOpen(); });
      this.socket.once('error', (error) => { clearTimeout(timer); reject(error); });
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(raw);
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id); clearTimeout(request.timer);
        message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
    this.socket.on('close', () => {
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('Browser control socket closed')); }
      this.pending.clear();
    });
  }
  on(method, listener) { const list = this.listeners.get(method) || []; list.push(listener); this.listeners.set(method, list); }
  send(method, params = {}, timeout = 10_000) {
    return new Promise((resolveSend, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out calling ${method}`)); }, timeout);
      this.pending.set(id, { resolve: resolveSend, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('Browser connection closed')); }
    this.pending.clear(); this.socket.close();
  }
}

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, label, timeout = 10_000) {
  const started = Date.now(); let lastError;
  while (Date.now() - started < timeout) {
    try { if (await evaluate(expression)) return; } catch (error) { lastError = error; }
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function viewport(width, height, touch = false) {
  activeViewport = { width, height, touch };
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  await waitFor(`innerWidth === ${width} && innerHeight === ${height}`, `${width}x${height} viewport`);
}

async function navigate(address = profileA) {
  const run = String(++navigationSequence);
  await cdp.send('Page.navigate', { url: `${baseUrl}/browser-tests/fixture.html?view=${address}&run=${run}` });
  await waitFor(`new URLSearchParams(location.search).get('run') === ${JSON.stringify(run)}`, 'new fixture navigation');
  await viewport(activeViewport.width, activeViewport.height, activeViewport.touch);
  await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(address)}`, 'published fixture');
  await waitFor(`document.querySelector('.published-home-world') && window.__fixture`, 'published visitor world');
  await waitFor(`(()=>{const n=document.querySelector('.published-home-world__spatial');if(!n||getComputedStyle(n).zIndex!=='15')return false;return innerWidth>=720||getComputedStyle(n).overflowY==='auto'})()`, 'published visitor responsive styles');
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
  const params = { type, x, y, button: options.button || 'left', buttons: options.buttons ?? (type === 'mouseReleased' ? 0 : 1), clickCount: options.clickCount ?? (type === 'mouseMoved' ? 0 : 1), modifiers: options.modifiers || 0 };
  if (options.deltaX !== undefined) params.deltaX = options.deltaX;
  if (options.deltaY !== undefined) params.deltaY = options.deltaY;
  await cdp.send('Input.dispatchMouseEvent', params);
}

async function click(selector) {
  const target = await point(selector);
  const hit = await evaluate(`(()=>{const n=document.elementFromPoint(${target.x},${target.y});const target=document.querySelector(${JSON.stringify(selector)});return {tag:n?.tagName,className:String(n?.className||''),label:n?.getAttribute?.('aria-label'),matches:Boolean(n?.closest?.(${JSON.stringify(selector)})),targetPointer:getComputedStyle(target).pointerEvents,targetZ:getComputedStyle(target).zIndex,parentPointer:getComputedStyle(target.parentElement).pointerEvents,parentZ:getComputedStyle(target.parentElement).zIndex,layers:document.elementsFromPoint(${target.x},${target.y}).slice(0,8).map(e=>e.tagName+'.'+String(e.className||''))}})()`);
  assert.equal(hit.matches, true, `${selector} is not reachable at ${Math.round(target.x)},${Math.round(target.y)}; hit ${JSON.stringify(hit)}`);
  await mouse('mousePressed', target.x, target.y); await mouse('mouseReleased', target.x, target.y);
}
async function pressKey(key, modifiers = 0) {
  const keys = {
    Tab: { code: 'Tab', value: 9 }, Enter: { code: 'Enter', value: 13 }, Space: { code: 'Space', value: 32, key: ' ' }, Escape: { code: 'Escape', value: 27 },
    ArrowLeft: { code: 'ArrowLeft', value: 37 }, ArrowUp: { code: 'ArrowUp', value: 38 },
    ArrowRight: { code: 'ArrowRight', value: 39 }, ArrowDown: { code: 'ArrowDown', value: 40 }
  };
  const entry = keys[key]; assert.ok(entry, `Unsupported test key ${key}`);
  const params = { key: entry.key || key, code: entry.code, windowsVirtualKeyCode: entry.value, nativeVirtualKeyCode: entry.value, modifiers };
  const text = key === 'Enter' ? '\r' : key === 'Space' ? ' ' : '';
  await cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...params, ...(text ? { text, unmodifiedText: text } : {}) });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
}
async function accessibilityNode(selector) {
  const { root: documentNode } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector });
  assert.ok(nodeId, `No DOM node for accessibility selector ${selector}`);
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false });
  const target = nodes.find((entry) => entry.backendDOMNodeId === node.backendNodeId) || nodes[0];
  return { role: target?.role?.value, name: target?.name?.value, description: target?.description?.value };
}
async function touch(type, points) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((entry, index) => ({ x: entry.x, y: entry.y, id: entry.id ?? index + 1, radiusX: 2, radiusY: 2, force: 1 })) }); }
function styleRect(selector) { return `(()=>{const n=document.querySelector(${JSON.stringify(selector)});return n&&['left','top','width','height','zIndex'].reduce((o,k)=>(o[k]=parseFloat(n.style[k])||0,o),{})})()`; }
async function closeFixtureWindows() {
  await evaluate(`[...document.querySelectorAll('[aria-label^="Close Alpha Archive"],[aria-label^="Close Beta Archive"]')].forEach((button) => button.click())`);
  await waitFor(`document.querySelectorAll('.published-home-world__window').length === 0`, 'fixture windows close');
}

describe('published visitor world', { concurrency: false }, () => {
before(async () => {
  const browserPath = await findBrowser();
  const vitePort = await availablePort(); const debugPort = await availablePort();
  baseUrl = `http://127.0.0.1:${vitePort}`;
  vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: vitePort, strictPort: true } });
  await vite.listen();
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-component-update', '--disk-cache-size=1', '--media-cache-size=1', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, '--incognito', `${baseUrl}/browser-tests/fixture.html?view=${profileA}`], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  browser.stderr.on('data', () => {});
  let target; const started = Date.now();
  while (Date.now() - started < 15_000) {
    try { target = (await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json())).find((entry) => entry.type === 'page' && entry.url.startsWith(baseUrl)); } catch { /* starting */ }
    if (target) break; await delay(100);
  }
  assert.ok(target, 'Edge/Chromium did not expose a page target');
  cdp = new CdpClient(target.webSocketDebuggerUrl); await cdp.open();
  cdp.on('Fetch.requestPaused', ({ requestId, request }) => {
    const local = request.url.startsWith(baseUrl) || /^(?:data|blob):/.test(request.url);
    const action = local
      ? cdp.send('Fetch.continueRequest', { requestId })
      : cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }] });
    action.catch((error) => browserProblems.push(`Request interception: ${error.message}`));
  });
  cdp.on('Runtime.exceptionThrown', (entry) => browserProblems.push(`Uncaught: ${entry.exceptionDetails.exception?.description || entry.exceptionDetails.text}`));
  cdp.on('Runtime.consoleAPICalled', (entry) => { if (['error', 'warning'].includes(entry.type)) browserProblems.push(`Console ${entry.type}: ${entry.args.map((arg) => arg.value || arg.description).join(' ')}`); });
  cdp.on('Log.entryAdded', ({ entry }) => { if (['error', 'warning'].includes(entry.level)) browserProblems.push(`Browser ${entry.level}: ${entry.text}`); });
  await Promise.all([cdp.send('Runtime.enable'), cdp.send('Page.enable'), cdp.send('Log.enable'), cdp.send('Accessibility.enable'), cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })]);
  await viewport(1280, 720); await navigate();
});

after(async () => {
  try { cdp?.close(); } finally {
    if (browser && !browser.killed) {
      const exited = new Promise((resolveExit) => browser.once('exit', resolveExit));
      browser.kill(); await Promise.race([exited, delay(5_000)]);
    }
    await vite?.close();
  }
  assert.deepEqual(browserProblems, [], `Unexpected browser diagnostics:\n${browserProblems.join('\n')}`);
});

test('desktop empty-world click moves the Keeper exactly once', async () => {
  await evaluate(`window.__fixture.resetMoves()`);
  const surface = await point('.home-world-surface', 0.48, 0.86);
  await mouse('mousePressed', surface.x, surface.y); await mouse('mouseReleased', surface.x, surface.y);
  await waitFor(`window.__fixture.moves.length === 1`, 'one Keeper move');
  assert.equal(await evaluate(`window.__fixture.moves.length`), 1);
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
  await evaluate(`document.querySelector(${JSON.stringify(launcher)}).focus()`); await pressKey('Enter');
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
  await evaluate(`document.querySelector('[data-launcher-id="space:Alpha:6"]').scrollIntoView({block:'center'})`); await click('[data-launcher-id="space:Alpha:6"]');
  await waitFor(`!!document.querySelector('[aria-label="Close Alpha Archive 7"]')`, 'narrow window control');
  const closeRect = await point('[aria-label="Close Alpha Archive 7"]'); assert.ok(closeRect.x >= 0 && closeRect.x <= 320 && closeRect.y >= 0 && closeRect.y <= 844);
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0, '320px layout exposes no resize control');
});

test('390px narrow accessibility tree exposes no misleading resize control', async () => {
  await viewport(390, 844, true); await navigate();
  assert.equal(await evaluate(`document.querySelectorAll('[data-resize-control]').length`), 0);
  const tree = await cdp.send('Accessibility.getFullAXTree');
  assert.equal(tree.nodes.some((node) => /^Resize .* window$/.test(node.name?.value || '')), false);
});

test('profile transition and route reload discard ephemeral visitor state', async () => {
  await viewport(1280, 720, false); await navigate(); await closeFixtureWindows(); await click('[aria-label="Open artwork: Alpha Artwork 1"]'); await evaluate(`document.querySelector('[data-launcher-id="space:Alpha:6"]').click()`);
  await evaluate(`window.__fixture.visit(${JSON.stringify(profileB)})`); await waitFor(`document.querySelector('[data-browser-fixture]')?.dataset.profileAddress === ${JSON.stringify(profileB)}`, 'profile transition');
  await waitFor(`!!document.querySelector('[data-launcher-id="space:Beta:0"]')`, 'Beta document');
  assert.equal(await evaluate(`document.querySelectorAll('[data-launcher-id^="space:Alpha:"]').length`), 0); assert.equal(await evaluate(`!!document.querySelector('[aria-label^="Artwork preview:"]')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.published-home-world__window').length`), 2, 'only Beta start-open windows remain');
  await evaluate(`document.querySelector('[data-launcher-id="space:Beta:6"]').click()`); const priorLoad = await evaluate(`performance.timeOrigin`); await cdp.send('Page.reload', { ignoreCache: true });
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
