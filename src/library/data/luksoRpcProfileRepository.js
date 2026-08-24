import { ERC725, decodeDataSourceWithHash } from '@erc725/erc725.js';
import { createPublicClient, fallback, getAddress, http } from 'viem';
import { lukso } from 'viem/chains';
import { IPFS_GATEWAY_URL, LIBRARY_PAGE_SIZE, LUKSO_RPC_FALLBACK_URLS, LUKSO_RPC_URL,
  normalizeProfileAddress } from '../config.js';
import { createStableAssetId, normalizeProfileAsset } from '../domain/normalizeProfileAsset.js';
import { resolveContentUrl } from './resolveContentUrl.js';
import { decodeVerifiedOnchainJsonDataUri } from './onchainDataUri.js';

const LSP5_RECEIVED_ASSETS_SCHEMA = [{
  name: 'LSP5ReceivedAssets[]',
  key: '0x6460ee3c0aac563ccbf76d6e1d07bada78e3a9514e6382b736ed3f478ab7b90b',
  keyType: 'Array', valueType: 'address', valueContent: 'Address'
}];
const LSP4_METADATA_KEY = '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e';
const LSP4_TOKEN_TYPE_KEY = '0xe0261fa95db2eb3b5439bd033cda66d56b96f92f243a8228fd87550ed7bdfdb3';
const LSP4_CREATORS_ARRAY_KEY = '0x114bd03b3a46d48759680d81ebb2b414fda7d030a7105a851867accf1c2352e7';
const LSP8_METADATA_BASE_URI_KEY = '0x1a7628600c3bac7101f53697f48df381ddc36b9015e7d7c9c5633d1252aa2843';
const LSP8_TOKEN_ID_FORMAT_KEY = '0xf675e9361af1c1664c1868cfa3eb97672d6b1a513aa5b81dec34c9ee330e818d';
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

function decodeMetadataPointer(value) {
  if (!value || value === '0x') return null;
  try {
    const pointer = decodeDataSourceWithHash(value);
    return pointer?.url ? pointer : null;
  } catch { return null; }
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
    value: entry?.value ?? '', attributeType: entry?.type || entry?.display_type || null
  })).filter((entry) => entry.key || entry.value !== '');
}

function decodeTokenType(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/iu.test(value) || value.length > 66) return null;
  try {
    const type = Number(BigInt(value));
    return ({ 0: 'TOKEN', 1: 'NFT', 2: 'COLLECTION' })[type] || `TYPE_${type}`;
  } catch { return null; }
}

function decodeStoredNumber(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/iu.test(value) || value.length > 66) return null;
  try { return Number(BigInt(value)); } catch { return null; }
}

function decodeTokenIdForMetadata(tokenId, tokenIdFormat) {
  if (typeof tokenId !== 'string' || !/^0x[0-9a-f]{64}$/iu.test(tokenId)) return null;
  switch (tokenIdFormat) {
    case 0: return BigInt(tokenId).toString(10);
    case 1: {
      const bytes = tokenId.slice(2).match(/.{2}/gu).map((byte) => Number.parseInt(byte, 16));
      try { return new TextDecoder().decode(Uint8Array.from(bytes)).replace(/\0+$/u, ''); } catch { return null; }
    }
    case 2: return `0x${tokenId.slice(-40)}`;
    case 3: return tokenId.replace(/0+$/u, '');
    case 4: return tokenId;
    default: return tokenId;
  }
}

function arrayElementKey(arrayKey, index) {
  return `${arrayKey.slice(0, 34)}${index.toString(16).padStart(32, '0')}`;
}

function decodeStoredAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/iu.test(value)) return null;
  return normalizeProfileAddress(`0x${value.slice(-40)}`);
}

async function readContractFacts(address, client) {
  const contractAddress = getAddress(address);
  const [tokenTypeValue, creatorCountValue, tokenIdFormatValue] = await Promise.all([
    client.readContract({ address: contractAddress, abi: ERC725Y_ABI,
      functionName: 'getData', args: [LSP4_TOKEN_TYPE_KEY] }).catch(() => null),
    client.readContract({ address: contractAddress, abi: ERC725Y_ABI,
      functionName: 'getData', args: [LSP4_CREATORS_ARRAY_KEY] }).catch(() => null),
    client.readContract({ address: contractAddress, abi: ERC725Y_ABI,
      functionName: 'getData', args: [LSP8_TOKEN_ID_FORMAT_KEY] }).catch(() => null)
  ]);
  let creatorCount = 0;
  if (typeof creatorCountValue === 'string' && creatorCountValue.length <= 66) {
    try { creatorCount = Math.min(Number(BigInt(creatorCountValue)), 32); } catch { creatorCount = 0; }
  }
  const creatorValues = creatorCount ? await Promise.all(Array.from({ length: creatorCount }, (_entry, index) =>
    client.readContract({ address: contractAddress, abi: ERC725Y_ABI, functionName: 'getData',
      args: [arrayElementKey(LSP4_CREATORS_ARRAY_KEY, index)] }).catch(() => null))) : [];
  return {
    tokenType: decodeTokenType(tokenTypeValue),
    tokenIdFormat: decodeStoredNumber(tokenIdFormatValue),
    creators: creatorValues.map(decodeStoredAddress).filter(Boolean)
      .map((profileId) => ({ profile_id: profileId, profile: { name: null } }))
  };
}

