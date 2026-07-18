import { normalizeProfileAddress } from '../config.js';
import { LIBRARY_WORKSPACE_VERSION, createEmptyWorkspace, launcherIdForView } from '../domain/libraryWorkspace.js';

export const LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v3:';
export const LIBRARY_WORKSPACE_V4_KEY_PREFIX = 'os-underneath.library-workspace.v4:';
export const LIBRARY_WORKSPACE_V5_KEY_PREFIX = 'os-underneath.library-workspace.v5:';
export const LEGACY_V2_LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v2:';
export const LEGACY_LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v1:';

export function libraryWorkspaceKey(profileAddress, version = LIBRARY_WORKSPACE_VERSION) {
  const normalized = normalizeProfileAddress(profileAddress);
  if (!normalized) throw new TypeError('A valid profile address is required');
  const prefix = version === 1 ? LEGACY_LIBRARY_WORKSPACE_KEY_PREFIX
    : version === 2 ? LEGACY_V2_LIBRARY_WORKSPACE_KEY_PREFIX : version === 3 ? LIBRARY_WORKSPACE_KEY_PREFIX : version === 4 ? LIBRARY_WORKSPACE_V4_KEY_PREFIX : LIBRARY_WORKSPACE_V5_KEY_PREFIX;
  return `${prefix}${normalized}`;
}

function normalizePosition(position) {
  return position && Number.isInteger(position.column) && Number.isInteger(position.row) && position.column >= 0 && position.row >= 0
    ? { column: position.column, row: position.row }
    : null;
}

export function normalizeWorkspace(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  const empty = createEmptyWorkspace(profile);
  if (!profile || !candidate || ![1, 2, 3, 4, LIBRARY_WORKSPACE_VERSION].includes(candidate.version) || normalizeProfileAddress(candidate.profileAddress) !== profile) return empty;
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
  const launchers = (candidate.version >= 2 && Array.isArray(candidate.canvas?.launchers) ? candidate.canvas.launchers : []).flatMap((launcher) => {
    const view = launcher?.viewType === 'favorites'
      ? { type: 'favorites', id: null }
      : launcher?.viewType === 'folder' && folderIds.has(launcher.folderId) ? { type: 'folder', id: launcher.folderId } : null;
    const id = launcherIdForView(view);
    if (!id || launcherIds.has(id)) return [];
    launcherIds.add(id);
    return [{ id, viewType: view.type, folderId: view.type === 'folder' ? view.id : null,
      visitorVisible: candidate.version === 2 ? true : launcher.visitorVisible === true, startOpen: candidate.version >= 5 && launcher.startOpen === true,
      label: candidate.version >= 5 && typeof launcher.label === 'string' && launcher.label.trim() ? launcher.label.trim().slice(0, 80) : null,
      position: normalizePosition(launcher.position), windowPosition: normalizePosition(launcher.windowPosition),
      windowGeometry: candidate.version >= 5 && launcher.windowGeometry
        && Number.isInteger(launcher.windowGeometry.column) && launcher.windowGeometry.column >= 0
        && Number.isInteger(launcher.windowGeometry.row) && launcher.windowGeometry.row >= 0
        && Number.isInteger(launcher.windowGeometry.columnSpan) && launcher.windowGeometry.columnSpan >= 1
        && Number.isInteger(launcher.windowGeometry.rowSpan) && launcher.windowGeometry.rowSpan >= 1
        ? { ...launcher.windowGeometry } : null,
      appearanceMode: ['label','icon','icon_label'].includes(launcher.appearanceMode) ? launcher.appearanceMode : 'label',
      iconKey: typeof launcher.iconKey === 'string' && launcher.iconKey.length <= 40 ? launcher.iconKey : view.type === 'favorites' ? 'favorites' : 'folder',
      span: { columns: Math.max(1, Math.min(12, Math.round(Number(launcher.span?.columns) || 3))), rows: Math.max(1, Math.min(8, Math.round(Number(launcher.span?.rows) || 1))) },
      presentationOrder: Number.isInteger(launcher.presentationOrder) ? launcher.presentationOrder : launcherIds.size + 3 }];
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
    const phaseFour = storage.getItem(libraryWorkspaceKey(profileAddress, 4));
    const phaseThree = storage.getItem(libraryWorkspaceKey(profileAddress, 3));
    const phaseTwo = storage.getItem(libraryWorkspaceKey(profileAddress, 2));
    const phaseOne = storage.getItem(libraryWorkspaceKey(profileAddress, 1));
    const legacy = phaseFour || phaseThree || phaseTwo || phaseOne;
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
