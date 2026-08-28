import { normalizeProfileAddress } from '../../library/config.js';
import { buildAssetReference, createCanonicalAssetId, normalizeTokenId } from './assetReference.js';
import { isValidPublishedAssetUrl, parsePublishedAssetUrl } from './publishedAssetUrl.js';

const ASSET_KEYS = [
  'stableAssetId', 'network', 'chainId', 'tokenStandard', 'contractAddress', 'tokenId',
  'name', 'description', 'collectionName', 'media', 'creators', 'attributes',
];
const record = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => record(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const safeText = (value, maximum, { nullable = false } = {}) => nullable && value === null
  || typeof value === 'string' && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
const CREATOR_SCOPES = new Set(['contract', 'tokenId']);
const CREATOR_SOURCES = new Set(['LUKSO INDEXER / LSP4 CREATORS', 'LSP4Creators[]']);
const LSP4_METADATA_KEY = '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e';
const VERIFICATION_METHODS = new Set(['keccak256(bytes)', 'keccak256(utf8)', '0x8019f9b1', '0x6f357c6a']);
const HASH = /^0x[0-9a-f]{64}$/u;

function cleanText(value, maximum, { nullable = false } = {}) {
  if (nullable && value == null) return null;
  if (typeof value !== 'string') return nullable ? null : '';
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maximum);
}

function buildCompactContentReference(value, identity) {
  if (!record(value) || value.protocol !== 'erc725y' || value.scope !== 'tokenId'
    || value.dataKey !== LSP4_METADATA_KEY || !identity.tokenId
    || !record(value.verification) || !VERIFICATION_METHODS.has(String(value.verification.method).toLowerCase())
    || !HASH.test(String(value.verification.data).toLowerCase())) return null;
  return {
    protocol: 'erc725y', scope: 'tokenId', dataKey: LSP4_METADATA_KEY,
    verification: {
      method: String(value.verification.method).toLowerCase(),
      data: String(value.verification.data).toLowerCase(),
    },
  };
}

export function validateProfileDocumentV9ContentReference(value) {
  return exactKeys(value, ['protocol', 'scope', 'dataKey', 'verification'])
    && value.protocol === 'erc725y' && value.scope === 'tokenId' && value.dataKey === LSP4_METADATA_KEY
    && exactKeys(value.verification, ['method', 'data'])
    && typeof value.verification.method === 'string' && typeof value.verification.data === 'string'
    && VERIFICATION_METHODS.has(String(value.verification.method).toLowerCase())
    && value.verification.method === value.verification.method.toLowerCase()
    && HASH.test(value.verification.data);
}

export function buildProfileDocumentV9Asset(asset, expectedStableAssetId, { compactContentReference = true } = {}) {
  if (!record(asset) || asset.id !== expectedStableAssetId) {
    throw new TypeError(`Missing or mismatched production asset: ${expectedStableAssetId}`);
  }
  const identity = buildAssetReference(asset, expectedStableAssetId);
  if (!identity || identity.stableAssetId !== expectedStableAssetId) {
    throw new TypeError(`Missing or mismatched production asset: ${expectedStableAssetId}`);
  }
  const contentReference = compactContentReference
    ? buildCompactContentReference(asset.contentReference, identity) : null;
  const mediaCandidate = [asset.originalImageUrl, asset.imageUrl, asset.thumbnailUrl]
    .find((value) => parsePublishedAssetUrl(value));
  const mediaUrl = contentReference ? null : parsePublishedAssetUrl(mediaCandidate)?.value;
  if (!contentReference && !mediaUrl) throw new TypeError(`Production asset has no publishable media: ${expectedStableAssetId}`);
  const declaredType = typeof asset.mediaType === 'string' && asset.mediaType.trim()
    ? asset.mediaType.trim().toLowerCase()
    : null;
  const mediaType = declaredType === null ? 'image'
    : ['image', 'animation'].includes(declaredType) ? declaredType : 'unknown';
  const creatorProvenance = asset.fieldProvenance?.creators;
  const canonicalCreatorProvenance = CREATOR_SCOPES.has(creatorProvenance?.scope)
    && CREATOR_SOURCES.has(creatorProvenance?.source) ? creatorProvenance : null;
  const creators = (canonicalCreatorProvenance && Array.isArray(asset.creators) ? asset.creators : []).map((creator) => ({
    address: normalizeProfileAddress(creator?.address || creator?.profile_id),
    name: cleanText(creator?.name || creator?.profile?.name, 80, { nullable: true }),
    source: canonicalCreatorProvenance.source,
    scope: canonicalCreatorProvenance.scope,
  })).filter(({ address }) => address).slice(0, 32);
  const attributes = (Array.isArray(asset.attributes) ? asset.attributes : []).map((attribute) => ({
    key: cleanText(attribute?.key, 80),
    value: cleanText(String(attribute?.value ?? ''), 400),
    type: cleanText(attribute?.type || attribute?.attributeType, 40, { nullable: true }),
  })).filter(({ key }) => key).slice(0, 128);
  return {
    stableAssetId: identity.stableAssetId,
    network: identity.network,
    chainId: identity.chainId,
    tokenStandard: identity.tokenStandard,
    contractAddress: identity.contractAddress,
    tokenId: identity.tokenId,
    name: cleanText(asset.name, 80),
    description: cleanText(asset.description, 2000),
    collectionName: cleanText(asset.collectionName, 80, { nullable: true }),
    media: {
      url: mediaUrl,
      ...(contentReference ? { reference: contentReference } : {}),
      width: Number.isSafeInteger(asset.imageWidth) && asset.imageWidth > 0 ? asset.imageWidth : null,
      height: Number.isSafeInteger(asset.imageHeight) && asset.imageHeight > 0 ? asset.imageHeight : null,
      type: mediaType,
    },
    creators,
    attributes,
  };
}

