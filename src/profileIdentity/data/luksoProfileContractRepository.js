import { ERC725 } from '@erc725/erc725.js';
import lsp5Schema from '@erc725/erc725.js/schemas/LSP5ReceivedAssets.json' with { type: 'json' };
import lsp12Schema from '@erc725/erc725.js/schemas/LSP12IssuedAssets.json' with { type: 'json' };
import { LUKSO_RPC_URL, normalizeProfileAddress } from '../../library/config.js';
import { createProfileContractFacts, errorContractFact, resolvedContractFact } from '../domain/profileContractFacts.js';

function abortError() { return new DOMException('The operation was aborted', 'AbortError'); }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }

async function readChainId({ rpcUrl, fetchImpl, signal }) {
  const response = await fetchImpl(rpcUrl, {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
  });
  if (!response.ok) throw new Error(`LUKSO RPC responded ${response.status}`);
  const payload = await response.json();
  if (payload.error || typeof payload.result !== 'string') throw new Error(payload.error?.message || 'Invalid chain response');
  const chainId = Number.parseInt(payload.result, 16);
  if (!Number.isSafeInteger(chainId) || chainId < 1) throw new Error('Invalid chain id');
  return chainId;
}

const settledFact = (outcome) => outcome.status === 'fulfilled'
  ? resolvedContractFact(outcome.value)
  : errorContractFact('RPC_ERROR');

export function createLuksoProfileContractRepository({
  rpcUrl = LUKSO_RPC_URL,
  fetchImpl = globalThis.fetch,
  chainReader = (options) => readChainId({ ...options, rpcUrl, fetchImpl }),
  erc725Factory = (address) => new ERC725([...lsp5Schema, ...lsp12Schema], address, rpcUrl)
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'DIRECT_RPC',
    async resolve(address, { signal } = {}) {
      const normalizedAddress = normalizeProfileAddress(address);
      if (!normalizedAddress) throw new TypeError('A valid address is required');
      throwIfAborted(signal);
      const erc725 = erc725Factory(normalizedAddress);
      const readArrayLength = async (key) => {
        const result = await erc725.getData(key);
        throwIfAborted(signal);
        if (!Array.isArray(result?.value)) throw new Error(`${key} did not resolve to an array`);
        return result.value.length;
      };
      const outcomes = await Promise.allSettled([
        chainReader({ signal }),
        erc725.supportsInterface('LSP0ERC725Account'),
        readArrayLength('LSP5ReceivedAssets[]'),
        readArrayLength('LSP12IssuedAssets[]')
      ]);
      throwIfAborted(signal);
      return createProfileContractFacts(normalizedAddress, {
        chain: settledFact(outcomes[0]),
        isUniversalProfile: settledFact(outcomes[1]),
        receivedAssetContracts: settledFact(outcomes[2]),
        issuedAssetContracts: settledFact(outcomes[3])
      });
    }
  };
}

export const luksoProfileContractRepository = createLuksoProfileContractRepository();
