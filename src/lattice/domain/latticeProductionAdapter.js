import { normalizeProfileAddress } from '../../library/config.js';
import { buildAssetReference } from '../../profileDocument/domain/assetReference.js';
import { parsePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import {
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from './latticeProductionDraft.js';
import {
  LATTICE_PRODUCTION_SCHEMA_VERSION,
  assertValidLatticeProductionPublication,
} from './latticeProductionPublication.js';

const cleanText = (value, maximum, nullable = false) => {
  if (nullable && value == null) return null;
  if (typeof value !== 'string') return nullable ? null : '';
  return value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maximum);
};

function publicAssetReference(asset, expectedStableAssetId) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset) || asset.id !== expectedStableAssetId) {
    throw new TypeError(`Missing or mismatched production asset: ${expectedStableAssetId}`);
  }
  const identity = buildAssetReference(asset, expectedStableAssetId);
  if (!identity || identity.stableAssetId !== expectedStableAssetId) throw new TypeError(`Missing or mismatched production asset: ${expectedStableAssetId}`);
  const mediaCandidate = [asset?.imageUrl, asset?.originalImageUrl, asset?.thumbnailUrl]
    .find((value) => parsePublishedAssetUrl(value));
  const mediaUrl = parsePublishedAssetUrl(mediaCandidate)?.value;
  if (!mediaUrl) throw new TypeError(`Production asset has no publishable media: ${expectedStableAssetId}`);
  const declaredMediaType = typeof asset?.mediaType === 'string' && asset.mediaType.trim()
    ? asset.mediaType.trim().toLowerCase() : null;
  // Production Library records originate from normalized metadata images but do
  // not currently persist mediaType. Treat that established image record shape
  // as an image; preserve fail-closed `unknown` for explicit unsupported types.
  const mediaType = declaredMediaType === null ? 'image'
    : ['image', 'animation'].includes(declaredMediaType) ? declaredMediaType : 'unknown';
  const creators = (Array.isArray(asset.creators) ? asset.creators : []).map((creator) => ({
    address: normalizeProfileAddress(creator?.address || creator?.profile_id),
    name: cleanText(creator?.name || creator?.profile?.name, 80, true),
  })).filter((creator) => creator.address).slice(0, 32);
  const attributes = (Array.isArray(asset.attributes) ? asset.attributes : []).map((attribute) => ({
    key: cleanText(attribute?.key, 80),
    value: cleanText(String(attribute?.value ?? ''), 400),
    type: cleanText(attribute?.type || attribute?.attributeType, 40, true),
  })).filter((attribute) => attribute.key).slice(0, 128);
  return {
    stableAssetId: identity.stableAssetId,
    network: identity.network,
    chainId: identity.chainId,
    tokenStandard: identity.tokenStandard,
    contractAddress: identity.contractAddress,
    tokenId: identity.tokenId,
    name: cleanText(asset?.name, 80),
    description: cleanText(asset?.description, 2000),
    collectionName: cleanText(asset?.collectionName, 80, true),
    media: {
      url: mediaUrl,
      width: Number.isSafeInteger(asset?.imageWidth) && asset.imageWidth > 0 ? asset.imageWidth : null,
      height: Number.isSafeInteger(asset?.imageHeight) && asset.imageHeight > 0 ? asset.imageHeight : null,
      type: mediaType,
    },
    creators,
    attributes,
  };
}

function createAssetResolver(assetRecords) {
  const records = assetRecords instanceof Map ? new Map(assetRecords) : new Map();
  if (!(assetRecords instanceof Map)) {
    for (const asset of Array.isArray(assetRecords) ? assetRecords : []) {
      if (records.has(asset?.id)) throw new TypeError(`Duplicate production asset record: ${String(asset?.id)}`);
      records.set(asset?.id, asset);
    }
  }
  return (stableAssetId) => publicAssetReference(records.get(stableAssetId), stableAssetId);
}

export function projectLatticeProductionPublication(draftInput, assetRecords, { lastPublished } = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const resolveAsset = createAssetResolver(assetRecords);
  const identity = structuredClone(draft.identityPresentation);
  const avatarAsset = identity.avatar.mode === 'inscape' && identity.avatar.stableAssetId
    ? resolveAsset(identity.avatar.stableAssetId)
    : null;
  const publication = {
    latticeVersion: LATTICE_PRODUCTION_SCHEMA_VERSION,
    artboard: { ...draft.artboard },
    geometry: { ...draft.geometry },
    appearance: { ...draft.appearance },
    identityPresentation: {
      alias: identity.alias,
      avatar: { mode: identity.avatar.mode, asset: avatarAsset, shape: identity.avatar.shape },
      bio: { mode: identity.bio.mode, customText: identity.bio.mode === 'inscape' ? identity.bio.customText : '' },
      tags: structuredClone(identity.tags),
      dossierSurface: identity.dossierSurface,
      visibility: { ...identity.visibility },
    },
    lastPublished,
    tables: draft.tables.map((table) => {
      if (table.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE) return {
        id: table.id,
        coordinate: { ...table.coordinate },
        visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE,
      };
      return {
        id: table.id,
        coordinate: { ...table.coordinate },
        title: table.title,
        subtitle: table.subtitle,
        labelVisible: table.labelVisible,
        labelAnchor: table.labelAnchor,
        labelOffset: { ...table.labelOffset },
        visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC,
        placements: table.placements
          .filter((placement) => placement.visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC)
          .sort((first, second) => first.navigationOrder - second.navigationOrder || first.id.localeCompare(second.id))
          .map(({ locked: _locked, stableAssetId, ...placement }) => ({
            ...structuredClone(placement),
            asset: resolveAsset(stableAssetId),
          })),
      };
    }),
  };
  return assertValidLatticeProductionPublication(publication);
}
