import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import { buildProfileDocumentV3 } from './profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument, formatProfileDocumentJson } from './profileDocumentSerialization.js';
import { createCanonicalPublication, encodeProfileDocumentVerifiableUri, normalizeProfileDocumentCid } from './profileDocumentPublication.js';
import { createProfileDocumentPublisher, describePublicationError } from '../storage/profileDocumentPublisher.js';
import { OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';
import { PROFILE_DOCUMENT_LIMITS } from './constants.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

function documentFor(address = PROFILE_A) {
  return buildProfileDocumentV3({ profileAddress: address,
    workspace: { version: 3, profileAddress: address, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets: [], publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' },
    signalSettings: { notifications: true, speech: true, visualEffects: true, audio: false },
    profileIdentity: { name: 'Published profile' }, documentId: 'profile:publication', revision: 1, createdAt: 1, exportedAt: 2 });
}

function responseFor(bytes, headers) {
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }), { status: 200, headers });
}

function context(overrides = {}) {
  const walletClient = { account: '0x3333333333333333333333333333333333333333', writeContract: async () => '0xabc' };
  const publicClient = { simulateContract: async () => { throw new Error('Public RPC simulation must not be used'); }, waitForTransactionReceipt: async () => ({ status: 'success' }) };
  return { ownerAuthoringEnabled: true, isWalletConnected: true, isHostProfileOwner: true, chainId: '0x2a',
    hostProfileAddress: PROFILE_A, workspaceProfileAddress: PROFILE_A, provider: {}, walletClient, publicClient, ...overrides };
}

test('canonical publication download is the exact serializer output and never the formatted export', () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document);
  assert.deepEqual(artifact.bytes, new TextEncoder().encode(canonicalSerializeProfileDocument(document)));
  assert.notEqual(artifact.text, formatProfileDocumentJson(document));
  assert.equal(artifact.filename, 'os-underneath-published-profile-profile-v4-publication.json');
  assert.equal(Object.isFrozen(artifact.document), true); assert.equal(Object.isFrozen(artifact.document.profile), true);
});

test('bare and ipfs CID inputs normalize while URLs, paths, queries, schemes, and malformed CIDs fail', () => {
  assert.equal(normalizeProfileDocumentCid(CID), `ipfs://${CID}`);
  assert.equal(normalizeProfileDocumentCid(`ipfs://${CID}`), `ipfs://${CID}`);
  for (const value of [`https://gateway.test/ipfs/${CID}`, `${CID}/file.json`, `${CID}?x=1`, `ar://${CID}`, 'ipfs://not-a-cid', '']) {
    assert.throws(() => normalizeProfileDocumentCid(value));
  }
});

test('the frozen key value is an LSP2 VerifiableURI for the exact canonical-byte hash', () => {
  const artifact = createCanonicalPublication(documentFor());
  const encoded = encodeProfileDocumentVerifiableUri(CID, artifact.hash); const decoded = decodeDataSourceWithHash(encoded);
  assert.equal(decoded.url, `ipfs://${CID}`); assert.equal(decoded.verification.method, 'keccak256(bytes)'); assert.equal(decoded.verification.data, artifact.hash);
  assert.equal(OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, '0x4a5b4ddee4f353a47d88a0ad908a9ff0bee45f7d31158b2d79ddafd15817cb4e');
});

test('CID mismatch and stale, visitor, wrong-profile, or wrong-chain context block every wallet call', async () => {
  const document = documentFor(); const wrongBytes = new TextEncoder().encode(canonicalSerializeProfileDocument({ ...document, revision: 2 }));
  let live = context(); let walletCalls = 0;
  live.walletClient.writeContract = async () => { walletCalls += 1; return '0xabc'; };
  const mismatch = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => responseFor(wrongBytes) });
  await assert.rejects(() => mismatch.verifyCid(document, CID), /CID verification failed/);
  await assert.rejects(() => mismatch.verifyCid(document, CID, { stale: true }), /stale/);
  for (const invalid of [
    { ownerAuthoringEnabled: false, isHostProfileOwner: false }, { chainId: '0x1' },
    { workspaceProfileAddress: PROFILE_B }, { hostProfileAddress: PROFILE_B }
  ]) {
    live = context(invalid);
    await assert.rejects(() => mismatch.verifyCid(document, CID), /required|mainnet|must match/);
  }
  assert.equal(walletCalls, 0);
});

test('invalid, oversized, wrong-profile, and hash-mismatched gateway content never reaches a wallet', async () => {
  const document = documentFor(); let calls = 0; const live = context();
  live.walletClient.writeContract = async () => { calls += 1; return '0xabc'; };
  const cases = [
    new TextEncoder().encode('{invalid'),
    new Uint8Array(PROFILE_DOCUMENT_LIMITS.maxJsonBytes + 1),
    new TextEncoder().encode(canonicalSerializeProfileDocument(documentFor(PROFILE_B))),
    new TextEncoder().encode(canonicalSerializeProfileDocument({ ...document, revision: 2 }))
  ];
  for (const bytes of cases) {
    const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => responseFor(bytes) });
    await assert.rejects(() => publisher.verifyCid(document, CID));
  }
  assert.equal(calls, 0);
});

