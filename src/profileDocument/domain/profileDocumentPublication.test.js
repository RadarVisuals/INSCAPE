import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import { buildProfileDocumentV3, buildProfileDocumentV8 } from './profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument, formatProfileDocumentJson } from './profileDocumentSerialization.js';
import { canonicalPublicationHash, createCanonicalPublication, encodeProfileDocumentVerifiableUri, normalizeProfileDocumentCid, publicationContentFingerprint } from './profileDocumentPublication.js';
import { createProfileDocumentPublisher, describePublicationError } from '../storage/profileDocumentPublisher.js';
import { OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';
import { PROFILE_DOCUMENT_LIMITS, PROFILE_DOCUMENT_VERSION } from './constants.js';
import { createProfileDocumentPublicationState } from '../state/useProfileDocumentPublication.js';
import { createEmptyLatticeProductionDraft } from '../../lattice/domain/latticeProductionDraft.js';

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

function deferred() {
  let resolve; let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function context(overrides = {}) {
  const snapshot = documentFor();
  const walletClient = { account: '0x3333333333333333333333333333333333333333', writeContract: async () => '0xabc' };
  const publicClient = { simulateContract: async () => { throw new Error('Public RPC simulation must not be used'); }, waitForTransactionReceipt: async () => ({ status: 'success' }) };
  return { ownerAuthoringEnabled: true, isWalletConnected: true, isHostProfileOwner: true, chainId: '0x2a',
    hostProfileAddress: PROFILE_A, workspaceProfileAddress: PROFILE_A, viewedProfileAddress: PROFILE_A,
    provider: {}, walletClient, publicClient, publicationContextGeneration: 1,
    snapshotGeneration: 1, draftGeneration: 1, cidGeneration: 1, cidInput: CID,
    snapshotArtifactHash: canonicalPublicationHash(snapshot), snapshotContentFingerprint: publicationContentFingerprint(snapshot),
    draftFingerprint: publicationContentFingerprint(snapshot), snapshotStale: false, ...overrides };
}

test('canonical publication download is the exact serializer output and never the formatted export', () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document);
  assert.deepEqual(artifact.bytes, new TextEncoder().encode(canonicalSerializeProfileDocument(document)));
  assert.notEqual(artifact.text, formatProfileDocumentJson(document));
  assert.equal(artifact.filename, `os-underneath-published-profile-profile-v${PROFILE_DOCUMENT_VERSION}-publication.json`);
  assert.equal(Object.isFrozen(artifact.document), true); assert.equal(Object.isFrozen(artifact.document.profile), true);
});

