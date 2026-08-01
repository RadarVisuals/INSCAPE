import { adaptLatticeProductionMedia, LATTICE_PRODUCTION_MEDIA_STATUS } from './latticeProductionMedia.js';

const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const shortAddress = (value) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : null;

export function createLatticeProductionFocusViewModel(placement, assetRecord, { trustPublishedMetadata = false } = {}) {
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
  const technical = [
    creators.length ? { label: 'CREATORS / CONTRACT', value: creators.map((creator) =>
      clean(creator.name) ? `${creator.name} — ${creator.address}` : creator.address).join('\n') } : null,
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
