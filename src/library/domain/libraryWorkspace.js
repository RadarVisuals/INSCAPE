import { isValidPublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import { imageResourceIdentity } from '../data/resolveContentUrl.js';

export const LIBRARY_WORKSPACE_VERSION = 9;

export const LIBRARY_VIEW_TYPES = Object.freeze({ ALL: 'all', FAVORITES: 'favorites', FOLDER: 'folder' });

function folderId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sectionId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function organization(workspace) {
  return workspace.categoryOrganization || { rootCategoryIds: workspace.folders.map(({ id }) => id), sections: [] };
}

function sameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function createEmptyWorkspace(profileAddress) {
  return { version: LIBRARY_WORKSPACE_VERSION, profileAddress, favorites: [], folders: [],
    categoryOrganization: { rootCategoryIds: [], sections: [] },
    canvas: { launchers: [], objects: [] }, tables: { placements: [] } };
}

export function createFolder(workspace, name, now = Date.now(), parentId = null) {
  if (parentId && !workspace.folders.some(folder => folder.id === parentId)) return workspace;
  const trimmed = String(name || '').trim();
  if (!trimmed) return workspace;
  const id = folderId(); const current = organization(workspace);
  return { ...workspace, folders: [...workspace.folders, { id, name: trimmed, ...(parentId ? { parentId } : {}), assetIds: [], public: false, createdAt: now, updatedAt: now }],
    categoryOrganization: { ...current, rootCategoryIds: parentId ? current.rootCategoryIds : [...current.rootCategoryIds, id] } };
}

export function renameFolder(workspace, id, name, now = Date.now()) {
  const trimmed = String(name || '').trim();
  if (!trimmed || !workspace.folders.some((folder) => folder.id === id)) return workspace;
  return { ...workspace, folders: workspace.folders.map((folder) => folder.id === id ? { ...folder, name: trimmed, updatedAt: now } : folder) };
}

export function deleteFolder(workspace, id) {
  if (!workspace.folders.some((folder) => folder.id === id)) return workspace;
  const current = organization(workspace);
  return {
    ...workspace,
    folders: workspace.folders.filter((folder) => folder.id !== id).map(folder => folder.parentId === id
      ? { ...folder, parentId: null } : folder),
    categoryOrganization: {
      rootCategoryIds: [...current.rootCategoryIds.filter((categoryId) => categoryId !== id), ...workspace.folders.filter(folder => folder.parentId === id).map(folder => folder.id)],
      sections: current.sections.map((section) => ({ ...section,
        categoryIds: section.categoryIds.filter((categoryId) => categoryId !== id) })),
    },
  };
}

export function createCategorySection(workspace, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return workspace;
  const current = organization(workspace);
  return { ...workspace, categoryOrganization: { ...current,
    sections: [...current.sections, { id: sectionId(), name: trimmed, categoryIds: [] }] } };
}

export function renameCategorySection(workspace, id, name) {
  const trimmed = String(name || '').trim(); const current = organization(workspace);
  if (!trimmed || !current.sections.some((section) => section.id === id)) return workspace;
  return { ...workspace, categoryOrganization: { ...current,
    sections: current.sections.map((section) => section.id === id ? { ...section, name: trimmed } : section) } };
}

export function deleteCategorySection(workspace, id) {
  const current = organization(workspace); const removed = current.sections.find((section) => section.id === id);
  if (!removed) return workspace;
  return { ...workspace, categoryOrganization: {
    rootCategoryIds: [...current.rootCategoryIds, ...removed.categoryIds],
    sections: current.sections.filter((section) => section.id !== id),
  } };
}

export function moveCategory(workspace, id, sectionIdValue = null, beforeId = null, parentId = null) {
  const byId = new Map(workspace.folders.map(folder => [folder.id, folder]));
  if (parentId && !byId.has(parentId)) return workspace;
  for (let ancestor = parentId; ancestor; ancestor = byId.get(ancestor)?.parentId) if (ancestor === id) return workspace;
  if (!workspace.folders.some((folder) => folder.id === id) || id === beforeId) return workspace;
  const current = organization(workspace);
  if (sectionIdValue && !current.sections.some((section) => section.id === sectionIdValue)) return workspace;
  const rootCategoryIds = current.rootCategoryIds.filter((categoryId) => categoryId !== id);
  const sections = current.sections.map((section) => ({ ...section,
    categoryIds: section.categoryIds.filter((categoryId) => categoryId !== id) }));
  const target = parentId ? [] : sectionIdValue ? sections.find((section) => section.id === sectionIdValue).categoryIds : rootCategoryIds;
  const index = beforeId ? target.indexOf(beforeId) : -1;
  target.splice(index < 0 ? target.length : index, 0, id);
  const unchanged = (byId.get(id)?.parentId || null) === parentId && sameIds(rootCategoryIds, current.rootCategoryIds)
    && sections.every((section, sectionIndex) => sameIds(section.categoryIds, current.sections[sectionIndex].categoryIds));
  return unchanged ? workspace : { ...workspace, folders: workspace.folders.map(folder => folder.id === id
    ? { ...folder, ...(parentId ? { parentId } : folder.parentId ? { parentId: null } : {}) } : folder), categoryOrganization: { rootCategoryIds, sections } };
}

export function moveCategorySection(workspace, id, beforeId = null) {
  if (id === beforeId) return workspace;
  const current = organization(workspace); const moved = current.sections.find((section) => section.id === id);
  if (!moved) return workspace;
  const sections = current.sections.filter((section) => section.id !== id);
  const index = beforeId ? sections.findIndex((section) => section.id === beforeId) : -1;
  sections.splice(index < 0 ? sections.length : index, 0, moved);
  return sections.every((section, sectionIndex) => section.id === current.sections[sectionIndex].id)
    ? workspace : { ...workspace, categoryOrganization: { ...current, sections } };
}

export function setFolderAsset(workspace, folderIdValue, assetId, included, now = Date.now()) {
  return setFolderAssets(workspace, folderIdValue, [assetId], included, now);
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
  const imageSelections = (folder.imageSelections || []).filter(({ assetId }) => !requested.has(assetId));
  if (nextAssetIds.length === folder.assetIds.length
    && nextAssetIds.every((id, index) => id === folder.assetIds[index])
    && imageSelections.length === (folder.imageSelections || []).length) return workspace;
  return { ...workspace, folders: workspace.folders.map((candidate) => candidate.id === folderIdValue
    ? { ...candidate, assetIds: nextAssetIds, ...(candidate.imageSelections ? { imageSelections } : {}), updatedAt: now } : candidate) };
}

// Asset IDs retain source/ownership scope; image selections only narrow the
// material shown in this category. Choosing an image replaces a whole-asset entry.
export function setFolderImage(workspace, folderIdValue, assetId, url, included, now = Date.now()) {
  if (!isValidPublishedAssetUrl(url) || typeof included !== 'boolean' || !assetId) return workspace;
  const folder = workspace.folders.find(({ id }) => id === folderIdValue);
  if (!folder) return workspace;
  const previous = folder.imageSelections || [];
  const matches = entry => entry.assetId === assetId && imageResourceIdentity(entry.url) === imageResourceIdentity(url);
  if (included && previous.some(matches)) return workspace;
  if (!included && !previous.some(entry => entry.assetId === assetId)) return setFolderAsset(workspace, folderIdValue, assetId, false, now);
  if (!included && !previous.some(matches)) return workspace;
  const imageSelections = included ? [...previous, { assetId, url }] : previous.filter(entry => !matches(entry));
  const assetIds = included ? [...new Set([...folder.assetIds, assetId])]
    : imageSelections.some(entry => entry.assetId === assetId) ? folder.assetIds : folder.assetIds.filter(id => id !== assetId);
  return { ...workspace, folders: workspace.folders.map(candidate => candidate.id === folderIdValue
    ? { ...candidate, assetIds, imageSelections, updatedAt: now } : candidate) };
}

export function moveFolderAssets(workspace, fromId, toId, ids, imageUrl = null) {
  const source = workspace.folders.find(folder => folder.id === fromId);
  const target = workspace.folders.find(folder => folder.id === toId);
  if (!source || !target || fromId === toId || !Array.isArray(ids) || !ids.length
    || !ids.every(id => source.assetIds.includes(id))) return workspace;
  if (imageUrl && (ids.length !== 1 || !isValidPublishedAssetUrl(imageUrl))) return workspace;
  let next = workspace;
  for (const id of new Set(ids)) {
    const selected = (source.imageSelections || []).filter(entry => entry.assetId === id);
    if (imageUrl && selected.length && !selected.some(entry => imageResourceIdentity(entry.url) === imageResourceIdentity(imageUrl))) return workspace;
    const urls = imageUrl ? [imageUrl] : selected.map(entry => entry.url);
    const targetHasWholeAsset = target.assetIds.includes(id) && !target.imageSelections?.some(entry => entry.assetId === id);
    if (!targetHasWholeAsset) {
      if (urls.length) {
        for (const url of urls) next = setFolderImage(next, toId, id, url, true);
      } else next = setFolderAssets(next, toId, [id], true);
    }
    next = imageUrl ? setFolderImage(next, fromId, id, imageUrl, false) : setFolderAssets(next, fromId, [id], false);
  }
  return next;
}

export function normalizeCategoryImageSelections(folder) {
  if (folder.imageSelections === undefined) return {};
  if (!Array.isArray(folder.imageSelections) || folder.imageSelections.some(entry => !entry
    || !folder.assetIds.includes(entry.assetId) || !isValidPublishedAssetUrl(entry.url)))
    throw new TypeError('Saved category image selections are invalid.');
  return { imageSelections: [...new Map(folder.imageSelections.map(({ assetId, url }) =>
    [`${assetId}\n${imageResourceIdentity(url)}`, { assetId, url }])).values()] };
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
