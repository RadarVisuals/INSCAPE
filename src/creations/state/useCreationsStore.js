import { create } from 'zustand';
import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { luksoCreationsRepository } from '../data/luksoCreationsRepository.js';
import { deduplicateCreations } from '../domain/normalizeCreation.js';

export function createCreationsStore({ liveRepository = luksoCreationsRepository, fixtureRepository = null, retainOnRetry = false } = {}) {
  let activeController = null;
  let referencedController = null;
  let referencedRequestKey = null;
  return create((set, get) => ({
    profileAddress: null, assets: [], sourceMode: null, status: 'idle',
    referencedAssets: [],
    progress: { resolved: 0, total: 0, failures: 0 }, error: null, liveError: null,
    searchQuery: '', selectedAssetId: null, loadGeneration: 0,

    setProfileAddress(viewedProfileAddress) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) return false;
      if (get().profileAddress === profile) return true;
      activeController?.abort(); activeController = null;
      referencedController?.abort(); referencedController = null; referencedRequestKey = null;
      set({ profileAddress: profile, assets: [], referencedAssets: [], sourceMode: null, status: 'idle',
        progress: { resolved: 0, total: 0, failures: 0 }, error: null, liveError: null,
        searchQuery: '', selectedAssetId: null, loadGeneration: get().loadGeneration + 1 });
      return true;
    },

    async load(viewedProfileAddress, { forceLive = false } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      if (get().status === 'loading' && get().profileAddress === profile && !forceLive) return;
      activeController?.abort();
      if (get().profileAddress !== profile) {
        referencedController?.abort();
        referencedRequestKey = null;
      }
      const controller = new AbortController();
      activeController = controller;
      const generation = get().loadGeneration + 1;
      const profileChanged = get().profileAddress !== profile;
      set({
        profileAddress: profile, loadGeneration: generation,
        assets: profileChanged || (forceLive && !retainOnRetry) ? [] : get().assets,
        referencedAssets: profileChanged ? [] : get().referencedAssets,
        sourceMode: 'LIVE', status: 'loading', error: null, liveError: null,
        selectedAssetId: profileChanged ? null : get().selectedAssetId,
        searchQuery: profileChanged ? '' : get().searchQuery,
        progress: { resolved: 0, total: 0, failures: 0 }
      });
      const current = () => get().loadGeneration === generation && get().profileAddress === profile && !controller.signal.aborted;
      const consume = async (repository) => {
        for await (const batch of repository.loadCreations(profile, { signal: controller.signal })) {
          if (!current()) return;
          set((state) => ({ assets: deduplicateCreations([...state.assets, ...batch.assets]), sourceMode: repository.source,
            status: batch.complete ? 'ready' : 'loading', progress: { resolved: batch.resolved, total: batch.total, failures: batch.failures } }));
        }
      };
      try {
        await consume(liveRepository);
        if (current() && get().status === 'loading') set({ status: 'ready' });
      } catch (error) {
        if (!current() || error?.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : String(error);
        if (get().assets.length) { set({ liveError: message, status: 'partial', sourceMode: 'LIVE' }); return; }
        if (!fixtureRepository) {
          set({ liveError: message, status: 'error', sourceMode: 'LIVE', error: message, assets: [], progress: { resolved: 0, total: 0, failures: 0 } });
          return;
        }
        set({ liveError: message, status: 'fallback', sourceMode: 'LIVE', assets: [], progress: { resolved: 0, total: 0, failures: 0 } });
        try {
          await consume(fixtureRepository);
          if (current()) set({ status: 'ready', sourceMode: fixtureRepository.source || 'FIXTURE' });
        } catch (fixtureError) {
          if (current()) set({ status: 'error', error: fixtureError instanceof Error ? fixtureError.message : String(fixtureError) });
        }
      } finally {
        if (activeController === controller) activeController = null;
      }
    },
    async resolveReferencedAssets(viewedProfileAddress, stableAssetIds = []) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile || get().profileAddress !== profile) return;
      const references = [...new Map((stableAssetIds || []).map((assetId) => parseCanonicalAssetId(assetId))
        .filter(Boolean)
        .map((reference) => [reference.stableAssetId, reference])).values()]
        .sort((left, right) => left.stableAssetId.localeCompare(right.stableAssetId));
      const requestKey = `${profile}:${references.map(({ stableAssetId }) => stableAssetId).join(',')}`;
      if (referencedRequestKey === requestKey) return;
      const knownIds = new Set([...get().assets, ...get().referencedAssets].map(({ id }) => id));
      const missing = references.filter(({ stableAssetId }) => !knownIds.has(stableAssetId));
      if (!missing.length) {
        referencedRequestKey = requestKey;
        return;
      }
      if (typeof liveRepository.loadReferencedCreations === 'function') {
        referencedController?.abort();
        const controller = new AbortController();
        referencedController = controller;
        referencedRequestKey = requestKey;
        const current = () => referencedController === controller && get().profileAddress === profile
          && !controller.signal.aborted;
        try {
          for await (const batch of liveRepository.loadReferencedCreations(profile,
            missing.map(({ stableAssetId }) => stableAssetId), { signal: controller.signal })) {
            if (!current()) return;
            const requestedIds = new Set(missing.map(({ stableAssetId }) => stableAssetId));
            const accepted = batch.assets.filter(({ id }) => requestedIds.has(id));
            if (accepted.length) set((state) => ({
              referencedAssets: deduplicateCreations([...state.referencedAssets, ...accepted]),
            }));
          }
        } catch (error) {
          if (!current() || error?.name === 'AbortError') return;
          referencedRequestKey = null;
        } finally {
          if (referencedController === controller) referencedController = null;
        }
        return;
      }
      const collections = new Map(get().assets.filter(({ isCollection }) => isCollection === true)
        .map((record) => [normalizeProfileAddress(record.contractAddress), record]));
      const tokenReferences = missing.filter(({ tokenId }) => tokenId);
      const targets = [...new Set(tokenReferences.map(({ contractAddress }) => contractAddress))]
        .map((contractAddress) => collections.get(contractAddress)).filter(Boolean);
      if (!targets.length) return;
      referencedController?.abort();
      const controller = new AbortController();
      referencedController = controller;
      referencedRequestKey = requestKey;
      const current = () => referencedController === controller && get().profileAddress === profile
        && !controller.signal.aborted;
      try {
        const requestedIds = new Set(tokenReferences.map(({ stableAssetId }) => stableAssetId));
        for (const collection of targets) {
          for await (const batch of liveRepository.loadCollectionTokens(profile, collection, { signal: controller.signal })) {
            if (!current()) return;
            const requestedAssets = batch.assets.filter(({ id }) => requestedIds.has(id));
            if (requestedAssets.length) set((state) => ({
              referencedAssets: deduplicateCreations([...state.referencedAssets, ...requestedAssets]),
            }));
          }
        }
      } catch (error) {
        if (!current() || error?.name === 'AbortError') return;
        referencedRequestKey = null;
      } finally {
        if (referencedController === controller) referencedController = null;
      }
    },
    retry: () => get().load(get().profileAddress, { forceLive: true }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    selectAsset: (selectedAssetId) => set({ selectedAssetId }),
    cancel() {
      activeController?.abort(); activeController = null;
      referencedController?.abort(); referencedController = null;
      referencedRequestKey = null;
      if (get().status === 'loading') set({ status: get().assets.length ? 'ready' : 'idle' });
    }
  }));
}

export const useCreationsStore = createCreationsStore();
