import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import { createPublicClient, fallback, getAddress, http } from 'viem';
import { lukso } from 'viem/chains';
import { IPFS_GATEWAY_URL, LUKSO_RPC_FALLBACK_URLS, LUKSO_RPC_URL, normalizeProfileAddress } from '../../library/config.js';
import { resolveContentUrl } from '../../library/data/resolveContentUrl.js';
import { decodeVerifiedOnchainJsonDataUri } from '../../library/data/onchainDataUri.js';

const METADATA_KEY = '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e';
const BASE_URI_KEY = '0x1a7628600c3bac7101f53697f48df381ddc36b9015e7d7c9c5633d1252aa2843';
const TOKEN_ID_FORMAT_KEY = '0xf675e9361af1c1664c1868cfa3eb97672d6b1a513aa5b81dec34c9ee330e818d';
const ABI = [
  { type: 'function', name: 'getData', stateMutability: 'view',
    inputs: [{ name: 'dataKey', type: 'bytes32' }], outputs: [{ name: 'dataValue', type: 'bytes' }] },
  { type: 'function', name: 'getDataForTokenId', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'bytes32' }, { name: 'dataKey', type: 'bytes32' }],
    outputs: [{ name: 'dataValue', type: 'bytes' }] },
];
const CONCURRENCY = 8;
const RESPONSE_TIMEOUT_MS = 10_000;

