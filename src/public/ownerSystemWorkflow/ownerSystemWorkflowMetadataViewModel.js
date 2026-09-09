const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function createOwnerSystemWorkflowMetadataViewModel(placement, asset) {
  if (!placement || !asset) return null;
  const attributes = Array.isArray(asset.attributes) ? asset.attributes : [];
  const creators = Array.isArray(asset.creators) ? asset.creators : [];
  const contractAddress = clean(asset.contractAddress);
  const collection = clean(asset.collectionName) || clean(asset.collection);
  return Object.freeze({
    dossier: Object.freeze({
      title: clean(asset.name) || clean(asset.title),
      description: clean(asset.description),
      collection,
      creators: Object.freeze(creators.map((creator) => Object.freeze({
        address: clean(creator.address), name: clean(creator.name),
      })).filter(({ address }) => address)),
      traits: Object.freeze(attributes.map((entry) => ({
        label: clean(entry.key || entry.label),
        value: clean(String(entry.value ?? '')),
      })).filter(({ label, value }) => label && value)),
      assetDetailHref: contractAddress ? `https://explorer.lukso.network/address/${contractAddress}` : null,
    }),
  });
}
