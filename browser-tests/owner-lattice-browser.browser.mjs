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
  withinDeadline,
} from './browser-test-lifecycle.mjs';
import {
  createPlaywrightRouteController,
  launchPlaywrightEdge,
} from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, '.browser-test-runtime');
const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const resources = {};
const browserProblems = [];
const diagnostic = createLifecycleDiagnostics();
let cleanupBrowserTest;
let setupAbortController;
let baseUrl;
let page;

const workspaceKey = (profile) => `inscape.library-workspace.v8:${profile}`;
const cacheKey = (profile) => `inscape.library-assets.v1:${profile}`;
const canonicalKey = (profile) => `inscape.lattice-production-draft.v1:${profile}`;

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolvePort(port));
    });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a Phase 5A browser-test port', () => socket.close());
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
  throw new Error('Phase 5A Vite server did not become ready');
}

async function setAuthority(profile) {
  await page.evaluate(async (address) => {
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    if (useWalletStore.getState().authorityLifecycleStatus !== 'complete') {
      await new Promise((resolveSettlement) => {
        const unsubscribe = useWalletStore.subscribe((state) => {
          if (state.authorityLifecycleStatus !== 'complete') return;
          unsubscribe(); resolveSettlement();
        });
      });
    }
    await new Promise((resolveStable, rejectStable) => {
      let quietTimer;
      const deadline = setTimeout(() => { unsubscribe(); rejectStable(new Error('Phase 5A wallet lifecycle did not become quiet')); }, 10_000);
      const settleAfterQuietWindow = () => {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          if (useWalletStore.getState().authorityLifecycleStatus !== 'complete') return settleAfterQuietWindow();
          clearTimeout(deadline); unsubscribe(); resolveStable();
        }, 1_500);
      };
      const unsubscribe = useWalletStore.subscribe(settleAfterQuietWindow);
      settleAfterQuietWindow();
    });
    const authoritativeState = { hostProfileAddress: address, isHostProfileOwner: true,
      isWalletConnected: true, authorityLifecycleStatus: 'complete',
      disposeWallet: () => ({ disposed: true, listenersRemoved: true, limitation: null }),
      _failClosedProviderContext: () => {}, _applyAuthoritativeProviderContext: async () => {} };
    window.__phase5aAuthorityUnsubscribe?.();
    let enforcing = false;
    window.__phase5aAuthorityUnsubscribe = useWalletStore.subscribe((state) => {
      if (enforcing || state.hostProfileAddress?.toLowerCase() === address.toLowerCase()
        && state.isHostProfileOwner && state.authorityLifecycleStatus === 'complete') return;
      enforcing = true; useWalletStore.setState(authoritativeState); enforcing = false;
    });
    useWalletStore.setState(authoritativeState);
  }, profile);
}