async function verifiedFixture({ mutateBeforeSubmission, walletError, receiptStatus = 'success', readBackDocument = documentFor() } = {}) {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let calls = 0; let simulations = 0; let readBacks = 0;
  let publishing = false; let publicationContextReads = 0;
  live.walletClient.writeContract = async (request) => {
    calls += 1; if (walletError) throw walletError;
    assert.equal(request.address, PROFILE_A); assert.equal(request.functionName, 'setData');
    assert.equal(request.account, live.walletClient.account); assert.equal(request.args[0], OS_UNDERNEATH_PROFILE_DOCUMENT_KEY);
    return '0xabc';
  };
  live.publicClient.simulateContract = async () => { simulations += 1; throw new Error('Public RPC simulation must not be used'); };
  live.publicClient.waitForTransactionReceipt = async () => ({ status: receiptStatus });
  const publisher = createProfileDocumentPublisher({ getContext: () => {
    if (publishing) {
      publicationContextReads += 1;
      if (publicationContextReads === 2 && mutateBeforeSubmission) live = mutateBeforeSubmission(live);
    }
    return live;
  }, ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => responseFor(artifact.bytes),
  resolvePublished: async () => { readBacks += 1; return { status: PUBLISHED_PROFILE_STATUS.RESOLVED, document: readBackDocument }; } });
  const verified = await publisher.verifyCid(document, CID);
  publishing = true;
  return { publisher, verified, calls: () => calls, simulations: () => simulations, readBacks: () => readBacks };
}

test('context changes immediately before provider submission block the wallet request', async () => {
  const fixture = await verifiedFixture({ mutateBeforeSubmission: (live) => ({ ...live, chainId: '0x1' }) });
  await assert.rejects(() => fixture.publisher.publish(fixture.verified), /mainnet/); assert.equal(fixture.calls(), 0);
});

test('provider context changes during CID verification are rejected', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let reads = 0;
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => {
    reads += 1; live = { ...live, provider: {} }; return responseFor(artifact.bytes);
  } });
  await assert.rejects(() => publisher.verifyCid(document, CID), /changed during CID verification/); assert.equal(reads, 1);
});

test('the provider-backed wallet receives one setData request and failures submit no duplicate', async () => {
  const rejected = await verifiedFixture({ walletError: new Error('User rejected request') });
  await assert.rejects(() => rejected.publisher.publish(rejected.verified), /rejected/);
  assert.equal(rejected.calls(), 1); assert.equal(rejected.simulations(), 0); assert.equal(rejected.readBacks(), 0);
  const reverted = await verifiedFixture({ receiptStatus: 'reverted' });
  await assert.rejects(() => reverted.publisher.publish(reverted.verified), /reverted/);
  assert.equal(reverted.calls(), 1); assert.equal(reverted.simulations(), 0); assert.equal(reverted.readBacks(), 0);
});

test('a successful receipt still requires matching resolver read-back', async () => {
  const mismatch = await verifiedFixture({ readBackDocument: documentFor(PROFILE_B) });
  await assert.rejects(() => mismatch.publisher.publish(mismatch.verified), /read-back/);
  assert.equal(mismatch.calls(), 1); assert.equal(mismatch.readBacks(), 1);
  await assert.rejects(() => mismatch.publisher.verifyPublication(mismatch.verified, '0xabc'), /read-back/);
  assert.equal(mismatch.calls(), 1, 'read-back retry does not submit another wallet request'); assert.equal(mismatch.readBacks(), 2);
  const success = await verifiedFixture();
  const result = await success.publisher.publish(success.verified);
  assert.equal(result.transactionHash, '0xabc'); assert.equal(result.receipt.status, 'success');
  assert.equal(success.calls(), 1); assert.equal(success.simulations(), 0); assert.equal(success.readBacks(), 1);
});

test('provider and LSP6 failures are decoded accurately', () => {
  assert.equal(describePublicationError({ code: 4001 }), 'Wallet request rejected by the user');
  const noPermissions = new Error('execution reverted');
  noPermissions.cause = { data: `0xf292052a${'0'.repeat(24)}${PROFILE_A.slice(2)}` };
  assert.equal(describePublicationError(noPermissions), `NoPermissionsSet: ${PROFILE_A} has no LSP6 permissions`);
  const notAllowed = new Error('execution reverted');
  notAllowed.cause = { data: `0x557ae079${'0'.repeat(24)}${PROFILE_A.slice(2)}${OS_UNDERNEATH_PROFILE_DOCUMENT_KEY.slice(2)}` };
  assert.equal(describePublicationError(notAllowed), `NotAllowedERC725YDataKey: ${PROFILE_A} cannot set ${OS_UNDERNEATH_PROFILE_DOCUMENT_KEY}`);
});

test('publication source contains no Pinata API, credential, SDK, upload call, or private-state dependency', () => {
  const files = ['../storage/profileDocumentPublisher.js', './profileDocumentPublication.js', '../state/useProfileDocumentPublication.js', '../components/ProfileDocumentPanel.jsx'];
  const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n').toLowerCase();
  for (const forbidden of ['pinata jwt', 'pinata api', '@pinata', 'uploadfile', 'use signalstore', 'runtimewindow', 'camera state']) assert.equal(source.includes(forbidden), false, forbidden);
});
