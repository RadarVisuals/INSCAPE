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
import { createPlaywrightRouteController, launchPlaywrightEdge } from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, '.browser-test-runtime');
const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const CONTRACT_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACT_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const browserCandidates = [process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
const resources = {};
const browserProblems = [];
const diagnostic = createLifecycleDiagnostics();
let cleanupBrowserTest;
let setupAbortController;
let baseUrl;
let page;

const canonicalKey = (profile) => `inscape.lattice-production-draft.v1:${profile}`;

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address(); socket.close(() => resolvePort(port));
    });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a Phase 5B.1 browser-test port', () => socket.close());
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
  throw new Error('Phase 5B.1 Vite server did not become ready');
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
      const deadline = setTimeout(() => { unsubscribe(); rejectStable(new Error('Phase 5B.1 wallet lifecycle did not become quiet')); }, 10_000);
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
    window.__phase5bAuthorityUnsubscribe?.();
    let enforcing = false;
    window.__phase5bAuthorityUnsubscribe = useWalletStore.subscribe((state) => {
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

async function passStartveil() {
  const enter = page.locator('.startveil__entry');
  await enter.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => !document.querySelector('.startveil__entry')?.disabled, undefined, { timeout: 20_000 });
  await enter.evaluate((button) => button.click());
  await page.evaluate(() => new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000)));
  await page.waitForTimeout(250);
}

async function openBrowser() {
  await page.getByRole('button', { name: 'BROWSER' }).evaluate((node) => node.click());
  await page.locator('.lattice-browser-workspace').waitFor({ state: 'visible', timeout: 10_000 });
}

describe('Phase 5B.1 canonical placement through the real App route', { concurrency: false }, () => {
  before(async () => runBrowserSetupWithCleanup(async () => {
    setupAbortController = new AbortController();
    const browserPath = await findBrowser();
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Phase 5B.1 Vite listen deadline exceeded');
    await waitForVite(baseUrl, setupAbortController.signal);
    const routeController = createPlaywrightRouteController({ loopbackOrigin: baseUrl, knownOrigins: [],
      decideKnown: async () => ({ action: 'abort' }), onUnexpected: () => {} });
    await launchPlaywrightEdge({ edgePath: browserPath, runtimePath: runtimeDir, workspaceRoot: root,
      loopbackOrigin: baseUrl, routeController, resources, diagnostic,
      onBrowserProblem: (problem) => browserProblems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      } });
    page = resources.page;
    page.setDefaultTimeout(60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ profileA, profileB, contractA, contractB }) => {
      const seed = (profile, contract, name) => {
        const assetId = `42:${contract}:contract`;
        localStorage.setItem(`inscape.library-workspace.v8:${profile}`, JSON.stringify({ version: 8,
          profileAddress: profile, favorites: [], folders: [], canvas: { launchers: [], objects: [] }, tables: { placements: [] } }));
        localStorage.setItem(`inscape.library-assets.v1:${profile}`, JSON.stringify({ version: 1, profileAddress: profile,
          updatedAt: Date.now(), assets: [{ id: assetId, chainId: 42, ownerAddress: profile,
            contractAddress: contract, tokenId: null, standard: 'UNKNOWN', name: `${name} PLACEABLE ASSET`,
            description: '', collectionName: null, imageUrl: `https://assets.example/${name}.png`,
            thumbnailUrl: `https://assets.example/${name}-thumb.png`, imageWidth: 1600, imageHeight: 900,
            creators: [], attributes: [], metadataStatus: 'ready', rawMetadata: {} }] }));
      };
      seed(profileA, contractA, 'ALPHA'); seed(profileB, contractB, 'BETA');
    }, { profileA: PROFILE_A, profileB: PROFILE_B, contractA: CONTRACT_A, contractB: CONTRACT_B });
  }, async () => {
    cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    await cleanupBrowserTest(resources);
  }, { timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs, diagnostic,
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); } }));

  after(async () => {
    const failures = [];
    try {
      cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      await cleanupBrowserTest(resources);
    } catch (error) { failures.push(error); }
    const actionable = browserProblems.filter((problem) => /Page error/iu.test(problem));
    if (actionable.length) failures.push(new Error(actionable.join('\n')));
    if (failures.length) throw new AggregateError(failures, 'Phase 5B.1 browser cleanup failed');
  });

  test('completed PLACE persists, remounts exactly, and stays profile isolated', async () => {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.ok(response?.ok());
    await visitOwnedProfile(PROFILE_A);
    await passStartveil();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), canonicalKey(PROFILE_A)), null,
      'absent owner mount created a canonical record');
    await openBrowser();
    await page.getByRole('button', { name: /ALPHA PLACEABLE ASSET/u }).evaluate((node) => node.click());
    const place = page.locator('.lattice-browser-footer button');
    await page.waitForFunction(() => document.querySelector('.lattice-browser-footer button')?.disabled === false);
    assert.match(await place.textContent(), /PLACE PUBLIC \/ TABLE 05/u);
    await place.evaluate((node) => node.click());
    const renderedPlacement = page.locator('[data-placement-id="placement-1"]');
    await renderedPlacement.waitFor({ state: 'attached', timeout: 8_000 });
    assert.match(await place.textContent(), /ADDITIONAL PLACEMENT REQUIRES NEXT AUTHORING SLICE/u);
    const persistedBytes = await page.evaluate((key) => localStorage.getItem(key), canonicalKey(PROFILE_A));
    const persisted = JSON.parse(persistedBytes);
    const renderedGeometry = await renderedPlacement.getAttribute('style');
    assert.deepEqual(persisted.tables[4].placements[0], {
      id: 'placement-1', stableAssetId: `42:${CONTRACT_A}:contract`,
      column: 10, row: 5, columnSpan: 12, rowSpan: 7, layer: 0, navigationOrder: 0,
      crop: null, frameId: 'NONE',
      mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
      backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
    });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 });
    await visitOwnedProfile(PROFILE_A);
    await passStartveil();
    const reloadedPlacement = page.locator('[data-placement-id="placement-1"]');
    await reloadedPlacement.waitFor({ state: 'attached', timeout: 15_000 });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), canonicalKey(PROFILE_A)), persistedBytes,
      'full document reload changed the accepted canonical bytes');
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), canonicalKey(PROFILE_A)), persisted);
    assert.equal(await reloadedPlacement.getAttribute('style'), renderedGeometry,
      'full document reload changed the rendered canonical geometry');
    await openBrowser();
    const reloadedPlace = page.locator('.lattice-browser-footer button');
    assert.equal(await reloadedPlace.isDisabled(), true);
    assert.match(await reloadedPlace.textContent(), /ADDITIONAL PLACEMENT REQUIRES NEXT AUTHORING SLICE/u);
    await page.getByRole('button', { name: 'Close Browser' }).evaluate((node) => node.click());

    await visitOwnedProfile(PROFILE_B);
    assert.equal(await page.locator('[data-placement-id]').count(), 0);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), canonicalKey(PROFILE_B)), null);
    await openBrowser();
    await page.getByRole('button', { name: /BETA PLACEABLE ASSET/u }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('.lattice-browser-asset[aria-pressed="true"]').count(), 0,
      'Browser selection leaked across the profile remount');
    await page.getByRole('button', { name: 'Close Browser' }).evaluate((node) => node.click());

    await visitOwnedProfile(PROFILE_A);
    await page.locator('[data-placement-id="placement-1"]').waitFor({ state: 'attached', timeout: 8_000 });
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), canonicalKey(PROFILE_A)), persisted);
  });
});