function abortError() { return new DOMException('The operation was aborted', 'AbortError'); }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }
function decodePointer(value) {
  if (!value || value === '0x') return null;
  try {
    const pointer = decodeDataSourceWithHash(value);
    return pointer?.url ? pointer : null;
  } catch { return null; }
}
const decodeUri = (value) => decodePointer(value)?.url || null;
function decodeNumber(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/iu.test(value) || value.length > 66) return null;
  try { return Number(BigInt(value)); } catch { return null; }
}
function decodeTokenId(tokenId, format) {
  if (typeof tokenId !== 'string' || !/^0x[0-9a-f]{64}$/iu.test(tokenId)) return null;
  if (format === 0) return BigInt(tokenId).toString(10);
  if (format === 1) {
    try { return new TextDecoder().decode(Uint8Array.from(tokenId.slice(2).match(/.{2}/gu)
      .map((byte) => Number.parseInt(byte, 16)))).replace(/\0+$/u, ''); } catch { return null; }
  }
  if (format === 2) return `0x${tokenId.slice(-40)}`;
  if (format === 3) return tokenId.replace(/0+$/u, '');
  return tokenId;
}
function metadataRoot(document) { return document?.LSP4Metadata || document || {}; }
function flattenMedia(value, output = []) {
  if (Array.isArray(value)) value.forEach((entry) => flattenMedia(entry, output));
  else if (value && typeof value === 'object' && (value.url || value.src)) output.push(value);
  return output;
}
function metadataImages(document) {
  const root = metadataRoot(document);
  return flattenMedia(root.images).length ? flattenMedia(root.images)
    : flattenMedia(root.image).length ? flattenMedia(root.image)
      : flattenMedia(root.icon).length ? flattenMedia(root.icon)
        : flattenMedia(root.assets).filter((entry) => !entry.fileType || String(entry.fileType).startsWith('image/'));
}
function metadataAttributes(document) {
  const values = metadataRoot(document).attributes;
  return (Array.isArray(values) ? values : []).map((entry) => ({ key: entry?.key || entry?.trait_type || entry?.name || '',
    value: entry?.value ?? '', attributeType: entry?.type || entry?.display_type || null }))
    .filter((entry) => entry.key || entry.value !== '');
}
function createClient(primary, fallbacks) {
  const urls = [...new Set([primary, ...String(fallbacks || '').split(/[\n,]/u)].map((value) => value.trim()).filter(Boolean))];
  const transports = urls.map((url) => http(url, { timeout: 20_000, retryCount: 2, retryDelay: 750 }));
  return createPublicClient({ chain: lukso, transport: transports.length > 1 ? fallback(transports) : transports[0] });
}
async function fetchDocument(pointer, { fetchImpl, ipfsGateway, signal, metadataResponseMs }) {
  const uri = pointer?.url;
  if (/^data:/iu.test(uri || '')) return decodeVerifiedOnchainJsonDataUri(uri, pointer.verification);
  const url = resolveContentUrl(uri, { ipfsGateway }); if (!url) return null;
  const controller = new AbortController(); const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), metadataResponseMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`ASSET METADATA RESPONDED ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', abort);
  }
}
async function mapConcurrent(items, mapper) {
  const results = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor; cursor += 1;
      try { results[index] = await mapper(items[index]); } catch (error) { results[index] = { error }; }
    }
  }));
  return results;
}

/** Official lookup order checked 2026-08-07: token LSP4Metadata, then LSP8TokenMetadataBaseURI. */
export function createLsp8CollectionMetadataResolver({
  rpcUrl = LUKSO_RPC_URL, rpcFallbackUrls = LUKSO_RPC_FALLBACK_URLS,
  ipfsGateway = IPFS_GATEWAY_URL, fetchImpl = globalThis.fetch, client,
  metadataResponseMs = RESPONSE_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  const publicClient = client || createClient(rpcUrl, rpcFallbackUrls); const contexts = new Map();
  return { source: 'DIRECT LUKSO RPC', async resolve(contractAddress, tokens, { signal } = {}) {
    const contract = normalizeProfileAddress(contractAddress);
    const candidates = (Array.isArray(tokens) ? tokens : []).filter((token) => /^0x[0-9a-f]{64}$/iu.test(token?.tokenId));
    if (!contract || !candidates.length) return new Map();
    let context = contexts.get(contract);
    if (!context) {
      const address = getAddress(contract);
      context = Promise.all([
        publicClient.readContract({ address, abi: ABI, functionName: 'getData', args: [TOKEN_ID_FORMAT_KEY] }).catch(() => null),
        publicClient.readContract({ address, abi: ABI, functionName: 'getData', args: [BASE_URI_KEY] }).catch(() => null),
      ]).then(([format, base]) => ({ format: decodeNumber(format), baseUri: decodeUri(base) }));
      contexts.set(contract, context);
    }
    const { format, baseUri } = await context; throwIfAborted(signal);
    const outcomes = await mapConcurrent(candidates, async (token) => {
      const tokenId = token.tokenId.toLowerCase(); const address = getAddress(contract);
      const direct = await publicClient.readContract({ address, abi: ABI, functionName: 'getDataForTokenId',
        args: [tokenId, METADATA_KEY] }).catch(() => null);
      let pointer = decodePointer(direct); let source = pointer ? 'LSP4MetadataForTokenId' : 'LSP8TokenMetadataBaseURI';
      let tokenFormat = format; let tokenBaseUri = baseUri;
      if (!pointer && format >= 100) {
        const [tokenFormatValue, tokenBaseValue] = await Promise.all([
          publicClient.readContract({ address, abi: ABI, functionName: 'getDataForTokenId',
            args: [tokenId, TOKEN_ID_FORMAT_KEY] }).catch(() => null),
          publicClient.readContract({ address, abi: ABI, functionName: 'getDataForTokenId',
            args: [tokenId, BASE_URI_KEY] }).catch(() => null),
        ]);
        tokenFormat = decodeNumber(tokenFormatValue) ?? format - 100;
        const tokenSpecificBaseUri = decodeUri(tokenBaseValue);
        tokenBaseUri = tokenSpecificBaseUri || baseUri;
        source = tokenSpecificBaseUri
          ? 'LSP8TokenMetadataBaseURIForTokenId'
          : 'LSP8TokenMetadataBaseURI';
      }
      if (!pointer && tokenBaseUri) pointer = { url: `${tokenBaseUri}${decodeTokenId(tokenId, tokenFormat)}`, verification: null };
      const document = pointer ? await fetchDocument(pointer, { fetchImpl, ipfsGateway, signal, metadataResponseMs }) : null;
      if (!document) return null;
      const metadata = metadataRoot(document);
      return { tokenId, name: metadata.name || metadata.title || null, description: metadata.description || '',
        images: metadataImages(document), attributes: metadataAttributes(document),
        metadataSource: `${source} (DIRECT LUKSO RPC)`, metadataResolved: true };
    });
    throwIfAborted(signal);
    return new Map(outcomes.filter((outcome) => outcome && !outcome.error).map((outcome) => [outcome.tokenId, outcome]));
  } };
}

export const lsp8CollectionMetadataResolver = createLsp8CollectionMetadataResolver();

function imageIdentity(images) {
  const image = Array.isArray(images) ? images[0] : null;
  return String(image?.url || image?.src || '').trim() || null;
}
export function collectionTokenNeedsMetadataRefresh(token) {
  const parent = token?.asset || token?.baseAsset; const tokenImage = imageIdentity(token?.images);
  const parentImage = imageIdentity(parent?.images);
  return Boolean(token?.tokenId && (!tokenImage || !resolveContentUrl(tokenImage)
    || parentImage && tokenImage === parentImage));
}
function overlayToken(token, metadata) {
  return metadata ? { ...token, name: metadata.name, lsp4TokenName: metadata.name,
    description: metadata.description, images: metadata.images, attributes: metadata.attributes,
    metadataSource: metadata.metadataSource, metadataResolved: true, error: null } : token;
}
export async function refreshIndexedCollectionTokens(contract, tokens, { resolver, signal } = {}) {
  const candidates = tokens.filter(collectionTokenNeedsMetadataRefresh); if (!candidates.length) return tokens;
  const refreshed = await (resolver || lsp8CollectionMetadataResolver).resolve(contract, candidates, { signal }).catch(() => new Map());
  return tokens.map((token) => overlayToken(token, refreshed.get(String(token?.tokenId || '').toLowerCase())));
}
export async function resolveMissingCollectionPreviews(rows, { resolver, signal } = {}) {
  const activeResolver = resolver || lsp8CollectionMetadataResolver;
  return Promise.all(rows.map(async (row) => {
    const asset = row?.asset; const token = asset?.tokens?.[0];
    if (!asset?.isCollection || asset.images?.length || !token?.tokenId) return row;
    const resolved = await activeResolver.resolve(asset.id, [token], { signal }).catch(() => new Map());
    const preview = resolved.get(String(token.tokenId).toLowerCase());
    return preview ? { ...row, asset: { ...asset, collectionPreview: preview } } : row;
  }));
}
