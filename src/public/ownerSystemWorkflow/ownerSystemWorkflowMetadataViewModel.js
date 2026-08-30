import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';

const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function createOwnerSystemWorkflowMetadataViewModel(placement, asset) {
  if (!placement || !asset) return null;
  const dimensions = ownerSystemWorkflowAssetDimensions(asset);
  const attributes = Array.isArray(asset.attributes) ? asset.attributes : [];
  const creators = Array.isArray(asset.creators) ? asset.creators : [];
  const contractAddress = clean(asset.contractAddress);
  return Object.freeze({
    dossier: Object.freeze({
      title: clean(asset.name) || clean(asset.title),
      description: clean(asset.description),
      creators: Object.freeze(creators.map((creator) => Object.freeze({
        address: clean(creator.address), name: clean(creator.name),
      })).filter(({ address }) => address)),
      traits: Object.freeze([
        ...(asset.collectionName || asset.collection ? [{ label: 'Collection', value: asset.collectionName || asset.collection }] : []),
        ...attributes.map((entry) => ({ label: clean(entry.key || entry.label), value: String(entry.value ?? '') }))
          .filter(({ label }) => label),
      ]),
      technical: Object.freeze([
        asset.standard || asset.tokenStandard ? { kind: 'standard', label: 'STANDARD', value: asset.standard || asset.tokenStandard } : null,
        { kind: 'network', label: 'NETWORK', value: 'LUKSO / 42' },
        dimensions ? { kind: 'dimensions', label: 'SOURCE', value: `${dimensions.width} × ${dimensions.height} PX` } : null,
        { href: contractAddress ? `https://explorer.lukso.network/address/${contractAddress}` : null,
          kind: 'asset', label: 'ASSET ID', value: placement.stableAssetId },
      ].filter(Boolean)),
    }),
  });
}
