import { searchProfileAssets } from './searchProfileAssets.js';

export function getLibraryViewAssetIds(workspace, view) {
  if (view?.type === 'favorites') return workspace.favorites;
  if (view?.type === 'folder') return workspace.folders.find((folder) => folder.id === view.id)?.assetIds || [];
  return null;
}

export function selectLibraryViewAssets(assets, workspace, view, query = '') {
  const assetIds = getLibraryViewAssetIds(workspace, view);
  const idSet = assetIds ? new Set(assetIds) : null;
  const scoped = idSet ? assets.filter((asset) => idSet.has(asset.id)) : assets;
  return searchProfileAssets(scoped, query);
}

export function getMissingLibraryViewAssetIds(assets, workspace, view) {
  const assetIds = getLibraryViewAssetIds(workspace, view) || [];
  const loadedIds = new Set(assets.map((asset) => asset.id));
  return assetIds.filter((id) => !loadedIds.has(id));
}
