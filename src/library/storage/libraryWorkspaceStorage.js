import { normalizeProfileAddress } from '../config.js';
import { LIBRARY_WORKSPACE_VERSION, createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { normalizeCanvasObjects } from '../domain/canvasObjects.js';
import { normalizeTablePlacements } from '../domain/tablePlacements.js';

const WORKSPACE_KEY_PREFIXES = [
  null,
  'os-underneath.library-workspace.v1:',
  'os-underneath.library-workspace.v2:',
  'os-underneath.library-workspace.v3:',
  'os-underneath.library-workspace.v4:',
  'os-underneath.library-workspace.v5:',
  'os-underneath.library-workspace.v6:',
  'inscape.library-workspace.v7:',
  'inscape.library-workspace.v8:',
  'inscape.library-workspace.v9:',
];

export function libraryWorkspaceKey(profileAddress, version = LIBRARY_WORKSPACE_VERSION) {
  const normalized = normalizeProfileAddress(profileAddress);
  if (!normalized) throw new TypeError('A valid profile address is required');
  const prefix = WORKSPACE_KEY_PREFIXES[version] || WORKSPACE_KEY_PREFIXES[LIBRARY_WORKSPACE_VERSION];
  return `${prefix}${normalized}`;
}

export function normalizeWorkspace(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  const empty = createEmptyWorkspace(profile);
  if (!profile || !candidate || ![1, 2, 3, 4, 5, 6, 7, 8, LIBRARY_WORKSPACE_VERSION].includes(candidate.version) || normalizeProfileAddress(candidate.profileAddress) !== profile) return empty;
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
  const placements = candidate.version >= 8 ? normalizeTablePlacements(candidate.tables?.placements) : [];
  const validCategoryIds = new Set(folders.map(({ id }) => id)); const organized = new Set(); const sectionIds = new Set();
  const sections = (candidate.version >= 9 && Array.isArray(candidate.categoryOrganization?.sections)
    ? candidate.categoryOrganization.sections : []).flatMap((section) => {
    if (!section || typeof section.id !== 'string' || !section.id || section.id.length > 200 || sectionIds.has(section.id)) return [];
    const name = typeof section.name === 'string' ? section.name.trim().slice(0, 80) : '';
    if (!name) return [];
    sectionIds.add(section.id);
    const categoryIds = (Array.isArray(section.categoryIds) ? section.categoryIds : []).filter((id) => {
      if (!validCategoryIds.has(id) || organized.has(id)) return false; organized.add(id); return true;
    });
    return [{ id: section.id, name, categoryIds }];
  });
  const rootCategoryIds = (candidate.version >= 9 && Array.isArray(candidate.categoryOrganization?.rootCategoryIds)
    ? candidate.categoryOrganization.rootCategoryIds : folders.map(({ id }) => id)).filter((id) => {
    if (!validCategoryIds.has(id) || organized.has(id)) return false; organized.add(id); return true;
  });
  for (const { id } of folders) if (!organized.has(id)) rootCategoryIds.push(id);
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress: profile, favorites, folders,
    categoryOrganization: { rootCategoryIds, sections }, canvas: { launchers: [], objects }, tables: { placements } };
}

export function loadLibraryWorkspace(storage, profileAddress) {
  if (!storage?.getItem) return createEmptyWorkspace(normalizeProfileAddress(profileAddress));
  try {
    const current = storage.getItem(libraryWorkspaceKey(profileAddress));
    if (current) {
      try { return normalizeWorkspace(JSON.parse(current), profileAddress); }
      catch { /* Fall through to the intact Phase 1 record when available. */ }
    }
    const phaseEight = storage.getItem(libraryWorkspaceKey(profileAddress, 8));
    const phaseSeven = storage.getItem(libraryWorkspaceKey(profileAddress, 7));
    const phaseSix = storage.getItem(libraryWorkspaceKey(profileAddress, 6));
    const phaseFive = storage.getItem(libraryWorkspaceKey(profileAddress, 5));
    const phaseFour = storage.getItem(libraryWorkspaceKey(profileAddress, 4));
    const phaseThree = storage.getItem(libraryWorkspaceKey(profileAddress, 3));
    const phaseTwo = storage.getItem(libraryWorkspaceKey(profileAddress, 2));
    const phaseOne = storage.getItem(libraryWorkspaceKey(profileAddress, 1));
    const legacy = phaseEight || phaseSeven || phaseSix || phaseFive || phaseFour || phaseThree || phaseTwo || phaseOne;
    if (!legacy) return createEmptyWorkspace(normalizeProfileAddress(profileAddress));
    const migrated = normalizeWorkspace(JSON.parse(legacy), profileAddress);
    saveLibraryWorkspace(storage, migrated);
    return migrated;
  } catch { return createEmptyWorkspace(normalizeProfileAddress(profileAddress)); }
}

export function inspectLibraryWorkspaceRecord(storage, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !storage?.getItem) return { presence: 'unavailable', profileAddress: profile };
  try {
    const current = storage.getItem(libraryWorkspaceKey(profile));
    if (current !== null) {
      try {
        const parsed = JSON.parse(current);
        const valid = normalizeProfileAddress(parsed?.profileAddress) === profile
          && [1, 2, 3, 4, 5, 6, 7, 8, LIBRARY_WORKSPACE_VERSION].includes(parsed?.version);
        return { presence: valid ? 'current' : 'invalid', profileAddress: profile };
      } catch { return { presence: 'invalid', profileAddress: profile }; }
    }
    for (const version of [8, 7, 6, 5, 4, 3, 2, 1]) {
      if (storage.getItem(libraryWorkspaceKey(profile, version)) !== null) {
        return { presence: 'legacy', profileAddress: profile, version };
      }
    }
    return { presence: 'absent', profileAddress: profile };
  } catch { return { presence: 'unavailable', profileAddress: profile }; }
}

export function saveLibraryWorkspace(storage, workspace) {
  if (!storage?.setItem) return false;
  try {
    const normalized = normalizeWorkspace(workspace, workspace.profileAddress);
    storage.setItem(libraryWorkspaceKey(normalized.profileAddress), JSON.stringify(normalized));
    return true;
  } catch { return false; }
}
