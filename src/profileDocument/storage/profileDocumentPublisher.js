import { canonicalSerializeProfileDocument } from '../domain/profileDocumentSerialization.js';
import { assertPublicationContext, createCanonicalPublication, encodeProfileDocumentVerifiableUri, normalizeProfileDocumentCid, publicationContentFingerprint } from '../domain/profileDocumentPublication.js';
import { createLuksoPublishedProfileRepository, OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, PUBLISHED_PROFILE_STATUS } from './luksoPublishedProfileRepository.js';
import { PROFILE_DOCUMENT_IPFS_GATEWAY_URL, normalizeProfileAddress } from '../../library/config.js';
import { decodeErrorResult, keccak256 } from 'viem';

const PUBLICATION_ERROR_ABI = [
  { type: 'error', name: 'NoPermissionsSet', inputs: [{ name: 'from', type: 'address' }] },
  { type: 'error', name: 'NotAllowedERC725YDataKey', inputs: [{ name: 'from', type: 'address' }, { name: 'disallowedKey', type: 'bytes32' }] }
];
export const SET_PROFILE_DOCUMENT_ABI = [
  { type: 'function', name: 'setData', stateMutability: 'payable', inputs: [{ name: 'dataKey', type: 'bytes32' }, { name: 'dataValue', type: 'bytes' }], outputs: [] },
  ...PUBLICATION_ERROR_ABI
];

export function describePublicationError(error) {
  let current = error; let rawData = null; let decoded = null;
  for (let depth = 0; current && depth < 10; depth += 1, current = current.cause) {
    if (current.code === 4001) return 'Wallet request rejected by the user';
    if (current.data?.errorName) decoded = current.data;
    if (typeof current.data === 'string' && /^0x[0-9a-f]+$/iu.test(current.data)) rawData = current.data;
  }
  if (!decoded && rawData) {
    try { decoded = decodeErrorResult({ abi: PUBLICATION_ERROR_ABI, data: rawData }); } catch { /* Unknown contract error. */ }
  }
  if (decoded?.errorName === 'NoPermissionsSet') return `NoPermissionsSet: ${decoded.args?.[0] || 'the sender'} has no LSP6 permissions`;
  if (decoded?.errorName === 'NotAllowedERC725YDataKey') {
    return `NotAllowedERC725YDataKey: ${decoded.args?.[0] || 'the sender'} cannot set ${decoded.args?.[1] || 'this ERC725Y key'}`;
  }
  return error?.shortMessage || error?.message || String(error);
}

function matchesArtifact(document, artifact) {
  return keccak256(new TextEncoder().encode(canonicalSerializeProfileDocument(document))).toLowerCase() === artifact.hash.toLowerCase();
}

function accountAddress(context) {
  return String(context?.walletClient?.account?.address || context?.walletClient?.account || context?.connectedAccountAddress || '').toLowerCase();
}

function bindingFrom(context, artifact, uri) {
  const generation = context?.publicationContextGeneration;
  if (!Number.isSafeInteger(generation) || generation < 0) throw new Error('A stable wallet/provider context generation is required');
  if (!Number.isSafeInteger(context?.snapshotGeneration) || context.snapshotGeneration < 0) throw new Error('A stable snapshot generation is required');
  if (!Number.isSafeInteger(context?.draftGeneration) || context.draftGeneration < 0) throw new Error('A stable draft generation is required');
  if (!Number.isSafeInteger(context?.cidGeneration) || context.cidGeneration < 0) throw new Error('A stable CID generation is required');
  const snapshotContentFingerprint = publicationContentFingerprint(artifact.document);
  const viewedProfileAddress = normalizeProfileAddress(context?.viewedProfileAddress);
  const hostProfileAddress = normalizeProfileAddress(context?.hostProfileAddress);
  const workspaceProfileAddress = normalizeProfileAddress(context?.workspaceProfileAddress);
  if (!viewedProfileAddress) throw new Error('A stable viewed-profile identity is required');
  const connectedAccountAddress = normalizeProfileAddress(accountAddress(context));
  if (!connectedAccountAddress) throw new Error('A stable connected-account identity is required');
  return Object.freeze({
    artifactHash: artifact.hash.toLowerCase(), uri, snapshotContentFingerprint,
    draftFingerprint: String(context?.draftFingerprint || ''),
    snapshotGeneration: context.snapshotGeneration, draftGeneration: context.draftGeneration,
    cidGeneration: context.cidGeneration, publicationContextGeneration: generation,
    hostProfileAddress, workspaceProfileAddress, viewedProfileAddress,
    connectedAccountAddress, chainId: Number(context.chainId),
    verifiedOwnerAuthority: Boolean(context.ownerAuthoringEnabled && context.isHostProfileOwner)
  });
}

function bindingIdentity(binding) {
  return JSON.stringify(binding);
}

function assertFreshBinding(context, verified) {
  assertPublicationContext(context, verified.artifact, { requireClients: true });
  const currentUri = normalizeProfileDocumentCid(context.cidInput);
  const current = bindingFrom(context, verified.artifact, currentUri);
  const expected = verified.binding;
  if (!expected || bindingIdentity(current) !== bindingIdentity(expected)
    || String(context.snapshotArtifactHash || '').toLowerCase() !== expected.artifactHash
    || String(context.snapshotContentFingerprint || '') !== expected.snapshotContentFingerprint
    || context.snapshotStale === true) {
    throw new Error('The verified snapshot, CID, draft, or wallet context changed; re-verification is required');
  }
  return context;
}

