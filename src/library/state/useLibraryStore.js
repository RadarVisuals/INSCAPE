import { create } from 'zustand';
import { resolveLibraryProfile } from '../config.js';
import { fixtureProfileRepository } from '../data/fixtureProfileRepository.js';
import { luksoProfileRepository } from '../data/luksoProfileRepository.js';
import {
  createFolder,
  deleteFolder,
  pinLibraryView,
  renameFolder,
  resetCanvasLayout,
  setFolderAsset,
  setLauncherPosition,
  setLauncherGeometry,
  setLauncherVisitorVisibility,
  setLauncherStartOpen,
  setLauncherWindowPosition, setLauncherPresentation,
  toggleFavorite,
  unpinLibraryView
} from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace, saveLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';

const profileAddress = resolveLibraryProfile();
let workspaceStorage = typeof window === 'undefined' ? null : window.localStorage;
let saveTimer = null;

function scheduleSave(workspace) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLibraryWorkspace(workspaceStorage, workspace), 180);
}

function uniqueAssets(existing, incoming) {
  const byId = new Map(existing.map((asset) => [asset.id, asset]));
  incoming.forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()];
}

export const useLibraryStore = create((set, get) => ({
  profileAddress,
  assets: [],
  sourceMode: null,
  status: 'idle',
  progress: { resolved: 0, total: 0, failures: 0 },
  error: null,
  liveError: null,
  searchQuery: '',
  activeView: { type: 'all', id: null },
  selectedAssetId: null,
  workspace: loadLibraryWorkspace(workspaceStorage, profileAddress),
  loadGeneration: 0,

  async load({ forceLive = false } = {}) {
    if (get().status === 'loading' && !forceLive) return;
    const generation = get().loadGeneration + 1;
    set({ loadGeneration: generation, assets: forceLive ? [] : get().assets, sourceMode: 'LIVE', status: 'loading',
      error: null, liveError: null, progress: { resolved: 0, total: 0, failures: 0 } });
    const consume = async (repository) => {
      for await (const batch of repository.loadProfileAssets(get().profileAddress)) {
        if (get().loadGeneration !== generation) return;
        set((state) => ({ assets: uniqueAssets(state.assets, batch.assets), sourceMode: repository.source,
          status: batch.complete ? 'ready' : 'loading',
          progress: { resolved: batch.resolved, total: batch.total, failures: (state.progress.failures || 0) + batch.failures } }));
      }
    };
    try {
      await consume(luksoProfileRepository);
      if (get().loadGeneration === generation && get().status === 'loading') set({ status: 'ready' });
    } catch (error) {
      if (get().loadGeneration !== generation) return;
      const message = error instanceof Error ? error.message : String(error);
      if (get().assets.length > 0) {
        set({ liveError: message, status: 'partial', sourceMode: 'LIVE' });
        return;
      }
      set({ liveError: message, status: 'fallback', assets: [], progress: { resolved: 0, total: 0, failures: 0 } });
      try {
        await consume(fixtureProfileRepository);
        if (get().loadGeneration === generation) set({ status: 'ready', sourceMode: 'FIXTURE' });
      } catch (fixtureError) {
        if (get().loadGeneration === generation) set({ status: 'error', error: fixtureError instanceof Error ? fixtureError.message : String(fixtureError) });
      }
    }
  },
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveView: (activeView) => set({ activeView, selectedAssetId: null }),
  selectAsset: (selectedAssetId) => set({ selectedAssetId }),
  createFolder(name) {
    const workspace = createFolder(get().workspace, name);
    const created = workspace.folders.length > get().workspace.folders.length ? workspace.folders.at(-1) : null;
    set({ workspace, activeView: workspace.folders.length > get().workspace.folders.length
      ? { type: 'folder', id: workspace.folders.at(-1).id } : get().activeView });
    scheduleSave(workspace);
    return created?.id || null;
  },
  renameFolder(id, name) {
    const workspace = renameFolder(get().workspace, id, name); set({ workspace }); scheduleSave(workspace);
  },
  deleteFolder(id) {
    const workspace = deleteFolder(get().workspace, id);
    set({ workspace, activeView: get().activeView.id === id ? { type: 'all', id: null } : get().activeView }); scheduleSave(workspace);
  },
  setFolderAsset(folderId, assetId, included) {
    const workspace = setFolderAsset(get().workspace, folderId, assetId, included); set({ workspace }); scheduleSave(workspace);
  },
  toggleFavorite(assetId) {
    const workspace = toggleFavorite(get().workspace, assetId); set({ workspace }); scheduleSave(workspace);
  },
  pinView(view) {
    const workspace = pinLibraryView(get().workspace, view); set({ workspace }); scheduleSave(workspace);
  },
  unpinView(view) {
    const workspace = unpinLibraryView(get().workspace, view); set({ workspace }); scheduleSave(workspace);
  },
  setLauncherPosition(launcherId, position) {
    const workspace = setLauncherPosition(get().workspace, launcherId, position); set({ workspace }); scheduleSave(workspace);
  },
  setLauncherGeometry(launcherId, geometry) {
    const workspace = setLauncherGeometry(get().workspace, launcherId, geometry); set({ workspace }); scheduleSave(workspace);
  },
  setLauncherWindowPosition(launcherId, position) {
    const workspace = setLauncherWindowPosition(get().workspace, launcherId, position); set({ workspace }); scheduleSave(workspace);
  },
  setLauncherVisitorVisibility(launcherId, visitorVisible) {
    const workspace = setLauncherVisitorVisibility(get().workspace, launcherId, visitorVisible); set({ workspace }); scheduleSave(workspace);
  },
  setLauncherStartOpen(launcherId, startOpen, windowGeometry) {
    const workspace = setLauncherStartOpen(get().workspace, launcherId, startOpen, windowGeometry); set({ workspace }); scheduleSave(workspace);
  },
  setLauncherPresentation(launcherId, presentation) {
    const workspace = setLauncherPresentation(get().workspace, launcherId, presentation); set({ workspace }); scheduleSave(workspace);
  },
  resetCanvasLayout() {
    const workspace = resetCanvasLayout(get().workspace); set({ workspace }); scheduleSave(workspace);
  },
  replaceWorkspace(workspace, { persist = true } = {}) {
    if (persist && !saveLibraryWorkspace(workspaceStorage, workspace)) return false;
    set({ workspace });
    return true;
  }
}));

export function resetLibraryStoreForTests(nextProfileAddress, nextStorage) {
  workspaceStorage = nextStorage;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const workspace = loadLibraryWorkspace(nextStorage, nextProfileAddress);
  useLibraryStore.setState({ profileAddress: nextProfileAddress, workspace, assets: [], status: 'idle', sourceMode: null,
    progress: { resolved: 0, total: 0, failures: 0 }, searchQuery: '', activeView: { type: 'all', id: null }, selectedAssetId: null });
}

export function flushLibraryWorkspaceForTests() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  return saveLibraryWorkspace(workspaceStorage, useLibraryStore.getState().workspace);
}
