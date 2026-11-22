import { parseCanonicalAssetId } from '../profileDocument/domain/assetReference.js';
import { isValidPublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { normalizeProfileAddress } from './config.js';
import { createStableAssetId } from './domain/normalizeProfileAsset.js';

const string = value => typeof value === 'string' ? value : null;
const dimension = value => Number.isSafeInteger(value) && value > 0 ? value : null;
const list = value => Array.isArray(value) ? value : [];
const creators = value => list(value).filter(entry => normalizeProfileAddress(entry?.address)).map(entry => ({
  address: normalizeProfileAddress(entry.address), name: string(entry.name),
}));

// Only display facts belong here. Holding, placement, selection and filing have separate owners.
export function curatedSnapshot(record, { existing = false } = {}) {
  // Existing v9 work may reference a validated on-chain SVG data URI.
  const url = value => (existing || !/^data:/i.test(value)) && isValidPublishedAssetUrl(value) ? value : null;
  const identity = parseCanonicalAssetId(record?.id);
  if (!identity || record.id !== createStableAssetId(identity)
    || record.chainId !== identity.chainId || normalizeProfileAddress(record.contractAddress) !== identity.contractAddress
    || (record.tokenId ?? null) !== identity.tokenId) return null;
  const provenance = record.fieldProvenance?.creators;
  return {
    id: record.id, chainId: identity.chainId, contractAddress: identity.contractAddress, tokenId: identity.tokenId,
    name: string(record.name), collectionName: string(record.collectionName), standard: string(record.standard),
    mediaType: string(record.mediaType), mediaFileType: string(record.mediaFileType),
    imageWidth: dimension(record.imageWidth), imageHeight: dimension(record.imageHeight),
    thumbnailUrl: url(record.thumbnailUrl), imageUrl: url(record.imageUrl), originalImageUrl: url(record.originalImageUrl),
    isCollection: record.isCollection === true, collectionPreviewTokenId: string(record.collectionPreviewTokenId),
    creators: creators(record.creators), collectionCreators: creators(record.collectionCreators),
    creatorAttributionLevel: string(record.creatorAttributionLevel),
    collectionCreatorAttributionLevel: string(record.collectionCreatorAttributionLevel),
    fieldProvenance: provenance ? { creators: { source: string(provenance.source), scope: string(provenance.scope) } } : {},
    fileAttachments: list(record.fileAttachments).filter(file => url(file?.url)).map(file => ({ url: file.url, fileType: string(file.fileType) })),
    imageGroups: list(record.imageGroups).filter(Boolean).map(group => ({
      index: group.index, resourceId: !existing && /^data:/i.test(group.resourceId) ? null : string(group.resourceId), thumbnailUrl: url(group.thumbnailUrl),
      originalImageUrl: url(group.originalImageUrl), imageUrl: url(group.imageUrl), fileType: string(group.fileType),
      width: dimension(group.width), height: dimension(group.height),
      variants: list(group.variants).filter(item => url(item?.url)).map(item => ({
        url: item.url, width: dimension(item.width), height: dimension(item.height), fileType: string(item.fileType),
      })),
    })),
  };
}

export function saveMissingSnapshots(workspace, ids, records) {
  const additions = [];
  for (const id of ids) {
    if (Object.hasOwn(workspace.curatedSnapshots || {}, id)) continue;
    const record = records.get(id);
    const snapshot = record?.id === id && curatedSnapshot(record);
    if (snapshot) additions.push([id, snapshot]);
  }
  return additions.length ? { ...workspace, curatedSnapshots: { ...workspace.curatedSnapshots, ...Object.fromEntries(additions) } } : workspace;
}