async function visitOwnedProfile(profile) {
  await setAuthority(profile);
  await page.evaluate((address) => {
    history.pushState({ viewedProfileAddress: address }, '', `?view=${address}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, profile);
  await page.locator('.owner-lattice-shell').waitFor({ state: 'attached', timeout: 15_000 });
}

function relevantOperations(operations) {
  return operations.filter(({ key }) => /^(?:inscape\.library-(?:workspace\.v8|assets\.v1)|inscape\.lattice-production-draft\.v1):/u.test(key));
}

describe('Phase 5A read-only Browser through the real App route', { concurrency: false }, () => {
  before(async () => runBrowserSetupWithCleanup(async () => {
    setupAbortController = new AbortController();
    const browserPath = await findBrowser();
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Phase 5A Vite listen deadline exceeded');
    await waitForVite(baseUrl, setupAbortController.signal);
    const routeController = createPlaywrightRouteController({
      loopbackOrigin: baseUrl,
      knownOrigins: [],
      decideKnown: async () => ({ action: 'abort' }),
      onUnexpected: () => {},
    });
    await launchPlaywrightEdge({
      edgePath: browserPath,
      runtimePath: runtimeDir,
      workspaceRoot: root,
      loopbackOrigin: baseUrl,
      routeController,
      resources,
      diagnostic,
      onBrowserProblem: (problem) => browserProblems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      },
    });
    page = resources.page;
    page.setDefaultTimeout(8_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ profileA, profileB, contractA, contractB }) => {
      const seed = (profile, contract, name) => {
        const assetId = `42:${contract}:contract`;
        const workspace = {
          version: 8,
          profileAddress: profile,
          favorites: [assetId],
          folders: [{ id: `category-${name}`, name: `${name} CATEGORY`, assetIds: [assetId], public: true, createdAt: 1, updatedAt: 2 }],
          canvas: { launchers: [], objects: [{ id: `legacy-${name}`, kind: 'framed-artwork', stableAssetId: assetId }] },
          tables: { placements: [{ id: `legacy-table-${name}`, stableAssetId: assetId }] },
        };
        const asset = {
          id: assetId, chainId: 42, ownerAddress: profile, contractAddress: contract, tokenId: null,
          name: `${name} REAL ASSET`, collectionName: `${name} COLLECTION`,
          imageUrl: `https://assets.example/${name}.webp`, thumbnailUrl: `https://assets.example/${name}-thumb.webp`,
          originalImageUrl: `https://assets.example/${name}-original.webp`, imageWidth: 1200, imageHeight: 800,
          creators: [], attributes: [], metadataStatus: 'ready', rawMetadata: {},
        };
        localStorage.setItem(`inscape.library-workspace.v8:${profile}`, JSON.stringify(workspace));
        localStorage.setItem(`inscape.library-assets.v1:${profile}`, JSON.stringify({
          version: 1, profileAddress: profile, updatedAt: Date.now(), assets: [asset],
        }));
      };
      seed(profileA, contractA, 'ALPHA');
      seed(profileB, contractB, 'BETA');
      window.__phase5aStorageOperations = [];
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function phase5aStorageProbe(key, ...rest) {
          window.__phase5aStorageOperations.push({ method, key: String(key) });
          return original.call(this, key, ...rest);
        };
      }
    }, { profileA: PROFILE_A, profileB: PROFILE_B, contractA: CONTRACT_A, contractB: CONTRACT_B });
  }, async () => {
    cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    await cleanupBrowserTest(resources);
  }, {
    timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs,
    diagnostic,
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); },
  }));

  after(async () => {
    const failures = [];
    try {
      cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      await cleanupBrowserTest(resources);
    } catch (error) { failures.push(error); }
    const actionable = browserProblems.filter((problem) => /Page error/iu.test(problem));
    if (actionable.length) failures.push(new Error(actionable.join('\n')));
    if (failures.length) throw new AggregateError(failures, 'Phase 5A browser cleanup failed');
  });

  test('real INDEX, Favorites, and Categories remain read-only and profile isolated', async () => {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.ok(response?.ok());
    await visitOwnedProfile(PROFILE_A);
    const enter = page.locator('.startveil__entry');
    await enter.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => !document.querySelector('.startveil__entry')?.disabled, undefined, { timeout: 20_000 });
    await enter.evaluate((button) => button.click());
    await page.evaluate(() => new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000)));
    await page.waitForTimeout(250);

    const before = await page.evaluate((key) => localStorage.getItem(key), workspaceKey(PROFILE_A));
    const browserTool = page.getByRole('button', { name: 'BROWSER' });
    await browserTool.waitFor({ state: 'visible', timeout: 8_000 });
    await browserTool.evaluate((node) => node.click());
    const browser = page.locator('.lattice-browser-workspace');
    await browser.waitFor({ state: 'visible', timeout: 15_000 });
    const interaction = await page.evaluate(async () => {
      const nextTask = () => new Promise((resolveTask) => setTimeout(resolveTask, 0));
      const root = document.querySelector('.lattice-browser-workspace');
      const byText = (selector, value) => [...root.querySelectorAll(selector)]
        .find((node) => node.textContent.trim() === value);
      byText('.lattice-browser-asset strong', 'ALPHA REAL ASSET').closest('button').click();
      const place = root.querySelector('footer button');
      byText('.lattice-browser-sidebar button span', 'FAVORITES').closest('button').click();
      await nextTask();
      const favoritesCount = root.querySelectorAll('.lattice-browser-asset').length;
      const search = root.querySelector('input[type="search"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'ALPHA');
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTask();
      const searchedCount = root.querySelectorAll('.lattice-browser-asset').length;
      root.querySelector('#lattice-browser-tab-categories').click();
      await nextTask();
      const categoryVisible = root.textContent.includes('ALPHA CATEGORY');
      const readOnlyVisible = root.textContent.includes('ORGANIZATION COMMANDS UNAVAILABLE');
      const forbiddenLabels = [...root.querySelectorAll('button')].some((button) => /^(CREATE|RENAME|DELETE|PUBLISH|UNPUBLISH)/u.test(button.textContent.trim()));
      root.querySelector('#lattice-browser-tab-index').click();
      await nextTask();
      const widthBefore = root.getBoundingClientRect().width;
      const resize = root.querySelector('.lattice-browser-resize');
      resize.focus();
      resize.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));
      await nextTask();
      const widthAfter = root.getBoundingClientRect().width;
      resize.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      await nextTask();
      root.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }));
      return {
        categoryVisible, favoritesCount, forbiddenLabels,
        placeDisabled: place.disabled, placeLabel: place.textContent,
        readOnlyVisible, searchedCount, widthAfter, widthBefore,
      };
    });
    assert.equal(interaction.placeDisabled, false);
    assert.match(interaction.placeLabel, /PLACE PUBLIC/u);
    assert.equal(interaction.favoritesCount, 1);
    assert.equal(interaction.searchedCount, 1);
    assert.equal(interaction.categoryVisible, true);
    assert.equal(interaction.readOnlyVisible, true);
    assert.equal(interaction.forbiddenLabels, false);
    assert.ok(interaction.widthAfter < interaction.widthBefore);
    await browser.waitFor({ state: 'detached', timeout: 5_000 });
    assert.equal(await page.getByRole('button', { name: 'BROWSER' }).evaluate((node) => document.activeElement === node), true);

    const after = await page.evaluate((key) => localStorage.getItem(key), workspaceKey(PROFILE_A));
    assert.equal(after, before, 'ordinary Browser interaction changed Library organization bytes');
    const firstAllOperations = await page.evaluate(() => window.__phase5aStorageOperations);
    const firstOperations = relevantOperations(firstAllOperations);
    assert.equal(firstOperations.some(({ method, key }) => method !== 'getItem' && key === workspaceKey(PROFILE_A)), false);
    assert.equal(firstOperations.some(({ method, key }) => method !== 'getItem' && key === canonicalKey(PROFILE_A)), false);

    await page.evaluate(() => { window.__phase5aStorageOperations = []; });
    await visitOwnedProfile(PROFILE_B);
    await page.getByRole('button', { name: 'BROWSER' }).evaluate((node) => node.click());
    await page.locator('.lattice-browser-workspace').waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByRole('button', { name: /BETA REAL ASSET/u }).waitFor({ state: 'visible', timeout: 5_000 });
    await page.waitForTimeout(200);
    const switchedAllOperations = await page.evaluate(() => window.__phase5aStorageOperations);
    const switchedOperations = relevantOperations(switchedAllOperations);
    assert.equal(switchedOperations.some(({ key }) => key.endsWith(PROFILE_A)), false,
      `old-profile storage accessed after generation change: ${JSON.stringify(switchedOperations)}`);
    assert.equal(switchedOperations.some(({ method, key }) => method !== 'getItem' && key === canonicalKey(PROFILE_B)), false);
    assert.equal(switchedOperations.every(({ key }) => key === workspaceKey(PROFILE_B)
      || key === cacheKey(PROFILE_B) || key === canonicalKey(PROFILE_B)), true);

    const classified = [...firstAllOperations, ...switchedAllOperations].map((operation) => ({
      ...operation,
      classification: operation.key.startsWith('inscape.library-assets.v1:')
        ? 'expected existing asset-cache lifecycle'
        : operation.method === 'getItem' && operation.key.startsWith('inscape.lattice-production-draft.v1:')
          ? 'expected Phase 5B.1 canonical draft read'
        : operation.method === 'getItem' && operation.key.startsWith('inscape.library-workspace.v8:')
          ? 'expected existing workspace read'
          : operation.key.startsWith('inscape.library-workspace.')
            || operation.key.startsWith('inscape.lattice-production-draft.')
            ? 'forbidden Phase 5A organization or canonical-authoring access'
            : 'expected existing non-Phase 5A application lifecycle',
    }));
    assert.equal(classified.some(({ classification }) => classification.startsWith('forbidden')), false,
      `forbidden storage operation: ${JSON.stringify(classified)}`);
    process.stdout.write(`\nPhase 5A storage operations: ${JSON.stringify(classified)}\n`);
    await page.waitForTimeout(100);
  });
});
