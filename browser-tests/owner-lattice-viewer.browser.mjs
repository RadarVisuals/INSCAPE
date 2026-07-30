import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer as createViteServer } from 'vite';
import { createEmptyLatticeProductionDraft } from '../src/lattice/domain/latticeProductionDraft.js';
import { createBrowserTestCleanup, createLifecycleDiagnostics, withinDeadline,
  BROWSER_LIFECYCLE_TIMEOUTS } from './browser-test-lifecycle.mjs';
import { createPlaywrightRouteController, launchPlaywrightEdge } from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, '.browser-test-runtime');
const profile = '0x1111111111111111111111111111111111111111';
const contract = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const stableAssetId = `42:${contract}:0x01`;
const imageOrigin = 'https://phase6-assets.example';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw5nAAAAAElFTkSuQmCC', 'base64');

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const { port } = socket.address(); socket.close(() => resolvePort(port)); });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a Phase 6 browser-test port', () => socket.close());
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
    window.__phase6AuthorityUnsubscribe?.();
    window.__phase6AuthorityUnsubscribe = useWalletStore.subscribe((current) => {
      if (current.hostProfileAddress?.toLowerCase() === address && current.isHostProfileOwner) return;
      useWalletStore.setState(state);
    });
    useWalletStore.setState(state);
    history.pushState({ viewedProfileAddress: address }, '', `?view=${address}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, profile);
}

test('production ARRANGE and decoded native viewer work through the real owner route', { timeout: 90_000 }, async () => {
  const resources = {}; const problems = []; const diagnostic = createLifecycleDiagnostics();
  let cleanup = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
  const draft = createEmptyLatticeProductionDraft(profile);
  draft.tables[4].placements.push({
    id: 'placement-1', stableAssetId, column: 8, row: 3, columnSpan: 14, rowSpan: 10,
    layer: 0, navigationOrder: 0, crop: { x: 0.7, y: 0.3, zoom: 1.8 }, frameId: 'NONE',
    mat: { enabled: true, color: '#090a0a', inset: { top: 0.08, right: 0.08, bottom: 0.08, left: 0.08 } },
    backing: { enabled: true, color: '#d8d4ca' }, transparencyMode: 'OPAQUE', visibility: 'PUBLIC', locked: false,
  });
  try {
    const port = await availablePort(); const baseUrl = `http://127.0.0.1:${port}`;
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await resources.vite.listen();
    diagnostic('phase6:vite-ready', { port });
    const routeController = createPlaywrightRouteController({ loopbackOrigin: baseUrl, knownOrigins: [imageOrigin],
      decideKnown: async () => ({ action: 'fulfill', options: { status: 200, contentType: 'image/png', body: png } }) });
    const launched = await launchPlaywrightEdge({ edgePath: await findBrowser(), runtimePath: runtimeDir,
      workspaceRoot: root, loopbackOrigin: baseUrl, routeController, resources, diagnostic,
      onBrowserProblem: (problem) => problems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => { cleanup = createBrowserTestCleanup({ rootPid, processTree,
        runtimePath: runtimeDir, workspaceRoot: root, diagnostic }); } });
    const page = launched.page;
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(10_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ address, assetId, assetContract, canonicalDraft, origin }) => {
      localStorage.setItem(`inscape.lattice-production-draft.v1:${address}`, JSON.stringify(canonicalDraft));
      localStorage.setItem(`inscape.library-assets.v1:${address}`, JSON.stringify({ version: 1, profileAddress: address,
        updatedAt: Date.now(), assets: [{ id: assetId, chainId: 42, ownerAddress: address, contractAddress: assetContract,
          tokenId: '0x01', standard: 'LSP8', tokenType: 'NFT', name: 'Scoped token', description: 'Scoped description',
          collectionName: 'Hidden collection', imageUrl: `${origin}/art.png`, originalImageUrl: `${origin}/art.png`,
          imageWidth: 800, imageHeight: 600, mediaFileType: 'image/png', creators: [{ address: assetContract, name: null }],
          attributes: [{ key: 'Signal', value: 'High', type: null }], metadataStatus: 'ready', rawMetadata: { balance: '7' },
          fieldProvenance: { name: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' },
            description: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' },
            attributes: { scope: 'tokenId', source: 'LSP4MetadataForTokenId' },
            creators: { scope: 'contract', source: 'LSP4Creators[]' },
            tokenType: { scope: 'contract', source: 'LSP4TokenType' } } }] }));
    }, { address: profile, assetId: stableAssetId, assetContract: contract, canonicalDraft: draft, origin: imageOrigin });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    diagnostic('phase6:dom-ready');
    await setAuthority(page);
    diagnostic('phase6:authority-set');
    const enter = page.locator('.startveil__entry');
    await enter.waitFor({ state: 'visible', timeout: 20_000 });
    diagnostic('phase6:entry-visible');
    await page.waitForFunction(() => !document.querySelector('.startveil__entry')?.disabled);
    diagnostic('phase6:entry-ready');
    await enter.evaluate((node) => node.click());
    await page.locator('.owner-lattice-shell').waitFor({ state: 'attached', timeout: 20_000 });
    diagnostic('phase6:owner-shell-ready');
    const placement = page.locator('.owner-lattice-table[data-active] [data-placement-id="placement-1"]');
    await page.waitForFunction(() => document.querySelector('.owner-lattice-table[data-active] [data-placement-id="placement-1"]')?.dataset.mediaState === 'ready');
    diagnostic('phase6:placement-media-ready');
    const arrange = page.getByRole('button', { name: 'ARRANGE' });
    assert.equal(await arrange.getAttribute('aria-pressed'), 'false');
    const arrangeBox = await arrange.boundingBox();
    await page.mouse.click(arrangeBox.x + arrangeBox.width / 2, arrangeBox.y + arrangeBox.height / 2);
    await page.waitForFunction(() => document.querySelector('button[aria-label="ARRANGE"]')?.getAttribute('aria-pressed') === 'true');
    diagnostic('phase6:arrange-on');
    await page.getByRole('button', { name: /Move placement: Scoped token/u }).waitFor({ state: 'visible' });
    await page.mouse.click(arrangeBox.x + arrangeBox.width / 2, arrangeBox.y + arrangeBox.height / 2);
    await page.waitForFunction(() => document.querySelector('button[aria-label="ARRANGE"]')?.getAttribute('aria-pressed') === 'false');
    diagnostic('phase6:arrange-off');
    await placement.evaluate((node) => node.click());
    const viewer = page.locator('[data-lattice-focus-viewer]');
    await viewer.waitFor({ state: 'visible' });
    diagnostic('phase6:viewer-open');
    assert.equal(await viewer.getAttribute('data-menu-surface'), 'mist');
    assert.equal(await viewer.locator('.lattice-production-focus-artwork__native img').evaluate((node) => getComputedStyle(node).objectFit), 'contain');
    assert.equal(await viewer.getByText('Hidden collection').count(), 0);
    assert.equal(await viewer.getByText(/balance|edition|supply/iu).count(), 0);
    const rack = viewer.locator('.lattice-focus-viewer__rack');
    assert.deepEqual(await rack.locator(':scope > section > button > span').allTextContents(), [
      'NARRATIVE DOSSIER', 'ATTRIBUTE DOSSIER', 'TECHNICAL DOSSIER',
    ]);
    await viewer.locator('.lattice-focus-viewer__artwork').evaluate((node) => node.click());
    assert.equal(await rack.getAttribute('aria-hidden'), 'true');
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });
    diagnostic('phase6:viewer-closed');
    assert.equal(await placement.evaluate((node) => document.activeElement === node), true);
    await placement.press('Space');
    assert.equal(await page.locator('[data-lattice-focus-viewer]').count(), 0);
    await placement.press('Enter');
    await page.locator('[data-lattice-focus-viewer]').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('[data-lattice-focus-viewer]').waitFor({ state: 'detached' });
    assert.deepEqual(problems.filter((problem) => /Page error/iu.test(problem)), []);
  } finally {
    await cleanup(resources);
  }
});