test('readable v8 is rejected before publication context, CID fetch, or wallet access', async () => {
  const document = buildProfileDocumentV8({
    profileAddress: PROFILE_A,
    workspace: { version: 8, profileAddress: PROFILE_A, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets: [], publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' }, signalSettings: {},
    profileIdentity: { name: 'Readable only' }, createdAt: 1, exportedAt: 2,
    latticeDraft: createEmptyLatticeProductionDraft(PROFILE_A),
  });
  let contextReads = 0;
  let fetches = 0;
  const publisher = createProfileDocumentPublisher({
    getContext: () => { contextReads += 1; return context(); },
    fetchImpl: async () => { fetches += 1; },
  });
  await assert.rejects(() => publisher.verifyCid(document, CID), /not publishable/);
  assert.equal(contextReads, 0);
  assert.equal(fetches, 0);
});

test('closing and reopening publication creates a new unverified session', () => {
  const closed = createProfileDocumentPublicationState(); closed.verified = { unsafe: true };
  const reopened = createProfileDocumentPublicationState();
  assert.notStrictEqual(closed, reopened); assert.equal(reopened.status, 'READY'); assert.equal(reopened.verified, null);
  assert.equal(reopened.transactionHash, null);
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

test('an insecure snapshot is refused before publication context or wallet access', async () => {
  const document = documentFor(); document.profile.cachedIdentity.avatarUrl = 'http://images.example/avatar.png';
  let contextReads = 0; let walletCalls = 0;
  const live = context({ walletClient: { account: PROFILE_A, writeContract: async () => { walletCalls += 1; } } });
  const publisher = createProfileDocumentPublisher({ getContext: () => { contextReads += 1; return live; },
    ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => responseFor(new Uint8Array()) });
  await assert.rejects(() => publisher.verifyCid(document, CID), /Invalid cached public identity fallback/);
  assert.equal(contextReads, 0); assert.equal(walletCalls, 0);
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
      if (publicationContextReads === 1 && mutateBeforeSubmission) live = mutateBeforeSubmission(live);
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

test('provider generation changes during CID verification are rejected', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let reads = 0;
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => {
    reads += 1; live = { ...live, provider: {}, publicationContextGeneration: live.publicationContextGeneration + 1 }; return responseFor(artifact.bytes);
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

test('simultaneous mouse and keyboard activation shares one synchronous publication operation', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let calls = 0;
  const wallet = deferred();
  live.walletClient.writeContract = () => { calls += 1; return wallet.promise; };
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async () => responseFor(artifact.bytes),
    resolvePublished: async () => ({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, document }) });
  const verified = await publisher.verifyCid(document, CID);
  const mouseClick = publisher.publish(verified);
  const mouseDoubleClick = publisher.publish(verified);
  const keyboardActivation = publisher.publish(verified);
  assert.strictEqual(mouseClick, mouseDoubleClick); assert.strictEqual(mouseClick, keyboardActivation);
  assert.equal(calls, 1);
  wallet.resolve('0xabc');
  const [first, second, third] = await Promise.all([mouseClick, mouseDoubleClick, keyboardActivation]);
  assert.strictEqual(first, second); assert.strictEqual(first, third); assert.equal(first.transactionHash, '0xabc');
});

test('a different verified context is rejected while another request owns the lock', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let calls = 0;
  const wallet = deferred();
  live.walletClient.writeContract = () => { calls += 1; return wallet.promise; };
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async () => responseFor(artifact.bytes), resolvePublished: async () => ({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, document }) });
  const firstVerified = await publisher.verifyCid(document, CID);
  live = { ...live, publicationContextGeneration: 2 };
  const secondVerified = await publisher.verifyCid(document, CID);
  const active = publisher.publish(secondVerified);
  await assert.rejects(() => publisher.publish(firstVerified), /already being published/);
  assert.equal(calls, 1); wallet.resolve('0xabc'); await active;
});

test('wallet rejection and a pre-hash provider failure release the lock for one controlled retry', async () => {
  for (const failure of [Object.assign(new Error('Rejected'), { code: 4001 }), new Error('Provider unavailable before hash')]) {
    const document = documentFor(); const artifact = createCanonicalPublication(document); const live = context(); let calls = 0;
    live.walletClient.writeContract = async () => { calls += 1; if (calls === 1) throw failure; return '0xretry'; };
    const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
      fetchImpl: async () => responseFor(artifact.bytes), resolvePublished: async () => ({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, document }) });
    const verified = await publisher.verifyCid(document, CID);
    await assert.rejects(() => publisher.publish(verified));
    const result = await publisher.publish(verified);
    assert.equal(result.transactionHash, '0xretry'); assert.equal(calls, 2);
    if (failure.code === 4001) assert.equal(describePublicationError(failure), 'Wallet request rejected by the user');
  }
});

test('receipt and resolver retry after a hash never submit another wallet request', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); const live = context();
  let writes = 0; let receipts = 0; let reads = 0;
  live.walletClient.writeContract = async () => { writes += 1; return '0xsubmitted'; };
  live.publicClient.waitForTransactionReceipt = async () => { receipts += 1; if (receipts === 1) throw new Error('receipt timeout'); return { status: 'success' }; };
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async () => responseFor(artifact.bytes), resolvePublished: async () => {
      reads += 1; if (reads === 1) throw new Error('resolver unavailable');
      return { status: PUBLISHED_PROFILE_STATUS.RESOLVED, document };
    } });
  const verified = await publisher.verifyCid(document, CID);
  await assert.rejects(() => publisher.publish(verified), /receipt timeout/);
  await assert.rejects(() => publisher.publish(verified), /resolver unavailable/);
  const result = await publisher.publish(verified);
  assert.equal(result.transactionHash, '0xsubmitted'); assert.equal(writes, 1); assert.equal(receipts, 2); assert.equal(reads, 2);
});

test('Viem cancellation after a known hash is retained and can never trigger another wallet request', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); const live = context(); let writes = 0;
  live.walletClient.writeContract = async () => { writes += 1; return '0xsubmitted'; };
  live.publicClient.waitForTransactionReceipt = async ({ onReplaced }) => {
    onReplaced({ reason: 'cancelled', transaction: { hash: '0xcancelled' } });
    return { status: 'success' };
  };
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async () => responseFor(artifact.bytes), resolvePublished: async () => ({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, document }) });
  const verified = await publisher.verifyCid(document, CID);
  await assert.rejects(() => publisher.publish(verified), (error) => {
    assert.equal(error.replacementReason, 'cancelled'); assert.equal(error.transactionHash, '0xsubmitted'); return true;
  });
  await assert.rejects(() => publisher.publish(verified));
  assert.equal(writes, 1);
});

