import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('Library retains cached cards after failed RPC discovery and Retry assets recovers through the actual presenter', { timeout: 60000 }, async () => {
  const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
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

test('5000 assets stay paged, visible metadata preserves selection, and a chosen category opens directly after reload', { timeout: 90000 }, async () => {
  const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://**/*', route => route.abort());
      await page.route('https://assets.inscape.test/*', route => route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }));
      await page.goto(`${root}/browser-tests/library-progressive-fixture.html`);
      await page.waitForFunction(() => window.libraryDemandTest?.metadataIds.length > 0);
      assert.equal(await page.evaluate(() => window.libraryDemandTest.ownedPages), 1);
      assert.equal(await page.locator('.system-workflow__library-item').count(), 25);
      assert.ok(await page.evaluate(() => window.libraryDemandTest.metadataIds.length <= 4));
      const first = page.getByRole('button', { name: /^A token 1(?: \/|$)/ });
      await first.click();
      assert.equal(await first.getAttribute('aria-pressed'), 'true');
      await page.locator('.lattice-browser-results').evaluate(node => { node.scrollTop = node.scrollHeight; });
      await page.waitForFunction(() => window.libraryDemandTest.ownedPages >= 2);
      assert.ok(await page.evaluate(() => window.libraryDemandTest.ownedPages < 5));
      await page.evaluate(() => window.libraryDemandTest.release());
      const updated = page.getByRole('button', { name: /^Fresh A token 1(?: \/|$)/ });
      await updated.waitFor();
      assert.equal(await updated.getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Created', exact: true }).click();
      await page.getByRole('button', { name: /^My collection(?: \/|$)/ }).dblclick();
      await page.waitForFunction(() => Boolean(window.libraryDemandTest.data.collectionContext));
      assert.equal(await page.evaluate(() => window.libraryDemandTest.collectionPages), 1);
      assert.equal(await page.evaluate(() => window.libraryDemandTest.data.hasMore), true);
      await page.getByRole('button', { name: 'Close fixture Library' }).click();
      await page.getByRole('button', { name: 'Open fixture Library' }).click();
      await page.waitForFunction(() => !window.libraryDemandTest.data.collectionContext);
      const category = page.getByRole('button', { name: /^Curated/ });
      await category.click({ button: 'right' });
      await page.getByRole('menuitemcheckbox', { name: 'Open Library here' }).click();
      await page.reload();
      await page.getByRole('button', { name: /^A token 4501(?: \/|$)/ }).waitFor();
      assert.equal(await page.evaluate(() => window.libraryDemandTest.ownedPages), 0, 'opening a curated category must not scan all 5000 holdings');
      assert.equal(await page.evaluate(() => window.libraryDemandTest.createdPages), 0);
      assert.equal(await page.evaluate(() => window.libraryDemandTest.referencePages), 1);
      assert.equal(await page.locator('.system-workflow__library-item').count(), 2);
      await page.getByRole('button', { name: /^All Assets/ }).click();
      await page.waitForFunction(() => window.libraryDemandTest.ownedPages === 1);
      await page.getByRole('button', { name: 'Close fixture Library' }).click();
      await page.getByRole('button', { name: 'Open fixture Library' }).click();
      await page.waitForFunction(() => !window.libraryDemandTest.data.hasMore && !window.libraryDemandTest.data.loadingMore);
      assert.equal(await page.locator('.system-workflow__library-item').count(), 2);
      await page.screenshot({ path: `.browser-test-runtime/library-curated-${width}.png` });
      await page.getByRole('button', { name: 'Switch fixture profile' }).click();
      await page.getByRole('button', { name: /^B token 1(?: \/|$)/ }).waitFor();
      await page.evaluate(() => window.libraryDemandTest.release());
      await page.getByRole('button', { name: /^Fresh B token 1(?: \/|$)/ }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^(Fresh )?A token/ }).count(), 0, 'late metadata cannot reintroduce the previous profile');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('a category keeps individual images from one NFT through reload and removes only the chosen image', { timeout: 90000 }, async () => {
  const root = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE, headless: true });
  try {
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://**/*', route => route.abort());
      await page.route('https://assets.inscape.test/*', route => {
        requests.push(route.request().url());
        return route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' });
      });
      await page.goto(`${root}/browser-tests/library-progressive-fixture.html?images`);
      await page.getByRole('button', { name: 'Create Category', exact: true }).click();
      await page.getByRole('textbox', { name: 'category name', exact: true }).fill('Single image');
      await page.keyboard.press('Enter');
      const category = page.getByRole('button', { name: 'Single image', exact: true });
      await category.waitFor();
      await page.getByRole('button', { name: 'All Assets', exact: true }).click();
      await page.getByRole('button', { name: 'Show 2 images of A token 1', exact: true }).click();
      const image = page.getByRole('button', { name: 'Image 2 of A token 1', exact: true });
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 2 of A token 1"]')?.getAttribute('aria-disabled') === 'false');
      await image.click({ button: 'right' });
      await page.getByRole('menuitemcheckbox', { name: 'Single image', exact: true }).click();
      await category.click();
      assert.equal(await page.locator('.system-workflow__library-item').count(), 1);
      assert.equal(await page.locator('.system-workflow__library-item img').getAttribute('src'), 'https://assets.inscape.test/chosen.webp');
      assert.equal(await page.locator('[data-library-images-for]').count(), 0, 'the rest of the NFT stays outside this category');
      await category.click({ button: 'right' });
      await page.getByRole('menuitemcheckbox', { name: 'Open Library here' }).click();
      requests.length = 0;
      await page.reload();
      await page.getByRole('button', { name: 'Image 1 of A token 1', exact: true }).waitFor();
      assert.equal(await page.locator('.system-workflow__library-item').count(), 1);
      assert.equal(await page.evaluate(() => window.libraryDemandTest.ownedPages), 0);
      assert.equal(await page.evaluate(() => window.libraryDemandTest.createdPages), 0);
      assert.ok(requests.length > 0 && requests.every(url => url.endsWith('/chosen.webp')), 'only the curated image is requested after reload');
      await page.screenshot({ path: `.browser-test-runtime/library-single-image-${width}.png` });
      await page.evaluate(() => window.libraryDemandTest.release());
      await page.getByRole('button', { name: 'Image 1 of Fresh A token 1', exact: true }).waitFor();
      assert.equal(await page.locator('.system-workflow__library-item img').getAttribute('src'), 'https://assets.inscape.test/chosen.webp',
        'refreshing the parent NFT must not replace a curated image');
      // Adding a second image retains both; removing one leaves its sibling.
      await page.getByRole('button', { name: 'All Assets', exact: true }).click();
      await page.getByRole('button', { name: /^Fresh A token 1(?: \/|$)/ }).click({ button: 'right' });
      await page.getByRole('menuitemcheckbox', { name: 'Single image', exact: true }).click();
      await category.click();
      assert.equal(await page.locator('.system-workflow__library-item').count(), 2);
      await page.getByRole('button', { name: 'Image 1 of Fresh A token 1', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Remove from Single image' }).click();
      assert.equal(await page.locator('.system-workflow__library-item').count(), 1);
      assert.equal(await page.locator('.system-workflow__library-item img').getAttribute('src'), 'https://assets.inscape.test/new.webp');
      assert.deepEqual(await page.evaluate(() => {
        const folder = window.libraryDemandTest.store.getState().workspace.folders.find(folder => folder.name === 'Single image');
        return [folder.assetIds.length, folder.imageSelections.map(entry => entry.url)];
      }), [1, ['https://assets.inscape.test/new.webp']]);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
