const uniqueSources = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value))];

export function progressiveArtworkSources(asset) {
  const low = uniqueSources([asset?.thumbnailUrl, asset?.previewSrc, ...(asset?.previewCandidates || [])]);
  const high = uniqueSources([asset?.src, asset?.originalImageUrl, asset?.imageUrl, ...low]);
  return Object.freeze({ low: low[0] || high[0] || null, high: high[0] || low[0] || null });
}
