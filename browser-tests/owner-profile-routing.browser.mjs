import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createBrowserTestCleanup,
  createLifecycleDiagnostics,
  runBrowserSetupWithCleanup,
  withinDeadline,
} from './browser-test-lifecycle.mjs';
import { createPlaywrightRouteController, launchPlaywrightEdge } from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, `.browser-test-runtime-owner-routing-${process.pid}-${Date.now()}-${randomUUID()}`);
const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const ROUTING_NAVIGATION_TIMEOUT_MS = 30_000;
const browserCandidates = [process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
const resources = {}; const browserProblems = []; const diagnostic = createLifecycleDiagnostics();
let cleanupBrowserTest; let setupAbortController; let baseUrl; let page;

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const { port } = socket.address(); socket.close(() => resolvePort(port)); });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a routing browser-test port', () => socket.close());
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  throw new Error('No Chromium browser found. Set BROWSER_PATH to Edge, Chrome, or Chromium.');
}

async function waitForVite(url, signal) {
  const started = Date.now();
  while (Date.now() - started < 8_000) {
    signal.throwIfAborted();
    try { if ((await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(1_000)]) })).ok) return; } catch { /* retry */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error('Routing Vite server did not become ready');
}

async function setRoutingState(patch) {
  await page.evaluate(async (next) => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    window.__routingAuthorityPatch = next;
    if (!window.__routingAuthorityUnsubscribe) {
      let enforcing = false;
      window.__routingAuthorityUnsubscribe = useWalletStore.subscribe((state) => {
        const authoritative = window.__routingAuthorityPatch;
        if (enforcing || !authoritative
          || Object.entries(authoritative).every(([key, value]) => Object.is(state[key], value))) return;
        enforcing = true;
        useWalletStore.setState(authoritative);
        enforcing = false;
      });
    }
    useWalletStore.setState(next);
  }, patch);
}

