import { ERC725, decodeDataSourceWithHash } from '@erc725/erc725.js';
import { createPublicClient, fallback, getAddress, http } from 'viem';
import { lukso } from 'viem/chains';
import { IPFS_GATEWAY_URL, LIBRARY_PAGE_SIZE, LUKSO_RPC_FALLBACK_URLS, LUKSO_RPC_URL,
  normalizeProfileAddress } from '../config.js';
import { createStableAssetId, normalizeProfileAsset } from '../domain/normalizeProfileAsset.js';
import { resolveContentUrl } from './resolveContentUrl.js';

const LSP5_RECEIVED_ASSETS_SCHEMA = [{
  name: 'LSP5ReceivedAssets[]',
  key: '0x6460ee3c0aac563ccbf76d6e1d07bada78e3a9514e6382b736ed3f478ab7b90b',
  keyType: 'Array', valueType: 'address', valueContent: 'Address'
}];
const LSP4_METADATA_KEY = '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e';
const LSP8_METADATA_BASE_URI_KEY = '0x1a7628600c3bac7101f53697f48df381ddc36b9015e7d7c9c5633d1252aa2843';
const LSP7_INTERFACE_ID = '0xc52d6008';
const LSP8_INTERFACE_ID = '0x3a271706';
const METADATA_CONCURRENCY = 8;
const METADATA_RESPONSE_TIMEOUT_MS = 10_000;

const ERC725Y_ABI = [
  { type: 'function', name: 'supportsInterface', stateMutability: 'view',
    inputs: [{ name: 'interfaceId', type: 'bytes4' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'getData', stateMutability: 'view',
    inputs: [{ name: 'dataKey', type: 'bytes32' }], outputs: [{ name: 'dataValue', type: 'bytes' }] }
];
const LSP7_ABI = [{ type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ name: 'tokenOwner', type: 'address' }], outputs: [{ type: 'uint256' }] }];
const LSP8_ABI = [
  { type: 'function', name: 'tokenIdsOf', stateMutability: 'view',
    inputs: [{ name: 'tokenOwner', type: 'address' }], outputs: [{ type: 'bytes32[]' }] },
  { type: 'function', name: 'getDataForTokenId', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'bytes32' }, { name: 'dataKey', type: 'bytes32' }],
    outputs: [{ name: 'dataValue', type: 'bytes' }] }
];

function abortError() { return new DOMException('The operation was aborted', 'AbortError'); }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }

function endpointList(primary, fallbacks) {
  const candidates = [primary, ...String(fallbacks || '').split(/[\n,]/u)];
  return [...new Set(candidates.map((value) => String(value || '').trim()).filter(Boolean))];
}

function createRpcClient(rpcUrls) {
  const transports = rpcUrls.map((url) => http(url, { timeout: 20_000, retryCount: 2, retryDelay: 750 }));
  return createPublicClient({ chain: lukso, transport: transports.length > 1 ? fallback(transports) : transports[0] });
}

async function discoverReceivedAssetContracts(profileAddress, { rpcUrls, signal }) {
  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    throwIfAborted(signal);
    try {
      const erc725 = new ERC725(LSP5_RECEIVED_ASSETS_SCHEMA, getAddress(profileAddress), rpcUrl);
      const result = await erc725.getData('LSP5ReceivedAssets[]');
      throwIfAborted(signal);
      return [...new Set((Array.isArray(result?.value) ? result.value : [])
        .map(normalizeProfileAddress).filter(Boolean))];
    } catch (error) {
      if (signal?.aborted) throw abortError();
      lastError = error;
    }
  }
  throw lastError || new Error('LSP5 RECEIVED ASSETS COULD NOT BE READ');
}

function resultValue(result) {
  return result?.status === 'success' ? result.result : null;
}

async function discoverOwnedTokens(profileAddress, contracts, client, signal) {
  const holdings = [];
  const collectionPageSize = 12;
  for (let offset = 0; offset < contracts.length; offset += collectionPageSize) {
    throwIfAborted(signal);
    const page = contracts.slice(offset, offset + collectionPageSize);
    const interfaceResults = await client.multicall({ allowFailure: true, contracts: page.flatMap((address) => [
      { address: getAddress(address), abi: ERC725Y_ABI, functionName: 'supportsInterface', args: [LSP8_INTERFACE_ID] },
      { address: getAddress(address), abi: ERC725Y_ABI, functionName: 'supportsInterface', args: [LSP7_INTERFACE_ID] }
    ]) });
    throwIfAborted(signal);
    const ownershipCalls = []; const ownershipMeta = [];
    page.forEach((address, index) => {
      if (resultValue(interfaceResults[index * 2]) === true) {
        ownershipMeta.push({ address, standard: 'LSP8' });
        ownershipCalls.push({ address: getAddress(address), abi: LSP8_ABI, functionName: 'tokenIdsOf', args: [getAddress(profileAddress)] });
      } else if (resultValue(interfaceResults[index * 2 + 1]) === true) {
        ownershipMeta.push({ address, standard: 'LSP7' });
        ownershipCalls.push({ address: getAddress(address), abi: LSP7_ABI, functionName: 'balanceOf', args: [getAddress(profileAddress)] });
      }
    });
    if (!ownershipCalls.length) continue;
    const ownershipResults = await client.multicall({ allowFailure: true, contracts: ownershipCalls });
    ownershipResults.forEach((result, index) => {
      const meta = ownershipMeta[index]; const value = resultValue(result);
      if (meta.standard === 'LSP8' && Array.isArray(value)) {
        value.forEach((tokenId) => holdings.push({ ...meta, tokenId: String(tokenId).toLowerCase() }));
      } else if (meta.standard === 'LSP7' && typeof value === 'bigint' && value > 0n) {
        holdings.push({ ...meta, tokenId: null, balance: value.toString() });
      }
    });
  }
  return holdings;
}

