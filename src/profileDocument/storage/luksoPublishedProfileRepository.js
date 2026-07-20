import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import { decodeFunctionResult, encodeFunctionData, keccak256 } from 'viem';
import { LUKSO_RPC_FALLBACK_URLS, LUKSO_RPC_URL, normalizeProfileAddress,
  PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS, PROFILE_DOCUMENT_IPFS_GATEWAY_URL } from '../../library/config.js';
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
export const PUBLISHED_PROFILE_TIMEOUTS = Object.freeze({
  rpcResponseMs: 12_000,
  gatewayResponseMs: 15_000,
  documentReadMs: 20_000
});

export class InvalidPublishedProfileError extends Error {
  constructor(code, message) { super(message); this.name = 'InvalidPublishedProfileError'; this.code = code; }
}

export class PublishedProfileAvailabilityError extends Error {
  constructor(code, endpointClass) {
    super(`${endpointClass} endpoint unavailable`); this.name = 'PublishedProfileAvailabilityError';
    this.code = code; this.endpointClass = endpointClass;
  }
}

function invalid(code, message) { throw new InvalidPublishedProfileError(code, message); }
function abortError() { return new DOMException('The operation was aborted', 'AbortError'); }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }

function endpointList(primary, fallbacks, kind) {
  const raw = [primary, ...(Array.isArray(fallbacks) ? fallbacks : String(fallbacks || '').split(/[\n,]/u))];
  const seen = new Set(); const endpoints = [];
  for (const item of raw) {
    const value = String(item || '').trim(); if (!value) continue;
    let parsed;
    try { parsed = new URL(value); } catch { invalid(`UNSAFE_${kind}`, `Configured ${kind.toLowerCase()} endpoint is invalid`); }
    if (parsed.protocol !== 'https:') invalid(`UNSAFE_${kind}`, `Configured ${kind.toLowerCase()} endpoint must use HTTPS`);
    if (parsed.username || parsed.password) invalid(`UNSAFE_${kind}`, `Configured ${kind.toLowerCase()} endpoint must not contain credentials`);
    parsed.hash = ''; parsed.pathname = parsed.pathname.replace(/\/+$/u, '') || '/';
    const normalized = `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}`;
    if (!seen.has(normalized)) { seen.add(normalized); endpoints.push(normalized); }
  }
  if (!endpoints.length) invalid(`UNSAFE_${kind}`, `At least one HTTPS ${kind.toLowerCase()} endpoint is required`);
  return endpoints;
}

async function boundedOperation(operation, { callerSignal, timeoutMs, timeoutCode, endpointClass, onTimeout }) {
  throwIfAborted(callerSignal);
  const controller = new AbortController(); let timedOut = false; let timer;
  let rejectCallerAbort;
  const callerAbort = new Promise((_, reject) => { rejectCallerAbort = reject; });
  const abortFromCaller = () => { controller.abort(callerSignal?.reason); rejectCallerAbort(abortError()); };
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true; controller.abort(); onTimeout?.();
      reject(new PublishedProfileAvailabilityError(timeoutCode, endpointClass));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout, callerAbort]);
  } catch (error) {
    if (callerSignal?.aborted) throw abortError();
    if (timedOut) throw new PublishedProfileAvailabilityError(timeoutCode, endpointClass);
    throw error;
  } finally {
    clearTimeout(timer); callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

async function readErc725YValue(address, { rpcUrl, fetchImpl, signal }) {
  const response = await fetchImpl(rpcUrl, { method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: address,
      data: encodeFunctionData({ abi: GET_DATA_ABI, functionName: 'getData', args: [OS_UNDERNEATH_PROFILE_DOCUMENT_KEY] }) }, 'latest'] }) });
  if (!response.ok) throw new Error(`LUKSO RPC request failed (${response.status})`);
  let payload; try { payload = await response.json(); } catch { throw new Error('Malformed LUKSO RPC response'); }
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
  const target = new URL(gateway); target.pathname = `${target.pathname.replace(/\/+$/u, '')}/${path}`;
  return target.toString();
}

async function readLimitedBytes(response, limit, signal) {
  if (!response.ok) throw new Error(`Published profile gateway request failed (${response.status})`);
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    await response.body?.cancel?.().catch?.(() => {});
    invalid('OVERSIZED_DOCUMENT', `Published profile exceeds ${limit} bytes`);
  }
  if (!response.body?.getReader) throw new Error('Published profile response is not stream-readable');
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  const cancelReader = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancelReader, { once: true });
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); invalid('OVERSIZED_DOCUMENT', `Published profile exceeds ${limit} bytes`); }
      chunks.push(value);
    }
  } finally { signal?.removeEventListener('abort', cancelReader); reader.releaseLock?.(); }
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

