import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { encodeAbiParameters } from 'viem';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';
import { memoryQuotaStore, uploadTestPolicy, uploadTestVerifier, UPLOAD_TEST_SIGNER } from '../scripts/fixtures/publicationUpload.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const profile = `0x${'1'.repeat(40)}`, otherProfile = `0x${'2'.repeat(40)}`;
const cid = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const transactionHash = `0x${'a'.repeat(64)}`;

for (const width of [1440, 390]) {
  test(`real App retains confirmed publication through owner refresh, ${width}px`, { timeout: 90_000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(15_000);
      const state = { bytes: '', value: '0x', uploads: 0, writes: 0, signatures: 0 };
      const store = memoryQuotaStore();
      const handler = createPinProfileDocumentHandler({ getJwt: () => 'fixture-only', getQuotaStore: () => store,
        getPolicy: () => uploadTestPolicy(), verifySignature: uploadTestVerifier(profile),
        fetchImpl: async (_url, init) => {
          state.uploads++; state.bytes = await init.body.get('file').text();
          return Response.json({ data: { cid } });
        } });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
      await page.route('**/api/profile-publications**', async route => {
        const request = route.request();
        const response = await handler(new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postDataBuffer() }));
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      });
      await page.route(`**/ipfs/${cid}`, route => route.fulfill({ contentType: 'application/json', body: state.bytes }));
      await page.route('https://rpc.mainnet.lukso.network/**', route => route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: encodeAbiParameters([{ type: 'bytes' }], [state.value]) }) }));
      await page.exposeFunction('fixtureSign', message => {
        state.signatures++; return UPLOAD_TEST_SIGNER.signMessage({ message });
      });
      await page.exposeFunction('fixtureWrite', args => {
        state.writes++; state.value = args[1]; return transactionHash;
      });
      await page.exposeFunction('fixtureDocument', () => JSON.parse(state.bytes));
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async ({ profile, signer, transactionHash }) => {
        const { useWalletStore } = await import('/src/store/useWalletStore.js');
        useWalletStore.getState().disposeWallet();
        const { publishedProfileResolutionStore: store } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
        store.repository = { resolve: async address => ({ status: 'UNAVAILABLE', address, document: null }) };
        store.clear();
        const patch = {
          authorityLifecycleStatus: 'complete', isWalletConnected: true, isHostProfileOwner: true,
          hostProfileAddress: profile, chainId: 42, publicationContextGeneration: 1, provider: {},
          profileMetadata: { name: 'Publication test' },
          walletClient: { account: signer, signMessage: ({ message }) => window.fixtureSign(message),
            writeContract: ({ args }) => window.fixtureWrite(args) },
          publicClient: { waitForTransactionReceipt: () => new Promise(resolve => {
            window.confirmFixtureReceipt = () => resolve({ status: 'success', transactionHash });
          }) },
        };
        let enforcing = false;
        window.fixtureWalletPatch = patch;
        useWalletStore.subscribe(state => {
          if (enforcing || Object.entries(patch).every(([key, value]) => state[key] === value)) return;
          enforcing = true; useWalletStore.setState(patch); enforcing = false;
        });
        useWalletStore.setState(patch);
      }, { profile, signer: UPLOAD_TEST_SIGNER.address, transactionHash });
      await page.locator('.startveil').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByRole('button', { name: 'PREPARE PUBLICATION', exact: true }).click();
      await page.getByRole('button', { name: 'MAKE PRESENTATION PUBLIC', exact: true }).click();
      await page.getByRole('button', { name: 'PUBLISH TO PROFILE', exact: true }).waitFor();
      const notice = page.getByRole('complementary', { name: 'Publication complete' });
      assert.equal(await notice.count(), 0, 'an upload alone is not publication success');
      await page.getByRole('button', { name: 'PUBLISH TO PROFILE', exact: true }).click();
      await page.waitForFunction(() => typeof window.confirmFixtureReceipt === 'function');
      assert.equal(await notice.count(), 0, 'a submitted but unconfirmed transaction is not success');
      await page.evaluate(async () => {
        const { publishedProfileResolutionStore: store } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
        store.repository = { resolve: address => new Promise(resolve => {
          window.finishFixtureRefresh = async () => resolve({ status: 'RESOLVED', address, document: await window.fixtureDocument() });
        }) };
        window.confirmFixtureReceipt();
      });
      await notice.waitFor();
      await page.getByText('Resolving owner workspace...', { exact: true }).waitFor();
      assert.match(await notice.innerText(), /Published successfully[\s\S]*transaction is confirmed/);
      assert.equal(await notice.getByRole('link', { name: 'View transaction' }).getAttribute('href'),
        `https://explorer.execution.mainnet.lukso.network/tx/${transactionHash}`);
      const viewUrl = await notice.getByRole('link', { name: 'View publication' }).getAttribute('href');
      assert.match(viewUrl, new RegExp(`view=${profile}`));
      assert.match(viewUrl, /reception=1/);
      await page.evaluate(() => window.finishFixtureRefresh());
      await page.getByRole('button', { name: 'Publish', exact: true }).waitFor();
      await notice.waitFor();
      await page.waitForTimeout(6500);
      assert.equal(await notice.isVisible(), true, 'confirmation has no short automatic timeout');
      const rect = await notice.boundingBox();
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= 900);
      assert.equal(await notice.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.equal(await notice.evaluate(node => {
        const box = node.getBoundingClientRect();
        return getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'
          && node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), true, 'confirmation is opaque and above the portaled editing tools');
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/success-${width}.png` });
      if (width === 1440) {
        await notice.getByRole('button', { name: 'Dismiss publication confirmation' }).focus();
        await page.keyboard.press('Enter');
        await notice.waitFor({ state: 'detached' });
        assert.equal(await page.getByRole('button', { name: 'Publish', exact: true }).evaluate(node => node === document.activeElement), true);
      } else {
        await page.evaluate(async address => {
          const { useWalletStore } = await import('/src/store/useWalletStore.js');
          window.fixtureWalletPatch.hostProfileAddress = address;
          useWalletStore.setState({ hostProfileAddress: address });
        }, otherProfile);
        await notice.waitFor({ state: 'detached' });
      }
      assert.deepEqual([state.signatures, state.uploads, state.writes], [1, 1, 1], 'no repeat wallet/upload action after success');
    } finally { await browser.close(); }
  });
}
