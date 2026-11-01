import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';
import { readUploadPolicy } from '../netlify/lib/publicationUploadAuth.mjs';
import { memoryQuotaStore, uploadTestPolicy, uploadTestVerifier, UPLOAD_TEST_SIGNER } from '../scripts/fixtures/publicationUpload.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const profile = `0x${'1'.repeat(40)}`, cid = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

async function fixture(page, scenario) {
  const store = memoryQuotaStore(), state = { requests: [], uploads: 0, bytes: '' };
  const handler = createPinProfileDocumentHandler({ getJwt: () => 'fixture-only', getQuotaStore: () => store,
    getPolicy: () => scenario === 'unconfigured' ? readUploadPolicy({}) : uploadTestPolicy(),
    verifySignature: uploadTestVerifier(profile, { lsp0: scenario !== 'invalid-profile' }), fetchImpl: async (_url, init) => {
      state.uploads++; state.bytes = await init.body.get('file').text();
      return Response.json({ data: { cid } });
    } });
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  await page.route('**/api/profile-publications**', async route => {
    const request = route.request(); state.requests.push(new URL(request.url()).pathname);
    if (scenario === 'quota' && !request.url().endsWith('/challenge')) return route.fulfill({ status: 429,
      contentType: 'application/json', body: JSON.stringify({ error: { code: 'UPLOAD_PROFILE_QUOTA', message: 'Your profile has reached its hourly upload limit. Try again next hour.' } }) });
    const response = await handler(new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postDataBuffer() }));
    return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.route(`**/ipfs/${cid}`, route => route.fulfill({ contentType: 'application/json', body: scenario === 'wrong-cid' ? '{}' : state.bytes }));
  await page.route(`${origin}/__upload__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.exposeFunction('testSignUpload', message => UPLOAD_TEST_SIGNER.signMessage({ message }));
  await page.goto(`${origin}/__upload__`);
  await page.evaluate(async ({ profile, account }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    await import('/src/index.css'); await import('/src/inscapeTokens.css');
    await import('/src/lattice/rendering/latticeMenuSurface.css');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    const { default: Rack } = await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx');
    const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
    const draft = createEmptySystemWorkflowDraft(profile, { generateId: () => 'home' });
    window.__uploadState = { signatures: 0, writes: 0, closes: 0 };
    const wallet = window.__uploadWallet = { isWalletConnected: true, isHostProfileOwner: true, hostProfileAddress: profile,
      chainId: 42, publicationContextGeneration: 1, provider: {}, publicClient: {}, walletClient: { account,
        signMessage: ({ message }) => { window.__uploadState.signatures++; return new Promise((resolve, reject) => {
          window.__approveUpload = () => window.testSignUpload(message).then(resolve, reject);
          window.__rejectUpload = () => reject(Error('User rejected fixture signature'));
        }); }, writeContract: async () => { window.__uploadState.writes++; throw Error('Unexpected wallet write'); } } };
    window.__uploadRoot = createRoot(document.getElementById('root'));
    window.__uploadRoot.render(React.createElement('main', { className: 'system-workflow', 'data-menu-surface': 'carbon' },
      React.createElement(Rack, { assetRecords: [], profile: { name: 'Upload verification' }, profileAddress: profile,
        systemWorkflowDraft: draft, menuSurface: 'carbon', phase: 'open', getWalletPublicationContext: () => wallet,
        onClose: () => window.__uploadState.closes++ })));
  }, { profile, account: UPLOAD_TEST_SIGNER.address });
  await page.getByRole('button', { name: 'Prepare publication', exact: true }).waitFor();
  return state;
}

for (const [scenario, width] of [['accepted', 1440], ['accepted', 390], ['refused', 1440], ['unconfigured', 390],
  ['invalid-profile', 390], ['profile-change', 1440], ['unmount', 1440], ['quota', 390], ['wrong-cid', 1440]]) {
  test(`publication upload ${scenario}, ${width}px`, { timeout: 60_000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 } }); page.setDefaultTimeout(10_000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const state = await fixture(page, scenario);
      const rack = page.getByRole('complementary', { name: 'Publish profile' });
      await page.getByRole('button', { name: 'Prepare publication', exact: true }).click();
      assert.equal(state.requests.length, 0, 'opening and preparing require no request or signature');
      assert.equal(await page.evaluate(() => window.__uploadState.signatures), 0);
      await page.getByRole('button', { name: 'Make presentation public', exact: true }).click();
      if (scenario === 'unconfigured') {
        await rack.getByRole('status').filter({ hasText: 'not configured' }).waitFor();
        assert.equal(await page.evaluate(() => window.__uploadState.signatures), 0);
      } else {
        await page.waitForFunction(() => window.__uploadState.signatures === 1);
        assert.equal(await page.getByRole('button', { name: 'Authorize upload…', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: 'Close Publication', exact: true }).isDisabled(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.__uploadState.closes), 0);
        assert.equal(state.uploads, 0);
        await mkdir(output, { recursive: true });
        if (scenario === 'accepted') await page.screenshot({ path: `${output}/authorization-${width}.png` });
        if (scenario === 'refused') await page.evaluate(() => window.__rejectUpload());
        else {
          if (scenario === 'profile-change') await page.evaluate(() => window.__uploadWallet.publicationContextGeneration++);
          if (scenario === 'unmount') await page.evaluate(() => window.__uploadRoot.unmount());
          await page.evaluate(() => window.__approveUpload());
        }
        if (scenario === 'accepted') {
          await page.getByRole('button', { name: 'Publish to profile', exact: true }).waitFor();
          assert.equal(state.uploads, 1);
          assert.equal(state.requests.length, 2);
        } else if (scenario !== 'unmount') {
          const text = { refused: 'authorization was not completed', 'invalid-profile': 'Universal Profile on LUKSO mainnet', 'profile-change': 'profile, wallet or presentation changed', quota: 'hourly upload limit', 'wrong-cid': 'CID verification failed' }[scenario];
          await rack.getByRole('status').filter({ hasText: text }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Publish to profile', exact: true }).count(), 0);
        } else {
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await rack.count(), 0);
        }
      }
      if (!['accepted', 'wrong-cid'].includes(scenario)) assert.equal(state.uploads, 0);
      if (['refused', 'unconfigured', 'profile-change', 'unmount'].includes(scenario)) assert.equal(state.requests.length, 1);
      if (scenario === 'invalid-profile') assert.equal(state.requests.length, 2);
      assert.equal(await page.evaluate(() => window.__uploadState.writes), 0, 'no chain write before a separate explicit Publish action');
      if (scenario !== 'unmount') {
        const box = await rack.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + .5 && box.y >= 0 && box.y + box.height <= 900.5);
        assert.equal(await rack.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