function availabilityCode(error, fallback) {
  return error instanceof PublishedProfileAvailabilityError ? error.code : fallback;
}

export function createLuksoPublishedProfileRepository({ rpcUrl = LUKSO_RPC_URL, rpcFallbackUrls = LUKSO_RPC_FALLBACK_URLS,
  ipfsGateway = PROFILE_DOCUMENT_IPFS_GATEWAY_URL, ipfsGatewayFallbackUrls = PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS,
  fetchImpl = globalThis.fetch, dataReader = null, timeouts = PUBLISHED_PROFILE_TIMEOUTS } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  const timeoutPolicy = { ...PUBLISHED_PROFILE_TIMEOUTS, ...timeouts };
  const rpcEndpoints = endpointList(rpcUrl, rpcFallbackUrls, 'RPC');
  const gatewayEndpoints = endpointList(ipfsGateway, ipfsGatewayFallbackUrls, 'GATEWAY');
  return { source: 'LUKSO_MAINNET', async resolve(address, { signal } = {}) {
    const requestedAddress = normalizeProfileAddress(address);
    if (!requestedAddress) throw new TypeError('A valid Universal Profile address is required');
    throwIfAborted(signal);
    const values = []; let rpcFailureCode = 'RPC_UNAVAILABLE'; let successfulRpcReads = 0;
    for (const endpoint of rpcEndpoints) {
      try {
        const value = await boundedOperation((attemptSignal) => (dataReader || readErc725YValue)(requestedAddress,
          { rpcUrl: endpoint, fetchImpl, signal: attemptSignal }), { callerSignal: signal,
          timeoutMs: timeoutPolicy.rpcResponseMs, timeoutCode: 'RPC_TIMEOUT', endpointClass: 'RPC' });
        throwIfAborted(signal); successfulRpcReads += 1;
        if (value && !/^0x0*$/i.test(value)) values.push(value.toLowerCase());
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        rpcFailureCode = availabilityCode(error, 'RPC_UNAVAILABLE');
      }
    }
    const distinctValues = [...new Set(values)];
    if (distinctValues.length > 1) return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress,
      document: null, errorCode: 'RPC_POINTER_CONFLICT' };
    if (!distinctValues.length) {
      if (successfulRpcReads === rpcEndpoints.length) return { status: PUBLISHED_PROFILE_STATUS.UNAVAILABLE, address: requestedAddress, document: null };
      throw new PublishedProfileAvailabilityError(rpcFailureCode, 'RPC');
    }
    const value = distinctValues[0];
    let pointer;
    try { pointer = decodePointer(value); } catch (error) { return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null, errorCode: error.code }; }
    let bytes; let gatewayFailureCode = 'GATEWAY_UNAVAILABLE'; let integrityFailureCode = null;
    for (const gateway of gatewayEndpoints) {
      try {
        const contentUrl = resolvePublishedContentUrl(pointer.url, gateway);
        const response = await boundedOperation((attemptSignal) => fetchImpl(contentUrl,
          { method: 'GET', signal: attemptSignal, headers: { accept: 'application/json' } }), { callerSignal: signal,
          timeoutMs: timeoutPolicy.gatewayResponseMs, timeoutCode: 'GATEWAY_TIMEOUT', endpointClass: 'GATEWAY' });
        bytes = await boundedOperation((attemptSignal) => readLimitedBytes(response, PROFILE_DOCUMENT_LIMITS.maxJsonBytes, attemptSignal),
          { callerSignal: signal, timeoutMs: timeoutPolicy.documentReadMs, timeoutCode: 'DOCUMENT_READ_TIMEOUT', endpointClass: 'GATEWAY' });
        if (keccak256(bytes).toLowerCase() !== pointer.verification.data.toLowerCase()) {
          integrityFailureCode = 'HASH_MISMATCH'; bytes = null; continue;
        }
        break;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        if (error instanceof InvalidPublishedProfileError) { integrityFailureCode = error.code; bytes = null; continue; }
        gatewayFailureCode = availabilityCode(error, 'GATEWAY_UNAVAILABLE'); bytes = null;
      }
    }
    if (!bytes) {
      if (integrityFailureCode) return { status: PUBLISHED_PROFILE_STATUS.INVALID, address: requestedAddress, document: null, errorCode: integrityFailureCode };
      throw new PublishedProfileAvailabilityError(gatewayFailureCode, 'GATEWAY');
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