async function fetchMetadataDocument(pointer, { fetchImpl, ipfsGateway, signal, metadataResponseMs = METADATA_RESPONSE_TIMEOUT_MS }) {
  const uri = pointer?.url;
  if (/^data:/iu.test(uri || '')) return decodeVerifiedOnchainJsonDataUri(uri, pointer.verification);
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
  const pointer = decodeMetadataPointer(value);
  return pointer ? fetchMetadataDocument(pointer, context) : null;
}

async function readTokenMetadata(holding, client, context, globalTokenIdFormat) {
  if (holding.standard === 'LSP7') return null;
  const directValue = await client.readContract({ address: getAddress(holding.address), abi: LSP8_ABI,
    functionName: 'getDataForTokenId', args: [holding.tokenId, LSP4_METADATA_KEY] }).catch(() => null);
  let pointer = decodeMetadataPointer(directValue);
  let source = pointer ? 'LSP4MetadataForTokenId' : null;
  if (!pointer) {
    let tokenIdFormat = globalTokenIdFormat;
    if (tokenIdFormat != null && tokenIdFormat >= 100) {
      const tokenFormatValue = await client.readContract({ address: getAddress(holding.address), abi: LSP8_ABI,
        functionName: 'getDataForTokenId', args: [holding.tokenId, LSP8_TOKEN_ID_FORMAT_KEY] }).catch(() => null);
      tokenIdFormat = decodeStoredNumber(tokenFormatValue) ?? tokenIdFormat - 100;
    }
    const tokenBaseValue = await client.readContract({ address: getAddress(holding.address), abi: LSP8_ABI,
      functionName: 'getDataForTokenId', args: [holding.tokenId, LSP8_METADATA_BASE_URI_KEY] }).catch(() => null);
    const globalBaseValue = tokenBaseValue && tokenBaseValue !== '0x' ? null
      : await client.readContract({ address: getAddress(holding.address), abi: ERC725Y_ABI,
        functionName: 'getData', args: [LSP8_METADATA_BASE_URI_KEY] }).catch(() => null);
    const baseValue = tokenBaseValue && tokenBaseValue !== '0x' ? tokenBaseValue : globalBaseValue;
    const baseUri = decodeMetadataPointer(baseValue)?.url || null;
    if (baseUri) {
      const decodedTokenId = decodeTokenIdForMetadata(String(holding.tokenId).toLowerCase(), tokenIdFormat);
      pointer = decodedTokenId == null ? null : { url: `${baseUri}${decodedTokenId}`, verification: null };
      source = tokenBaseValue && tokenBaseValue !== '0x' ? 'LSP8TokenMetadataBaseURIForTokenId' : 'LSP8TokenMetadataBaseURI';
    }
  }
  const document = pointer ? await fetchMetadataDocument(pointer, context) : null;
  return document ? { document, pointer, source } : null;
}

function toNormalizedAsset(holding, ownerAddress, tokenDocument, collectionDocument, contractFacts, options) {
  const collection = metadataRoot(collectionDocument);
  const token = metadataRoot(tokenDocument?.document);
  const contractMetadata = {
    id: holding.address, name: collection.name || collection.title || null,
    lsp4TokenName: collection.name || null, description: collection.description || '',
    images: metadataImages(collectionDocument), lsp4Creators: contractFacts.creators,
    attributes: metadataAttributes(collectionDocument), isLSP7: holding.standard === 'LSP7',
    isCollection: contractFacts.tokenType === 'COLLECTION', lsp4TokenType: contractFacts.tokenType,
    metadataSource: 'LSP4Metadata', tokenTypeSource: 'LSP4TokenType'
  };
  const rawHolding = holding.standard === 'LSP8' ? {
    id: `rpc:${holding.address}:${holding.tokenId}`, balance: '1', asset_id: holding.address,
    token: { tokenId: holding.tokenId, name: token.name || token.title || null,
      lsp4TokenName: token.name || null, description: token.description || '',
      images: metadataImages(tokenDocument?.document), lsp4Creators: contractFacts.creators,
      attributes: metadataAttributes(tokenDocument?.document), asset: contractMetadata,
      metadataSource: tokenDocument?.source || 'LSP4MetadataForTokenId' }
  } : { id: `rpc:${holding.address}`, balance: holding.balance, asset_id: holding.address, asset: contractMetadata };
  const normalized = normalizeProfileAsset(rawHolding, ownerAddress, options);
  const verification = tokenDocument?.pointer?.verification;
  const compactOnchainReference = normalized?.imageUrl?.startsWith('data:image/svg+xml;base64,')
    && tokenDocument?.pointer?.url?.startsWith('data:application/json')
    && typeof verification?.method === 'string' && /^0x[0-9a-f]{64}$/iu.test(verification?.data || '')
    ? {
      protocol: 'erc725y', scope: 'tokenId', dataKey: LSP4_METADATA_KEY,
      verification: { method: verification.method, data: verification.data.toLowerCase() },
    } : null;
  return compactOnchainReference ? { ...normalized, contentReference: compactOnchainReference } : normalized;
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
      const collectionMetadata = new Map(); const contractFacts = new Map(); let resolved = 0;
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
          let factsRequest = contractFacts.get(holding.address);
          if (!factsRequest) {
            factsRequest = readContractFacts(holding.address, publicClient).catch(() => ({ tokenType: null, creators: [] }));
            contractFacts.set(holding.address, factsRequest);
          }
          const facts = await factsRequest;
          const tokenDocument = await readTokenMetadata(holding, publicClient,
            { fetchImpl, ipfsGateway, signal, metadataResponseMs }, facts.tokenIdFormat).catch(() => null);
          return toNormalizedAsset(holding, profile, tokenDocument, collectionDocument, facts, { ipfsGateway });
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