test('every publication identity binding invalidates a verified artifact before submission', async () => {
  const cases = [
    ['draft', (live) => ({ ...live, draftFingerprint: `${live.draftFingerprint}:edit`, draftGeneration: live.draftGeneration + 1, snapshotStale: true })],
    ['snapshot rebuild', (live) => ({ ...live, snapshotGeneration: live.snapshotGeneration + 1 })],
    ['snapshot replacement', (live) => ({ ...live, snapshotArtifactHash: `0x${'0'.repeat(64)}`, snapshotGeneration: live.snapshotGeneration + 1 })],
    ['CID edit and edit back', (live) => ({ ...live, cidGeneration: live.cidGeneration + 2 })],
    ['account', (live) => ({ ...live, walletClient: { ...live.walletClient, account: '0x4444444444444444444444444444444444444444' }, publicationContextGeneration: live.publicationContextGeneration + 1 })],
    ['chain', (live) => ({ ...live, chainId: '0x1', publicationContextGeneration: live.publicationContextGeneration + 1 })],
    ['provider/client generation', (live) => ({ ...live, provider: {}, walletClient: { ...live.walletClient }, publicClient: { ...live.publicClient }, publicationContextGeneration: live.publicationContextGeneration + 1 })],
    ['host', (live) => ({ ...live, hostProfileAddress: PROFILE_B, publicationContextGeneration: live.publicationContextGeneration + 1 })],
    ['workspace', (live) => ({ ...live, workspaceProfileAddress: PROFILE_B })],
    ['viewed profile', (live) => ({ ...live, viewedProfileAddress: PROFILE_B })],
    ['logout', (live) => ({ ...live, isWalletConnected: false, publicationContextGeneration: live.publicationContextGeneration + 1 })],
    ['owner authority', (live) => ({ ...live, ownerAuthoringEnabled: false, isHostProfileOwner: false, publicationContextGeneration: live.publicationContextGeneration + 1 })]
  ];
  for (const [name, mutate] of cases) {
    const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let writes = 0;
    live.walletClient.writeContract = async () => { writes += 1; return '0xforbidden'; };
    const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/', fetchImpl: async () => responseFor(artifact.bytes) });
    const verified = await publisher.verifyCid(document, CID); live = mutate(live);
    assert.equal(publisher.isFresh(verified), false, name);
    await assert.rejects(() => publisher.publish(verified), /changed|required|mainnet|match/);
    assert.equal(writes, 0, name);
  }
});

test('a draft change after provider invocation confirms only the frozen submitted artifact', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let writes = 0;
  const wallet = deferred();
  live.walletClient.writeContract = () => { writes += 1; return wallet.promise; };
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async () => responseFor(artifact.bytes), resolvePublished: async () => ({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, document }) });
  const verified = await publisher.verifyCid(document, CID); const pending = publisher.publish(verified);
  live = { ...live, draftFingerprint: `${live.draftFingerprint}:newer`, draftGeneration: 2, snapshotStale: true };
  wallet.resolve('0xold-artifact'); const result = await pending;
  assert.equal(writes, 1); assert.equal(result.transactionHash, '0xold-artifact');
  assert.equal(canonicalSerializeProfileDocument(result.result.document), artifact.text);
  assert.equal(publisher.isFresh(verified), false);
});

test('provider, account, and chain changes after the hash preserve the submitted record without resubmission', async () => {
  const document = documentFor(); const artifact = createCanonicalPublication(document); let live = context(); let writes = 0;
  const receipt = deferred();
  live.walletClient.writeContract = async () => { writes += 1; return '0xsubmitted-context'; };
  live.publicClient.waitForTransactionReceipt = () => receipt.promise;
  const publisher = createProfileDocumentPublisher({ getContext: () => live, ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async () => responseFor(artifact.bytes), resolvePublished: async () => ({ status: PUBLISHED_PROFILE_STATUS.RESOLVED, document }) });
  const verified = await publisher.verifyCid(document, CID); const pending = publisher.publish(verified);
  await Promise.resolve();
  live = context({ provider: {}, chainId: '0x1', walletClient: { account: PROFILE_B, writeContract: async () => { writes += 1; } },
    publicationContextGeneration: 2, ownerAuthoringEnabled: false, isHostProfileOwner: false });
  receipt.resolve({ status: 'success' });
  const first = await pending; const retry = await publisher.publish(verified);
  assert.equal(first.transactionHash, '0xsubmitted-context'); assert.equal(retry.transactionHash, '0xsubmitted-context');
  assert.equal(writes, 1); assert.equal(publisher.isFresh(verified), false);
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

test('browser publication source contains no Pinata endpoint, credential, SDK, or private-state dependency', () => {
  const files = ['../storage/profileDocumentPublisher.js', '../storage/profileDocumentUploadClient.js', './profileDocumentPublication.js', '../state/useProfileDocumentPublication.js', '../components/ProfileDocumentPanel.jsx'];
  const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n').toLowerCase();
  for (const forbidden of ['pinata_jwt', 'uploads.pinata.cloud', 'bearer ', '@pinata', 'use signalstore', 'runtimewindow', 'camera state']) assert.equal(source.includes(forbidden), false, forbidden);
});
