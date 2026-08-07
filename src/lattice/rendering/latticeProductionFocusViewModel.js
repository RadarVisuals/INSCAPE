import { adaptLatticeProductionMedia, LATTICE_PRODUCTION_MEDIA_STATUS } from './latticeProductionMedia.js';
import { normalizeProfileAddress } from '../../library/config.js';

const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const shortAddress = (value) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : null;

export function createLatticeProductionFocusViewModel(placement, assetRecord, {
  presentingProfileAddress = null,
  trustPublishedMetadata = false,
} = {}) {
  const published = placement?.asset;
  const normalized = assetRecord?.id === published?.stableAssetId ? assetRecord : null;
  const media = adaptLatticeProductionMedia(published);
  if (!published || media.status !== LATTICE_PRODUCTION_MEDIA_STATUS.READY) return null;
  const dimensions = normalized?.imageWidth > 0 && normalized?.imageHeight > 0
    ? { width: normalized.imageWidth, height: normalized.imageHeight } : media.dimensions;
  const creators = normalized?.fieldProvenance?.creators && Array.isArray(normalized.creators)
    ? normalized.creators : trustPublishedMetadata && Array.isArray(published.creators) ? published.creators : [];
  const attributes = normalized?.fieldProvenance?.attributes && Array.isArray(normalized.attributes)
    ? normalized.attributes : trustPublishedMetadata && Array.isArray(published.attributes) ? published.attributes : [];
  const standard = ['LSP7', 'LSP8'].includes(normalized?.standard) ? normalized.standard : published.tokenStandard;
  const publishedCreatorRelationship = trustPublishedMetadata && normalizeProfileAddress(presentingProfileAddress)
    && creators.some((creator) => normalizeProfileAddress(creator?.address) === normalizeProfileAddress(presentingProfileAddress));
  const presentingRelationship = normalized?.viewedProfileIsCreator === true
    ? `CREATOR / ${String(normalized.creatorAttributionLevel || 'INDEXED').toUpperCase()}`
    : publishedCreatorRelationship ? 'CREATOR / PUBLISHED METADATA' : null;
  const currentHolding = normalized?.ownershipKnown === true
    ? normalized.isOwnedByViewedProfile === true ? 'HELD BY PRESENTING PROFILE'
      : clean(normalized.currentOwnerAddress) ? `HELD BY ${normalized.currentOwnerAddress}`
        : 'NOT HELD BY PRESENTING PROFILE'
    : null;
  const creatorsLabel = normalized?.fieldProvenance?.creators?.scope === 'tokenId' ? 'CREATORS / TOKEN'
    : trustPublishedMetadata ? 'CREATORS / PUBLISHED METADATA' : 'CREATORS / CONTRACT';
  const technical = [
    creators.length ? { label: creatorsLabel, value: creators.map((creator) =>
      clean(creator.name) ? `${creator.name} — ${creator.address}` : creator.address).join('\n') } : null,
    presentingRelationship ? { label: 'PRESENTING PROFILE / RELATIONSHIP', value: presentingRelationship } : null,
    currentHolding ? { label: 'CURRENT HOLDING / INDEXED', value: currentHolding } : null,
    published.contractAddress ? { label: 'CONTRACT', value: published.contractAddress } : null,
    published.tokenId && standard === 'LSP8' ? { label: 'TOKEN ID / TOKEN', value: published.tokenId } : null,
    standard !== 'UNKNOWN' ? { label: 'STANDARD / CONTRACT', value: standard } : null,
    clean(normalized?.tokenType) && normalized?.fieldProvenance?.tokenType
      ? { label: 'LSP4 TOKEN TYPE / CONTRACT', value: normalized.tokenType } : null,
    { label: 'NETWORK', value: published.network === 'lukso-mainnet' ? 'LUKSO MAINNET' : published.network },
    dimensions ? { label: 'SOURCE DIMENSIONS', value: `${dimensions.width} × ${dimensions.height} PX` } : null,
    clean(normalized?.mediaFileType) ? { label: 'DECLARED FILE TYPE', value: normalized.mediaFileType } : null,
    published.contractAddress ? {
      label: 'EXPLORER / DERIVED',
      value: `https://explorer.lukso.network/address/${published.contractAddress}`,
      href: `https://explorer.lukso.network/address/${published.contractAddress}`,
    } : null,
  ].filter(Boolean);
  return Object.freeze({
    dossier: {
      title: normalized?.fieldProvenance?.name ? clean(normalized.name)
        : trustPublishedMetadata ? clean(published.name) : null,
      description: normalized?.fieldProvenance?.description ? clean(normalized.description)
        : trustPublishedMetadata ? clean(published.description) : null,
      traits: attributes.map((attribute) => ({ label: clean(attribute.key), value: String(attribute.value ?? '') }))
        .filter((attribute) => attribute.label),
      technical,
    },
    focusDimensions: dimensions,
    media: { ...media, src: clean(normalized?.originalImageUrl) || clean(normalized?.imageUrl) || media.src },
    placement,
    accessibleLabel: clean(normalized?.name) || clean(published.name) || shortAddress(published.contractAddress) || 'Artwork',
  });
}
