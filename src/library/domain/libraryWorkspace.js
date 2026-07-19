export const LIBRARY_WORKSPACE_VERSION = 6;

export const LIBRARY_VIEW_TYPES = Object.freeze({ ALL: 'all', FAVORITES: 'favorites', FOLDER: 'folder' });

function folderId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyWorkspace(profileAddress) {
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress, favorites: [], folders: [], canvas: { launchers: [], objects: [] } };
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
  const launcher = { id, viewType: view.type, folderId: view.type === LIBRARY_VIEW_TYPES.FOLDER ? view.id : null,
    visitorVisible: false, startOpen: false, label: null, position: null, windowPosition: null, windowGeometry: null, appearanceMode: 'label', iconKey: view.type === LIBRARY_VIEW_TYPES.FAVORITES ? 'favorites' : 'folder', span: { columns: 3, rows: 1 }, presentationOrder: workspace.canvas.launchers.length + 4 };
  return { ...workspace, canvas: { ...workspace.canvas, launchers: [...workspace.canvas.launchers, launcher] } };
}

export function unpinLibraryView(workspace, view) {
  const id = launcherIdForView(view);
  if (!id || !getPinnedLauncher(workspace, view)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.filter((launcher) => launcher.id !== id) } };
}

export function setLauncherVisitorVisibility(workspace, launcherId, visitorVisible) {
  if (typeof visitorVisible !== 'boolean' || !workspace.canvas.launchers.some((launcher) => launcher.id === launcherId)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => (
    launcher.id === launcherId ? { ...launcher, visitorVisible } : launcher
  )) } };
}

export function setLauncherStartOpen(workspace, launcherId, startOpen, windowGeometry = null) {
  if (typeof startOpen !== 'boolean' || !workspace.canvas.launchers.some((launcher) => launcher.id === launcherId)) return workspace;
  const valid = windowGeometry
    && Number.isInteger(windowGeometry.column) && windowGeometry.column >= 0
    && Number.isInteger(windowGeometry.row) && windowGeometry.row >= 0
    && Number.isInteger(windowGeometry.columnSpan) && windowGeometry.columnSpan >= 1
    && Number.isInteger(windowGeometry.rowSpan) && windowGeometry.rowSpan >= 1
    ? { ...windowGeometry } : null;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => launcher.id === launcherId ? { ...launcher, startOpen, ...(valid ? { windowGeometry: valid, windowPosition: { column: valid.column, row: valid.row } } : {}) } : launcher) } };
}

function setLauncherPlacement(workspace, launcherId, field, position) {
  const normalized = position && Number.isInteger(position.column) && Number.isInteger(position.row) ? { column: position.column, row: position.row } : null;
  if (!workspace.canvas.launchers.some((launcher) => launcher.id === launcherId)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => launcher.id === launcherId ? { ...launcher, [field]: normalized } : launcher) } };
}

export function setLauncherPosition(workspace, launcherId, position) {
  return setLauncherPlacement(workspace, launcherId, 'position', position);
}

export function setLauncherGeometry(workspace, launcherId, geometry) {
  if (!workspace.canvas.launchers.some((launcher) => launcher.id === launcherId)) return workspace;
  if (!geometry || !['column','row','columnSpan','rowSpan'].every((key) => Number.isInteger(geometry[key])) || geometry.column < 0 || geometry.row < 0 || geometry.columnSpan < 1 || geometry.rowSpan < 1) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => launcher.id === launcherId ? {
    ...launcher,
    position: { column: geometry.column, row: geometry.row },
    span: { columns: geometry.columnSpan, rows: geometry.rowSpan }
  } : launcher) } };
}

export function setLauncherWindowPosition(workspace, launcherId, position) {
  return setLauncherPlacement(workspace, launcherId, 'windowPosition', position);
}

export function setLauncherPresentation(workspace, launcherId, patch) {
  const modes = new Set(['label', 'icon', 'icon_label']);
  if (!workspace.canvas.launchers.some((launcher) => launcher.id === launcherId)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, launchers: workspace.canvas.launchers.map((launcher) => {
    if (launcher.id !== launcherId) return launcher;
    const appearanceMode = modes.has(patch?.appearanceMode) ? patch.appearanceMode : launcher.appearanceMode;
    const minimum = appearanceMode === 'icon' ? 1 : 2;
    const span = patch?.span ? { columns: Math.max(minimum, Math.min(12, Math.round(Number(patch.span.columns) || launcher.span.columns))), rows: Math.max(1, Math.min(8, Math.round(Number(patch.span.rows) || launcher.span.rows))) } : launcher.span;
    const iconKey = typeof patch?.iconKey === 'string' && patch.iconKey.length <= 40 ? patch.iconKey : launcher.iconKey;
    const label = typeof patch?.label === 'string' && patch.label.trim() ? patch.label.trim().slice(0, 80) : launcher.label;
    return { ...launcher, appearanceMode, iconKey, label, span };
  }) } };
}

export function resetCanvasLayout(workspace) {
  return { ...workspace, canvas: {
    ...workspace.canvas,
    launchers: workspace.canvas.launchers.map((launcher) => ({ ...launcher, position: null, windowPosition: null, windowGeometry: null })),
    objects: workspace.canvas.objects.map((object) => ({ ...object, placement: { column: 0, row: object.presentationOrder * object.span.rows } }))
  } };
}
