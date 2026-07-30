import assert from 'node:assert/strict';
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
const runtimeDir = resolve(root, '.browser-test-runtime');
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

async function openDossier(page) {
  const trigger = page.locator('.lattice-profile-rail__identity');
  await trigger.evaluate((node) => node.click());
  const dialog = page.locator('#lattice-profile-dossier');
  await dialog.waitFor({ state: 'visible' });
  return { dialog, trigger };
}

test('production owner Identity Dossier owns focus, scrolling, modules, and responsive geometry', { timeout: 120_000 }, async () => {
  const resources = {}; const problems = []; const diagnostic = createLifecycleDiagnostics();
  let cleanup = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
  try {
    const port = await availablePort(); const baseUrl = `http://127.0.0.1:${port}`;
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await resources.vite.listen();
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
    page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(10_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await setAuthority(page);
    const enter = page.locator('.startveil__entry');
    await enter.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => !document.querySelector('.startveil__entry')?.disabled);
    await enter.evaluate((node) => node.click());
    await page.locator('.owner-lattice-shell').waitFor({ state: 'attached', timeout: 20_000 });
    diagnostic('phase7:owner-ready');

    let opened = await openDossier(page);
    diagnostic('phase7:precedence-open');
    assert.equal(await opened.dialog.locator('button[aria-label="Close Identity Dossier"]').evaluate((node) => document.activeElement === node), true);
    assert.equal(await opened.dialog.getByRole('button', { name: 'PROFILE DOSSIER' }).getAttribute('aria-expanded'), 'true');
    assert.equal(await opened.dialog.locator('section[data-active]').count(), 1);

    const ownership = await page.evaluate(() => {
      const dialog = document.querySelector('#lattice-profile-dossier');
      const activeBefore = document.querySelector('.owner-lattice-table[data-active]')?.getAttribute('style');
      dialog.focus();
      dialog.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      dialog.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true }));
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      return { activeBefore, activeAfter: document.querySelector('.owner-lattice-table[data-active]')?.getAttribute('style'),
        focusContained: dialog.contains(document.activeElement) };
    });
    assert.equal(ownership.activeAfter, ownership.activeBefore);
    assert.equal(ownership.focusContained, true);

    await page.mouse.click(5, 5);
    await opened.dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement === document.querySelector('.lattice-profile-rail__identity'));
    opened = await openDossier(page);
    diagnostic('phase7:ownership-checked');
    const moduleGeometry = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.lattice-production-identity-dossier__module > button')];
      buttons[1].click(); const firstTechnicalY = buttons[2].getBoundingClientRect().y;
      buttons[0].click(); buttons[1].click();
      return { firstTechnicalY, secondTechnicalY: buttons[2].getBoundingClientRect().y };
    });
    assert.equal(moduleGeometry.secondTechnicalY, moduleGeometry.firstTechnicalY);
    assert.deepEqual(await opened.dialog.locator('.lattice-production-identity-dossier__module > button strong').allTextContents(),
      ['PROFILE DOSSIER', 'LINKS', 'TECHNICAL IDENTITY']);

    await opened.dialog.evaluate((node) => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    await opened.dialog.waitFor({ state: 'hidden' });
    diagnostic('phase7:escape-restored');
    assert.equal(await opened.trigger.evaluate((node) => document.activeElement === node), true);
    const boundaries = [
      { width: 1280, height: 720, layout: 'desktop' },
      { width: 900, height: 720, layout: 'desktop' },
      { width: 640, height: 720, layout: 'compact' },
      { width: 390, height: 844, layout: 'compact' }
    ];
    for (const boundary of boundaries) {
      await page.setViewportSize({ width: boundary.width, height: boundary.height });
      opened = await openDossier(page);
      assert.equal(await opened.dialog.getAttribute('data-layout'), boundary.layout);
      const rack = await opened.dialog.locator('.lattice-production-identity-dossier').boundingBox();
      const artwork = await opened.dialog.locator('.lattice-production-identity-viewer__artwork').boundingBox();
      assert.ok(rack.x >= 0 && rack.y >= 0 && rack.x + rack.width <= boundary.width && rack.y + rack.height <= boundary.height);
      assert.ok(artwork.x >= 0 && artwork.y >= 0 && artwork.x + artwork.width <= boundary.width && artwork.y + artwork.height <= boundary.height);
      if (boundary.layout === 'desktop') assert.ok(rack.x > artwork.x + artwork.width);
      else assert.ok(rack.y > artwork.y + artwork.height);
      await opened.dialog.evaluate((node) => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
      await opened.dialog.waitFor({ state: 'hidden' });
      diagnostic('phase7:boundary', { width: boundary.width });
    }
    assert.deepEqual(problems.filter((problem) => /Page error/iu.test(problem)), []);
  } finally {
    await cleanup(resources);
  }
});
