const unique = (values) => [...new Set(values.filter(Boolean))];

export function nftViewerMedia(asset) {
  const declaredGroups = Array.isArray(asset?.media) ? asset.media.map((entry) => (
    typeof entry === 'string' ? [entry] : unique([entry?.url, entry?.thumbnailUrl])
  )).filter((sources) => sources.length) : [];
  const declared = declaredGroups.filter((sources, index) => declaredGroups.findIndex((candidate) => candidate[0] === sources[0]) === index);
  const media = declared.length
    ? declared
    : [unique([asset?.imageUrl, asset?.thumbnailUrl, asset?.originalImageUrl])].filter((sources) => sources.length);
  return media.map((sources, index) => ({ kind: 'media', url: sources[0], sources, label: `IMAGE ${index + 1}` }));
}

export function buildNftViewerPages(asset) {
  const media = nftViewerMedia(asset);
  return [
    ...media,
    { kind: 'story', label: 'DESCRIPTION' },
    { kind: 'traits', label: 'ATTRIBUTES' },
    { kind: 'record', label: 'RECORD' }
  ];
}

export function nftViewerPageRatio(page, measuredRatios = {}) {
  if (page?.kind !== 'media') return 1;
  const ratio = Number(measuredRatios[page.url]);
  return Number.isFinite(ratio) && ratio > 0.05 && ratio < 20 ? ratio : 1;
}

export function compactTokenId(tokenId) {
  if (!tokenId) return 'COLLECTION';
  const value = String(tokenId);
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export function compactAddress(address) {
  if (!address) return 'UNAVAILABLE';
  const value = String(address);
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
