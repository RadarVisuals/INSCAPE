import { create } from 'zustand';
import { normalizeProfileAddress } from '../../library/config.js';
import { createAssetPageSession } from '../../library/data/assetPageSession.js';
import { mergeAssetMetadata } from '../../library/data/libraryMetadataDemand.js';
import { luksoCreationsRepository } from '../data/luksoCreationsRepository.js';

export function createCollectionTokensStore({ repository = luksoCreationsRepository } = {}) {
  let session = null;
  return create((set, get) => ({
    profileAddress: null, collectionAddress: null, assets: [], status: 'idle', error: null, hasMore: false,
    progress: { resolved: 0, total: 0, failures: 0 }, loadGeneration: 0,
    load(viewedProfileAddress, collectionRecord, { force = false } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      const collectionAddress = normalizeProfileAddress(collectionRecord?.contractAddress);
      if (!profile || !collectionAddress || collectionRecord?.isCollection !== true) throw new TypeError('A valid profile and creator collection are required');
      if (!force && get().status === 'loading' && get().profileAddress === profile && get().collectionAddress === collectionAddress) return;
      session?.cancel();
      session = createAssetPageSession(signal => repository.loadCollectionTokens(profile, collectionRecord, { signal }));
      set({ profileAddress: profile, collectionAddress, assets: [], status: 'idle', error: null,
        hasMore: true, progress: { resolved: 0, total: 0, failures: 0 }, loadGeneration: get().loadGeneration + 1 });
      return get().loadMore();
    },
    async loadMore() {
      const run = session;
      if (!run || !get().hasMore || get().status === 'loading') return;
      set({ status: 'loading' });
      try {
        const batch = await run.next();
        if (run !== session || !batch) return;
        set(state => ({ assets: [...new Map([...state.assets, ...batch.assets].map(asset => [asset.id, asset])).values()],
          hasMore: !batch.complete, status: 'ready',
          progress: { resolved: batch.resolved, total: batch.total, failures: state.progress.failures + batch.failures } }));
      } catch (error) { if (run === session) set({ status: 'error', hasMore: false, error: error.message }); }
    },
    updateMetadata(updates) { set(state => ({ assets: mergeAssetMetadata(state.assets, updates) })); },
    retry(collectionRecord) { return get().load(get().profileAddress, collectionRecord, { force: true }); },
    cancel() {
      session?.cancel(); session = null;
      if (get().status === 'loading') set({ status: get().assets.length ? 'ready' : 'idle' });
    },
    clear() {
      get().cancel();
      set({ profileAddress: null, collectionAddress: null, assets: [], status: 'idle', error: null, hasMore: false,
        progress: { resolved: 0, total: 0, failures: 0 }, loadGeneration: get().loadGeneration + 1 });
    },
  }));
}
