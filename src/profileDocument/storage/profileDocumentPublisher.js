import { canonicalSerializeProfileDocument } from '../domain/profileDocumentSerialization.js';
import { assertPublicationContext, createCanonicalPublication, encodeProfileDocumentVerifiableUri, normalizeProfileDocumentCid } from '../domain/profileDocumentPublication.js';
import { createLuksoPublishedProfileRepository, OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, PUBLISHED_PROFILE_STATUS } from './luksoPublishedProfileRepository.js';
import { PROFILE_DOCUMENT_IPFS_GATEWAY_URL } from '../../library/config.js';
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

function sameConnectedContext(left, right) {
  return left?.walletClient === right?.walletClient && left?.publicClient === right?.publicClient && left?.provider === right?.provider
    && String(left?.walletClient?.account?.address || left?.walletClient?.account || '').toLowerCase()
      === String(right?.walletClient?.account?.address || right?.walletClient?.account || '').toLowerCase();
}

export function createProfileDocumentPublisher({ getContext, fetchImpl = globalThis.fetch,
  ipfsGateway = PROFILE_DOCUMENT_IPFS_GATEWAY_URL, resolvePublished, onStatus = () => {} } = {}) {
  if (typeof getContext !== 'function') throw new TypeError('A live publication context is required');
  const readBack = resolvePublished || createLuksoPublishedProfileRepository({ fetchImpl, ipfsGateway }).resolve;
  const verifyPublication = async (verified, transactionHash) => {
    const address = assertPublicationContext(getContext(), verified.artifact, { requireClients: true });
    onStatus('VERIFYING_PUBLICATION', verified, transactionHash);
    const result = await readBack(address);
    if (result.status !== PUBLISHED_PROFILE_STATUS.RESOLVED || !matchesArtifact(result.document, verified.artifact)) {
      throw new Error('On-chain publication read-back did not match the frozen snapshot');
    }
    onStatus('PUBLISHED', verified, transactionHash);
    return result;
  };

  return {
    async verifyCid(snapshot, cidInput, { stale = false } = {}) {
      const artifact = createCanonicalPublication(snapshot);
      if (stale) throw new Error('Rebuild the stale snapshot before publication');
      const initialContext = getContext();
      assertPublicationContext(initialContext, artifact, { requireClients: true });
      const uri = normalizeProfileDocumentCid(cidInput);
      const value = encodeProfileDocumentVerifiableUri(uri, artifact.hash);
      onStatus('VERIFYING_CID');
      const repository = createLuksoPublishedProfileRepository({ fetchImpl, ipfsGateway, dataReader: async () => value });
      const result = await repository.resolve(artifact.document.profile.address);
      const currentContext = getContext();
      assertPublicationContext(currentContext, artifact, { requireClients: true });
      if (!sameConnectedContext(initialContext, currentContext)) throw new Error('Wallet/provider context changed during CID verification');
      if (result.status !== PUBLISHED_PROFILE_STATUS.RESOLVED || !matchesArtifact(result.document, artifact)) {
        throw new Error(`CID verification failed${result.errorCode ? `: ${result.errorCode}` : ''}`);
      }
      const verified = Object.freeze({ artifact, uri, value });
      onStatus('CID_VERIFIED', verified);
      return verified;
    },

    async publish(verified) {
      if (!verified?.artifact || !verified?.value) throw new Error('Verify the CID before requesting publication');
      const context = getContext(); const address = assertPublicationContext(context, verified.artifact, { requireClients: true });
      const call = { address, abi: SET_PROFILE_DOCUMENT_ABI, functionName: 'setData',
        args: [OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, verified.value], account: context.walletClient.account };
      const current = getContext();
      assertPublicationContext(current, verified.artifact, { requireClients: true });
      if (!sameConnectedContext(context, current)) {
        throw new Error('Wallet/provider context changed before transaction submission');
      }
      onStatus('AWAITING_WALLET', verified);
      // UP Provider exposes the connected Universal Profile as the account and privately
      // selects its authorised controller during eth_sendTransaction. A public RPC
      // simulation with the UP as `from` bypasses that flow and is therefore invalid.
      const transactionHash = await current.walletClient.writeContract(call);
      onStatus('CONFIRMING_TRANSACTION', verified, transactionHash);
      const receipt = await current.publicClient.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt?.status !== 'success') throw new Error('The publication transaction reverted');
      const result = await verifyPublication(verified, transactionHash);
      return { transactionHash, receipt, result };
    },
    verifyPublication
  };
}