export function createProfileDocumentPublisher({ getContext, fetchImpl = globalThis.fetch,
  ipfsGateway = PROFILE_DOCUMENT_IPFS_GATEWAY_URL, resolvePublished, onStatus = () => {} } = {}) {
  if (typeof getContext !== 'function') throw new TypeError('A live publication context is required');
  const readBack = resolvePublished || createLuksoPublishedProfileRepository({ fetchImpl, ipfsGateway }).resolve;
  let active = null;
  const submitted = new Map();

  const verifyPublication = async (verified, transactionHash) => {
    const address = normalizeProfileAddress(verified?.artifact?.document?.profile?.address);
    if (!address) throw new Error('The submitted artifact profile is invalid');
    onStatus('VERIFYING_PUBLICATION', verified, transactionHash);
    const result = await readBack(address);
    if (result.status !== PUBLISHED_PROFILE_STATUS.RESOLVED || !matchesArtifact(result.document, verified.artifact)) {
      throw new Error('On-chain publication read-back did not match the frozen snapshot');
    }
    onStatus('PUBLISHED', verified, transactionHash);
    return result;
  };

  const confirmSubmitted = async (record) => {
    if (!record.receipt) {
      onStatus('CONFIRMING_TRANSACTION', record.verified, record.transactionHash);
      const receipt = await record.publicClient.waitForTransactionReceipt({ hash: record.transactionHash });
      if (receipt?.status !== 'success') throw new Error('The publication transaction reverted');
      record.receipt = receipt;
    }
    if (!record.result) record.result = await verifyPublication(record.verified, record.transactionHash);
    return { transactionHash: record.transactionHash, receipt: record.receipt, result: record.result };
  };

  const runLocked = (identity, operation) => {
    let resolve; let reject;
    const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
    active = { identity, promise };
    const release = () => { if (active?.promise === promise) active = null; };
    operation().then((value) => { release(); resolve(value); }, (error) => { release(); reject(error); });
    return promise;
  };

  return {
    async verifyCid(snapshot, cidInput, { stale = false } = {}) {
      const artifact = createCanonicalPublication(snapshot);
      if (stale) throw new Error('Rebuild the stale snapshot before publication');
      const uri = normalizeProfileDocumentCid(cidInput);
      const initialContext = getContext();
      assertPublicationContext(initialContext, artifact, { requireClients: true });
      const initialBinding = bindingFrom(initialContext, artifact, uri);
      if (String(initialContext.snapshotArtifactHash || '').toLowerCase() !== artifact.hash.toLowerCase()
        || initialContext.snapshotStale === true) throw new Error('Rebuild the stale snapshot before publication');
      const value = encodeProfileDocumentVerifiableUri(uri, artifact.hash);
      onStatus('VERIFYING_CID');
      const repository = createLuksoPublishedProfileRepository({ fetchImpl, ipfsGateway, dataReader: async () => value });
      const result = await repository.resolve(artifact.document.profile.address);
      const currentContext = getContext();
      assertPublicationContext(currentContext, artifact, { requireClients: true });
      const currentBinding = bindingFrom(currentContext, artifact, uri);
      if (bindingIdentity(initialBinding) !== bindingIdentity(currentBinding)) throw new Error('Snapshot, CID, or wallet context changed during CID verification');
      if (String(currentContext.snapshotArtifactHash || '').toLowerCase() !== artifact.hash.toLowerCase()
        || String(currentContext.snapshotContentFingerprint || '') !== initialBinding.snapshotContentFingerprint
        || currentContext.snapshotStale === true) throw new Error('Snapshot changed during CID verification');
      if (result.status !== PUBLISHED_PROFILE_STATUS.RESOLVED || !matchesArtifact(result.document, artifact)) {
        throw new Error(`CID verification failed${result.errorCode ? `: ${result.errorCode}` : ''}`);
      }
      const verified = Object.freeze({ artifact, uri, value, binding: initialBinding, identity: bindingIdentity(initialBinding) });
      onStatus('CID_VERIFIED', verified);
      return verified;
    },

    isFresh(verified) {
      try { assertFreshBinding(getContext(), verified); return true; } catch { return false; }
    },

    publish(verified) {
      if (!verified?.artifact || !verified?.value || !verified?.identity) return Promise.reject(new Error('Verify the CID before requesting publication'));
      const identity = verified.identity;
      if (active) {
        if (active.identity === identity) return active.promise;
        return Promise.reject(new Error('Another artifact or wallet context is already being published'));
      }
      const existing = submitted.get(identity);
      if (existing) return runLocked(identity, () => confirmSubmitted(existing));

      // The lock exists before this operation begins. The final freshness check and
      // provider-backed write invocation are synchronous and adjacent: invocation is
      // the irreversible submission boundary because UP Provider offers no cancellation.
      return runLocked(identity, async () => {
        onStatus('AWAITING_WALLET', verified);
        const current = assertFreshBinding(getContext(), verified);
        const address = normalizeProfileAddress(verified.artifact.document.profile.address);
        const call = { address, abi: SET_PROFILE_DOCUMENT_ABI, functionName: 'setData',
          args: [OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, verified.value], account: current.walletClient.account };
        const transactionHash = await current.walletClient.writeContract(call);
        const record = { verified, transactionHash, publicClient: current.publicClient, receipt: null, result: null };
        submitted.set(identity, record);
        return confirmSubmitted(record);
      });
    },
    verifyPublication
  };
}
