import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../config.js';
import { selectImageUrls } from '../data/resolveContentUrl.js';

function normalizeCreator(entry) {
  const address = normalizeProfileAddress(entry?.profile_id);
  return address ? { address, name: entry?.profile?.name || null } : null;
}

export function createStableAssetId({ chainId = LUKSO_CHAIN_ID, contractAddress, tokenId = null }) {
  const contract = normalizeProfileAddress(contractAddress);
  if (!contract) throw new TypeError('A valid contract address is required');
  return `${chainId}:${contract}:${tokenId ? String(tokenId).toLowerCase() : 'contract'}`;
}

export function normalizeProfileAsset(holding, ownerAddress, options = {}) {
  const token = holding?.token || null;
  const contractMetadata = token?.asset || holding?.asset || token?.baseAsset || holding?.baseAsset || null;
  const contractAddress = normalizeProfileAddress(contractMetadata?.id || holding?.asset_id || String(holding?.token_id || '').slice(0, 42));
  if (!contractAddress) return null;
  const tokenId = token?.tokenId ? String(token.tokenId).toLowerCase() : null;
  const metadata = token || contractMetadata || {};
  const images = metadata.images?.length ? metadata.images : contractMetadata?.images;
  const urls = selectImageUrls(images, options);
  const creators = (metadata.lsp4Creators?.length ? metadata.lsp4Creators : contractMetadata?.lsp4Creators || []).map(normalizeCreator).filter(Boolean);
  const name = metadata.name || metadata.lsp4TokenName || contractMetadata?.name || contractMetadata?.lsp4TokenName
    || (tokenId ? `Token ${tokenId.slice(0, 10)}…` : 'Unnamed asset');
  const collectionName = token ? (contractMetadata?.name || contractMetadata?.lsp4TokenName || null)
    : (contractMetadata?.isCollection ? contractMetadata?.name || null : null);
  const metadataStatus = metadata.error ? 'unavailable' : (!urls.imageUrl || !metadata.description || !collectionName) ? 'partial' : 'ready';
  return {
    id: createStableAssetId({ contractAddress, tokenId }), chainId: LUKSO_CHAIN_ID,
    ownerAddress: normalizeProfileAddress(ownerAddress), contractAddress, tokenId,
    standard: token ? 'LSP8' : contractMetadata?.isLSP7 ? 'LSP7' : 'unknown',
    name, description: metadata.description || contractMetadata?.description || '', collectionName,
    imageUrl: urls.imageUrl, thumbnailUrl: urls.thumbnailUrl, originalImageUrl: urls.originalImageUrl,
    creators, attributes: (metadata.attributes || []).map(({ key, value, attributeType }) => ({ key, value, type: attributeType })),
    metadataStatus,
    rawMetadata: { indexerHoldingId: holding?.id || null, indexerMetadataError: metadata.error || null,
      originalImageUrl: urls.originalImageUrl, balance: holding?.balance ?? null }
  };
}
