import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import { createPublicClient, fallback, getAddress, http } from 'viem';
import { lukso } from 'viem/chains';
import { LUKSO_RPC_FALLBACK_URLS, LUKSO_RPC_URL } from '../../library/config.js';
import { decodeVerifiedOnchainJsonDataUri } from '../../library/data/onchainDataUri.js';
import { selectImageUrls } from '../../library/data/resolveContentUrl.js';
import { validateProfileDocumentV9Asset, validateProfileDocumentV9ContentReference } from './profileDocumentV9Asset.js';

const ABI = [{
  type: 'function', name: 'getDataForTokenId', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'bytes32' }, { name: 'dataKey', type: 'bytes32' }],
  outputs: [{ name: 'dataValue', type: 'bytes' }],
}];
const cache = new Map();

function clientFor(primary, fallbacks) {
  const urls = [...new Set([primary, ...String(fallbacks || '').split(/[\n,]/u)]
    .map((value) => String(value || '').trim()).filter(Boolean))];
  const transports = urls.map((url) => http(url, { timeout: 20_000, retryCount: 2, retryDelay: 750 }));
  return createPublicClient({ chain: lukso, transport: transports.length > 1 ? fallback(transports) : transports[0] });
}

function flattenMedia(value, output = []) {
  if (Array.isArray(value)) value.forEach((entry) => flattenMedia(entry, output));
  else if (value && typeof value === 'object' && (value.url || value.src)) output.push(value);
  return output;
}

function metadataImages(document) {
  const root = document?.LSP4Metadata || document || {};
  for (const group of [root.images, root.image, root.icon]) {
    const images = flattenMedia(group);
    if (images.length) return images;
  }
  return flattenMedia(root.assets).filter((entry) => !entry.fileType
    || String(entry.fileType).startsWith('image/'));
}

function sameVerification(left, right) {
  return String(left?.method || '').toLowerCase() === String(right?.method || '').toLowerCase()
    && String(left?.data || '').toLowerCase() === String(right?.data || '').toLowerCase();
}

async function resolveUncached(asset, reference, client, signal) {
  if (signal?.aborted) throw signal.reason || new DOMException('The operation was aborted', 'AbortError');
  const value = await client.readContract({
    address: getAddress(asset.contractAddress), abi: ABI, functionName: 'getDataForTokenId',
    args: [asset.tokenId, reference.dataKey],
  });
  if (signal?.aborted) throw signal.reason || new DOMException('The operation was aborted', 'AbortError');
  let pointer;
  try { pointer = decodeDataSourceWithHash(value); } catch { return null; }
  if (!pointer?.url || !sameVerification(pointer.verification, reference.verification)) return null;
  const document = decodeVerifiedOnchainJsonDataUri(pointer.url, reference.verification);
  if (!document) return null;
  const selected = selectImageUrls(metadataImages(document));
  return selected.imageUrl?.startsWith('data:image/svg+xml;base64,')
    ? Object.freeze({ src: selected.imageUrl, width: selected.width, height: selected.height }) : null;
}

export async function resolveProfileDocumentV9ContentReference(asset, {
  client = null, rpcUrl = LUKSO_RPC_URL, rpcFallbackUrls = LUKSO_RPC_FALLBACK_URLS, signal,
} = {}) {
  if (!validateProfileDocumentV9Asset(asset)
    || !validateProfileDocumentV9ContentReference(asset.media.reference)) return null;
  const reference = asset.media.reference;
  const key = `${asset.stableAssetId}:${reference.verification.method}:${reference.verification.data}`;
  if (client) return resolveUncached(asset, reference, client, signal).catch(() => null);
  let pending = cache.get(key);
  if (!pending) {
    pending = resolveUncached(asset, reference, clientFor(rpcUrl, rpcFallbackUrls), null)
      .catch(() => null).then((resolved) => {
        if (!resolved) cache.delete(key);
        return resolved;
      });
    cache.set(key, pending);
  }
  const resolved = await pending;
  return signal?.aborted ? null : resolved;
}

export function clearProfileDocumentV9ContentReferenceCache() { cache.clear(); }
