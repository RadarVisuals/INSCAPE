function attributeKey(attribute) {
  return String(attribute?.key || '').trim().toLocaleLowerCase();
}

export function mergeProfileAssetAttributes(asset, enrichment) {
  if (!asset || asset.id !== enrichment?.id || !Array.isArray(enrichment.attributes)
    || enrichment.attributes.length === 0) return asset;
  const attributes = Array.isArray(asset.attributes) ? [...asset.attributes] : [];
  const positions = new Map(attributes.map((attribute, index) => [attributeKey(attribute), index])
    .filter(([key]) => key));
  enrichment.attributes.forEach((attribute) => {
    const key = attributeKey(attribute);
    if (!key) return;
    const normalized = { key: String(attribute.key).trim(), value: attribute.value ?? '', type: attribute.type || null };
    const position = positions.get(key);
    if (position == null) {
      positions.set(key, attributes.length);
      attributes.push(normalized);
    } else attributes[position] = normalized;
  });
  return {
    ...asset,
    attributes,
    fieldProvenance: {
      ...(asset.fieldProvenance || {}),
      attributes: { scope: 'tokenId', source: 'LSP4MetadataForTokenId (LUKSO Envio Indexer)' }
    },
    rawMetadata: { ...(asset.rawMetadata || {}), attributesEnrichedBy: 'LUKSO Envio Indexer' }
  };
}

export function mergeProfileAssetAttributeEnrichments(assets, enrichments) {
  const byId = new Map((Array.isArray(enrichments) ? enrichments : []).map((entry) => [entry.id, entry]));
  return (Array.isArray(assets) ? assets : []).map((asset) => mergeProfileAssetAttributes(asset, byId.get(asset.id)));
}