function prioritizeHoldings(holdings, priorityAssetIds) {
  const priorities = new Map((Array.isArray(priorityAssetIds) ? priorityAssetIds : [])
    .map((id, index) => [String(id || '').toLowerCase(), index]));
  if (!priorities.size) return holdings;
  return holdings.map((holding, index) => ({ holding, index,
    priority: priorities.get(createStableAssetId({ contractAddress: holding.address, tokenId: holding.tokenId })) }))
    .sort((first, second) => {
      const firstPriority = first.priority ?? Number.POSITIVE_INFINITY;
      const secondPriority = second.priority ?? Number.POSITIVE_INFINITY;
      return firstPriority - secondPriority || first.index - second.index;
    }).map((entry) => entry.holding);
}

function decodeMetadataUri(value) {
  if (!value || value === '0x') return null;
  try { return decodeDataSourceWithHash(value)?.url || null; } catch { return null; }
}

function flattenMedia(value, output = []) {
  if (Array.isArray(value)) value.forEach((entry) => flattenMedia(entry, output));
  else if (value && typeof value === 'object' && (value.url || value.src)) output.push(value);
  return output;
}

function metadataRoot(document) { return document?.LSP4Metadata || document || {}; }

function metadataImages(document) {
  const root = metadataRoot(document);
  const images = flattenMedia(root.images);
  if (images.length) return images;
  const image = flattenMedia(root.image);
  if (image.length) return image;
  const icon = flattenMedia(root.icon);
  if (icon.length) return icon;
  return flattenMedia(root.assets).filter((entry) => !entry.fileType || String(entry.fileType).startsWith('image/'));
}

function metadataAttributes(document) {
  const attributes = metadataRoot(document)?.attributes;
  return (Array.isArray(attributes) ? attributes : []).map((entry) => ({
    key: entry?.key || entry?.trait_type || entry?.name || '',
    value: entry?.value ?? '', attributeType: entry?.type || null
  })).filter((entry) => entry.key || entry.value !== '');
}

function metadataCreators(document) {
  const creators = metadataRoot(document)?.creators;
  return (Array.isArray(creators) ? creators : []).map((entry) => {
    const address = normalizeProfileAddress(typeof entry === 'string' ? entry : entry?.address);
    return address ? { profile_id: address, profile: { name: entry?.name || null } } : null;
  }).filter(Boolean);
}

