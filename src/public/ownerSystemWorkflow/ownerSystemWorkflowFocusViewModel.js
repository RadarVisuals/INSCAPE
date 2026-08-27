import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';

const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const sourceFor = (asset) => asset?.src || asset?.originalImageUrl || asset?.imageUrl || asset?.thumbnailUrl || null;

export function createOwnerSystemWorkflowFocusViewModel(placement, asset) {
  const src = sourceFor(asset);
  const dimensions = ownerSystemWorkflowAssetDimensions(asset);
  if (!placement || !src || !dimensions) return null;
  const { width, height } = dimensions;
  const attributes = Array.isArray(asset.attributes) ? asset.attributes : [];
  const creators = Array.isArray(asset.creators) ? asset.creators : [];
  return Object.freeze({
    accessibleLabel: clean(asset.name) || clean(asset.title) || 'Artwork',
    dossier: Object.freeze({
      title: clean(asset.name) || clean(asset.title),
      description: clean(asset.description),
      traits: Object.freeze([
        ...(asset.collectionName || asset.collection ? [{ label: 'COLLECTION', value: asset.collectionName || asset.collection }] : []),
        ...attributes.map((entry) => ({ label: clean(entry.key || entry.label), value: String(entry.value ?? '') })).filter(({ label }) => label),
      ]),
      technical: Object.freeze([
        creators.length ? { label: 'CREATORS / METADATA', value: creators.map((creator) => creator.name ? `${creator.name} — ${creator.address}` : creator.address).join('\n') } : null,
        asset.standard || asset.tokenStandard ? { label: 'STANDARD / CONTRACT', value: asset.standard || asset.tokenStandard } : null,
        { label: 'NETWORK', value: 'LUKSO MAINNET / 42' },
        { label: 'SOURCE DIMENSIONS', value: `${width} × ${height} PX` },
        { label: 'ASSET ID', value: placement.stableAssetId },
      ].filter(Boolean)),
    }),
    focusDimensions: Object.freeze({ width, height }),
    media: Object.freeze({ accessibleLabel: clean(asset.name) || clean(asset.title) || 'Artwork', src }),
    placement: Object.freeze(structuredClone(placement)),
  });
}
