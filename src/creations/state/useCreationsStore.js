import { create } from 'zustand';
import { normalizeProfileAddress } from '../../library/config.js';
import { luksoCreationsRepository } from '../data/luksoCreationsRepository.js';
import { deduplicateCreations } from '../domain/normalizeCreation.js';

export function createCreationsStore({ liveRepository = luksoCreationsRepository, fixtureRepository = null, retainOnRetry = false } = {}) {
  let activeController = null;
  return create((set, get) => ({
    profileAddress: null, assets: [], sourceMode: null, status: 'idle',
    progress: { resolved: 0, total: 0, failures: 0 }, error: null, liveError: null,
    searchQuery: '', selectedAssetId: null, loadGeneration: 0,

    async load(viewedProfileAddress, { forceLive = false } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      if (get().status === 'loading' && get().profileAddress === profile && !forceLive) return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const generation = get().loadGeneration + 1;
      const profileChanged = get().profileAddress !== profile;
      set({
        profileAddress: profile, loadGeneration: generation,
        assets: profileChanged || (forceLive && !retainOnRetry) ? [] : get().assets,
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
    retry: () => get().load(get().profileAddress, { forceLive: true }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    selectAsset: (selectedAssetId) => set({ selectedAssetId }),
    cancel() {
      activeController?.abort(); activeController = null;
      if (get().status === 'loading') set({ status: get().assets.length ? 'ready' : 'idle' });
    }
  }));
}

export const useCreationsStore = createCreationsStore();
