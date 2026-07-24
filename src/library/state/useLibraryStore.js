import { create } from 'zustand';
import { normalizeProfileAddress, resolveWorkspaceProfile } from '../config.js';
import { luksoProfileRepository } from '../data/luksoProfileRepository.js';
import { luksoRpcProfileRepository } from '../data/luksoRpcProfileRepository.js';
import { useWalletStore } from '../../store/useWalletStore.js';
import { developmentLog, reportControlledError } from '../../diagnostics.js';
import {
  createFolder,
  deleteFolder,
  pinLibraryView,
  renameFolder,
  resetCanvasLayout,
  setFolderAsset,
  setFolderPublic,
  setLauncherPosition,
  setLauncherGeometry,
  setLauncherVisitorVisibility,
  setLauncherStartOpen,
  setLauncherWindowPosition, setLauncherPresentation,
  toggleFavorite,
  unpinLibraryView
} from '../domain/libraryWorkspace.js';
import {
  createCanvasObject, removeCanvasObject, reorderCanvasObject, replaceCanvasObjectAsset,
  setCanvasObjectGeometry, setCanvasObjectLocked, setCanvasObjectPresentation, setCanvasObjectVisitorVisibility
} from '../domain/canvasObjects.js';
import { loadLibraryWorkspace, saveLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';

const profileAddress = resolveWorkspaceProfile(useWalletStore.getState().hostProfileAddress);
let workspaceStorage = typeof window === 'undefined' ? null : window.localStorage;
let saveTimer = null;
let activeLoadController = null;
const LIVE_SOURCE_TIMEOUT_MS = 15000;
const RPC_SOURCE_TIMEOUT_MS = 240000;

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

  setProfileAddress(nextProfileAddress) {
    const profile = normalizeProfileAddress(nextProfileAddress);
    if (!profile) return false;
    if (profile === get().profileAddress) return true;
    developmentLog('[asset-index] profile changed', {
      previousProfileAddress: get().profileAddress,
      profileAddress: profile
    });
    activeLoadController?.abort();
    activeLoadController = null;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (get().workspace?.profileAddress) saveLibraryWorkspace(workspaceStorage, get().workspace);
    }
    const workspace = loadLibraryWorkspace(workspaceStorage, profile);
    set({ profileAddress: profile, workspace, assets: [], sourceMode: null, status: 'idle', error: null, liveError: null,
      progress: { resolved: 0, total: 0, failures: 0 }, searchQuery: '', activeView: { type: 'all', id: null }, selectedAssetId: null,
      loadGeneration: get().loadGeneration + 1 });
    return true;
  },

  async load({ forceLive = false } = {}) {
    if (get().status === 'loading' && !forceLive) {
      developmentLog('[asset-index] duplicate load ignored', {
        profileAddress: get().profileAddress,
        generation: get().loadGeneration
      });
      return;
    }
    activeLoadController?.abort();
    const controller = new AbortController();
    activeLoadController = controller;
    const requestedProfileAddress = get().profileAddress;
    const generation = get().loadGeneration + 1;
    developmentLog('[asset-index] load started', {
      endpoint: luksoProfileRepository.endpoint,
      forceLive,
      generation,
      profileAddress: requestedProfileAddress,
      timeoutMs: LIVE_SOURCE_TIMEOUT_MS
    });
    set({ loadGeneration: generation, assets: forceLive ? [] : get().assets, sourceMode: 'LIVE', status: 'loading',
      error: null, liveError: null, progress: { resolved: 0, total: 0, failures: 0 } });
    const consume = async (repository, signal) => {
      for await (const batch of repository.loadProfileAssets(requestedProfileAddress, { signal })) {
        if (get().loadGeneration !== generation) {
          developmentLog('[asset-index] stale batch discarded', { generation, profileAddress: requestedProfileAddress });
          return;
        }
        developmentLog('[asset-index] batch received', {
          assets: batch.assets.length,
          complete: batch.complete,
          failures: batch.failures,
          generation,
          profileAddress: requestedProfileAddress,
          resolved: batch.resolved,
          total: batch.total
        });
        set((state) => ({ assets: uniqueAssets(state.assets, batch.assets), sourceMode: repository.source,
          status: batch.complete ? 'ready' : 'loading',
          progress: { resolved: batch.resolved, total: batch.total, failures: (state.progress.failures || 0) + batch.failures } }));
      }
    };
    const consumeWithTimeout = async (repository, timeoutMs) => {
      const sourceController = new AbortController(); let timedOut = false;
      const abortSource = () => sourceController.abort(controller.signal.reason);
      controller.signal.addEventListener('abort', abortSource, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        developmentLog('[asset-index] source timeout reached', {
          generation, profileAddress: requestedProfileAddress, source: repository.source, timeoutMs
        });
        sourceController.abort();
      }, timeoutMs);
      try {
        await consume(repository, sourceController.signal);
      } catch (error) {
        if (controller.signal.aborted) throw error;
        if (timedOut) {
          const timeoutError = new Error(`${repository.source} ASSET SOURCE DID NOT RESPOND`);
          timeoutError.name = 'SourceTimeoutError';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', abortSource);
      }
    };
    try {
      try {
        await consumeWithTimeout(luksoProfileRepository, LIVE_SOURCE_TIMEOUT_MS);
      } catch (liveSourceError) {
        if (controller.signal.aborted || get().loadGeneration !== generation) throw liveSourceError;
        const liveMessage = liveSourceError instanceof Error ? liveSourceError.message : String(liveSourceError);
        developmentLog('[asset-index] switching to RPC fallback', {
          generation, message: liveMessage, profileAddress: requestedProfileAddress,
          rpcEndpoint: luksoRpcProfileRepository.endpoint
        });
        set({ sourceMode: 'RPC', status: 'loading', error: null, liveError: liveMessage,
          progress: { resolved: 0, total: 0, failures: 0 } });
        await consumeWithTimeout(luksoRpcProfileRepository, RPC_SOURCE_TIMEOUT_MS);
      }
      if (get().loadGeneration === generation && get().status === 'loading') set({ status: 'ready' });
      if (get().loadGeneration === generation) {
        developmentLog('[asset-index] load completed', {
          assets: get().assets.length,
          generation,
          profileAddress: requestedProfileAddress,
          status: get().status
        });
      }
    } catch (error) {
      if (get().loadGeneration !== generation) {
        developmentLog('[asset-index] superseded load cancelled', { generation, profileAddress: requestedProfileAddress });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      reportControlledError('asset-index-load', new Error(message));
      developmentLog('[asset-index] load failed', {
        errorName: error instanceof Error ? error.name : typeof error,
        generation,
        message,
        profileAddress: requestedProfileAddress,
        sourceMode: get().sourceMode
      });
      if (get().assets.length > 0) {
        set({ liveError: message, status: 'partial' });
        return;
      }
      set({ liveError: message, status: 'error', error: message, assets: [], progress: { resolved: 0, total: 0, failures: 0 } });
    } finally {
      if (activeLoadController === controller) activeLoadController = null;
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
  createCanvasObject(input) {
    const previous = get().workspace;
    const workspace = createCanvasObject(previous, input); set({ workspace }); scheduleSave(workspace);
    return workspace === previous ? null : workspace.canvas.objects.find((object) => !previous.canvas.objects.some((prior) => prior.id === object.id))?.id || null;
  },
  setCanvasObjectGeometry(id, geometry) {
    const workspace = setCanvasObjectGeometry(get().workspace, id, geometry); set({ workspace }); scheduleSave(workspace);
  },
  setCanvasObjectPresentation(id, presentation) {
    const workspace = setCanvasObjectPresentation(get().workspace, id, presentation); set({ workspace }); scheduleSave(workspace);
  },
  replaceCanvasObjectAsset(id, stableAssetId) {
    const workspace = replaceCanvasObjectAsset(get().workspace, id, stableAssetId); set({ workspace }); scheduleSave(workspace);
  },
  setCanvasObjectVisitorVisibility(id, visitorVisible) {
    const workspace = setCanvasObjectVisitorVisibility(get().workspace, id, visitorVisible); set({ workspace }); scheduleSave(workspace);
  },
  setFolderPublic(folderId, isPublic) {
    const workspace = setFolderPublic(get().workspace, folderId, isPublic); set({ workspace }); scheduleSave(workspace);
  },
  setCanvasObjectLocked(id, locked) {
    const workspace = setCanvasObjectLocked(get().workspace, id, locked); set({ workspace }); scheduleSave(workspace);
  },
  reorderCanvasObject(id, command) {
    const workspace = reorderCanvasObject(get().workspace, id, command); set({ workspace }); scheduleSave(workspace);
  },
  removeCanvasObject(id) {
    const workspace = removeCanvasObject(get().workspace, id); set({ workspace }); scheduleSave(workspace);
  },
  resetCanvasLayout() {
    const workspace = resetCanvasLayout(get().workspace); set({ workspace }); scheduleSave(workspace);
  },
  replaceWorkspace(workspace, { persist = true } = {}) {
    if (persist && !saveLibraryWorkspace(workspaceStorage, workspace)) return false;
    if (persist && saveTimer) clearTimeout(saveTimer);
    if (persist) saveTimer = null;
    set({ workspace });
    return true;
  }
}));

export function resetLibraryStoreForTests(nextProfileAddress, nextStorage) {
  workspaceStorage = nextStorage;
  activeLoadController?.abort();
  activeLoadController = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const workspace = loadLibraryWorkspace(nextStorage, nextProfileAddress);
  useLibraryStore.setState({ profileAddress: nextProfileAddress, workspace, assets: [], status: 'idle', sourceMode: null,
    progress: { resolved: 0, total: 0, failures: 0 }, searchQuery: '', activeView: { type: 'all', id: null }, selectedAssetId: null });
}

export function flushLibraryWorkspace() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  return saveLibraryWorkspace(workspaceStorage, useLibraryStore.getState().workspace);
}

export const flushLibraryWorkspaceForTests = flushLibraryWorkspace;
