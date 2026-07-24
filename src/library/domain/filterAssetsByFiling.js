export const ASSET_FILING_FILTER = Object.freeze({
  ALL: 'ALL',
  FILED: 'FILED',
  UNFILED: 'UNFILED'
});

export function filterAssetsByFiling(assets, folders, filing = ASSET_FILING_FILTER.ALL) {
  if (filing === ASSET_FILING_FILTER.ALL) return assets;
  const filedIds = new Set((Array.isArray(folders) ? folders : []).flatMap((folder) =>
    Array.isArray(folder?.assetIds) ? folder.assetIds : []
  ));
  const includeFiled = filing === ASSET_FILING_FILTER.FILED;
  return assets.filter((asset) => filedIds.has(asset.id) === includeFiled);
}
