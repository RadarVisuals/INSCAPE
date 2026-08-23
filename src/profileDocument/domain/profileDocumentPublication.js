import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { keccak256 } from 'viem';
import { normalizeProfileAddress } from '../../library/config.js';
import { isValidCid } from './cidValidation.js';
import {
  canonicalSerializeProfileDocumentV9,
  createProfileDocumentV9Filename,
  profileDocumentV9ContentFingerprint,
} from './profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';

export const PROFILE_DOCUMENT_PUBLICATION_STATUS = Object.freeze({
  READY: 'READY', VERIFYING_CID: 'VERIFYING_CID', CID_VERIFIED: 'CID_VERIFIED',
  AWAITING_WALLET: 'AWAITING_WALLET', CONFIRMING_TRANSACTION: 'CONFIRMING_TRANSACTION',
  VERIFYING_PUBLICATION: 'VERIFYING_PUBLICATION', PUBLISHED: 'PUBLISHED', STALE: 'STALE', ERROR: 'ERROR'
});

export function normalizeProfileDocumentCid(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 200 || /[\s\\/?#]/u.test(raw.replace(/^ipfs:\/\//i, ''))) throw new Error('Enter a bare IPFS CID or ipfs://CID with no path, query, or fragment');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^ipfs:\/\//i.test(raw)) throw new Error('Only a bare IPFS CID or ipfs://CID is allowed');
  const cid = raw.replace(/^ipfs:\/\//i, '');
  if (cid === raw && raw.includes(':')) throw new Error('Only IPFS CIDs are allowed');
  if (!isValidCid(cid)) throw new Error('The IPFS CID is malformed or unsupported');
  return `ipfs://${cid.startsWith('B') ? `b${cid.slice(1).toLowerCase()}` : cid}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createCanonicalPublication(snapshot) {
  const document = deepFreeze(assertValidProfileDocumentV9(snapshot));
  const text = canonicalSerializeProfileDocumentV9(document);
  const bytes = new TextEncoder().encode(text);
  return Object.freeze({ document, text, bytes, hash: keccak256(bytes), filename: createProfileDocumentV9Filename(document) });
}

export function canonicalPublicationHash(snapshot) {
  return keccak256(new TextEncoder().encode(canonicalSerializeProfileDocumentV9(snapshot)));
}

export function publicationContentFingerprint(document) {
  return keccak256(new TextEncoder().encode(profileDocumentV9ContentFingerprint(document)));
}

export function encodeProfileDocumentVerifiableUri(ipfsUri, hash) {
  const uri = normalizeProfileDocumentCid(ipfsUri);
  if (!/^0x[0-9a-f]{64}$/iu.test(hash || '')) throw new Error('A canonical keccak256 hash is required');
  return encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: hash }, uri);
}

function chainNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^0x[0-9a-f]+$/iu.test(value)) return Number.parseInt(value, 16);
  return Number(value);
}

export function assertPublicationContext(context, artifact, { requireClients = false } = {}) {
  const host = normalizeProfileAddress(context?.hostProfileAddress);
  const workspace = normalizeProfileAddress(context?.workspaceProfileAddress);
  const snapshot = normalizeProfileAddress(artifact?.document?.profile?.address);
  if (!context?.ownerAuthoringEnabled || !context?.isWalletConnected || !context?.isHostProfileOwner) throw new Error('Verified owner authoring is required to publish');
  if (chainNumber(context?.chainId) !== 42) throw new Error('Publication requires LUKSO mainnet (chain 42)');
  if (!host || host !== workspace || host !== snapshot) throw new Error('Verified host, workspace, and snapshot profile addresses must match');
  if (requireClients && (!context?.walletClient || !context?.publicClient || !context?.provider)) throw new Error('The connected wallet/provider context is unavailable');
  return host;
}
