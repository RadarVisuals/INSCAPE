import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../config.js';
import { selectImageUrls } from '../data/resolveContentUrl.js';

function normalizeCreator(entry) {
  const address = normalizeProfileAddress(entry?.profile_id || entry?.address);
  return address ? { address, name: entry?.profile?.name || null } : null;
}

function fieldSource(token, contractMetadata, tokenValue, contractValue) {
  if (token && tokenValue != null && tokenValue !== '') return { scope: 'tokenId', source: token.metadataSource || 'LSP4Metadata' };
  if (contractValue != null && contractValue !== '') return { scope: 'contract', source: contractMetadata?.metadataSource || 'LSP4Metadata' };
  return null;
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
  const attributes = metadata.attributes?.length ? metadata.attributes : contractMetadata?.attributes || [];
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
    tokenType: contractMetadata?.lsp4TokenType || null,
    name, description: metadata.description || contractMetadata?.description || '', collectionName,
    imageUrl: urls.imageUrl, thumbnailUrl: urls.thumbnailUrl, originalImageUrl: urls.originalImageUrl,
    imageWidth: urls.width, imageHeight: urls.height,
    mediaFileType: urls.fileType || null,
    creators, attributes: attributes.map(({ key, value, attributeType }) => ({ key, value, type: attributeType })),
    metadataStatus,
    fieldProvenance: {
      name: fieldSource(token, contractMetadata, metadata.name || metadata.lsp4TokenName,
        contractMetadata?.name || contractMetadata?.lsp4TokenName),
      description: fieldSource(token, contractMetadata, metadata.description, contractMetadata?.description),
      images: fieldSource(token, contractMetadata, metadata.images?.length ? metadata.images : null,
        contractMetadata?.images?.length ? contractMetadata.images : null),
      attributes: fieldSource(token, contractMetadata, metadata.attributes?.length ? metadata.attributes : null,
        contractMetadata?.attributes?.length ? contractMetadata.attributes : null),
      creators: contractMetadata?.lsp4Creators?.length
        ? { scope: 'contract', source: contractMetadata.metadataSource || 'LSP4Creators[]' } : null,
      tokenType: contractMetadata?.lsp4TokenType
        ? { scope: 'contract', source: contractMetadata.tokenTypeSource || 'LSP4TokenType' } : null
    },
    rawMetadata: { indexerHoldingId: holding?.id || null, indexerMetadataError: metadata.error || null,
      originalImageUrl: urls.originalImageUrl, balance: holding?.balance ?? null }
  };
}
