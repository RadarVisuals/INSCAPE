import { normalizeProfileAddress } from '../config.js';
import { LIBRARY_WORKSPACE_VERSION, createEmptyWorkspace } from '../domain/libraryWorkspace.js';
export const LIBRARY_WORKSPACE_KEY_PREFIX = 'os-underneath.library-workspace.v1:';
export function libraryWorkspaceKey(profileAddress) {
  const normalized = normalizeProfileAddress(profileAddress);
  if (!normalized) throw new TypeError('A valid profile address is required');
  return `${LIBRARY_WORKSPACE_KEY_PREFIX}${normalized}`;
}
export function normalizeWorkspace(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  const empty = createEmptyWorkspace(profile);
  if (!profile || !candidate || candidate.version !== LIBRARY_WORKSPACE_VERSION || normalizeProfileAddress(candidate.profileAddress) !== profile) return empty;
  const favorites = [...new Set((Array.isArray(candidate.favorites) ? candidate.favorites : []).filter((id) => typeof id === 'string' && id.length <= 300))];
  const seen = new Set();
  const folders = (Array.isArray(candidate.folders) ? candidate.folders : []).flatMap((folder) => {
    if (!folder || typeof folder.id !== 'string' || !folder.id || seen.has(folder.id)) return [];
    const name = typeof folder.name === 'string' ? folder.name.trim().slice(0, 80) : '';
    if (!name) return [];
    seen.add(folder.id);
    return [{ id: folder.id, name, assetIds: [...new Set((Array.isArray(folder.assetIds) ? folder.assetIds : []).filter((id) => typeof id === 'string' && id.length <= 300))],
      createdAt: Number.isFinite(folder.createdAt) ? folder.createdAt : 0, updatedAt: Number.isFinite(folder.updatedAt) ? folder.updatedAt : 0 }];
  });
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress: profile, favorites, folders };
}
export function loadLibraryWorkspace(storage, profileAddress) {
  if (!storage?.getItem) return createEmptyWorkspace(normalizeProfileAddress(profileAddress));
  try {
    const source = storage.getItem(libraryWorkspaceKey(profileAddress));
    return source ? normalizeWorkspace(JSON.parse(source), profileAddress) : createEmptyWorkspace(normalizeProfileAddress(profileAddress));
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
