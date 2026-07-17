export const LIBRARY_WORKSPACE_VERSION = 1;
function folderId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function createEmptyWorkspace(profileAddress) {
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress, favorites: [], folders: [] };
}
export function createFolder(workspace, name, now = Date.now()) {
  const trimmed = String(name || '').trim();
  return !trimmed ? workspace : { ...workspace, folders: [...workspace.folders, { id: folderId(), name: trimmed, assetIds: [], createdAt: now, updatedAt: now }] };
}
export function renameFolder(workspace, id, name, now = Date.now()) {
  const trimmed = String(name || '').trim();
  return !trimmed ? workspace : { ...workspace, folders: workspace.folders.map((folder) => folder.id === id ? { ...folder, name: trimmed, updatedAt: now } : folder) };
}
export function deleteFolder(workspace, id) {
  return { ...workspace, folders: workspace.folders.filter((folder) => folder.id !== id) };
}
export function setFolderAsset(workspace, folderIdValue, assetId, included, now = Date.now()) {
  return { ...workspace, folders: workspace.folders.map((folder) => {
    if (folder.id !== folderIdValue) return folder;
    const assetIds = included ? [...new Set([...folder.assetIds, assetId])] : folder.assetIds.filter((id) => id !== assetId);
    return { ...folder, assetIds, updatedAt: now };
  }) };
}
export function toggleFavorite(workspace, assetId) {
  return { ...workspace, favorites: workspace.favorites.includes(assetId)
    ? workspace.favorites.filter((id) => id !== assetId) : [...workspace.favorites, assetId] };
}
