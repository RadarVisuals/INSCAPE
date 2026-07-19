import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { keccak256 } from 'viem';
import { normalizeProfileAddress } from '../../library/config.js';
import { canonicalSerializeProfileDocument, createProfileDocumentPublicationFilename } from './profileDocumentSerialization.js';

export const PROFILE_DOCUMENT_PUBLICATION_STATUS = Object.freeze({
  READY: 'READY', VERIFYING_CID: 'VERIFYING_CID', CID_VERIFIED: 'CID_VERIFIED',
  AWAITING_WALLET: 'AWAITING_WALLET', CONFIRMING_TRANSACTION: 'CONFIRMING_TRANSACTION',
  VERIFYING_PUBLICATION: 'VERIFYING_PUBLICATION', PUBLISHED: 'PUBLISHED', ERROR: 'ERROR'
});

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function decodeBase58(value) {
  let bytes = [0];
  for (const character of value) {
    const digit = BASE58.indexOf(character);
    if (digit < 0) return null;
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58; bytes[index] = carry & 255; carry >>= 8;
    }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  for (const character of value) { if (character !== '1') break; bytes.push(0); }
  return Uint8Array.from(bytes.reverse());
}

function decodeBase32(value) {
  let bits = 0; let buffer = 0; const bytes = [];
  for (const character of value.toLowerCase()) {
    const digit = BASE32.indexOf(character);
    if (digit < 0) return null;
    buffer = (buffer << 5) | digit; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); buffer &= (1 << bits) - 1; }
  }
  if (bits && buffer !== 0) return null;
  return Uint8Array.from(bytes);
}

function readVarint(bytes, offset) {
  let value = 0; let shift = 0;
  for (let index = offset; index < bytes.length && shift <= 49; index += 1) {
    const byte = bytes[index]; value += (byte & 127) * (2 ** shift);
    if (!(byte & 128)) return { value, offset: index + 1 };
    shift += 7;
  }
  return null;
}

function isValidCid(value) {
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/u.test(value)) {
    const bytes = decodeBase58(value);
    return bytes?.length === 34 && bytes[0] === 0x12 && bytes[1] === 0x20;
  }
  if (!/^[bB][a-zA-Z2-7]+$/u.test(value)) return false;
  const bytes = decodeBase32(value.slice(1));
  const version = bytes && readVarint(bytes, 0);
  const codec = version && readVarint(bytes, version.offset);
  const hashCode = codec && readVarint(bytes, codec.offset);
  const hashLength = hashCode && readVarint(bytes, hashCode.offset);
  return Boolean(version?.value === 1 && codec?.value > 0 && hashCode?.value > 0 && hashLength?.value > 0
    && hashLength.offset + hashLength.value === bytes.length);
}

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
  const document = deepFreeze(structuredClone(snapshot));
  const text = canonicalSerializeProfileDocument(document);
  const bytes = new TextEncoder().encode(text);
  return Object.freeze({ document, text, bytes, hash: keccak256(bytes), filename: createProfileDocumentPublicationFilename(document) });
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
