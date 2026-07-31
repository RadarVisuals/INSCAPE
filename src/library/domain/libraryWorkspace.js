export const LIBRARY_WORKSPACE_VERSION = 8;

export const LIBRARY_VIEW_TYPES = Object.freeze({ ALL: 'all', FAVORITES: 'favorites', FOLDER: 'folder' });

function folderId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyWorkspace(profileAddress) {
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress, favorites: [], folders: [], canvas: { launchers: [], objects: [] }, tables: { placements: [] } };
}

export function createFolder(workspace, name, now = Date.now()) {
  const trimmed = String(name || '').trim();
  return !trimmed ? workspace : { ...workspace, folders: [...workspace.folders, { id: folderId(), name: trimmed, assetIds: [], public: false, createdAt: now, updatedAt: now }] };
}

export function renameFolder(workspace, id, name, now = Date.now()) {
  const trimmed = String(name || '').trim();
  if (!trimmed || !workspace.folders.some((folder) => folder.id === id)) return workspace;
  return { ...workspace, folders: workspace.folders.map((folder) => folder.id === id ? { ...folder, name: trimmed, updatedAt: now } : folder) };
}

export function deleteFolder(workspace, id) {
  if (!workspace.folders.some((folder) => folder.id === id)) return workspace;
  return {
    ...workspace,
    folders: workspace.folders.filter((folder) => folder.id !== id)
  };
}

export function setFolderAsset(workspace, folderIdValue, assetId, included, now = Date.now()) {
  if (typeof included !== 'boolean' || typeof assetId !== 'string' || !assetId) return workspace;
  const folder = workspace.folders.find(({ id }) => id === folderIdValue);
  if (!folder || folder.assetIds.includes(assetId) === included) return workspace;
  return { ...workspace, folders: workspace.folders.map((folder) => {
    if (folder.id !== folderIdValue) return folder;
    const assetIds = included ? [...new Set([...folder.assetIds, assetId])] : folder.assetIds.filter((id) => id !== assetId);
    return { ...folder, assetIds, updatedAt: now };
  }) };
}

export function setFolderAssets(workspace, folderIdValue, assetIdsValue, included, now = Date.now()) {
  if (typeof included !== 'boolean' || !Array.isArray(assetIdsValue)) return workspace;
  const assetIds = [...new Set(assetIdsValue.filter((id) => typeof id === 'string' && id))];
  if (!assetIds.length) return workspace;
  const folder = workspace.folders.find(({ id }) => id === folderIdValue);
  if (!folder) return workspace;
  const requested = new Set(assetIds);
  const nextAssetIds = included ? [...new Set([...folder.assetIds, ...assetIds])]
    : folder.assetIds.filter((id) => !requested.has(id));
  if (nextAssetIds.length === folder.assetIds.length
    && nextAssetIds.every((id, index) => id === folder.assetIds[index])) return workspace;
  return { ...workspace, folders: workspace.folders.map((candidate) => candidate.id === folderIdValue
    ? { ...candidate, assetIds: nextAssetIds, updatedAt: now } : candidate) };
}

export function toggleFavorite(workspace, assetId) {
  return { ...workspace, favorites: workspace.favorites.includes(assetId)
    ? workspace.favorites.filter((id) => id !== assetId) : [...workspace.favorites, assetId] };
}

export function isProtectedLibraryView(view) {
  return view?.type === LIBRARY_VIEW_TYPES.ALL || view?.type === LIBRARY_VIEW_TYPES.FAVORITES;
}

export function resetCanvasLayout(workspace) {
  return { ...workspace, canvas: {
    ...workspace.canvas,
    launchers: [],
    objects: workspace.canvas.objects
  } };
}

export function setFolderPublic(workspace, folderIdValue, isPublic, now = Date.now()) {
  if (typeof isPublic !== 'boolean' || !workspace.folders.some((folder) => folder.id === folderIdValue && folder.public !== isPublic)) return workspace;
  return { ...workspace, folders: workspace.folders.map((folder) => (
    folder.id === folderIdValue ? { ...folder, public: isPublic, updatedAt: now } : folder
  )) };
}