async function fetchMetadataDocument(uri, { fetchImpl, ipfsGateway, signal, metadataResponseMs = METADATA_RESPONSE_TIMEOUT_MS }) {
  const url = resolveContentUrl(uri, { ipfsGateway });
  if (!url) return null;
  throwIfAborted(signal);
  const requestController = new AbortController();
  const abortRequest = () => requestController.abort(signal?.reason);
  signal?.addEventListener('abort', abortRequest, { once: true });
  const timeout = setTimeout(() => requestController.abort(), metadataResponseMs);
  try {
    const response = await fetchImpl(url, { signal: requestController.signal,
      headers: { accept: 'application/json,image/*;q=0.8,*/*;q=0.2' } });
    if (!response.ok) throw new Error(`ASSET METADATA RESPONDED ${response.status}`);
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.startsWith('image/')) return { image: [{ url: uri, fileType: contentType }] };
    return response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

async function readCollectionMetadata(address, client, context) {
  const value = await client.readContract({ address: getAddress(address), abi: ERC725Y_ABI,
    functionName: 'getData', args: [LSP4_METADATA_KEY] });
  const uri = decodeMetadataUri(value);
  return uri ? fetchMetadataDocument(uri, context) : null;
}

async function readTokenMetadata(holding, client, context) {
  if (holding.standard === 'LSP7') return null;
  const directValue = await client.readContract({ address: getAddress(holding.address), abi: LSP8_ABI,
    functionName: 'getDataForTokenId', args: [holding.tokenId, LSP4_METADATA_KEY] }).catch(() => null);
  let uri = decodeMetadataUri(directValue);
  if (!uri) {
    const baseValue = await client.readContract({ address: getAddress(holding.address), abi: ERC725Y_ABI,
      functionName: 'getData', args: [LSP8_METADATA_BASE_URI_KEY] }).catch(() => null);
    const baseUri = decodeMetadataUri(baseValue);
    if (baseUri) uri = `${baseUri.replace(/\/$/u, '')}/${BigInt(holding.tokenId).toString()}`;
  }
  return uri ? fetchMetadataDocument(uri, context) : null;
}

function toNormalizedAsset(holding, ownerAddress, tokenDocument, collectionDocument, options) {
  const collection = metadataRoot(collectionDocument);
  const token = metadataRoot(tokenDocument);
  const contractMetadata = {
    id: holding.address, name: collection.name || collection.title || null,
    lsp4TokenName: collection.name || null, description: collection.description || '',
    images: metadataImages(collectionDocument), lsp4Creators: metadataCreators(collectionDocument),
    attributes: metadataAttributes(collectionDocument), isLSP7: holding.standard === 'LSP7',
    isCollection: holding.standard === 'LSP8'
  };
  const rawHolding = holding.standard === 'LSP8' ? {
    id: `rpc:${holding.address}:${holding.tokenId}`, balance: '1', asset_id: holding.address,
    token: { tokenId: holding.tokenId, name: token.name || token.title || null,
      lsp4TokenName: token.name || null, description: token.description || '',
      images: metadataImages(tokenDocument), lsp4Creators: metadataCreators(tokenDocument),
      attributes: metadataAttributes(tokenDocument), asset: contractMetadata }
  } : { id: `rpc:${holding.address}`, balance: holding.balance, asset_id: holding.address, asset: contractMetadata };
  return normalizeProfileAsset(rawHolding, ownerAddress, options);
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length); let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor; cursor += 1;
      try { results[index] = await mapper(items[index]); } catch (error) { results[index] = { error }; }
    }
  });
  await Promise.all(workers); return results;
}

export function createLuksoRpcProfileRepository({
  rpcUrl = LUKSO_RPC_URL, rpcFallbackUrls = LUKSO_RPC_FALLBACK_URLS,
  ipfsGateway = IPFS_GATEWAY_URL, fetchImpl = globalThis.fetch, pageSize = LIBRARY_PAGE_SIZE,
  client, discoverContracts = discoverReceivedAssetContracts, metadataResponseMs = METADATA_RESPONSE_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  const rpcUrls = endpointList(rpcUrl, rpcFallbackUrls);
  const publicClient = client || createRpcClient(rpcUrls);
  return {
    source: 'RPC', endpoint: rpcUrls.join(', '),
    async *loadProfileAssets(profileAddress, { signal, priorityAssetIds = [], requestedAssetIds = null } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      if (!profile) throw new TypeError('A valid Universal Profile address is required');
      const contracts = await discoverContracts(profile, { rpcUrls, signal });
      throwIfAborted(signal);
      const discoveredHoldings = await discoverOwnedTokens(profile, contracts, publicClient, signal);
      const requested = Array.isArray(requestedAssetIds) && requestedAssetIds.length
        ? new Set(requestedAssetIds.map((id) => String(id).toLowerCase())) : null;
      const selectedHoldings = requested ? discoveredHoldings.filter((holding) => requested.has(
        createStableAssetId({ contractAddress: holding.address, tokenId: holding.tokenId }))) : discoveredHoldings;
      const holdings = prioritizeHoldings(selectedHoldings, priorityAssetIds);
      const collectionMetadata = new Map(); let resolved = 0;
      const streamBatchSize = Math.min(pageSize, METADATA_CONCURRENCY);
      for (let offset = 0; offset < holdings.length; offset += streamBatchSize) {
        throwIfAborted(signal);
        const page = holdings.slice(offset, offset + streamBatchSize);
        const outcomes = await mapConcurrent(page, METADATA_CONCURRENCY, async (holding) => {
          throwIfAborted(signal);
          let collectionRequest = collectionMetadata.get(holding.address);
          if (!collectionRequest) {
            collectionRequest = readCollectionMetadata(holding.address, publicClient,
              { fetchImpl, ipfsGateway, signal, metadataResponseMs }).catch(() => null);
            collectionMetadata.set(holding.address, collectionRequest);
          }
          const collectionDocument = await collectionRequest;
          const tokenDocument = await readTokenMetadata(holding, publicClient,
            { fetchImpl, ipfsGateway, signal, metadataResponseMs }).catch(() => null);
          return toNormalizedAsset(holding, profile, tokenDocument, collectionDocument, { ipfsGateway });
        });
        const assets = []; let batchFailures = 0;
        outcomes.forEach((outcome) => {
          if (outcome?.error || !outcome?.imageUrl) batchFailures += 1;
          else assets.push(outcome);
        });
        resolved += page.length;
        yield { assets, resolved, total: holdings.length, failures: batchFailures,
          complete: resolved >= holdings.length };
      }
      if (!holdings.length) yield { assets: [], resolved: 0, total: 0, failures: 0, complete: true };
    }
  };
}

export const luksoRpcProfileRepository = createLuksoRpcProfileRepository();
