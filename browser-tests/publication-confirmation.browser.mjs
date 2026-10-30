import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { encodeAbiParameters } from 'viem';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';
import { memoryQuotaStore, uploadTestPolicy, uploadTestVerifier, UPLOAD_TEST_SIGNER } from '../scripts/fixtures/publicationUpload.mjs';
import { mountPublicationBoundary, boundaryProfile, otherBoundaryProfile } from './fixtures/publication-boundary.mjs';
import { pointerAction, r12Cases } from './fixtures/r12-pointer.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const profile = `0x${'1'.repeat(40)}`, otherProfile = `0x${'2'.repeat(40)}`;
const cid = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const transactionHash = `0x${'a'.repeat(64)}`;

for (const { theme, width, height } of r12Cases) {
  test(`R12 available publication actions finish through native pointers (${theme} ${width}x${height})`, { timeout: 40000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      // Every network, upload, signature and transaction boundary is local to
      // this existing fixture. Nothing is sent to a live profile or wallet.
      const state = await mountPublicationBoundary(page, origin, 'receipt', theme);
      await pointerAction(page, page.getByRole('button', { name: 'Prepare publication', exact: true }));
      assert.equal(await page.evaluate(() => publicationBoundary.saves), 1);
      assert.equal(state.uploads, 0);
      const makePublic = page.getByRole('button', { name: 'Make presentation public', exact: true });
      await makePublic.waitFor();
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/r12-ready-${theme}-${width}x${height}.png` });
      await pointerAction(page, makePublic);
      const publish = page.getByRole('button', { name: 'Publish to profile', exact: true });
      await publish.waitFor();
      assert.equal(state.uploads, 1); assert.ok(state.verifications >= 1);
      assert.equal(state.writes, 0);
      await page.screenshot({ path: `${output}/r12-verified-${theme}-${width}x${height}.png` });
      await pointerAction(page, publish);
      await state.reached;
      assert.equal(state.writes, 1);
      assert.equal(await page.getByRole('button', { name: 'Close Publication', exact: true }).isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => publicationBoundary.confirmed), []);
      state.release();
      await page.waitForFunction(() => publicationBoundary.confirmed.length === 1);
      assert.equal(await page.evaluate(() => publicationBoundary.confirmed[0].document.profile.address), boundaryProfile);
      assert.equal(state.writes, 1);
      await pointerAction(page, page.getByRole('button', { name: 'Close Publication', exact: true }));
      await page.locator('.owner-lattice-publication-rack').waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

for (const phase of ['upload', 'verify']) for (const change of ['snapshot', 'profile', 'close']) {
  test(`publication UI rejects late ${phase} after ${change}`, { timeout: 40000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const state = await mountPublicationBoundary(page, origin, phase);
      assert.equal(await page.evaluate(() => publicationBoundary.saves), 0);
      await page.getByRole('button', { name: 'Prepare publication', exact: true }).click();
      assert.equal(await page.evaluate(() => publicationBoundary.saves), 1);
      assert.equal(state.uploads, 0);
      await page.getByRole('button', { name: 'Make presentation public', exact: true }).click();
      await state.reached;
      await page.evaluate(({ change, other }) => {
        if (change === 'snapshot') publicationBoundary.changeSnapshot();
        if (change === 'profile') publicationBoundary.changeProfile(other);
        if (change === 'close') publicationBoundary.close();
      }, { change, other: otherBoundaryProfile });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      state.release();
      if (change === 'snapshot') await page.getByRole('button', { name: 'Prepare publication', exact: true }).waitFor({ state: 'visible' });
      if (change === 'profile') await page.getByRole('button', { name: 'Prepare publication', exact: true }).waitFor();
      await state.delivered;
      if (change === 'snapshot') await page.waitForFunction(() =>
        [...document.querySelectorAll('button')].some(button => button.textContent === 'Prepare publication' && !button.disabled));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByRole('button', { name: 'Publish to profile', exact: true }).count(), 0);
      assert.deepEqual(await page.evaluate(() => publicationBoundary.confirmed), []);
      assert.equal(state.writes, 0);
    } finally { await browser.close(); }
  });
}

test('a submitted publication confirms its original snapshot after the Rack changes profile', { timeout: 40000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const state = await mountPublicationBoundary(page, origin, 'receipt');
    await page.getByRole('button', { name: 'Prepare publication', exact: true }).click();
    await page.getByRole('button', { name: 'Make presentation public', exact: true }).click();
    await page.getByRole('button', { name: 'Publish to profile', exact: true }).click();
    await state.reached;
    await page.evaluate(address => publicationBoundary.changeProfile(address), otherBoundaryProfile);
    state.release();
    await page.waitForFunction(() => publicationBoundary.confirmed.length === 1);
    assert.equal(await page.evaluate(() => publicationBoundary.confirmed[0].document.profile.address), boundaryProfile);
    assert.equal(state.writes, 1);
    assert.equal(await page.getByRole('button', { name: 'Publish to profile', exact: true }).count(), 0);
  } finally { await browser.close(); }
});

test('publication recovery ignores old profile results and rereads the journal on explicit invalidation', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/__recovery_boundary__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    // Controlled dependencies isolate React acceptance. The actual journal and
    // receipt/read-back implementations remain covered by their existing units.
    await page.route('**/src/profileDocument/storage/publicationJournal.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      export const publicationJournal = {
        read(profile) { window.recoveryProbe.reads++; return { profileAddress: profile }; },
        remove(record) { window.recoveryProbe.removed.push(record.profileAddress); }
      };` }));
    await page.route('**/src/profileDocument/storage/publicationRecovery.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      export const createPublicationRecovery = () => record => new Promise(resolve =>
        window.recoveryProbe.pending.push({ record, resolve }));` }));
    await page.goto(`${origin}/__recovery_boundary__`);
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { usePublicationRecovery } = await import('/src/profileDocument/state/usePublicationRecovery.js');
      const probe = window.recoveryProbe = { reads: 0, removed: [], pending: [] };
      const root = createRoot(document.getElementById('root'));
      function Host(props) {
        probe.current = usePublicationRecovery(props.profile, props.status, props.busy);
        return React.createElement('output', null, probe.current.status);
      }
      probe.render = props => root.render(React.createElement(Host, props));
      probe.render({ profile: 'A', status: 'READY', busy: false });
    });
    await page.waitForFunction(() => recoveryProbe.pending.length === 1);
    await page.evaluate(() => recoveryProbe.render({ profile: 'A', status: 'VERIFYING_CID', busy: false }));
    await page.waitForFunction(() => recoveryProbe.reads === 2);
    await page.waitForFunction(() => recoveryProbe.pending.length === 2);
    await page.evaluate(() => recoveryProbe.render({ profile: 'A', status: 'VERIFYING_CID', busy: true }));
    await page.waitForFunction(() => recoveryProbe.reads === 3);
    await page.evaluate(() => recoveryProbe.render({ profile: 'B', status: 'READY', busy: false }));
    await page.waitForFunction(() => recoveryProbe.pending.length === 3);
    await page.evaluate(() => {
      recoveryProbe.pending[0].resolve({ status: 'PUBLISHED', message: 'Old profile result' });
      recoveryProbe.pending[1].resolve({ status: 'PUBLISHED', message: 'Old attempt result' });
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('output').innerText(), 'CHECKING');
    await page.evaluate(() => recoveryProbe.pending[2].resolve({ status: 'FAILED', message: 'Current profile result' }));
    await page.getByText('FAILED', { exact: true }).waitFor();
    await page.evaluate(() => recoveryProbe.current.check());
    await page.waitForFunction(() => recoveryProbe.pending.length === 4);
    assert.equal(await page.locator('output').innerText(), 'CHECKING');
    await page.evaluate(() => recoveryProbe.pending[3].resolve({ status: 'PUBLISHED', result: { profile: 'B' } }));
    await page.getByText('PUBLISHED', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => recoveryProbe.current.acknowledge()), { result: { profile: 'B' } });
    assert.deepEqual(await page.evaluate(() => recoveryProbe.removed), ['B']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

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
        const { publishedProfileResolutionStore: store } = await import(performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/profileDocument/state/publishedProfileResolutionStore.js')?.name || '/src/profileDocument/state/publishedProfileResolutionStore.js');
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
      await page.getByRole('button', { name: 'Prepare publication', exact: true }).click();
      await page.getByRole('button', { name: 'Make presentation public', exact: true }).click();
      await page.getByRole('button', { name: 'Publish to profile', exact: true }).waitFor();
      const notice = page.getByRole('complementary', { name: 'Publication complete' });
      assert.equal(await notice.count(), 0, 'an upload alone is not publication success');
      await page.getByRole('button', { name: 'Publish to profile', exact: true }).click();
      await page.waitForFunction(() => typeof window.confirmFixtureReceipt === 'function');
      assert.equal(await notice.count(), 0, 'a submitted but unconfirmed transaction is not success');
      await page.evaluate(async () => {
        const { publishedProfileResolutionStore: store } = await import(performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/profileDocument/state/publishedProfileResolutionStore.js')?.name || '/src/profileDocument/state/publishedProfileResolutionStore.js');
        store.repository = { resolve: address => new Promise(resolve => {
          window.finishFixtureRefresh = async () => resolve({ status: 'RESOLVED', address, document: await window.fixtureDocument() });
        }) };
        window.confirmFixtureReceipt();
      });
      await notice.waitFor();
      await page.waitForFunction(() => typeof window.finishFixtureRefresh === 'function');
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
