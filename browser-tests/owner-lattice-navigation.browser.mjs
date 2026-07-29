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
  settlePlaywrightAnimationFrames,
} from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, '.browser-test-runtime');
const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const canonicalKey = (profile) => `inscape.lattice-production-draft.v1:${profile}`;
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

function assertCanonicalReadIsolation(operations) {
  const allowedKeys = new Set([canonicalKey(PROFILE_A), canonicalKey(PROFILE_B)]);
  assert.equal(operations.every(({ method, key }) => method === 'getItem' && allowedKeys.has(key)), true,
    `unexpected Phase 4 lattice storage operation: ${JSON.stringify(operations)}`);
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
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a Phase 4 browser-test port', () => socket.close());
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
  throw new Error('Phase 4 Vite server did not become ready');
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
      const deadline = setTimeout(() => { unsubscribe(); rejectStable(new Error('Phase 4 wallet lifecycle did not become quiet')); }, 10_000);
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
    const authoritativeState = {
      hostProfileAddress: address,
      isHostProfileOwner: true,
      isWalletConnected: true,
      authorityLifecycleStatus: 'complete',
      disposeWallet: () => ({ disposed: true, listenersRemoved: true, limitation: null }),
      _failClosedProviderContext: () => {},
      _applyAuthoritativeProviderContext: async () => {},
    };
    window.__phase4AuthorityUnsubscribe?.();
    let enforcing = false;
    window.__phase4AuthorityUnsubscribe = useWalletStore.subscribe((state) => {
      if (enforcing || state.hostProfileAddress?.toLowerCase() === address.toLowerCase()
        && state.isHostProfileOwner && state.authorityLifecycleStatus === 'complete') return;
      enforcing = true; useWalletStore.setState(authoritativeState); enforcing = false;
    });
    useWalletStore.setState(authoritativeState);
  }, profile);
}

const activeCoordinate = () => page.locator('.lattice-coordinate-map [aria-current="location"]').getAttribute('data-coordinate');

async function waitForCoordinate(coordinate) {
  await page.waitForFunction((expected) => document.querySelector('.lattice-coordinate-map [aria-current="location"]')?.dataset.coordinate === expected,
    coordinate, { timeout: 5_000 });
  await page.waitForFunction(() => !document.querySelector('.owner-lattice-stage')?.hasAttribute('data-snapping'), undefined, { timeout: 5_000 });
}

const fixedChromeSelectors = Object.freeze([
  '.lattice-profile-rail',
  '.lattice-workspace-toolbar',
  '.lattice-coordinate-map',
  '.owner-lattice-signature',
  '.keeper-dock',
]);

async function rectangles(selectors = fixedChromeSelectors) {
  return page.evaluate((values) => Object.fromEntries(values.map((selector) => {
    const rectangle = document.querySelector(selector)?.getBoundingClientRect();
    return [selector, rectangle && { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height }];
  })), selectors);
}

function assertRectanglesEqual(actual, expected, message) {
  for (const selector of Object.keys(expected)) {
    assert.ok(actual[selector] && expected[selector], `${message}: missing ${selector}`);
    for (const key of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(actual[selector][key] - expected[selector][key]) < 0.1,
        `${message}: ${selector}.${key} moved from ${expected[selector][key]} to ${actual[selector][key]}`);
    }
  }
}

