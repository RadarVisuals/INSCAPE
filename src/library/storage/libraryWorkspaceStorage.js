import { normalizeProfileAddress } from '../config.js';
import { LIBRARY_WORKSPACE_VERSION, createEmptyWorkspace, normalizeCategoryImageSelections } from '../domain/libraryWorkspace.js';
import { normalizeCanvasObjects } from '../domain/canvasObjects.js';
import { normalizeTablePlacements } from '../domain/tablePlacements.js';

export function libraryWorkspaceKey(profileAddress) {
  const normalized = normalizeProfileAddress(profileAddress);
  if (!normalized) throw new TypeError('A valid profile address is required');
  return `inscape.library-workspace.v${LIBRARY_WORKSPACE_VERSION}:${normalized}`;
}

export function normalizeWorkspace(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !candidate || candidate.version !== LIBRARY_WORKSPACE_VERSION || normalizeProfileAddress(candidate.profileAddress) !== profile)
    throw new TypeError('Saved Library data has an unsupported version or profile.');
  const favorites = [...new Set((Array.isArray(candidate.favorites) ? candidate.favorites : []).filter((id) => typeof id === 'string' && id.length <= 300))];
  const seen = new Set();
  const folders = (Array.isArray(candidate.folders) ? candidate.folders : []).flatMap((folder) => {
    if (!folder || typeof folder.id !== 'string' || !folder.id || folder.id.length > 200 || seen.has(folder.id)) return [];
    const name = typeof folder.name === 'string' ? folder.name.trim().slice(0, 80) : '';
    if (!name) return [];
    seen.add(folder.id);
    return [{ id: folder.id, name, assetIds: [...new Set((Array.isArray(folder.assetIds) ? folder.assetIds : []).filter((id) => typeof id === 'string' && id.length <= 300))], public: folder.public === true,
      ...normalizeCategoryImageSelections(folder),
      createdAt: Number.isFinite(folder.createdAt) ? folder.createdAt : 0, updatedAt: Number.isFinite(folder.updatedAt) ? folder.updatedAt : 0 }];
  });
  const objects = normalizeCanvasObjects(candidate.canvas?.objects);
  const placements = normalizeTablePlacements(candidate.tables?.placements);
  const validCategoryIds = new Set(folders.map(({ id }) => id)); const organized = new Set(); const sectionIds = new Set();
  const sections = (Array.isArray(candidate.categoryOrganization?.sections)
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
  const rootCategoryIds = (Array.isArray(candidate.categoryOrganization?.rootCategoryIds)
    ? candidate.categoryOrganization.rootCategoryIds : folders.map(({ id }) => id)).filter((id) => {
    if (!validCategoryIds.has(id) || organized.has(id)) return false; organized.add(id); return true;
  });
  for (const { id } of folders) if (!organized.has(id)) rootCategoryIds.push(id);
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress: profile, favorites, folders,
    categoryOrganization: { rootCategoryIds, sections }, canvas: { launchers: [], objects }, tables: { placements } };
}

// Read once: the accepted workspace and conflict token describe the same bytes.
// Missing current-format data is empty; failed or unsupported reads stay failures.
export function loadLibraryWorkspace(storage, profileAddress) {
  if (!storage?.getItem) throw new Error('Library storage is unavailable.');
  const profile = normalizeProfileAddress(profileAddress);
  const raw = storage.getItem(libraryWorkspaceKey(profile));
  return { raw, workspace: raw === null ? createEmptyWorkspace(profile) : normalizeWorkspace(JSON.parse(raw), profile) };
}
