import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import { decodeFunctionResult, encodeFunctionData, keccak256 } from 'viem';
import { IPFS_GATEWAY_URL, LUKSO_RPC_URL, normalizeProfileAddress } from '../../library/config.js';
import { PROFILE_DOCUMENT_LIMITS } from '../domain/constants.js';
import { parseProfileDocumentJson } from '../domain/profileDocumentValidation.js';

export const OS_UNDERNEATH_PROFILE_DOCUMENT_KEY_NAME = 'OSUnderneathProfileDocument';
export const OS_UNDERNEATH_PROFILE_DOCUMENT_KEY = '0x4a5b4ddee4f353a47d88a0ad908a9ff0bee45f7d31158b2d79ddafd15817cb4e';
export const PUBLISHED_PROFILE_STATUS = Object.freeze({
  LOADING: 'LOADING', RESOLVED: 'RESOLVED', UNAVAILABLE: 'UNAVAILABLE', INVALID: 'INVALID', ERROR: 'ERROR', STALE: 'STALE'
});

const GET_DATA_ABI = [{ type: 'function', name: 'getData', stateMutability: 'view',
  inputs: [{ name: 'dataKey', type: 'bytes32' }], outputs: [{ name: 'dataValue', type: 'bytes' }] }];
const SUPPORTED_HASH_METHODS = new Set(['keccak256(bytes)', 'keccak256(utf8)']);

export class InvalidPublishedProfileError extends Error {
  constructor(code, message) { super(message); this.name = 'InvalidPublishedProfileError'; this.code = code; }
}

function invalid(code, message) { throw new InvalidPublishedProfileError(code, message); }
function throwIfAborted(signal) { if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError'); }

async function readErc725YValue(address, { rpcUrl, fetchImpl, signal }) {
  const response = await fetchImpl(rpcUrl, { method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: address,
      data: encodeFunctionData({ abi: GET_DATA_ABI, functionName: 'getData', args: [OS_UNDERNEATH_PROFILE_DOCUMENT_KEY] }) }, 'latest'] }) });
  if (!response.ok) throw new Error(`LUKSO RPC request failed (${response.status})`);
  const payload = await response.json();
  throwIfAborted(signal);
  if (payload?.error || typeof payload?.result !== 'string') throw new Error(payload?.error?.message || 'Invalid LUKSO RPC response');
  try { return decodeFunctionResult({ abi: GET_DATA_ABI, functionName: 'getData', data: payload.result }); }
  catch { throw new Error('Invalid ERC725Y response'); }
}

function resolvePublishedContentUrl(uri, gateway) {
  if (typeof uri !== 'string' || uri.length > 2048 || !/^ipfs:\/\//i.test(uri) || /[\u0000-\u001f\u007f\\]/u.test(uri)) {
    invalid('UNSAFE_URI', 'Published profile pointer must use a safe IPFS URI');
  }
  const path = uri.replace(/^ipfs:\/\/(ipfs\/)?/i, '').replace(/^\/+/, '');
  if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) invalid('UNSAFE_URI', 'Published profile IPFS path is invalid');
  const base = String(gateway || '').trim();
  if (!/^https:\/\//i.test(base)) invalid('UNSAFE_GATEWAY', 'The configured IPFS gateway must use HTTPS');
  return `${base.replace(/\/+$/, '')}/${path}`;
}

async function readLimitedBytes(response, limit, signal) {
  if (!response.ok) throw new Error(`Published profile gateway request failed (${response.status})`);
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) invalid('OVERSIZED_DOCUMENT', `Published profile exceeds ${limit} bytes`);
  if (!response.body?.getReader) throw new Error('Published profile response is not stream-readable');
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); invalid('OVERSIZED_DOCUMENT', `Published profile exceeds ${limit} bytes`); }
      chunks.push(value);
    }
  } finally { reader.releaseLock?.(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function decodePointer(value) {
  try {
    const pointer = decodeDataSourceWithHash(value);
    if (!pointer?.url || !SUPPORTED_HASH_METHODS.has(pointer?.verification?.method)
      || !/^0x[0-9a-f]{64}$/i.test(pointer?.verification?.data || '')) invalid('MALFORMED_POINTER', 'Published profile pointer has unsupported verification data');
    return pointer;
  } catch (error) {
    if (error instanceof InvalidPublishedProfileError) throw error;
    invalid('MALFORMED_POINTER', 'Published profile pointer is malformed');
  }
}

export function createLuksoPublishedProfileRepository({ rpcUrl = LUKSO_RPC_URL, ipfsGateway = IPFS_GATEWAY_URL,
  fetchImpl = globalThis.fetch, dataReader = null } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  return { source: 'LUKSO_MAINNET', async resolve(address, { signal } = {}) {
    const requestedAddress = normalizeProfileAddress(address);
    if (!requestedAddress) throw new TypeError('A valid Universal Profile address is required');
    throwIfAborted(signal);
    const value = await (dataReader || readErc725YValue)(requestedAddress, { rpcUrl, fetchImpl, signal });
    throwIfAborted(signal);
    if (!value || /^0x0*$/i.test(value)) return { status: PUBLISHED_PROFILE_STATUS.UNAVAILABLE, address: requestedAddress, document: null };
    let pointer;
    try { pointer = decodePointer(value); } catch (error) { return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null, errorCode: error.code }; }
    let contentUrl;
    try { contentUrl = resolvePublishedContentUrl(pointer.url, ipfsGateway); }
    catch (error) { return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null, errorCode: error.code }; }
    let bytes;
    try {
      const response = await fetchImpl(contentUrl, { method: 'GET', signal, headers: { accept: 'application/json' } });
      bytes = await readLimitedBytes(response, PROFILE_DOCUMENT_LIMITS.maxJsonBytes, signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (error instanceof InvalidPublishedProfileError) return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null, errorCode: error.code };
      throw error;
    }
    if (keccak256(bytes).toLowerCase() !== pointer.verification.data.toLowerCase()) {
      return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null, errorCode: 'HASH_MISMATCH' };
    }
    try {
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const document = parseProfileDocumentJson(raw);
      if (normalizeProfileAddress(document.profile.address) !== requestedAddress) invalid('PROFILE_MISMATCH', 'Published profile address does not match its authority');
      return { status: PUBLISHED_PROFILE_STATUS.RESOLVED, address: requestedAddress, document, pointer };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null,
        errorCode: error instanceof InvalidPublishedProfileError ? error.code : 'INVALID_DOCUMENT' };
    }
  } };
}

export const luksoPublishedProfileRepository = createLuksoPublishedProfileRepository();