export function validateProfileDocumentV9Asset(asset) {
  if (!exactKeys(asset, ASSET_KEYS)) return false;
  const tokenId = asset.tokenId === null ? null : normalizeTokenId(asset.tokenId);
  const stableAssetId = createCanonicalAssetId({
    chainId: asset.chainId,
    contractAddress: asset.contractAddress,
    tokenId,
  });
  if (!stableAssetId || stableAssetId !== asset.stableAssetId
    || asset.network !== 'lukso-mainnet' || asset.chainId !== 42
    || !['LSP7', 'LSP8', 'UNKNOWN'].includes(asset.tokenStandard)
    || asset.tokenStandard === 'LSP8' && !tokenId
    || asset.tokenStandard === 'LSP7' && tokenId) return false;
  if (!safeText(asset.name, 80) || !safeText(asset.description, 2000)
    || !safeText(asset.collectionName, 80, { nullable: true })) return false;
  const compactReference = exactKeys(asset.media, ['url', 'reference', 'width', 'height', 'type'])
    && asset.media.url === null && validateProfileDocumentV9ContentReference(asset.media.reference);
  const directUrl = exactKeys(asset.media, ['url', 'width', 'height', 'type'])
    && isValidPublishedAssetUrl(asset.media.url);
  if (!(compactReference || directUrl)
    || !(asset.media.width === null || Number.isSafeInteger(asset.media.width) && asset.media.width > 0)
    || !(asset.media.height === null || Number.isSafeInteger(asset.media.height) && asset.media.height > 0)
    || !['image', 'animation', 'unknown'].includes(asset.media.type)) return false;
  if (!Array.isArray(asset.creators) || asset.creators.length > 32
    || asset.creators.some((creator) => !exactKeys(creator, ['address', 'name', 'source', 'scope'])
      || !normalizeProfileAddress(creator.address)
      || creator.address !== creator.address.toLowerCase()
      || !safeText(creator.name, 80, { nullable: true })
      || !CREATOR_SOURCES.has(creator.source)
      || !CREATOR_SCOPES.has(creator.scope))) return false;
  return Array.isArray(asset.attributes) && asset.attributes.length <= 128
    && asset.attributes.every((attribute) => exactKeys(attribute, ['key', 'value', 'type'])
      && safeText(attribute.key, 80)
      && safeText(attribute.value, 400)
      && safeText(attribute.type, 40, { nullable: true }));
}

export function createProfileDocumentV9AssetResolver(assetRecords = [], options) {
  const records = assetRecords instanceof Map ? new Map(assetRecords) : new Map();
  if (!(assetRecords instanceof Map)) {
    for (const asset of Array.isArray(assetRecords) ? assetRecords : []) {
      if (records.has(asset?.id)) throw new TypeError(`Duplicate production asset record: ${String(asset?.id)}`);
      records.set(asset?.id, asset);
    }
  }
  return (stableAssetId) => buildProfileDocumentV9Asset(records.get(stableAssetId), stableAssetId, options);
}
