import { ERC725 } from '@erc725/erc725.js';
import lsp3ProfileSchema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json' assert { type: 'json' };
import { IPFS_GATEWAY_URL, LUKSO_RPC_URL, normalizeProfileAddress } from '../../library/config.js';
import { createErrorIdentity, createUnavailableIdentity, normalizeLsp3Identity } from '../domain/profileIdentity.js';
function throwIfAborted(signal) { if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError'); }
async function readContractCode(address, { rpcUrl, fetchImpl, signal }) {
  const response = await fetchImpl(rpcUrl, { method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }) });
  if (!response.ok) throw new Error(`LUKSO RPC responded ${response.status}`);
  const payload = await response.json(); if (payload.error || typeof payload.result !== 'string') throw new Error(payload.error?.message || 'Invalid LUKSO RPC response');
  return payload.result;
}
export function createLsp3ProfileIdentityRepository({ rpcUrl = LUKSO_RPC_URL, ipfsGateway = IPFS_GATEWAY_URL, fetchImpl = globalThis.fetch,
  codeReader = (address, options) => readContractCode(address, { ...options, rpcUrl, fetchImpl }),
  erc725Factory = (address) => new ERC725(lsp3ProfileSchema, address, rpcUrl, { ipfsGateway }) } = {}) { return { source: 'LIVE', async resolve(address, { signal } = {}) { const normalized = normalizeProfileAddress(address); if (!normalized) throw new TypeError('A valid address is required'); throwIfAborted(signal); try { const code = await codeReader(normalized, { signal }); throwIfAborted(signal); if (!code || /^0x0*$/i.test(code)) return createUnavailableIdentity(normalized, { errorCode: 'NOT_UNIVERSAL_PROFILE' }); const erc725 = erc725Factory(normalized); const isProfile = await erc725.supportsInterface('LSP0ERC725Account'); throwIfAborted(signal); if (!isProfile) return createUnavailableIdentity(normalized, { errorCode: 'NOT_UNIVERSAL_PROFILE' }); const result = await erc725.fetchData('LSP3Profile'); throwIfAborted(signal); const profile = result?.value?.LSP3Profile; if (!profile) return createUnavailableIdentity(normalized, { isUniversalProfile: true, errorCode: 'METADATA_UNAVAILABLE' }); return normalizeLsp3Identity(normalized, profile, { ipfsGateway, source: 'LIVE' }) || createUnavailableIdentity(normalized, { isUniversalProfile: true, errorCode: 'MALFORMED_METADATA' }); } catch (error) { if (error?.name === 'AbortError') throw error; return createErrorIdentity(normalized, { errorCode: /hash|verify|verification/i.test(error?.message || '') ? 'VERIFICATION_FAILED' : 'NETWORK_ERROR' }); } } }; }
export const lsp3ProfileIdentityRepository = createLsp3ProfileIdentityRepository();