async function stageTranslation() {
  return page.locator('.owner-lattice-stage').evaluate((stage) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(stage).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
}

describe('Phase 4 owner lattice through the real App route', { concurrency: false }, () => {
  before(async () => runBrowserSetupWithCleanup(async () => {
    setupAbortController = new AbortController();
    const browserPath = await findBrowser();
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Phase 4 Vite listen deadline exceeded');
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
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      window.__phase4LatticeStorageOperations = [];
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function phase4StorageProbe(key, ...rest) {
          if (/lattice/iu.test(String(key))) window.__phase4LatticeStorageOperations.push({ method, key: String(key) });
          return original.call(this, key, ...rest);
        };
      }
    });
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
    if (failures.length) throw new AggregateError(failures, 'Phase 4 browser cleanup failed');
  });

  test('direct navigation, one-step controls, reset, disabled semantics, and storage isolation hold', async () => {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.ok(response?.ok());
    await setAuthority(PROFILE_A);
    try { await page.locator('.owner-lattice-shell').waitFor({ state: 'attached', timeout: 5_000 }); }
    catch (error) {
      const routeDiagnostic = await page.evaluate(async () => {
        const { useWalletStore } = await import('/src/store/useWalletStore.js');
        const state = useWalletStore.getState();
        return { href: location.href, authorityLifecycleStatus: state.authorityLifecycleStatus,
          hostProfileAddress: state.hostProfileAddress, isHostProfileOwner: state.isHostProfileOwner,
          isWalletConnected: state.isWalletConnected, body: document.body.textContent?.slice(0, 500) };
      });
      throw new Error(`Owner shell unavailable after fixture authority: ${JSON.stringify(routeDiagnostic)}`, { cause: error });
    }
    const enter = page.locator('.startveil__entry');
    await enter.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => !document.querySelector('.startveil__entry')?.disabled, undefined, { timeout: 20_000 });
    await enter.evaluate((button) => button.click());
    await page.evaluate(() => new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000)));
    assert.equal(await activeCoordinate(), '0:0');

    await Promise.all(fixedChromeSelectors.map((selector) => page.locator(selector)
      .waitFor({ state: 'attached', timeout: 60_000 })));
    const fixedBefore = await rectangles();
    await page.evaluate(() => {
      window.__phase4CoordinateHistory = [];
      const map = document.querySelector('.lattice-coordinate-map');
      window.__phase4CoordinateObserver = new MutationObserver(() => {
        const value = map.querySelector('[aria-current="location"]')?.dataset.coordinate;
        if (value && window.__phase4CoordinateHistory.at(-1) !== value) window.__phase4CoordinateHistory.push(value);
      });
      window.__phase4CoordinateObserver.observe(map, { attributes: true, subtree: true, attributeFilter: ['aria-current'] });
    });
    await page.locator('.lattice-coordinate-map [data-coordinate="1:1"]').click();
    await waitForCoordinate('1:1');
    assert.deepEqual(await page.evaluate(() => window.__phase4CoordinateHistory), ['1:1']);

    await page.locator('.owner-lattice-spatial-surface').focus();
    await page.keyboard.press('ArrowLeft');
    await waitForCoordinate('0:1');
    await page.locator('.lattice-direction-chevron.is-left').click();
    await waitForCoordinate('-1:1');
    await page.locator('.owner-lattice-spatial-surface').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await activeCoordinate(), '-1:1');

    const surfaceBox = await page.locator('.owner-lattice-spatial-surface').boundingBox();
    await page.mouse.click(surfaceBox.x + (surfaceBox.width / 2), surfaceBox.y + (surfaceBox.height / 2));
    assert.equal(await activeCoordinate(), '-1:1');
    assertRectanglesEqual(await rectangles(), fixedBefore, 'fixed chrome after keyboard and chevron navigation');

    await page.locator('.lattice-coordinate-map [data-coordinate="0:0"]').click();
    await waitForCoordinate('0:0');
    const dragStart = { x: surfaceBox.x + (surfaceBox.width / 2), y: surfaceBox.y + (surfaceBox.height / 2) };
    const baselineTransform = await stageTranslation();
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + 110, dragStart.y, { steps: 3 });
    const activeDragTransform = await stageTranslation();
    assert.ok(activeDragTransform.x - baselineTransform.x > 90, 'activated drag did not visibly move the lattice');
    assertRectanglesEqual(await rectangles(), fixedBefore, 'fixed chrome during activated drag');
    await page.mouse.up();
    await waitForCoordinate('-1:0');
    assertRectanglesEqual(await rectangles(), fixedBefore, 'fixed chrome after drag settling');

    const subThresholdBaseline = await stageTranslation();
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x - 32, dragStart.y, { steps: 2 });
    assert.ok((await stageTranslation()).x < subThresholdBaseline.x, 'sub-threshold drag did not activate visibly');
    await page.mouse.up();
    await waitForCoordinate('-1:0');

    const edgeBaseline = await stageTranslation();
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + 140, dragStart.y, { steps: 3 });
    const resisted = await stageTranslation();
    const resistedDistance = resisted.x - edgeBaseline.x;
    assert.ok(resistedDistance > 10 && resistedDistance < 40, `edge drag was not visibly resisted: ${resistedDistance}`);
    assertRectanglesEqual(await rectangles(), fixedBefore, 'fixed chrome during resisted edge drag');
    await page.mouse.up();
    await waitForCoordinate('-1:0');

    await page.mouse.move(dragStart.x, dragStart.y);
    const wheelResult = await page.locator('.owner-lattice-spatial-surface').evaluate((surface) => {
      const current = () => document.querySelector('.lattice-coordinate-map [aria-current="location"]')?.dataset.coordinate;
      surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40 }));
      const afterFirstDelta = current();
      surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 45 }));
      surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 120 }));
      return { afterFirstDelta };
    });
    assert.equal(wheelResult.afterFirstDelta, '-1:0');
    await waitForCoordinate('0:0');
    assert.equal(await activeCoordinate(), '0:0');
    assertRectanglesEqual(await rectangles(), fixedBefore, 'fixed chrome after accumulated wheel navigation');

    const disabled = page.locator('.owner-lattice-shell button:disabled');
    assert.ok(await disabled.count() >= 5);
    assert.equal(await page.locator('.owner-lattice-theme').count(), 0);
    await page.getByRole('button', { name: 'THEME' }).click();
    await page.locator('.owner-lattice-theme select').first().selectOption('paper');
    assert.equal(await page.locator('.owner-lattice-shell').getAttribute('data-surface'), 'paper');

    await setAuthority(PROFILE_B);
    await page.evaluate((address) => {
      history.pushState({ viewedProfileAddress: address }, '', `?view=${address}`);
      dispatchEvent(new PopStateEvent('popstate'));
    }, PROFILE_B);
    await page.locator('.owner-lattice-shell[data-surface="carbon"]').waitFor({ state: 'attached', timeout: 5_000 });
    assert.equal(await activeCoordinate(), '0:0');
    assert.equal(await page.locator('.owner-lattice-theme').count(), 0);
    assertCanonicalReadIsolation(await page.evaluate(() => window.__phase4LatticeStorageOperations));

    await page.locator('.lattice-coordinate-map [data-coordinate="1:-1"]').click();
    await waitForCoordinate('1:-1');
    await page.getByRole('button', { name: 'THEME' }).click();
    await page.locator('.owner-lattice-theme select').first().selectOption('paper');
    assert.equal(await page.locator('.owner-lattice-shell').getAttribute('data-surface'), 'paper');
    assert.equal(await page.locator('.owner-lattice-theme').count(), 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await setAuthority(PROFILE_B);
    await page.locator('.owner-lattice-shell[data-surface="carbon"]').waitFor({ state: 'attached', timeout: 15_000 });
    assert.equal(await activeCoordinate(), '0:0');
    assert.equal(await page.locator('.owner-lattice-theme').count(), 0);
    assertCanonicalReadIsolation(await page.evaluate(() => window.__phase4LatticeStorageOperations));
    await settlePlaywrightAnimationFrames(page);
  });
});
