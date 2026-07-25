import { normalizeProfileAddress } from '../config.js';
import { LIBRARY_WORKSPACE_VERSION, createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { normalizeCanvasObjects } from '../domain/canvasObjects.js';

export const LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v3:';
export const LIBRARY_WORKSPACE_V4_KEY_PREFIX = 'os-underneath.library-workspace.v4:';
export const LIBRARY_WORKSPACE_V5_KEY_PREFIX = 'os-underneath.library-workspace.v5:';
export const LIBRARY_WORKSPACE_V6_KEY_PREFIX = 'os-underneath.library-workspace.v6:';
export const LIBRARY_WORKSPACE_V7_KEY_PREFIX = 'inscape.library-workspace.v7:';
export const LEGACY_V2_LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v2:';
export const LEGACY_LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v1:';

export function libraryWorkspaceKey(profileAddress, version = LIBRARY_WORKSPACE_VERSION) {
  const normalized = normalizeProfileAddress(profileAddress);
  if (!normalized) throw new TypeError('A valid profile address is required');
  const prefix = version === 1 ? LEGACY_LIBRARY_WORKSPACE_KEY_PREFIX
    : version === 2 ? LEGACY_V2_LIBRARY_WORKSPACE_KEY_PREFIX : version === 3 ? LIBRARY_WORKSPACE_KEY_PREFIX : version === 4 ? LIBRARY_WORKSPACE_V4_KEY_PREFIX : version === 5 ? LIBRARY_WORKSPACE_V5_KEY_PREFIX : version === 6 ? LIBRARY_WORKSPACE_V6_KEY_PREFIX : LIBRARY_WORKSPACE_V7_KEY_PREFIX;
  return `${prefix}${normalized}`;
}

export function normalizeWorkspace(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  const empty = createEmptyWorkspace(profile);
  if (!profile || !candidate || ![1, 2, 3, 4, 5, 6, LIBRARY_WORKSPACE_VERSION].includes(candidate.version) || normalizeProfileAddress(candidate.profileAddress) !== profile) return empty;
  const favorites = [...new Set((Array.isArray(candidate.favorites) ? candidate.favorites : []).filter((id) => typeof id === 'string' && id.length <= 300))];
  const legacyPublicFolderIds = new Set((candidate.version < 7 && Array.isArray(candidate.canvas?.launchers) ? candidate.canvas.launchers : [])
    .filter((launcher) => launcher?.viewType === 'folder' && (candidate.version === 2 || launcher.visitorVisible === true))
    .map((launcher) => launcher.folderId));
  const seen = new Set();
  const folders = (Array.isArray(candidate.folders) ? candidate.folders : []).flatMap((folder) => {
    if (!folder || typeof folder.id !== 'string' || !folder.id || folder.id.length > 200 || seen.has(folder.id)) return [];
    const name = typeof folder.name === 'string' ? folder.name.trim().slice(0, 80) : '';
    if (!name) return [];
    seen.add(folder.id);
    return [{ id: folder.id, name, assetIds: [...new Set((Array.isArray(folder.assetIds) ? folder.assetIds : []).filter((id) => typeof id === 'string' && id.length <= 300))], public: candidate.version >= 7 ? folder.public === true : legacyPublicFolderIds.has(folder.id),
      createdAt: Number.isFinite(folder.createdAt) ? folder.createdAt : 0, updatedAt: Number.isFinite(folder.updatedAt) ? folder.updatedAt : 0 }];
  });
  const objects = candidate.version >= 6 ? normalizeCanvasObjects(candidate.canvas?.objects) : [];
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress: profile, favorites, folders, canvas: { launchers: [], objects } };
}

export function loadLibraryWorkspace(storage, profileAddress) {
  if (!storage?.getItem) return createEmptyWorkspace(normalizeProfileAddress(profileAddress));
  try {
    const current = storage.getItem(libraryWorkspaceKey(profileAddress));
    if (current) {
      try { return normalizeWorkspace(JSON.parse(current), profileAddress); }
      catch { /* Fall through to the intact Phase 1 record when available. */ }
    }
    const phaseSix = storage.getItem(libraryWorkspaceKey(profileAddress, 6));
    const phaseFive = storage.getItem(libraryWorkspaceKey(profileAddress, 5));
    const phaseFour = storage.getItem(libraryWorkspaceKey(profileAddress, 4));
    const phaseThree = storage.getItem(libraryWorkspaceKey(profileAddress, 3));
    const phaseTwo = storage.getItem(libraryWorkspaceKey(profileAddress, 2));
    const phaseOne = storage.getItem(libraryWorkspaceKey(profileAddress, 1));
    const legacy = phaseSix || phaseFive || phaseFour || phaseThree || phaseTwo || phaseOne;
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