async function setUrl(search) {
  await page.evaluate((nextSearch) => {
    history.pushState({}, '', `/${nextSearch}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, search);
}

async function waitForInitialWalletSettlement() {
  await page.evaluate(async () => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    if (useWalletStore.getState().authorityLifecycleStatus === 'complete') return;
    await new Promise((resolveSettlement) => {
      const unsubscribe = useWalletStore.subscribe((state) => {
        if (state.authorityLifecycleStatus !== 'complete') return;
        unsubscribe(); resolveSettlement();
      });
    });
  });
}

async function detachWalletLifecycle() {
  await page.evaluate(async () => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    useWalletStore.getState().disposeWallet();
  });
}

async function waitForOwnerShell(label) {
  try {
    await page.locator('.system-workflow').waitFor({ state: 'attached', timeout: 15_000 });
  } catch (error) {
    const state = await page.evaluate(async () => {
      const { useWalletStore } = await import('/src/store/useWalletStore.js');
      const wallet = useWalletStore.getState();
      return {
        href: location.href,
        authorityLifecycleStatus: wallet.authorityLifecycleStatus,
        hostProfileAddress: wallet.hostProfileAddress,
        isHostProfileOwner: wallet.isHostProfileOwner,
        isWalletConnected: wallet.isWalletConnected,
        body: document.body.textContent?.slice(0, 800)
      };
    });
    throw new Error(`${label}: ${JSON.stringify(state)}`, { cause: error });
  }
}

describe('owner/viewed-profile routing through the real App', { concurrency: false }, () => {
  before(async () => runBrowserSetupWithCleanup(async () => {
    setupAbortController = new AbortController(); const browserPath = await findBrowser(); const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Routing Vite listen deadline exceeded');
    await waitForVite(baseUrl, setupAbortController.signal);
    const routeController = createPlaywrightRouteController({ loopbackOrigin: baseUrl, knownOrigins: [],
      decideKnown: async () => ({ action: 'abort' }), onUnexpected: () => {} });
    await launchPlaywrightEdge({ edgePath: browserPath, runtimePath: runtimeDir, workspaceRoot: root,
      loopbackOrigin: baseUrl, routeController, resources, diagnostic,
      onBrowserProblem: (problem) => browserProblems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      } });
    page = resources.page; page.setDefaultTimeout(10_000); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.__routingStorageOperations = [];
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function routingStorageProbe(key, ...rest) {
          if (/^(?:inscape\.library-|inscape\.lattice-production-draft)/u.test(String(key))) {
            window.__routingStorageOperations.push({ method, key: String(key) });
          }
          return original.call(this, key, ...rest);
        };
      }
    });
  }, async () => {
    cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    await cleanupBrowserTest(resources);
  }, { timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs, diagnostic,
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); } }));

  after(async () => {
    const failures = [];
    try { cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      await cleanupBrowserTest(resources); } catch (error) { failures.push(error); }
    const actionable = browserProblems.filter((problem) => /Page error/iu.test(problem));
    if (actionable.length) failures.push(new Error(actionable.join('\n')));
    if (failures.length) throw new AggregateError(failures, 'Routing browser cleanup failed');
  });

  test('pending implicit authority is neutral and makes no publication, owner graph, or owner storage request', async () => {
    assert.ok((await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForInitialWalletSettlement();
    await detachWalletLifecycle();
    await page.evaluate(async () => {
      const { publishedProfileResolutionStore } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      publishedProfileResolutionStore.clear(); window.__publishedRequests = [];
      publishedProfileResolutionStore.repository = { resolve: async (address) => {
        window.__publishedRequests.push(address);
        return { status: 'UNAVAILABLE', address, document: null, errorCode: 'PROFILE_DOCUMENT_NOT_FOUND' };
      } };
      window.__routingStorageOperations.length = 0;
    });
    await setRoutingState({ authorityLifecycleStatus: 'pending', hostProfileAddress: PROFILE_A,
      isWalletConnected: true, isHostProfileOwner: false });
    await page.locator('.mode-loading', { hasText: 'Resolving profile...' }).waitFor({ state: 'attached' });
    await page.waitForTimeout(100);
    const pending = await page.evaluate(() => ({ requests: [...window.__publishedRequests],
      storage: [...window.__routingStorageOperations], text: document.body.textContent,
      ownerResources: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((name) => /OwnerSystemWorkflowShell|useOwnerSystemWorkflow/iu.test(name)) }));
    assert.deepEqual(pending.requests, []);
    assert.deepEqual(pending.storage, []);
    assert.equal(pending.ownerResources.length, 0);
    assert.doesNotMatch(pending.text, /PROFILE UNAVAILABLE|GALLERY/iu);
    assert.equal(await page.locator('.system-workflow').count(), 0);
  });

  test('root A to B, explicit visitor, RETURN, and Back/Forward preserve URL intent', async () => {
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_A,
      isWalletConnected: true, isHostProfileOwner: true });
    await waitForOwnerShell('Owner A did not become active');
    const enter = page.locator('.startveil__entry');
    await enter.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => !document.querySelector('.startveil__entry')?.disabled, undefined, { timeout: 20_000 });
    await enter.evaluate((button) => button.click());
    await page.waitForFunction(() => document.querySelector('.application-interface')?.dataset.visible === 'true', undefined, { timeout: 15_000 });

    await setRoutingState({ authorityLifecycleStatus: 'pending', hostProfileAddress: PROFILE_A,
      isWalletConnected: false, isHostProfileOwner: false });
    await page.getByText('Resolving profile...').waitFor({ state: 'attached' });
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE UNAVAILABLE|GALLERY/iu);
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await waitForOwnerShell('Owner B did not replace owner A');

    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await page.getByText('PROFILE UNAVAILABLE').waitFor();
    assert.match(await page.url(), new RegExp(`view=${PROFILE_B}`),
      'disconnect must retain owner B as an explicit public visitor route');
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE CONTEXT REQUIRED/iu);
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await waitForOwnerShell('Reconnecting B did not restore owner B');

    await setUrl(`?view=${PROFILE_A}`);
    await page.getByText('PROFILE UNAVAILABLE').waitFor();
    assert.match(await page.url(), new RegExp(`view=${PROFILE_A}`));
    assert.equal(await page.getByRole('button', { name: 'RETURN' }).count(), 1);
    await page.getByRole('button', { name: 'RETURN' }).evaluate((button) => button.click());
    await waitForOwnerShell('RETURN did not restore implicit owner B');
    assert.doesNotMatch(await page.url(), /[?&]view=/u);

    await page.goBack(); await page.getByText('PROFILE UNAVAILABLE').waitFor();
    assert.equal(await page.getByRole('button', { name: 'RETURN' }).count(), 1);
    await page.goForward(); await waitForOwnerShell('Forward did not restore implicit owner B');
    assert.doesNotMatch(await page.url(), /[?&]view=/u);
  });

  test('signed-out root, profile fallback, and unpublished explicit visitor have exact return semantics', async () => {
    assert.ok((await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForInitialWalletSettlement();
    await detachWalletLifecycle();
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await setUrl(''); await page.locator('.system-workflow--public-discover .lattice-browser-sidebar').waitFor();
    assert.match(await page.locator('.system-workflow--public-discover').innerText(), /PUBLISHED WORLDS/iu);
    assert.equal(await page.locator('.system-workflow__workspace-owner-entry').count(), 1);
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE CONTEXT REQUIRED/iu);
    assert.equal(await page.getByRole('button', { name: 'RETURN' }).count(), 0);

    assert.ok((await page.goto(`${baseUrl}/?profile=${PROFILE_A}`, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForInitialWalletSettlement();
    await detachWalletLifecycle();
    await page.evaluate(async () => {
      const { publishedProfileResolutionStore } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      publishedProfileResolutionStore.clear();
      publishedProfileResolutionStore.repository = { resolve: async (address) => ({ status: 'UNAVAILABLE', address,
        document: null, errorCode: 'PROFILE_DOCUMENT_NOT_FOUND' }) };
    });
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await setUrl(`?profile=${PROFILE_A}&view=${PROFILE_B}`);
    await page.locator('h1', { hasText: 'PROFILE UNAVAILABLE' }).waitFor({ state: 'attached' });
    await setUrl(`?profile=${PROFILE_A}`);
    await page.locator('h1', { hasText: 'PROFILE UNAVAILABLE' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('button', { hasText: 'RETURN' }).count(), 0);
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await waitForOwnerShell('Connected B did not supersede profile fallback A');

    await setUrl(`?profile=${PROFILE_A}&view=${PROFILE_A}`);
    await page.locator('h1', { hasText: 'PROFILE UNAVAILABLE' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('button', { hasText: 'RETURN' }).count(), 1);
  });
});
