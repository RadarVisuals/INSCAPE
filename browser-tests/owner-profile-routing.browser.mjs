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
const pendingLocalRequests = new Map();
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
    setupAbortController = new AbortController(); const browserPath = await findBrowser(); const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Routing Vite listen deadline exceeded');
    await waitForVite(baseUrl, setupAbortController.signal);
    // Vite serves the owner graph as many separate source modules. This bound
    // accommodates its import burst; handler failures still fail the suite.
    const routeController = createPlaywrightRouteController({ loopbackOrigin: baseUrl, knownOrigins: [], maxOutstanding: 512,
      decideKnown: async () => ({ action: 'abort' }), onUnexpected: () => {} });
    await launchPlaywrightEdge({ edgePath: browserPath, runtimePath: runtimeDir, workspaceRoot: root,
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
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); } }));

  after(async () => {
    const failures = [];
    try { cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      await cleanupBrowserTest(resources); } catch (error) { failures.push(error); }
    const actionable = browserProblems.filter((problem) => /Page error|Route handler/iu.test(problem));
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
    await waitForOwnerShell('Owner A did not become active');
    await page.locator('.startveil').waitFor({ state: 'detached', timeout: 20_000 });
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

  test('owner Reception shows saved local content and returns without disconnecting or changing compositions', async () => {
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_A,
      isWalletConnected: true, isHostProfileOwner: true });
    await setUrl('');
    await waitForOwnerShell('Owner before reception');
    const back = () => page.getByRole('button', { name: 'Back to my Workbench', exact: true });
    const openReception = async () => {
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      const entry = page.getByRole('button', { name: 'View my reception', exact: true });
      await entry.focus();
      await page.keyboard.press('Enter');
      await back().waitFor();
      assert.match(page.url(), new RegExp(`view=${PROFILE_A}`));
      assert.match(page.url(), /[?&]reception=1/);
      assert.equal(await page.locator('main.system-workflow:not(.visitor-grid-world)').count(), 0);
    };
    await openReception();
    await page.locator('.reception-canvas').waitFor();
    assert.equal(await page.locator('.published-profile-status').count(), 0);
    await page.evaluate(async (address) => {
      const { publishedProfileResolutionStore: store } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      store.repository = { resolve: () => new Promise((_, reject) => { window.__failReceptionRead = reject; }) };
      void store.resolve(address);
    }, PROFILE_A);
    await page.locator('.reception-canvas').waitFor();
    assert.equal(await page.locator('.published-profile-status').count(), 0);
    assert.equal(await back().isEnabled(), true);
    await page.evaluate(() => window.__failReceptionRead(new Error('Fixture network failure')));
    await page.locator('.reception-canvas').waitFor();
    assert.equal(await page.locator('.published-profile-status').count(), 0);
    assert.equal(await back().isEnabled(), true);
    await back().click();
    await waitForOwnerShell('Unpublished reception returns to owner');
    assert.doesNotMatch(page.url(), /[?&](view|reception)=/);

    // A local repository fixture supplies only public data; the real App,
    // navigation hook, owner menu and public boundary remain in use.
    await page.evaluate(async (address) => {
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
      const { publishedProfileResolutionStore: store } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      const draft = createEmptySystemWorkflowDraft(address);
      draft.grids[0].title = 'Published reception';
      const document = buildProfileDocumentV9({ profileAddress: address, profileIdentity: { name: 'Reception owner' }, assetRecords: [], systemWorkflowDraft: draft });
      store.repository = { resolve: async (target) => target === address
        ? { status: 'RESOLVED', address: target, document }
        : { status: 'UNAVAILABLE', address: target, document: null } };
      await store.resolve(address);
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createReception } = await import('/src/profileDocument/domain/receptionPresentation.js');
      const { createArticle } = await import('/src/text/domain/article.js');
      const local = createSystemWorkflowDraftStore({ profileAddress: address, storage: localStorage, requireEditor: true });
      const scope = local.acquireReceptionScope();
      try {
        const reception = createReception(), article = createArticle();
        article.title = 'Saved local Reception';
        reception.texts = [{ id: 'text:reception-local', article, visibility: 'PUBLIC' }];
        reception.regions[0].content = reception.texts[0].id;
        if (!scope.commitCompletedOperation({ ...scope.getDraft(), reception }, { expectedGeneration: scope.getGeneration() })) throw Error('Could not seed local Reception');
      } finally { scope.release(); }
    }, PROFILE_A);
    await waitForOwnerShell('Owner after publication fixture');
    for (const width of [1440, 640, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await page.getByRole('button', { name: 'View my reception', exact: true }).focus();
      if (process.env.INSCAPE_RECEPTION_CAPTURE_DIR) await page.screenshot({ path: resolve(process.env.INSCAPE_RECEPTION_CAPTURE_DIR, `owner-menu-${width}.png`) });
      const savedDraft = await page.evaluate(address => localStorage.getItem('inscape.system-workflow-draft.v1:' + address), PROFILE_A);
      assert.ok(savedDraft, 'Fixture owner has a saved draft to preserve');
      await page.keyboard.press('Enter');
      await page.locator('.reception-page').waitFor();
      await page.getByRole('heading', { name: 'Saved local Reception', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
      await page.locator('[data-reception-editor]').waitFor();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.locator('[data-reception-editor]').waitFor({ state: 'detached' });
      await page.getByRole('heading', { name: 'Saved local Reception', exact: true }).waitFor();
      assert.equal(await page.locator('.reception-cell-actions, .reception-divider, .reception-tool-panel').count(), 0);
      await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
      await page.locator('[data-reception-editor]').waitFor();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('heading', { name: 'Saved local Reception', exact: true }).waitFor();
      const navigationBounds = await back().boundingBox();
      assert.equal(await back().evaluate(node => !!node.closest('.reception-navigation')), true,
        'The owner return belongs to the navigation footprint inside the Reception silhouette');
      assert.ok(await back().evaluate(node => { const b = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); }), 'Owner return is exposed and clickable');
      assert.equal(await back().count(), 1);
      await back().focus();
      if (process.env.INSCAPE_RECEPTION_CAPTURE_DIR) await page.screenshot({ path: resolve(process.env.INSCAPE_RECEPTION_CAPTURE_DIR, `reception-${width}.png`) });
      const box = await back().boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 900);
      await page.evaluate(() => { window.__routingStorageOperations.length = 0; });
      await page.getByRole('button', { name: 'Enter Inscape', exact: true }).click();
      await page.locator('.workbench-overview').waitFor();
      assert.match(page.url(), /[?&]canvas=1/);
      assert.doesNotMatch(page.url(), /[?&]reception=1/);
      assert.equal(await page.locator('main.system-workflow:not(.visitor-grid-world)').count(), 0);
      assert.ok(await page.getByRole('button', { name: /^Edit / }).count() > 0, 'The owner opens their local collection from Reception');
      assert.equal(await page.evaluate(address => localStorage.getItem('inscape.system-workflow-draft.v1:' + address), PROFILE_A), savedDraft,
        'Opening the owner collection does not change its saved compositions');
      await page.goBack(); await page.locator('.reception-page').waitFor();
      await page.goForward(); await page.locator('.workbench-overview').waitFor();
      assert.doesNotMatch(page.url(), /[?&]reception=1/);
      await page.getByRole('button', { name: 'Inscape menu', exact: true }).click();
      await page.getByRole('button', { name: 'About', exact: true }).click();
      await page.locator('.reception-page').waitFor();
      await page.getByRole('heading', { name: 'Saved local Reception', exact: true }).waitFor();
      await page.getByRole('button', { name: /^Explore/ }).click();
      await page.getByRole('region', { name: 'Exploration room', exact: true }).waitFor();
      await page.locator('.keeper-dock').waitFor();
      const roomDraft = await page.evaluate(address => localStorage.getItem('inscape.system-workflow-draft.v1:' + address), PROFILE_A);
      const beforeRoom = JSON.parse(savedDraft), afterRoom = JSON.parse(roomDraft);
      assert.equal(afterRoom.keeperDocks.length, Math.max(1, beforeRoom.keeperDocks?.length || 0));
      assert.deepEqual(afterRoom.imageModules, beforeRoom.imageModules);
      assert.match(page.url(), /[?&]reception=1/);
      assert.equal(await page.locator('main.system-workflow:not(.visitor-grid-world)').count(), 0);
      assert.equal(await back().count(), 1);
      const publicState = await page.evaluate(async () => {
        const { useWalletStore } = await import('/src/store/useWalletStore.js');
        return { connected: useWalletStore.getState().isWalletConnected, storage: [...window.__routingStorageOperations] };
      });
      assert.equal(publicState.connected, true);
      assert.ok(publicState.storage.length > 0, 'Verified owner opens the existing local draft for Keeper editing');
      const overviewReturn = page.getByRole('button', { name: 'Back to Reception', exact: true });
      const ownerBox = await back().boundingBox(), overviewBox = await overviewReturn.boundingBox();
      assert.ok(ownerBox.x >= overviewBox.x + overviewBox.width || overviewBox.x >= ownerBox.x + ownerBox.width
        || ownerBox.y >= overviewBox.y + overviewBox.height || overviewBox.y >= ownerBox.y + ownerBox.height,
        'Owner return and profile overview controls do not overlap');
      await overviewReturn.click();
      await page.locator('.reception-page').waitFor();
      assert.match(page.url(), /[?&]reception=1/);
      await back().focus();
      await page.keyboard.press('Enter');
      await waitForOwnerShell('Published reception returns to owner');
      assert.doesNotMatch(page.url(), /[?&](view|reception|canvas)=/);
      assert.equal(await page.evaluate(address => localStorage.getItem('inscape.system-workflow-draft.v1:' + address), PROFILE_A), roomDraft);
      await page.goBack(); await page.locator('.reception-page').waitFor();
      assert.equal(await back().count(), 1);
      await page.goForward(); await waitForOwnerShell('Forward returns to editing');
    }
    await openReception();
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    assert.equal(await back().count(), 0, 'Account changes remove the old owner action');
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    assert.equal(await back().count(), 0, 'Signed-out visitors cannot enter owner editing');
    assert.equal(await page.getByRole('heading', { name: 'Saved local Reception', exact: true }).count(), 0,
      'Local Reception content disappears when owner authority is lost');
    assert.equal(await page.locator('main.system-workflow:not(.visitor-grid-world)').count(), 0);
    await page.evaluate(() => { window.__routingStorageOperations.length = 0; });
    await page.getByRole('button', { name: 'Enter Inscape', exact: true }).click();
    await page.locator('.workbench-overview').waitFor();
    assert.match(page.url(), /[?&]reception=1/);
    assert.equal(await page.getByRole('button', { name: /^Edit / }).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__routingStorageOperations), [], 'Visitors only open the published collection');
    assert.equal(await back().count(), 0);
    assert.equal(await page.locator('main.system-workflow:not(.visitor-grid-world)').count(), 0);
    await page.goBack(); await page.locator('.reception-page').waitFor();
  });


  test('signed-out root, profile fallback, and unpublished explicit visitor have exact return semantics', async () => {
    assert.ok((await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: ROUTING_NAVIGATION_TIMEOUT_MS }))?.ok());
    await waitForInitialWalletSettlement();
    await detachWalletLifecycle();
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null,
      isWalletConnected: false, isHostProfileOwner: false });
    await setUrl(''); await page.locator('.public-entry-portal').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Connect profile', exact: true }).count(), 1);
    assert.doesNotMatch(await page.locator('body').innerText(), /PROFILE CONTEXT REQUIRED/iu);
    assert.equal(await page.getByRole('button', { name: 'RETURN', exact: true }).count(), 0);

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
    await setUrl(`?profile=${PROFILE_B}`);
    await page.waitForFunction((address) => document.querySelector('.published-profile-status__body code')?.textContent === address, PROFILE_B);
    await setRoutingState({ authorityLifecycleStatus: 'complete', hostProfileAddress: PROFILE_B,
      isWalletConnected: true, isHostProfileOwner: true });
    await waitForOwnerShell('Connected B did not supersede profile fallback A');

    await setUrl(`?profile=${PROFILE_A}&view=${PROFILE_A}`);
    await page.locator('h1', { hasText: 'PROFILE UNAVAILABLE' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('button', { hasText: 'RETURN' }).count(), 1);
  });

  test('explicit disconnect opens Discover from the Workbench and preserves public visitor destinations', async () => {
    await page.route('**/src/wallet/standaloneWalletSession.js', (route) => route.fulfill({
      contentType: 'application/javascript', body: `
        import { useWalletStore } from '/src/store/useWalletStore.js';
        export function acquireStandaloneWalletSession(options) {
          useWalletStore.setState({authorityLifecycleStatus:'complete',hostProfileAddress:null,isWalletConnected:false,isHostProfileOwner:false});
          return { release() {}, session: {
            showSignIn() {
              if (window.__cancelSignIn) { options.onSignInClose(); return; }
              const connect = () => useWalletStore.setState({authorityLifecycleStatus:'complete',hostProfileAddress:'${PROFILE_A}',isWalletConnected:true,isHostProfileOwner:true});
              if (window.__delaySignIn) window.__finishSignIn = connect; else connect();
            },
            async disconnect() {
              window.__disconnectCalls = (window.__disconnectCalls || 0) + 1;
              if (window.__delayDisconnect) await new Promise((resolve) => { window.__finishDisconnect = resolve; });
              useWalletStore.setState({authorityLifecycleStatus:'complete',hostProfileAddress:null,isWalletConnected:false,isHostProfileOwner:false});
            }
          }};
        }` }));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseUrl}/?discover`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        const { publishedProfileResolutionStore: store } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
        store.clear();
        store.repository = { resolve: async (address) => ({ status: 'UNAVAILABLE', address, document: null }) };
      });
      await page.evaluate(() => { window.__cancelSignIn = true; });
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.getByRole('button', { name: 'Connect', exact: true }).waitFor();
      assert.match(page.url(), /[?&]discover/);
      assert.equal(await page.locator('.system-workflow').count(), 0);
      await page.evaluate(() => { window.__cancelSignIn = false; });
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await waitForOwnerShell('Connect from Discover opens owner');
      await page.evaluate(() => { window.__ownerBeforeDiscover = document.querySelector('.system-workflow'); });
      await page.getByRole('button', { name: 'Discover', exact: true }).click();
      assert.match(page.url(), /[?&]discover/);
      assert.equal(await page.locator('.public-entry-portal').count(), 1);
      await page.goBack();
      await page.getByRole('button', { name: 'Profile', exact: true }).waitFor();
      await page.goForward();
      await page.getByRole('searchbox', { name: 'Search published worlds' }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Profile', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__ownerBeforeDiscover === document.querySelector('.system-workflow')), true,
        'Discover and history navigation must preserve the mounted owner workspace');
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      const disconnect = page.getByRole('button', { name: 'Disconnect', exact: true });
      await disconnect.waitFor();
      const bounds = await disconnect.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: `.browser-test-runtime/profile-account-${width}.png` });
      await disconnect.click();
      await page.locator('.public-entry-portal[data-mode="explore"]').waitFor();
      assert.match(page.url(), /[?&]discover/);
      assert.equal(await page.locator('.published-profile-status').count(), 0);
      assert.equal(await page.locator('.system-workflow').count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.public-entry-portal[data-mode="explore"]').waitFor();
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await waitForOwnerShell('Reconnect returns to owner');
      await page.getByRole('button', { name: 'Discover', exact: true }).click();
      await page.locator('.public-entry-portal__account-trigger').click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      await page.locator('.public-entry-portal[data-mode="explore"]').waitFor();
      assert.equal(await page.locator('.system-workflow').count(), 0);
      if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: `.browser-test-runtime/disconnected-discover-${width}.png` });
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await waitForOwnerShell('Owner before explicit visit');
      await setUrl(`?view=${PROFILE_B}`);
      await page.getByRole('button', { name: 'DISCOVER', exact: true }).click();
      await page.locator('.public-entry-portal__account-trigger').click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      await page.getByRole('button', { name: 'Connect', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Return to workspace', exact: true }).click();
      assert.match(page.url(), new RegExp(`view=${PROFILE_B}`));
      assert.equal(await page.locator('.system-workflow').count(), 0);
      // An in-flight disconnect belongs to its originating route, not a later visit.
      await setUrl('?discover');
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await waitForOwnerShell('Owner before delayed disconnect');
      await page.evaluate(() => { window.__delayDisconnect = true; window.__disconnectCalls = 0; });
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      await page.waitForFunction(() => typeof window.__finishDisconnect === 'function');
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__disconnectCalls), 1);
      await setUrl(`?view=${PROFILE_B}`);
      await page.evaluate(() => { window.__finishDisconnect(); window.__delayDisconnect = false; });
      await page.locator('.published-profile-status').waitFor();
      assert.match(await page.locator('.published-profile-status').innerText(), new RegExp(PROFILE_B));
      assert.match(page.url(), new RegExp(`view=${PROFILE_B}`));
      await setUrl('?discover');
      await page.evaluate(() => { window.__delaySignIn = true; });
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.waitForFunction(() => typeof window.__finishSignIn === 'function');
      await setUrl(`?view=${PROFILE_B}`);
      await page.evaluate(() => window.__finishSignIn());
      await page.locator('.published-profile-status').waitFor();
      assert.match(page.url(), new RegExp(`view=${PROFILE_B}`));
      assert.equal(await page.locator('.system-workflow').count(), 0);
    }
    await page.unroute('**/src/wallet/standaloneWalletSession.js');
  });
});
