import { create } from 'zustand';
import { normalizeProfileAddress, resolveWorkspaceProfile } from '../config.js';
import { chillwhalesProfileRepository } from '../data/chillwhalesProfileRepository.js';
import { luksoRpcProfileRepository } from '../data/luksoRpcProfileRepository.js';
import { useWalletStore } from '../../store/useWalletStore.js';
import { developmentLog, reportControlledError } from '../../diagnostics.js';
import {
  createFolder,
  deleteFolder,
  renameFolder,
  resetCanvasLayout,
  setFolderAsset,
  setFolderPublic,
  toggleFavorite
} from '../domain/libraryWorkspace.js';
import {
  createCanvasObject, removeCanvasObject, reorderCanvasObject, replaceCanvasObjectAsset,
  setAllCanvasObjectsLocked, setCanvasObjectGeometry, setCanvasObjectLocked, setCanvasObjectPresentation, setCanvasObjectVisitorVisibility
} from '../domain/canvasObjects.js';
import { loadLibraryWorkspace, saveLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { loadLibraryAssetCache, saveLibraryAssetCache } from '../storage/libraryAssetCache.js';
import { createTablePlacement, removeTablePlacement, reorderTablePlacement, updateTablePlacement } from '../domain/tablePlacements.js';

const profileAddress = resolveWorkspaceProfile(useWalletStore.getState().hostProfileAddress);
let workspaceStorage = typeof window === 'undefined' ? null : window.localStorage;
const tableAuthoringEnabled = import.meta.env?.DEV ?? true;
let saveTimer = null;
let activeLoadController = null;
const INDEXER_SOURCE_TIMEOUT_MS = 8000;
const RPC_REPAIR_TIMEOUT_MS = 60000;
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
  assets: loadLibraryAssetCache(workspaceStorage, profileAddress),
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
    set({ profileAddress: profile, workspace, assets: loadLibraryAssetCache(workspaceStorage, profile), sourceMode: null, status: 'idle', error: null, liveError: null,
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
      endpoint: chillwhalesProfileRepository.endpoint,
      forceLive,
      generation,
      profileAddress: requestedProfileAddress,
      timeoutMs: INDEXER_SOURCE_TIMEOUT_MS
    });
    set({ loadGeneration: generation, assets: forceLive ? [] : get().assets, sourceMode: 'INDEXER', status: 'loading',
      error: null, liveError: null, progress: { resolved: 0, total: 0, failures: 0 } });
    const priorityAssetIds = [...new Set((get().workspace?.canvas?.objects || [])
      .map((object) => object?.stableAssetId).filter(Boolean))];
    const consume = async (repository, signal, options = {}) => {
      const unresolvedAssetIds = []; let sourceAssets = []; let sourceFailures = 0;
      const replaceOnComplete = options.replaceOnComplete ?? !options.preserveProgress;
      for await (const batch of repository.loadProfileAssets(requestedProfileAddress,
        { signal, priorityAssetIds, requestedAssetIds: options.requestedAssetIds })) {
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
          source: options.sourceMode || repository.source,
          total: batch.total
        });
        unresolvedAssetIds.push(...(Array.isArray(batch.unresolvedAssetIds) ? batch.unresolvedAssetIds : []));
        sourceAssets = uniqueAssets(sourceAssets, batch.assets);
        sourceFailures += batch.failures;
        set((state) => ({
          assets: batch.complete && replaceOnComplete ? sourceAssets : uniqueAssets(state.assets, batch.assets),
          sourceMode: options.sourceMode || repository.source,
          status: options.preserveProgress ? state.status : batch.complete ? 'ready' : 'loading',
          progress: options.preserveProgress ? { ...state.progress, failures: sourceFailures }
            : { resolved: batch.resolved, total: batch.total, failures: (state.progress.failures || 0) + batch.failures } }));
        saveLibraryAssetCache(workspaceStorage, requestedProfileAddress, get().assets);
      }
      return [...new Set(unresolvedAssetIds)];
    };
    const consumeWithTimeout = async (repository, timeoutMs, options = {}) => {
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
        return await consume(repository, sourceController.signal, options);
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
        const unresolvedAssetIds = await consumeWithTimeout(chillwhalesProfileRepository, INDEXER_SOURCE_TIMEOUT_MS);
        if (unresolvedAssetIds.length) {
          developmentLog('[asset-index] repairing unresolved metadata through RPC', {
            assets: unresolvedAssetIds.length, generation, profileAddress: requestedProfileAddress
          });
          try {
            await consumeWithTimeout(luksoRpcProfileRepository, RPC_REPAIR_TIMEOUT_MS,
              { requestedAssetIds: unresolvedAssetIds, sourceMode: 'INDEXER+RPC', preserveProgress: true });
          } catch (repairError) {
            if (controller.signal.aborted || get().loadGeneration !== generation) throw repairError;
            developmentLog('[asset-index] RPC metadata repair incomplete', {
              generation, message: repairError instanceof Error ? repairError.message : String(repairError),
              profileAddress: requestedProfileAddress
            });
          }
        }
      } catch (indexerSourceError) {
        if (controller.signal.aborted || get().loadGeneration !== generation) throw indexerSourceError;
        const liveMessage = indexerSourceError instanceof Error ? indexerSourceError.message : String(indexerSourceError);
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
  discardUnavailableAsset(assetId) {
    const assets = get().assets.filter((asset) => asset.id !== assetId);
    if (assets.length === get().assets.length) return false;
    set({ assets, selectedAssetId: get().selectedAssetId === assetId ? null : get().selectedAssetId });
    saveLibraryAssetCache(workspaceStorage, get().profileAddress, assets);
    return true;
  },
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
  setAllCanvasObjectsLocked(locked) {
    const workspace = setAllCanvasObjectsLocked(get().workspace, locked); set({ workspace }); scheduleSave(workspace);
  },
  reorderCanvasObject(id, command) {
    const workspace = reorderCanvasObject(get().workspace, id, command); set({ workspace }); scheduleSave(workspace);
  },
  removeCanvasObject(id) {
    const workspace = removeCanvasObject(get().workspace, id); set({ workspace }); scheduleSave(workspace);
  },
  ...(tableAuthoringEnabled ? {
    createTablePlacement(input) {
      const previous = get().workspace;
      const workspace = createTablePlacement(previous, input); set({ workspace }); scheduleSave(workspace);
      return workspace === previous ? null : workspace.tables.placements.find((placement) => !previous.tables.placements.some((prior) => prior.id === placement.id))?.id || null;
    },
    updateTablePlacement(id, patch) {
      const workspace = updateTablePlacement(get().workspace, id, patch); set({ workspace }); scheduleSave(workspace);
    },
    reorderTablePlacement(id, command) {
      const workspace = reorderTablePlacement(get().workspace, id, command); set({ workspace }); scheduleSave(workspace);
    },
    removeTablePlacement(id) {
      const workspace = removeTablePlacement(get().workspace, id); set({ workspace }); scheduleSave(workspace);
    }
  } : {}),
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
