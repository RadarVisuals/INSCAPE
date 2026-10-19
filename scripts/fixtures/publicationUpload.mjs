import { recoverAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { LSP0_ERC165_INTERFACE_ID } from '../../src/library/config.js';
import { createCanonicalPublication } from '../../src/profileDocument/domain/profileDocumentPublication.js';
import { createUploadChallenge, createProfileSignatureVerifier, readUploadPolicy } from '../../netlify/lib/publicationUploadAuth.mjs';

export const UPLOAD_TEST_ORIGIN = 'https://inscape.example';
export const UPLOAD_TEST_NOW = Date.parse('2026-10-19T12:00:00Z');
export const UPLOAD_TEST_SIGNER = privateKeyToAccount(`0x${'1'.repeat(64)}`); // Synthetic fixture only.
export const UPLOAD_TEST_SIGNATURE = `0x${'a'.repeat(130)}`;
export function uploadTestPolicy(overrides = {}) {
  return { ...readUploadPolicy({ INSCAPE_UPLOAD_AUTH_SECRET: '2'.repeat(64) }), ...overrides };
}
export function memoryQuotaStore() {
  const records = new Map(); let revision = 0;
  return { records,
    async getWithMetadata(key) { return structuredClone(records.get(key) || null); },
    async setJSON(key, data, conditions) {
      const current = records.get(key);
      if ((conditions.onlyIfNew && current) || (conditions.onlyIfMatch && current?.etag !== conditions.onlyIfMatch)) return { modified: false };
      const etag = `"${++revision}"`; records.set(key, { data: structuredClone(data), etag });
      return { modified: true, etag };
    },
  };
}
export function uploadTestVerifier(profile, { chain = 42, authorized = true, lsp0 = true, erc165 = true, invalidInterface = false } = {}) {
  return createProfileSignatureVerifier({ client: {
    getChainId: async () => chain,
    readContract: async call => {
      if (call.address !== profile) throw Error('Wrong verification scope');
      if (call.functionName === 'supportsInterface') {
        const values = { '0x01ffc9a7': erc165, '0xffffffff': invalidInterface, [LSP0_ERC165_INTERFACE_ID]: lsp0 };
        if (!(call.args[0] in values)) throw Error('Unexpected interface check');
        return values[call.args[0]];
      }
      if (call.functionName !== 'isValidSignature') throw Error('Wrong verification scope');
      const signer = await recoverAddress({ hash: call.args[0], signature: call.args[1] });
      return authorized && signer === UPLOAD_TEST_SIGNER.address ? '0x1626ba7e' : '0xffffffff';
    },
  } });
}
export function uploadTestContext(document, overrides = {}) {
  return { ownerAuthoringEnabled: true, isWalletConnected: true, isHostProfileOwner: true, chainId: 42,
    hostProfileAddress: document.profile.address, workspaceProfileAddress: document.profile.address, viewedProfileAddress: document.profile.address,
    provider: {}, publicClient: {}, publicationContextGeneration: 1, snapshotGeneration: 1, draftGeneration: 1,
    snapshotArtifactHash: createCanonicalPublication(document).hash, snapshotStale: false, draftFingerprint: 'current-draft',
    walletClient: { account: UPLOAD_TEST_SIGNER.address, signMessage: ({ message }) => UPLOAD_TEST_SIGNER.signMessage({ message }) }, ...overrides };
}
export function uploadTestChallenge(document, options = {}) {
  const artifact = createCanonicalPublication(document);
  return createUploadChallenge({ profile: document.profile.address, hash: artifact.hash, bytes: artifact.bytes.byteLength,
    origin: UPLOAD_TEST_ORIGIN, policy: uploadTestPolicy(), now: UPLOAD_TEST_NOW, ...options });
}
export function uploadRequest(document, challenge, signature, origin = UPLOAD_TEST_ORIGIN) {
  return new Request(`${origin}/api/profile-publications`, { method: 'POST', headers: {
    origin, 'content-type': 'application/json',
    ...(challenge ? { 'x-inscape-upload-authorization': challenge.authorization, 'x-inscape-upload-signature': signature } : {}),
  }, body: createCanonicalPublication(document).text });
}
