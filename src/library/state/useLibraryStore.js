import { create } from 'zustand';
import { normalizeProfileAddress, resolveWorkspaceProfile } from '../config.js';
import { chillwhalesProfileRepository } from '../data/chillwhalesProfileRepository.js';
import { luksoRpcProfileRepository } from '../data/luksoRpcProfileRepository.js';
import { luksoEnvioAttributeRepository } from '../data/luksoEnvioAttributeRepository.js';
import { mergeProfileAssetAttributeEnrichments } from '../domain/mergeProfileAssetAttributes.js';
import { useWalletStore } from '../../store/useWalletStore.js';
import { developmentLog, reportControlledError } from '../../diagnostics.js';
import {
  createFolder,
  createCategorySection,
  deleteCategorySection,
  deleteFolder,
  moveCategory,
  moveCategorySection,
  renameCategorySection,
  renameFolder,
  resetCanvasLayout,
  setFolderAsset,
  setFolderAssets,
  setFolderPublic,
  toggleFavorite
} from '../domain/libraryWorkspace.js';
import {
  createCanvasObject, removeCanvasObject, reorderCanvasObject, replaceCanvasObjectAsset,
  setAllCanvasObjectsLocked, setCanvasObjectGeometry, setCanvasObjectLocked, setCanvasObjectPresentation, setCanvasObjectVisitorVisibility
} from '../domain/canvasObjects.js';
import { browserLibraryStorage, createLibraryWorkspacePersistence } from '../storage/libraryWorkspacePersistence.js';
import { loadLibraryAssetCache, saveLibraryAssetCache } from '../storage/libraryAssetCache.js';
import { createTablePlacement, removeTablePlacement, reorderTablePlacement, updateTablePlacement } from '../domain/tablePlacements.js';

const profileAddress = resolveWorkspaceProfile(useWalletStore.getState().hostProfileAddress);
let workspaceStorage = browserLibraryStorage();
let workspacePersistence = createLibraryWorkspacePersistence(workspaceStorage);
const initialWorkspace = workspacePersistence.load(profileAddress);
const tableAuthoringEnabled = import.meta.env?.DEV ?? true;
let activeLoadController = null;
const INDEXER_SOURCE_TIMEOUT_MS = 8000;
const ENVIO_ENRICHMENT_TIMEOUT_MS = 12000;
const RPC_REPAIR_TIMEOUT_MS = 60000;
const RPC_SOURCE_TIMEOUT_MS = 240000;

function commitWorkspace(set, get, workspace, extra = {}) {
  if (workspace === get().workspace) return false;
  if (workspace?.profileAddress !== get().profileAddress) return false;
  const result = workspacePersistence.save(workspace);
  if (!result.ok) { set({ persistenceError: result.error }); return false; }
  set({ workspace, persistenceError: null, ...extra });
  return true;
}

