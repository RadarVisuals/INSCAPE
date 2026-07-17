export const LIBRARY_WORKSPACE_VERSION = 2;

export const LIBRARY_VIEW_TYPES = Object.freeze({ ALL: 'all', FAVORITES: 'favorites', FOLDER: 'folder' });

function folderId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyWorkspace(profileAddress) {
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress, favorites: [], folders: [], canvas: { launchers: [] } };
}

export function createFolder(workspace, name, now = Date.now()) {
  const trimmed = String(name || '').trim();
  return !trimmed ? workspace : { ...workspace, folders: [...workspace.folders, { id: folderId(), name: trimmed, assetIds: [], createdAt: now, updatedAt: now }] };
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
    folders: workspace.folders.filter((folder) => folder.id !== id),
    canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.filter((launcher) => launcher.folderId !== id) }
  };
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

export function isProtectedLibraryView(view) {
  return view?.type === LIBRARY_VIEW_TYPES.ALL || view?.type === LIBRARY_VIEW_TYPES.FAVORITES;
}

export function launcherIdForView(view) {
  if (view?.type === LIBRARY_VIEW_TYPES.FAVORITES) return 'library:favorites';
  if (view?.type === LIBRARY_VIEW_TYPES.FOLDER && typeof view.id === 'string' && view.id) return `library:folder:${view.id}`;
  return null;
}

export function getPinnedLauncher(workspace, view) {
  const id = launcherIdForView(view);
  return id ? workspace.canvas.launchers.find((launcher) => launcher.id === id) || null : null;
}

export function pinLibraryView(workspace, view) {
  const id = launcherIdForView(view);
  if (!id || getPinnedLauncher(workspace, view)) return workspace;
  if (view.type === LIBRARY_VIEW_TYPES.FOLDER && !workspace.folders.some((folder) => folder.id === view.id)) return workspace;
  const launcher = { id, viewType: view.type, folderId: view.type === LIBRARY_VIEW_TYPES.FOLDER ? view.id : null, position: null, windowPosition: null };
  return { ...workspace, canvas: { ...workspace.canvas, launchers: [...workspace.canvas.launchers, launcher] } };
}

export function unpinLibraryView(workspace, view) {
  const id = launcherIdForView(view);
  if (!id || !getPinnedLauncher(workspace, view)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.filter((launcher) => launcher.id !== id) } };
}

function setLauncherPlacement(workspace, launcherId, field, position) {
  const normalized = position && Number.isInteger(position.column) && Number.isInteger(position.row) ? { column: position.column, row: position.row } : null;
  if (!workspace.canvas.launchers.some((launcher) => launcher.id === launcherId)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => launcher.id === launcherId ? { ...launcher, [field]: normalized } : launcher) } };
}

export function setLauncherPosition(workspace, launcherId, position) {
  return setLauncherPlacement(workspace, launcherId, 'position', position);
}

export function setLauncherWindowPosition(workspace, launcherId, position) {
  return setLauncherPlacement(workspace, launcherId, 'windowPosition', position);
}

export function resetCanvasLayout(workspace) {
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => ({ ...launcher, position: null, windowPosition: null })) } };
}
