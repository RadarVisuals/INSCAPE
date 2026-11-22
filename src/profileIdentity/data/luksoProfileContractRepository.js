import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';
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

const storageAbi = parseAbi(['function getData(bytes32 key) view returns (bytes)']);
async function readRegisterLength(key, address, rpcUrl, fetchImpl, signal) {
  const data = encodeFunctionData({abi:storageAbi, functionName:'getData', args:[key]});
  const response = await fetchImpl(rpcUrl, {method:'POST', signal, headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0', id:1, method:'eth_call', params:[{to:address, data}, 'latest']})});
  if (!response.ok) throw Error('Register length unavailable');
  const {result} = await response.json();
  const value = decodeFunctionResult({abi:storageAbi, functionName:'getData', data:result});
  if (value === '0x') return 0;
  if (!/^0x[0-9a-f]{32}$/i.test(value)) throw Error('Invalid register length');
  const length = Number(BigInt(value));
  if (!Number.isSafeInteger(length)) throw Error('Register length exceeds supported range');
  return length;
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
      const outcomes = await Promise.allSettled([
        chainReader({ signal }),
        erc725.supportsInterface('LSP0ERC725Account'),
        readRegisterLength(lsp5Schema.find(s => s.name === 'LSP5ReceivedAssets[]').key, normalizedAddress, rpcUrl, fetchImpl, signal),
        readRegisterLength(lsp12Schema.find(s => s.name === 'LSP12IssuedAssets[]').key, normalizedAddress, rpcUrl, fetchImpl, signal)
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
