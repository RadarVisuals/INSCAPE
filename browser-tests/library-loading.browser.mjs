import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('Library retains cached cards after failed RPC discovery and Retry assets recovers through the actual presenter', { timeout: 60000 }, async () => {
  const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('https://**/*', (route) => route.abort());
      await page.route('https://assets.inscape.test/known.webp', (route) => route.fulfill({
        contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp',
      }));
      await page.goto(`${root}/browser-tests/library-storage-fixture.html`);
      await page.waitForFunction(() => Boolean(window.storageTest?.store));
      await page.evaluate(async () => {
        // Use the same development module instance as the mounted store, including
        // Vite's timestamp after a source edit during a running development server.
        const loadedModule = (path) => performance.getEntriesByType('resource')
          .map(({ name }) => name).find((url) => new URL(url).pathname === path) || path;
        const { chillwhalesProfileRepository } = await import(loadedModule('/src/library/data/chillwhalesProfileRepository.js'));
        const { createLuksoRpcProfileRepository, luksoRpcProfileRepository } = await import(loadedModule('/src/library/data/luksoRpcProfileRepository.js'));
        const { libraryAssetCacheKey, loadLibraryAssetCache, saveLibraryAssetCache } = await import('/src/library/storage/libraryAssetCache.js');
        const profile = '0x1111111111111111111111111111111111111111';
        const contract = '0x2222222222222222222222222222222222222222';
        const store = window.storageTest.store;
        const storage = { getItem: (key) => localStorage.getItem(`storage-fixture:${key}`),
          setItem: (key, value) => localStorage.setItem(`storage-fixture:${key}`, value) };
        const asset = { id: `42:${contract}:contract`, chainId: 42, ownerAddress: profile,
          contractAddress: contract, tokenId: null, standard: 'LSP7', name: 'Retained artwork',
          imageUrl: 'https://assets.inscape.test/known.webp', fieldProvenance: {} };
        saveLibraryAssetCache(storage, profile, [asset]);
        store.setState({ assets: loadLibraryAssetCache(storage, profile), status: 'ready' });
        const probe = { failing: true, requests: 0, cache: () => JSON.parse(storage.getItem(libraryAssetCacheKey(profile))).assets };
        window.libraryLoadingTest = probe;
        chillwhalesProfileRepository.loadProfileAssets = async function* () { throw new Error('Indexer unavailable'); };
        const rpc = createLuksoRpcProfileRepository({
          discoverContracts: async () => [contract],
          client: { async multicall({ contracts }) {
            probe.requests += 1;
            return contracts.map(() => probe.failing
              ? { status: 'failure', error: new Error('RPC unavailable') }
              : { status: 'success', result: false });
          } },
        });
        luksoRpcProfileRepository.loadProfileAssets = rpc.loadProfileAssets;
        await store.getState().load({ forceLive: true });
      });
      await page.getByRole('button', { name: 'Retry assets', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.storageTest.store.getState().status), 'partial');
      assert.equal(await page.locator('.system-workflow__library-item').count(), 1);
      assert.equal(await page.evaluate(() => window.libraryLoadingTest.cache().length), 1);
      await page.getByText(/Some asset holdings could not be verified/).waitFor();
      await page.screenshot({ path: `.browser-test-runtime/library-rpc-partial-${width}.png` });
      await page.evaluate(() => { window.libraryLoadingTest.failing = false; });
      await page.getByRole('button', { name: 'Retry assets', exact: true }).click();
      await page.waitForFunction(() => window.storageTest.store.getState().status === 'ready');
      assert.equal(await page.evaluate(() => window.libraryLoadingTest.requests), 2);
      assert.equal(await page.evaluate(() => window.libraryLoadingTest.cache().length), 0);
      assert.equal(await page.locator('.system-workflow__library-item').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Retry assets', exact: true }).count(), 0);
      await page.getByText('No assets in this view', { exact: true }).waitFor();
      await page.screenshot({ path: `.browser-test-runtime/library-rpc-recovered-${width}.png` });

      await page.evaluate(async () => {
        window.libraryLoadingTest.failing = true;
        await window.storageTest.store.getState().load({ forceLive: true });
      });
      assert.equal(await page.evaluate(() => window.storageTest.store.getState().status), 'error');
      const retry = page.getByRole('button', { name: 'Retry assets', exact: true });
      await retry.waitFor();
      await page.evaluate(() => { window.libraryLoadingTest.failing = false; });
      await retry.focus(); await retry.press('Enter');
      await page.waitForFunction(() => window.storageTest.store.getState().status === 'ready');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
