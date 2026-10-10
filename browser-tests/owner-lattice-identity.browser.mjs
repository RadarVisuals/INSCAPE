import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer as createViteServer } from 'vite';
import { createBrowserTestCleanup, createLifecycleDiagnostics, withinDeadline,
  BROWSER_LIFECYCLE_TIMEOUTS } from './browser-test-lifecycle.mjs';
import { createPlaywrightRouteController, launchPlaywrightEdge } from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, `.browser-test-runtime-owner-identity-${process.pid}-${Date.now()}-${randomUUID()}`);
const profile = '0x1111111111111111111111111111111111111111';
const rpcOrigin = 'https://rpc.mainnet.lukso.network';

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const { port } = socket.address(); socket.close(() => resolvePort(port)); });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a Phase 7 browser-test port', () => socket.close());
}

async function findBrowser() {
  const candidates = [process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* next */ }
  }
  throw new Error('No Edge/Chromium browser found');
}

async function setAuthority(page) {
  await page.evaluate(async (address) => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    const state = { hostProfileAddress: address, isHostProfileOwner: true, isWalletConnected: true,
      authorityLifecycleStatus: 'complete', disposeWallet: () => ({ disposed: true, listenersRemoved: true, limitation: null }),
      _failClosedProviderContext: () => {}, _applyAuthoritativeProviderContext: async () => {} };
    window.__phase7AuthorityUnsubscribe?.();
    window.__phase7AuthorityUnsubscribe = useWalletStore.subscribe((current) => {
      if (current.hostProfileAddress?.toLowerCase() === address && current.isHostProfileOwner) return;
      useWalletStore.setState(state);
    });
    useWalletStore.setState(state);
    history.pushState({ viewedProfileAddress: address }, '', `?view=${address}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, profile);
}

async function openIdentity(page) {
  const trigger = page.getByRole('button', { name: 'Profile', exact: true });
  await trigger.click();
  await page.locator('.system-workflow__profile-card').click();
  const dialog = page.locator('.identity-module aside[aria-label^="Identity —"]');
  await dialog.waitFor({ state: 'visible' });
  return { dialog, trigger };
}

test('production owner Identity window owns focus, scrolling, details and responsive geometry', { timeout: 120_000 }, async () => {
  const resources = {}; const problems = []; const diagnostic = createLifecycleDiagnostics();
  let cleanup = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
  try {
    const suppliedOrigin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT;
    const port = suppliedOrigin ? null : await availablePort();
    const baseUrl = suppliedOrigin || `http://127.0.0.1:${port}`;
    if (!suppliedOrigin) {
      resources.vite = await createViteServer({ root, cacheDir: resolve(runtimeDir, 'vite-cache'), optimizeDeps: { entries: ['index.html'] }, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true, watch: null } });
      await resources.vite.listen();
    }
    const routeController = createPlaywrightRouteController({
      loopbackOrigin: baseUrl,
      knownOrigins: [rpcOrigin],
      decideKnown: async ({ request }) => {
        const payload = JSON.parse(request.postData() || '{}');
        const word = (value) => BigInt(value).toString(16).padStart(64, '0');
        const emptyArrayBytes = `0x${word(32)}${word(16)}${word(0)}`;
        const respond = (entry) => {
          if (entry.method === 'eth_chainId') return { jsonrpc: '2.0', id: entry.id, result: '0x2a' };
          if (entry.method === 'eth_getCode') return { jsonrpc: '2.0', id: entry.id, result: '0x' };
          if (entry.method === 'eth_call') {
            const data = entry.params?.[0]?.data || '';
            return { jsonrpc: '2.0', id: entry.id, result: data.startsWith('0x01ffc9a7') ? `0x${word(1)}` : emptyArrayBytes };
          }
          return { jsonrpc: '2.0', id: entry.id, error: { code: -32601, message: 'Fixture method unavailable' } };
        };
        const body = JSON.stringify(Array.isArray(payload) ? payload.map(respond) : respond(payload));
        return { action: 'fulfill', options: { status: 200, contentType: 'application/json', body } };
      }
    });
    const launched = await launchPlaywrightEdge({ edgePath: await findBrowser(), runtimePath: runtimeDir,
      workspaceRoot: root, loopbackOrigin: baseUrl, routeController, resources, diagnostic,
      onBrowserProblem: (problem) => problems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => { cleanup = createBrowserTestCleanup({ rootPid, processTree,
        runtimePath: runtimeDir, workspaceRoot: root, diagnostic }); } });
    const page = launched.page;
    page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(30_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    // Finish the real App's initial wallet acquisition before imposing the test
    // authority, matching the production routing harness lifecycle.
    await page.evaluate(async () => {
      const { useWalletStore } = await import('/src/store/useWalletStore.js');
      if (useWalletStore.getState().authorityLifecycleStatus !== 'complete') await new Promise(resolve => {
        const unsubscribe = useWalletStore.subscribe(state => { if (state.authorityLifecycleStatus === 'complete') { unsubscribe(); resolve(); } });
      });
      useWalletStore.getState().disposeWallet();
      const { publishedProfileResolutionStore } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      publishedProfileResolutionStore.clear();
      publishedProfileResolutionStore.repository = { resolve: async address => ({ status: 'UNAVAILABLE', address, document: null, errorCode: 'PROFILE_DOCUMENT_NOT_FOUND' }) };
    });
    await setAuthority(page);
    await page.locator('.startveil').waitFor({ state: 'detached', timeout: 20_000 });
    await page.locator('main.system-workflow').waitFor({ state: 'attached', timeout: 20_000 });
    diagnostic('phase7:owner-ready');

    let opened = await openIdentity(page);
    assert.equal(await opened.dialog.getAttribute('aria-modal'), null, 'Identity is an independent non-modal window');
    const camera = () => page.locator('main.system-workflow').evaluate(node => ({ x: node.dataset.workbenchCameraX, y: node.dataset.workbenchCameraY, scale: node.dataset.workbenchCameraScale }));
    const beforeCamera = await camera();
    const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('inscape.system-workflow-draft.'))));
    await opened.dialog.getByRole('button', { name: 'Close Identity', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close Identity',
      'Tab follows the native document order');
    // Short content need not claim wheel input. Constrain the viewport until
    // this real profile overflows, then exercise its native scroll container.
    await page.setViewportSize({ width: 1440, height: 300 });
    const reader = opened.dialog.locator('.system-workflow__instrument-content');
    await page.waitForFunction(() => {
      const node = document.querySelector('.identity-module .system-workflow__instrument-content');
      return node && node.scrollHeight > node.clientHeight + 1;
    });
    assert.equal(await reader.evaluate(node => node.scrollHeight > node.clientHeight + 1), true);
    const readerBox = await reader.boundingBox();
    await page.mouse.move(readerBox.x + readerBox.width / 2, readerBox.y + readerBox.height / 2);
    await page.mouse.wheel(0, 80);
    await page.waitForFunction(() => document.querySelector('.identity-module .system-workflow__instrument-content')?.scrollTop > 0);
    assert.deepEqual(await camera(), beforeCamera, 'Identity scrolling does not pan the Workbench');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.mouse.click(5, 5);
    assert.equal(await opened.dialog.isVisible(), true, 'a non-modal Identity remains open after outside interaction');
    await opened.dialog.getByRole('button', { name: 'Close Identity', exact: true }).click();
    await opened.dialog.waitFor({ state: 'detached' });
    assert.equal(await opened.trigger.evaluate(node => node === document.activeElement), true);
    for (const boundary of [{ width: 1280, height: 720 }, { width: 900, height: 720 }, { width: 640, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(boundary);
      opened = await openIdentity(page);
      const compact = await opened.dialog.boundingBox();
      const expand = opened.dialog.getByRole('button', { name: 'Expand INSCAPE details', exact: true });
      await expand.click();
      const collapse = opened.dialog.getByRole('button', { name: 'Collapse INSCAPE details', exact: true });
      assert.equal(await collapse.getAttribute('aria-expanded'), 'true');
      const expanded = await opened.dialog.boundingBox();
      assert.equal(expanded.y, compact.y, 'expansion preserves the top edge');
      assert.ok(expanded.height >= compact.height, 'details expand below the official identity');
      assert.ok(expanded.x >= 0 && expanded.y >= 0 && expanded.x + expanded.width <= boundary.width && expanded.y + expanded.height <= boundary.height,
        `Identity fits ${boundary.width}px: ${JSON.stringify(expanded)}`);
      assert.equal(await opened.dialog.getByRole('link', { name: 'Open official Universal Profile' }).getAttribute('href'), `https://universaleverything.io/${profile}`);
      await collapse.click();
      // fitContent applies the ResizeObserver measurement after the collapse
      // render. Wait for exact restoration; no pixel tolerance is needed.
      await page.waitForFunction(expected => {
        const node = document.querySelector('.identity-module aside[aria-label^="Identity —"]');
        const box = node?.getBoundingClientRect();
        return box && ['x', 'y', 'width', 'height'].every(key => box[key] === expected[key]);
      }, compact);
      assert.deepEqual(await opened.dialog.boundingBox(), compact, 'collapsing details restores compact geometry');
      await opened.dialog.getByRole('button', { name: 'Close Identity', exact: true }).focus();
      await page.keyboard.press('Escape');
      await opened.dialog.waitFor({ state: 'detached' });
      assert.equal(await opened.trigger.evaluate(node => node === document.activeElement), true, 'Escape restores Profile focus');
      diagnostic('identity:boundary', boundary);
    }
    assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('inscape.system-workflow-draft.')))), saved,
      'Identity window interaction never edits authored content');
    assert.deepEqual(problems.filter(problem => /Page error/iu.test(problem)), []);
  } finally { await cleanup(resources); }
});
