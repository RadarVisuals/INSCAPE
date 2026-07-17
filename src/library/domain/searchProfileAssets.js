function searchableText(asset) {
  return [asset?.name, asset?.collectionName, asset?.contractAddress, asset?.tokenId,
    ...(asset?.creators || []).flatMap((creator) => [creator.name, creator.address])]
    .filter(Boolean).join(' ').toLocaleLowerCase();
}
export function tokenizeAssetSearch(query) {
  return String(query || '').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
}
export function searchProfileAssets(assets, query) {
  const tokens = tokenizeAssetSearch(query);
  if (!tokens.length) return Array.isArray(assets) ? assets : [];
  return (Array.isArray(assets) ? assets : []).filter((asset) => tokens.every((token) => searchableText(asset).includes(token)));
}
