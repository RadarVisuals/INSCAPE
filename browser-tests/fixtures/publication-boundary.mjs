import { encodeAbiParameters } from 'viem';
import { createPinProfileDocumentHandler } from '../../netlify/functions/pin-profile-document.mjs';
import { memoryQuotaStore, uploadTestPolicy, uploadTestVerifier, UPLOAD_TEST_SIGNER } from '../../scripts/fixtures/publicationUpload.mjs';

export const boundaryProfile = `0x${'1'.repeat(40)}`;
export const otherBoundaryProfile = `0x${'2'.repeat(40)}`;
const cid = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const transactionHash = `0x${'a'.repeat(64)}`;

export async function mountPublicationBoundary(page, origin, pauseAt, menuSurface = 'mist') {
  let arrive, release, deliver;
  const reached = new Promise(resolve => { arrive = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const delivered = new Promise(resolve => { deliver = resolve; });
  const state = { bytes: '', value: '0x', uploads: 0, writes: 0, verifications: 0, reached, release, delivered };
  let paused = false;
  const pause = async phase => { if (phase === pauseAt && !paused) { paused = true; arrive(); await gate; } };
  const handler = createPinProfileDocumentHandler({ getJwt: () => 'fixture-only', getQuotaStore: () => memory,
    getPolicy: () => uploadTestPolicy(), verifySignature: uploadTestVerifier(boundaryProfile),
    fetchImpl: async (_url, init) => {
      state.uploads++; state.bytes = await init.body.get('file').text();
      await pause('upload');
      return Response.json({ data: { cid } });
    } });
  const memory = memoryQuotaStore();
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  await page.route('**/api/profile-publications**', async route => {
    const request = route.request();
    const response = await handler(new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postDataBuffer() }));
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    if (pauseAt === 'upload' && paused) deliver();
  });
  await page.route(`**/ipfs/${cid}`, async route => {
    state.verifications++; await pause('verify');
    await route.fulfill({ contentType: 'application/json', body: state.bytes });
    if (pauseAt === 'verify') deliver();
  });
  await page.route('https://rpc.mainnet.lukso.network/**', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: encodeAbiParameters([{ type: 'bytes' }], [state.value]) }) }));
  await page.exposeFunction('boundarySign', message => UPLOAD_TEST_SIGNER.signMessage({ message }));
  await page.exposeFunction('boundaryWrite', args => { state.writes++; state.value = args[1]; return transactionHash; });
  await page.exposeFunction('boundaryReceipt', async () => { await pause('receipt'); return { status: 'success', transactionHash }; });
  await page.route(`${origin}/__publication_boundary__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__publication_boundary__`);
  await page.evaluate(async ({ profile, signer, menuSurface }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Rack = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx')).default;
    const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
    await import('/src/index.css'); await import('/src/inscapeTokens.css');
    const probe = window.publicationBoundary = { saves: 0, confirmed: [], settled: false };
    const root = createRoot(document.getElementById('root'));
    const wallet = { isWalletConnected: true, isHostProfileOwner: true, hostProfileAddress: profile,
      chainId: 42, publicationContextGeneration: 1, provider: {},
      walletClient: { account: signer, signMessage: ({ message }) => window.boundarySign(message), writeContract: ({ args }) => window.boundaryWrite(args) },
      publicClient: { waitForTransactionReceipt: () => window.boundaryReceipt() } };
    let props = { profileAddress: profile, profile: { name: 'Original profile' }, assetRecords: [],
      systemWorkflowDraft: createEmptySystemWorkflowDraft(profile), menuSurface, phase: 'open',
      getWalletPublicationContext: () => wallet, onSaveWorkbench: () => { probe.saves++; return true; },
      onPublished: result => { probe.confirmed.push(result); }, onClose: () => root.render(null) };
    probe.render = () => root.render(React.createElement(Rack, { ...props, key: props.profileAddress }));
    probe.changeSnapshot = () => { props = { ...props, profile: { name: 'Changed profile' } }; probe.render(); };
    probe.changeProfile = address => {
      wallet.hostProfileAddress = address; wallet.publicationContextGeneration++;
      props = { ...props, profileAddress: address, systemWorkflowDraft: createEmptySystemWorkflowDraft(address) };
      probe.render();
    };
    probe.close = () => root.render(null);
    probe.render();
  }, { profile: boundaryProfile, signer: UPLOAD_TEST_SIGNER.address, menuSurface });
  await page.getByRole('button', { name: 'Prepare publication', exact: true }).waitFor();
  return state;
}
