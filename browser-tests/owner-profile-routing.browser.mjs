import { workspaceDestination, editorDestination, editorMenu } from './fixtures/editor-menu.mjs';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createBrowserTestServer } from '../scripts/runBrowserTests.mjs';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
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
const resources = {}; const browserProblems = []; const diagnostic = createLifecycleDiagnostics();
const pendingLocalRequests = new Map();
let cleanupBrowserTest; let setupAbortController; let baseUrl; let page;

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const { port } = socket.address(); socket.close(() => resolvePort(port)); });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a routing browser-test port', () => socket.close());
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
  if (Object.hasOwn(patch, 'isWalletConnected')) patch = { ...patch, accounts: patch.isWalletConnected ? [patch.hostProfileAddress] : [] };
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

async function savedOwnerDraft() {
  return page.evaluate(async address => {
    const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    return createSystemWorkflowDraftStore({ profileAddress: address, storage: localStorage }).getDraft();
  }, PROFILE_A);
}

async function waitForRoutingEntry() {
  // Standalone sign-in can keep wallet discovery dormant until the user connects.
  // Both entry states are ready for the isolated routing fixture.
  await page.waitForFunction(async () => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    return useWalletStore.getState().authorityLifecycleStatus === 'complete' ||
      [...document.querySelectorAll('button')].some(node => node.textContent.trim() === 'Connect profile' && node.getClientRects().length);
  }, undefined, { timeout: 15_000 });
}

async function detachWalletLifecycle() {
  await page.evaluate(async () => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    useWalletStore.getState().disposeWallet();
  });
}

async function waitForOwnerShell(label) {
  try {
    await page.locator('main.system-workflow:not(.visitor-grid-world)').waitFor({ state: 'attached', timeout: 15_000 });
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
        body: document.body.textContent?.slice(0, 800),
        root: document.querySelector('#root')?.innerHTML.slice(0, 4000)
      };
    });
    throw new Error(`${label}: ${JSON.stringify({ ...state,
      browserProblems: browserProblems.filter(problem => /Page error|Route handler|loopback/.test(problem)),
      pendingLocalRequests: [...pendingLocalRequests.values()] })}`, { cause: error });
  }
}