function uniqueAssets(existing, incoming) {
  const byId = new Map(existing.map((asset) => [asset.id, asset]));
  incoming.forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()];
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
  searchQuery: '',
  activeView: { type: 'all', id: null },
  selectedAssetId: null,
  ...initialWorkspace,
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
    set({ profileAddress: profile, ...workspacePersistence.load(profile), assets: loadLibraryAssetCache(workspaceStorage, profile), sourceMode: null, status: 'idle', error: null, liveError: null,
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
    const consume = async (repository, signal, options = {}) => {
      const unresolvedAssetIds = []; let sourceAssets = []; let sourceFailures = 0;
      const replaceOnComplete = options.replaceOnComplete ?? !options.preserveProgress;
      for await (const batch of repository.loadProfileAssets(requestedProfileAddress,
        { signal, requestedAssetIds: options.requestedAssetIds })) {
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
        const tokenAssetIds = get().assets.filter((asset) => asset.standard === 'LSP8' && asset.tokenId).map((asset) => asset.id);
        if (tokenAssetIds.length) {
          developmentLog('[asset-index] enriching indexed token attributes through Envio', {
            assets: tokenAssetIds.length, generation, profileAddress: requestedProfileAddress
          });
          const enrichmentController = new AbortController(); let enrichmentTimedOut = false;
          const abortEnrichment = () => enrichmentController.abort(controller.signal.reason);
          controller.signal.addEventListener('abort', abortEnrichment, { once: true });
          const enrichmentTimeout = setTimeout(() => {
            enrichmentTimedOut = true;
            enrichmentController.abort();
          }, ENVIO_ENRICHMENT_TIMEOUT_MS);
          try {
            const enrichments = await luksoEnvioAttributeRepository.enrich(tokenAssetIds,
              { signal: enrichmentController.signal });
            if (get().loadGeneration === generation && enrichments.length) {
              set((state) => ({ assets: mergeProfileAssetAttributeEnrichments(state.assets, enrichments),
                sourceMode: 'INDEXER+ENVIO' }));
              saveLibraryAssetCache(workspaceStorage, requestedProfileAddress, get().assets);
            }
          } catch (enrichmentError) {
            if (controller.signal.aborted || get().loadGeneration !== generation) throw enrichmentError;
            developmentLog('[asset-index] Envio attribute enrichment incomplete', {
              generation, message: enrichmentTimedOut ? 'LUKSO ENVIO ATTRIBUTE ENRICHMENT DID NOT RESPOND'
                : enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError),
              profileAddress: requestedProfileAddress
            });
          } finally {
            clearTimeout(enrichmentTimeout);
            controller.signal.removeEventListener('abort', abortEnrichment);
          }
        }
        if (unresolvedAssetIds.length) {
          developmentLog('[asset-index] repairing unresolved metadata through RPC', {
            assets: unresolvedAssetIds.length, generation, profileAddress: requestedProfileAddress
          });
          try {
            await consumeWithTimeout(luksoRpcProfileRepository, RPC_REPAIR_TIMEOUT_MS,
              { requestedAssetIds: unresolvedAssetIds,
                sourceMode: tokenAssetIds.length ? 'INDEXER+ENVIO+RPC' : 'INDEXER+RPC', preserveProgress: true });
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
    const committed = commitWorkspace(set, get, workspace, { activeView: created
      ? { type: 'folder', id: created.id } : get().activeView });
    return committed ? created?.id || null : null;
  },
  renameFolder(id, name) {
    const workspace = renameFolder(get().workspace, id, name); commitWorkspace(set, get, workspace);
  },
  deleteFolder(id) {
    const workspace = deleteFolder(get().workspace, id);
    commitWorkspace(set, get, workspace, { activeView: get().activeView.id === id ? { type: 'all', id: null } : get().activeView });
  },
  setFolderAsset(folderId, assetId, included) {
    const workspace = setFolderAsset(get().workspace, folderId, assetId, included); commitWorkspace(set, get, workspace);
  },
  toggleFavorite(assetId) {
    const workspace = toggleFavorite(get().workspace, assetId); commitWorkspace(set, get, workspace);
  },
  createCanvasObject(input) {
    const previous = get().workspace;
    const workspace = createCanvasObject(previous, input); if (!commitWorkspace(set, get, workspace)) return null;
    return workspace === previous ? null : workspace.canvas.objects.find((object) => !previous.canvas.objects.some((prior) => prior.id === object.id))?.id || null;
  },
  setCanvasObjectGeometry(id, geometry) {
    const workspace = setCanvasObjectGeometry(get().workspace, id, geometry); commitWorkspace(set, get, workspace);
  },
  setCanvasObjectPresentation(id, presentation) {
    const workspace = setCanvasObjectPresentation(get().workspace, id, presentation); commitWorkspace(set, get, workspace);
  },
  replaceCanvasObjectAsset(id, stableAssetId) {
    const workspace = replaceCanvasObjectAsset(get().workspace, id, stableAssetId); commitWorkspace(set, get, workspace);
  },
  setCanvasObjectVisitorVisibility(id, visitorVisible) {
    const workspace = setCanvasObjectVisitorVisibility(get().workspace, id, visitorVisible); commitWorkspace(set, get, workspace);
  },
  setFolderPublic(folderId, isPublic) {
    const workspace = setFolderPublic(get().workspace, folderId, isPublic); commitWorkspace(set, get, workspace);
  },
  commitCategoryForProfile(expectedProfileAddress, command) {
    const beforeIds = command?.type === 'create' ? new Set(get().workspace?.folders?.map(({ id }) => id) || []) : null;
    const beforeSectionIds = command?.type === 'create-section'
      ? new Set(get().workspace?.categoryOrganization?.sections?.map(({ id }) => id) || []) : null;
    const workspace = commitProfileScopedCategory(set, get, expectedProfileAddress, (current) => {
      if (command?.type === 'create') return createFolder(current, command.name);
      if (command?.type === 'rename') return renameFolder(current, command.categoryId, command.name);
      if (command?.type === 'delete') return deleteFolder(current, command.categoryId);
      if (command?.type === 'public') return setFolderPublic(current, command.categoryId, command.value);
      if (command?.type === 'create-section') return createCategorySection(current, command.name);
      if (command?.type === 'rename-section') return renameCategorySection(current, command.sectionId, command.name);
      if (command?.type === 'delete-section') return deleteCategorySection(current, command.sectionId);
      if (command?.type === 'move-category') return moveCategory(current, command.categoryId, command.sectionId, command.beforeId);
      if (command?.type === 'move-section') return moveCategorySection(current, command.sectionId, command.beforeId);
      if (command?.type === 'asset') return setFolderAsset(current, command.categoryId, command.assetId, command.value);
      if (command?.type === 'assets') {
        const acceptedIds = new Set([...get().assets.map(({ id }) => id),
          ...(command.acceptedAssetIds || [])]);
        const assetIds = Array.isArray(command.assetIds) ? [...new Set(command.assetIds)] : [];
        if (!assetIds.length || assetIds.some((id) => typeof id !== 'string' || !acceptedIds.has(id))) return current;
        return setFolderAssets(current, command.categoryId, assetIds, command.value);
      }
      return current;
    });
    if (beforeIds) return workspace?.folders.find(({ id }) => !beforeIds.has(id))?.id || null;
    if (beforeSectionIds) return workspace?.categoryOrganization.sections.find(({ id }) => !beforeSectionIds.has(id))?.id || null;
    return Boolean(workspace);
  },
  setCanvasObjectLocked(id, locked) {
    const workspace = setCanvasObjectLocked(get().workspace, id, locked); commitWorkspace(set, get, workspace);
  },
  setAllCanvasObjectsLocked(locked) {
    const workspace = setAllCanvasObjectsLocked(get().workspace, locked); commitWorkspace(set, get, workspace);
  },
  reorderCanvasObject(id, command) {
    const workspace = reorderCanvasObject(get().workspace, id, command); commitWorkspace(set, get, workspace);
  },
  removeCanvasObject(id) {
    const workspace = removeCanvasObject(get().workspace, id); commitWorkspace(set, get, workspace);
  },
  ...(tableAuthoringEnabled ? {
    createTablePlacement(input) {
      const previous = get().workspace;
      const workspace = createTablePlacement(previous, input); if (!commitWorkspace(set, get, workspace)) return null;
      return workspace === previous ? null : workspace.tables.placements.find((placement) => !previous.tables.placements.some((prior) => prior.id === placement.id))?.id || null;
    },
    updateTablePlacement(id, patch) {
      const workspace = updateTablePlacement(get().workspace, id, patch); commitWorkspace(set, get, workspace);
    },
    reorderTablePlacement(id, command) {
      const workspace = reorderTablePlacement(get().workspace, id, command); commitWorkspace(set, get, workspace);
    },
    removeTablePlacement(id) {
      const workspace = removeTablePlacement(get().workspace, id); commitWorkspace(set, get, workspace);
    }
  } : {}),
  resetCanvasLayout() {
    const workspace = resetCanvasLayout(get().workspace); commitWorkspace(set, get, workspace);
  },
  replaceWorkspace(workspace, { persist = true } = {}) {
    if (workspace?.profileAddress !== get().profileAddress) return false;
    if (persist) return commitWorkspace(set, get, workspace);
    set({ workspace });
    return true;
  }
}));

export function resetLibraryStoreForTests(nextProfileAddress, nextStorage) {
  workspaceStorage = nextStorage;
  activeLoadController?.abort();
  activeLoadController = null;
  workspacePersistence = createLibraryWorkspacePersistence(nextStorage);
  useLibraryStore.setState({ profileAddress: nextProfileAddress, ...workspacePersistence.load(nextProfileAddress), assets: [], status: 'idle', sourceMode: null,
    progress: { resolved: 0, total: 0, failures: 0 }, searchQuery: '', activeView: { type: 'all', id: null }, selectedAssetId: null });
}

export function flushLibraryWorkspace() {
  const result = workspacePersistence.save(useLibraryStore.getState().workspace);
  useLibraryStore.setState({ persistenceError: result.error });
  return result.ok;
}

export const flushLibraryWorkspaceForTests = flushLibraryWorkspace;
