import { normalizeProfileAddress } from '../config.js';
import { LIBRARY_WORKSPACE_VERSION, createEmptyWorkspace, launcherIdForView } from '../domain/libraryWorkspace.js';

export const LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v2:';
export const LEGACY_LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v1:';

export function libraryWorkspaceKey(profileAddress, version = LIBRARY_WORKSPACE_VERSION) {
  const normalized = normalizeProfileAddress(profileAddress);
  if (!normalized) throw new TypeError('A valid profile address is required');
  return `${version === 1 ? LEGACY_LIBRARY_WORKSPACE_KEY_PREFIX : LIBRARY_WORKSPACE_KEY_PREFIX}${normalized}`;
}

function normalizePosition(position) {
  return position && Number.isInteger(position.column) && Number.isInteger(position.row) && position.column >= 0 && position.row >= 0
    ? { column: position.column, row: position.row }
    : null;
}

export function normalizeWorkspace(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  const empty = createEmptyWorkspace(profile);
  if (!profile || !candidate || ![1, LIBRARY_WORKSPACE_VERSION].includes(candidate.version) || normalizeProfileAddress(candidate.profileAddress) !== profile) return empty;
  const favorites = [...new Set((Array.isArray(candidate.favorites) ? candidate.favorites : []).filter((id) => typeof id === 'string' && id.length <= 300))];
  const seen = new Set();
  const folders = (Array.isArray(candidate.folders) ? candidate.folders : []).flatMap((folder) => {
    if (!folder || typeof folder.id !== 'string' || !folder.id || folder.id.length > 200 || seen.has(folder.id)) return [];
    const name = typeof folder.name === 'string' ? folder.name.trim().slice(0, 80) : '';
    if (!name) return [];
    seen.add(folder.id);
    return [{ id: folder.id, name, assetIds: [...new Set((Array.isArray(folder.assetIds) ? folder.assetIds : []).filter((id) => typeof id === 'string' && id.length <= 300))],
      createdAt: Number.isFinite(folder.createdAt) ? folder.createdAt : 0, updatedAt: Number.isFinite(folder.updatedAt) ? folder.updatedAt : 0 }];
  });
  const folderIds = new Set(folders.map((folder) => folder.id));
  const launcherIds = new Set();
  const launchers = (candidate.version === LIBRARY_WORKSPACE_VERSION && Array.isArray(candidate.canvas?.launchers) ? candidate.canvas.launchers : []).flatMap((launcher) => {
    const view = launcher?.viewType === 'favorites'
      ? { type: 'favorites', id: null }
      : launcher?.viewType === 'folder' && folderIds.has(launcher.folderId) ? { type: 'folder', id: launcher.folderId } : null;
    const id = launcherIdForView(view);
    if (!id || launcherIds.has(id)) return [];
    launcherIds.add(id);
    return [{ id, viewType: view.type, folderId: view.type === 'folder' ? view.id : null,
      position: normalizePosition(launcher.position), windowPosition: normalizePosition(launcher.windowPosition) }];
  });
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress: profile, favorites, folders, canvas: { launchers } };
}

export function loadLibraryWorkspace(storage, profileAddress) {
  if (!storage?.getItem) return createEmptyWorkspace(normalizeProfileAddress(profileAddress));
  try {
    const current = storage.getItem(libraryWorkspaceKey(profileAddress));
    if (current) {
      try { return normalizeWorkspace(JSON.parse(current), profileAddress); }
      catch { /* Fall through to the intact Phase 1 record when available. */ }
    }
    const legacy = storage.getItem(libraryWorkspaceKey(profileAddress, 1));
    if (!legacy) return createEmptyWorkspace(normalizeProfileAddress(profileAddress));
    const migrated = normalizeWorkspace(JSON.parse(legacy), profileAddress);
    saveLibraryWorkspace(storage, migrated);
    return migrated;
  } catch { return createEmptyWorkspace(normalizeProfileAddress(profileAddress)); }
}

export function saveLibraryWorkspace(storage, workspace) {
  if (!storage?.setItem) return false;
  try {
    const normalized = normalizeWorkspace(workspace, workspace.profileAddress);
    storage.setItem(libraryWorkspaceKey(normalized.profileAddress), JSON.stringify(normalized));
    return true;
  } catch { return false; }
}
