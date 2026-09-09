import { create } from 'zustand';
import { normalizeProfileAddress } from '../../library/config.js';
import { luksoCreationsRepository } from '../data/luksoCreationsRepository.js';
import { deduplicateCreations } from '../domain/normalizeCreation.js';

export function createCollectionTokensStore({ repository = luksoCreationsRepository } = {}) {
  let activeController = null;
  return create((set, get) => ({
    profileAddress: null, collectionAddress: null, assets: [], status: 'idle', error: null,
    progress: { resolved: 0, total: 0, failures: 0 }, loadGeneration: 0,

    async load(viewedProfileAddress, collectionRecord, { force = false } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      const collectionAddress = normalizeProfileAddress(collectionRecord?.contractAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      if (!collectionAddress || collectionRecord?.isCollection !== true) throw new TypeError('A valid creator collection is required');
      if (!force && get().status === 'loading' && get().profileAddress === profile
        && get().collectionAddress === collectionAddress) return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const generation = get().loadGeneration + 1;
      const scopeChanged = get().profileAddress !== profile || get().collectionAddress !== collectionAddress;
      set({
        profileAddress: profile, collectionAddress, loadGeneration: generation,
        assets: scopeChanged || force ? [] : get().assets,
        status: 'loading', error: null, progress: { resolved: 0, total: 0, failures: 0 },
      });
      const current = () => get().loadGeneration === generation && get().profileAddress === profile
        && get().collectionAddress === collectionAddress && !controller.signal.aborted;
      try {
        for await (const batch of repository.loadCollectionTokens(profile, collectionRecord, { signal: controller.signal })) {
          if (!current()) return;
          set((state) => ({
            assets: deduplicateCreations([...state.assets, ...batch.assets]),
            status: batch.complete ? 'ready' : 'loading',
            progress: { resolved: batch.resolved, total: batch.total, failures: batch.failures },
          }));
        }
        if (current() && get().status === 'loading') set({ status: 'ready' });
      } catch (error) {
        if (!current() || error?.name === 'AbortError') return;
        set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (activeController === controller) activeController = null;
      }
    },
    retry(collectionRecord) {
      return get().load(get().profileAddress, collectionRecord, { force: true });
    },
    cancel() {
      activeController?.abort();
      activeController = null;
      if (get().status === 'loading') set({ status: get().assets.length ? 'ready' : 'idle' });
    },
    clear() {
      activeController?.abort();
      activeController = null;
      set({ profileAddress: null, collectionAddress: null, assets: [], status: 'idle', error: null,
        progress: { resolved: 0, total: 0, failures: 0 }, loadGeneration: get().loadGeneration + 1 });
    },
  }));
}
