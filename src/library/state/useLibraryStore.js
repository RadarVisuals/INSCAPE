import { authoredStorage, hydrateWorkspace, workspaceSession } from '../../workspace/profileWorkspace.js';
import { saveMissingSnapshots } from '../curatedSnapshots.js';
import { create } from 'zustand';
import { createLibraryInventoryActions } from './libraryInventoryActions.js';
import { normalizeProfileAddress } from '../config.js';
import { useWalletStore } from '../../store/useWalletStore.js';
import { developmentLog } from '../../diagnostics.js';
import {
  createFolder,
  createCategorySection,
  deleteCategorySection,
  deleteFolder,
  moveCategory,
  moveFolderAssets,
  moveCategorySection,
  renameCategorySection,
  renameFolder,
  setFolderAsset,
  setFolderAssets,
  setFolderImage,
  setFolderPublic,
  toggleFavorite
} from '../domain/libraryWorkspace.js';
import { browserLibraryStorage, createLibraryWorkspacePersistence } from '../storage/libraryWorkspacePersistence.js';
import { loadLibraryAssetCache, saveLibraryAssetCache } from '../storage/libraryAssetCache.js';

const profileAddress = normalizeProfileAddress(useWalletStore.getState().hostProfileAddress);
let workspaceStorage = browserLibraryStorage();
let workspacePersistence = createLibraryWorkspacePersistence(authoredStorage(workspaceStorage));
let injected = false;
const initialWorkspace = { workspace: null, persistenceError: null };

function commitWorkspace(set, get, workspace) {
  if (workspace === get().workspace) return false;
  if (!get().workspace || workspace?.profileAddress !== get().profileAddress) return false;
  const result = workspacePersistence.save(workspace);
  if (!result.accepted && !result.ok) { set({ persistenceError: result.error }); return false; }
  set({ workspace, persistenceError: null });
  return true;
}

function commitProfileScopedCategory(set, get, expectedProfileAddress, update) {
  const expectedProfile = normalizeProfileAddress(expectedProfileAddress);
  const before = get();
  if (!expectedProfile || before.profileAddress !== expectedProfile
    || normalizeProfileAddress(before.workspace?.profileAddress) !== expectedProfile) return null;
  const workspace = update(before.workspace);
  if (workspace === before.workspace) return null;
  const current = get();
  if (current.profileAddress !== expectedProfile || current.workspace !== before.workspace
    || normalizeProfileAddress(current.workspace?.profileAddress) !== expectedProfile) return null;
  return commitWorkspace(set, get, workspace) ? workspace : null;
}