describe('owner/viewed-profile routing through the real App', { concurrency: false }, () => {
  before(async () => runBrowserSetupWithCleanup(async () => {
    setupAbortController = new AbortController();
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    baseUrl = process.env.INSCAPE_TEST_ROOT;
    if (!baseUrl) {
      const port = await availablePort(); baseUrl = `http://127.0.0.1:${port}`;
      resources.vite = await createBrowserTestServer(root, port);
      await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Routing Vite listen deadline exceeded');
    }
    await waitForVite(baseUrl, setupAbortController.signal);
    // Vite serves the owner graph as many separate source modules. This bound
    // accommodates its import burst; handler failures still fail the suite.
    const routeController = createPlaywrightRouteController({ loopbackOrigin: baseUrl, knownOrigins: [], maxOutstanding: 512,
      decideKnown: async () => ({ action: 'abort' }), onUnexpected: () => {} });
    await launchPlaywrightEdge({ edgePath: browserExecutable, runtimePath: runtimeDir, workspaceRoot: root,
      loopbackOrigin: baseUrl, routeController, resources, diagnostic,
      onBrowserProblem: (problem) => browserProblems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      } });
    page = resources.page; page.setDefaultTimeout(10_000); await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === baseUrl) pendingLocalRequests.set(request, url.pathname);
    });
    page.on('requestfinished', request => pendingLocalRequests.delete(request));
    page.on('requestfailed', request => pendingLocalRequests.delete(request));
    await page.addInitScript(() => {
      window.__routingStorageOperations = [];
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function routingStorageProbe(key, ...rest) {
          if (/^(?:inscape\.library-|inscape\.system-workflow-draft)/u.test(String(key))) {
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
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserSession?.close().catch(() => {}); } }));

  after(async () => {
    const failures = [];
    try { cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      await cleanupBrowserTest(resources); } catch (error) { failures.push(error); }
    const actionable = browserProblems.filter((problem) => /Page error|Route handler/iu.test(problem));
    if (actionable.length) failures.push(new Error(actionable.join('\n')));
    if (failures.length) throw new AggregateError(failures, `Routing browser cleanup failed: ${failures.map(error => error.message).join('; ')}`);
  });

  test('pending implicit authority is neutral and makes no publication, owner graph, or owner storage request', async () => {
    assert.ok((await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForRoutingEntry();
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
    await page.waitForFunction(async () => (await import('/src/store/useWalletStore.js')).useWalletStore.getState().authorityLifecycleStatus === 'pending');
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
    await page.locator('.visitor-profile-card').waitFor();
    await page.getByRole('button', { name: 'Studio', exact: true }).waitFor();
    await page.locator('.startveil').waitFor({ state: 'detached', timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('.application-interface')?.dataset.visible === 'true', undefined, { timeout: 15_000 });

    await setRoutingState({ authorityLifecycleStatus: 'pending', hostProfileAddress: PROFILE_A,
      isWalletConnected: false, isHostProfileOwner: false });
    await page.getByText('Resolving profile...').waitFor({ state: 'attached' });
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE UNAVAILABLE|GALLERY/iu);
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await page.locator('.visitor-profile-card').waitFor();
    await page.getByRole('button', { name: 'Studio', exact: true }).waitFor();

    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await page.getByRole('main', { name: 'Sign in to Inscape' }).waitFor();
    assert.equal(new URL(page.url()).searchParams.has('view'), false);
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE CONTEXT REQUIRED/iu);
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await page.locator('.visitor-profile-card').waitFor();
    await page.getByRole('button', { name: 'Studio', exact: true }).waitFor();

    await setUrl(`?view=${PROFILE_A}`);
    await page.locator('.visitor-profile-card').waitFor();
    assert.match(await page.url(), new RegExp(`view=${PROFILE_A}`));
    await workspaceDestination(page, 'Studio');
    await waitForOwnerShell('Studio did not open the connected owner B');
    assert.equal(new URL(page.url()).searchParams.get('view'), PROFILE_B);
    assert.equal(new URL(page.url()).searchParams.get('editor'), 'studio');

    await page.goBack(); await page.locator('.visitor-profile-card').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Studio', exact: true }).count(), 0);
    await page.goForward(); await waitForOwnerShell('Forward did not restore owner B');
    assert.equal(new URL(page.url()).searchParams.get('work'), null);
  });


  test('signed-out root and an explicit artist visit remain distinct', async () => {
    assert.ok((await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForRoutingEntry();
    await detachWalletLifecycle();
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await setUrl(''); await page.getByRole('main', { name: 'Sign in to Inscape' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Connect profile', exact: true }).count(), 1);
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE CONTEXT REQUIRED/iu);
    assert.equal(await page.getByRole('button', { name: 'Studio', exact: true }).count(), 0);

    assert.ok((await page.goto(`${baseUrl}/?profile=${PROFILE_A}`, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForRoutingEntry();
    await detachWalletLifecycle();
    await page.evaluate(async () => {
      const { publishedProfileResolutionStore } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      publishedProfileResolutionStore.clear();
      publishedProfileResolutionStore.repository = { resolve: async (address) => ({ status: 'UNAVAILABLE', address,
        document: null, errorCode: 'PROFILE_DOCUMENT_NOT_FOUND' }) };
    });
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await setUrl(`?view=${PROFILE_B}`);
    await page.locator('.visitor-profile-card').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Studio', exact: true }).count(), 0);
    await setUrl(`?profile=${PROFILE_A}`);
    await page.getByRole('main', { name: 'Sign in to Inscape' }).waitFor();
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await page.getByRole('button', { name: 'Studio', exact: true }).waitFor();
    assert.equal(await page.locator('.system-workflow').count(), 0);
    await setUrl(`?profile=${PROFILE_A}&view=${PROFILE_A}`);
    await page.locator('.visitor-profile-card').waitFor();
    await page.getByRole('button', { name: 'Inscape menu', exact: true }).click();
    assert.equal(await page.getByRole('menuitemcheckbox', { name: 'Studio', exact: true }).isEnabled(), true);
    await page.keyboard.press('Escape');
  });

  test('disconnect opens the sign-in entrance from home and preserves explicit public visitor destinations', async () => {
    await page.route('**/src/wallet/standaloneWalletSession.js', (route) => route.fulfill({
      contentType: 'application/javascript', body: `
        import { useWalletStore } from '/src/store/useWalletStore.js';
        export function acquireStandaloneWalletSession(options) {
          useWalletStore.setState({authorityLifecycleStatus:'complete',hostProfileAddress:null,isWalletConnected:false,isHostProfileOwner:false});
          return { release() {}, session: {
            showSignIn() {
              if (window.__cancelSignIn) { options.onSignInClose(); window.__signInCancelled = true; return; }
              const connect = () => useWalletStore.setState({authorityLifecycleStatus:'complete',hostProfileAddress:'${PROFILE_A}',accounts:['${PROFILE_A}'],isWalletConnected:true,isHostProfileOwner:true});
              if (window.__delaySignIn) window.__finishSignIn = connect; else connect();
            },
            async disconnect() {
              window.__disconnectCalls = (window.__disconnectCalls || 0) + 1;
              if (window.__delayDisconnect) await new Promise((resolve) => { window.__finishDisconnect = resolve; });
              useWalletStore.setState({authorityLifecycleStatus:'complete',hostProfileAddress:null,isWalletConnected:false,isHostProfileOwner:false});
            }
          }};
        }` }));
    const useEmptyPublication = () => page.evaluate(async () => {
      const { publishedProfileResolutionStore: store } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      store.clear();
      store.repository = { resolve: async (address) => ({ status: 'UNAVAILABLE', address, document: null }) };
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await useEmptyPublication();
      const entrance = page.getByRole('main', { name: 'Sign in to Inscape' });
      const connect = entrance.getByRole('button', { name: 'Connect profile' });
      await page.evaluate(() => { window.__cancelSignIn = true; });
      await connect.click();
      await page.waitForFunction(() => window.__signInCancelled);
      await connect.waitFor();
      assert.equal(new URL(page.url()).search, '');
      assert.equal(await page.locator('.system-workflow').count(), 0);
      await page.evaluate(() => { window.__cancelSignIn = false; });
      await connect.click();
      const studio = page.getByRole('button', { name: 'Studio', exact: true });
      await studio.click();
      await waitForOwnerShell('Studio from owner profile');
      await page.goBack();
      await studio.waitFor();
      await page.goForward();
      await waitForOwnerShell('Studio after browser Forward');
      await page.goBack();
      await studio.waitFor();
      const account = page.getByRole('button', { name: / account$/ });
      const disconnect = page.getByRole('button', { name: 'Disconnect', exact: true });
      await account.click();
      const bounds = await disconnect.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: `.browser-test-runtime/profile-account-${width}.png` });
      await disconnect.click();
      await entrance.waitFor();
      assert.equal(new URL(page.url()).search, '');
      assert.equal(await page.locator('.system-workflow').count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await useEmptyPublication();
      await entrance.getByRole('button', { name: 'Connect profile' }).click();
      await page.getByRole('button', { name: 'Studio', exact: true }).waitFor();
      await setUrl(`?view=${PROFILE_B}`);
      await account.click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      assert.match(page.url(), new RegExp(`view=${PROFILE_B}`));
      assert.equal(await page.locator('.system-workflow').count(), 0);
      // An in-flight disconnect belongs to its originating route, not a later visit.
      await setUrl('');
      await connect.click();
      await page.getByRole('button', { name: 'Studio', exact: true }).waitFor();
      await page.evaluate(() => { window.__delayDisconnect = true; window.__disconnectCalls = 0; });
      await page.getByRole('button', { name: / account$/ }).click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      await page.waitForFunction(() => typeof window.__finishDisconnect === 'function');
      if (!(await disconnect.isVisible())) await account.click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__disconnectCalls), 1);
      await setUrl(`?view=${PROFILE_B}`);
      await page.evaluate(() => { window.__finishDisconnect(); window.__delayDisconnect = false; });
      await page.locator('.visitor-profile-card').waitFor();
      assert.match(page.url(), new RegExp(`view=${PROFILE_B}`));
      await setUrl('');
      await page.evaluate(() => { window.__delaySignIn = true; });
      await connect.click();
      await page.waitForFunction(() => typeof window.__finishSignIn === 'function');
      await setUrl(`?view=${PROFILE_B}`);
      await page.evaluate(() => window.__finishSignIn());
      await page.locator('.visitor-profile-card').waitFor();
      assert.match(page.url(), new RegExp(`view=${PROFILE_B}`));
      assert.equal(await page.locator('.system-workflow').count(), 0);
    }
    await page.unroute('**/src/wallet/standaloneWalletSession.js');
  });
});