export const useLibraryStore = create((set, get) => ({
  profileAddress,
  assets: loadLibraryAssetCache(workspaceStorage, profileAddress),
  sourceMode: null,
  status: 'idle',
  progress: { resolved: 0, total: 0, failures: 0 },
  error: null,
  liveError: null,
  ...initialWorkspace,
  loadGeneration: 0,

  setProfileAddress(nextProfileAddress) {
    const profile = normalizeProfileAddress(nextProfileAddress);
    if (!profile) return false;
    if (profile === get().profileAddress && get().workspace) return true;
    if (!injected && !workspaceSession(profile)?.rows) {
      if (get().profileAddress !== profile) { get().cancel(); set({ loadGeneration: get().loadGeneration + 1 }); }
      set({ profileAddress: profile, workspace: null, assets: [], referencedAssets: [], persistenceError: null });
      void hydrateWorkspace(profile).then(session => {
        if (get().profileAddress !== profile) return;
        if (session.rows) get().setProfileAddress(profile);
        else set({ persistenceError: session.state.message });
      });
      return false;
    }
    developmentLog('[asset-index] profile changed', {
      previousProfileAddress: get().profileAddress,
      profileAddress: profile
    });
    get().cancel();
    set({ profileAddress: profile, ...workspacePersistence.load(profile), assets: loadLibraryAssetCache(workspaceStorage, profile), referencedAssets: [], hasMore: false, inventoryComplete: false, sourceMode: null, status: 'idle', error: null, liveError: null,
      progress: { resolved: 0, total: 0, failures: 0 },
      loadGeneration: get().loadGeneration + 1 });
    return true;
  },

  ...createLibraryInventoryActions(set, get, () => saveLibraryAssetCache(workspaceStorage, get().profileAddress, get().assets)),
  discardUnavailableAsset(assetId) {
    const assets = get().assets.filter((asset) => asset.id !== assetId);
    if (assets.length === get().assets.length) return false;
    set({ assets });
    saveLibraryAssetCache(workspaceStorage, get().profileAddress, assets);
    return true;
  },
  createFolder(name) {
    if (!get().workspace) return false;
    const workspace = createFolder(get().workspace, name);
    const created = workspace.folders.length > get().workspace.folders.length ? workspace.folders.at(-1) : null;
    const committed = commitWorkspace(set, get, workspace);
    return committed ? created?.id || null : null;
  },
  renameFolder(id, name) {
    if (!get().workspace) return false;
    const workspace = renameFolder(get().workspace, id, name); commitWorkspace(set, get, workspace);
  },
  deleteFolder(id) {
    if (!get().workspace) return false;
    const workspace = deleteFolder(get().workspace, id);
    commitWorkspace(set, get, workspace);
  },
  setFolderAsset(folderId, assetId, included) {
    if (!get().workspace) return false;
    const workspace = setFolderAsset(get().workspace, folderId, assetId, included); commitWorkspace(set, get, workspace);
  },
  toggleFavorite(assetId) {
    if (!get().workspace) return false;
    const workspace = toggleFavorite(get().workspace, assetId); commitWorkspace(set, get, workspace);
  },
  setFolderPublic(folderId, isPublic) {
    if (!get().workspace) return false;
    const workspace = setFolderPublic(get().workspace, folderId, isPublic); commitWorkspace(set, get, workspace);
  },
  commitCategoryForProfile(expectedProfileAddress, command, records) {
    const beforeIds = command?.type === 'create' ? new Set(get().workspace?.folders?.map(({ id }) => id) || []) : null;
    const beforeSectionIds = command?.type === 'create-section'
      ? new Set(get().workspace?.categoryOrganization?.sections?.map(({ id }) => id) || []) : null;
    const workspace = commitProfileScopedCategory(set, get, expectedProfileAddress, (current) => {
      if (command?.type === 'create') {
        if (command.sectionId && !current.categoryOrganization?.sections.some(section => section.id === command.sectionId)) return current;
        const created = createFolder(current, command.name, Date.now(), command.parentId);
        return created === current || command.parentId || !command.sectionId ? created
          : moveCategory(created, created.folders.at(-1).id, command.sectionId);
      }
      if (command?.type === 'move-assets') return moveFolderAssets(current, command.fromId, command.toId, command.assetIds, command.imageUrl);
      if (command?.type === 'rename') return renameFolder(current, command.categoryId, command.name);
      if (command?.type === 'delete') return deleteFolder(current, command.categoryId);
      if (command?.type === 'public') return setFolderPublic(current, command.categoryId, command.value);
      if (command?.type === 'create-section') return createCategorySection(current, command.name);
      if (command?.type === 'rename-section') return renameCategorySection(current, command.sectionId, command.name);
      if (command?.type === 'delete-section') return deleteCategorySection(current, command.sectionId);
      if (command?.type === 'move-category') return moveCategory(current, command.categoryId, command.sectionId, command.beforeId, command.parentId);
      if (command?.type === 'move-section') return moveCategorySection(current, command.sectionId, command.beforeId);
      const capture = (next, ids) => next !== current && records && command.value
        ? saveMissingSnapshots(next, ids, records) : next;
      if (command?.type === 'asset') return capture(setFolderAsset(current, command.categoryId, command.assetId, command.value), [command.assetId]);
      if (command?.type === 'assets' || command?.type === 'image') {
        const acceptedIds = new Set([...get().assets.map(({ id }) => id),
          ...(command.acceptedAssetIds || [])]);
        const assetIds = Array.isArray(command.assetIds) ? [...new Set(command.assetIds)] : [];
        if (!assetIds.length || assetIds.some((id) => typeof id !== 'string' || !acceptedIds.has(id))) return current;
        if (command.type === 'image') return assetIds.length === 1
          ? capture(setFolderImage(current, command.categoryId, assetIds[0], command.url, command.value), assetIds) : current;
        return capture(setFolderAssets(current, command.categoryId, assetIds, command.value), assetIds);
      }
      return current;
    });
    if (beforeIds) return workspace?.folders.find(({ id }) => !beforeIds.has(id))?.id || null;
    if (beforeSectionIds) return workspace?.categoryOrganization.sections.find(({ id }) => !beforeSectionIds.has(id))?.id || null;
    return Boolean(workspace);
  },
  replaceWorkspace(workspace, { persist = true } = {}) {
    if (!get().workspace || workspace?.profileAddress !== get().profileAddress) return false;
    if (persist) return commitWorkspace(set, get, workspace);
    set({ workspace });
    return true;
  }
}));

if (typeof window !== 'undefined') window.addEventListener('inscape-workspace-change', ({ detail }) => {
  if (!injected && detail.kind === 'library' && detail.profile === useLibraryStore.getState().profileAddress) {
    useLibraryStore.setState(workspacePersistence.load(detail.profile));
  }
});

export function resetLibraryStoreForTests(nextProfileAddress, nextStorage) {
  injected = true;
  workspaceStorage = nextStorage;
  useLibraryStore.getState().cancel();
  workspacePersistence = createLibraryWorkspacePersistence(nextStorage);
  useLibraryStore.setState({ profileAddress: nextProfileAddress, ...workspacePersistence.load(nextProfileAddress), assets: [], referencedAssets: [], hasMore: false, inventoryComplete: false, status: 'idle', sourceMode: null,
    progress: { resolved: 0, total: 0, failures: 0 } });
}

export function flushLibraryWorkspace() {
  const result = workspacePersistence.save(useLibraryStore.getState().workspace);
  useLibraryStore.setState({ persistenceError: result.error });
  return result.committed ?? result.ok;
}

export const flushLibraryWorkspaceForTests = flushLibraryWorkspace;
