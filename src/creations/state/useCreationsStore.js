import { create } from 'zustand';
import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { luksoCreationsRepository } from '../data/luksoCreationsRepository.js';
import { deduplicateCreations } from '../domain/normalizeCreation.js';
import { createAssetPageSession } from '../../library/data/assetPageSession.js';
import { mergeAssetMetadata } from '../../library/data/libraryMetadataDemand.js';

export function createCreationsStore({ liveRepository = luksoCreationsRepository, retainOnRetry = false, pageOnDemand = false } = {}) {
  let pageSession = null;
  const referencesInFlight = new Map();
  const cancelReferences = () => { referencesInFlight.forEach(controller => controller.abort()); referencesInFlight.clear(); };
  return create((set, get) => ({
    profileAddress: null, assets: [], sourceMode: null, status: 'idle',
    referencedAssets: [], hasMore: false,
    progress: { resolved: 0, total: 0, failures: 0 }, error: null, liveError: null,
    searchQuery: '', selectedAssetId: null, loadGeneration: 0,

    setProfileAddress(viewedProfileAddress) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) return false;
      if (get().profileAddress === profile) return true;
      pageSession?.session.cancel(); pageSession = null;
      cancelReferences();
      set({ profileAddress: profile, assets: [], referencedAssets: [], hasMore: false, sourceMode: null, status: 'idle',
        progress: { resolved: 0, total: 0, failures: 0 }, error: null, liveError: null,
        searchQuery: '', selectedAssetId: null, loadGeneration: get().loadGeneration + 1 });
      return true;
    },

    async load(viewedProfileAddress, { forceLive = false } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile) throw new TypeError('A valid viewed Universal Profile address is required');
      if (get().status === 'loading' && get().profileAddress === profile && !forceLive) return;
      get().setProfileAddress(profile);
      pageSession?.session.cancel();
      const run = { assets: [], failures: 0,
        session: createAssetPageSession(signal => liveRepository.loadCreations(profile, { signal })) };
      pageSession = run;
      set({ assets: forceLive && !retainOnRetry ? [] : get().assets, status: 'idle', hasMore: true,
        sourceMode: liveRepository.source || 'LIVE', error: null, liveError: null,
        progress: { resolved: 0, total: 0, failures: 0 }, loadGeneration: get().loadGeneration + 1 });
      do { await get().loadMore(); }
      while (!pageOnDemand && pageSession === run && get().hasMore);
    },
    async loadMore() {
      const run = pageSession;
      if (!run || !get().hasMore || get().status === 'loading') return;
      set({ status: 'loading' });
      try {
        const batch = await run.session.next();
        if (run !== pageSession || !batch) return;
        run.assets = deduplicateCreations([...run.assets, ...batch.assets]);
        run.failures += batch.failures || 0;
        set(state => ({ assets: batch.complete && !run.failures ? run.assets : deduplicateCreations([...state.assets, ...batch.assets]),
          hasMore: !batch.complete, status: run.failures ? 'partial' : 'ready',
          progress: { resolved: batch.resolved, total: batch.total, failures: run.failures } }));
      } catch (error) {
        if (run === pageSession) set({ status: get().assets.length ? 'partial' : 'error', hasMore: false,
          liveError: error.message, error: get().assets.length ? null : error.message });
      }
    },
    updateMetadata(updates) {
      if (pageSession) pageSession.assets = mergeAssetMetadata(pageSession.assets, updates);
      set(state => ({ assets: mergeAssetMetadata(state.assets, updates), referencedAssets: mergeAssetMetadata(state.referencedAssets, updates) }));
    },
    async resolveReferencedAssets(viewedProfileAddress, stableAssetIds = [], { signal } = {}) {
      const profile = normalizeProfileAddress(viewedProfileAddress);
      if (!profile || get().profileAddress !== profile || signal?.aborted) return;
      const known = new Set([...get().assets, ...get().referencedAssets].map(asset => asset.id));
      const missing = [...new Map(stableAssetIds.map(parseCanonicalAssetId).filter(reference => reference?.chainId === 42)
        .map(reference => [reference.stableAssetId, reference])).values()].filter(reference => !known.has(reference.stableAssetId));
      if (!missing.length) return;
      const key = missing.map(reference => reference.stableAssetId).sort().join(',');
      if (referencesInFlight.has(key)) return;
      const controller = new AbortController();
      referencesInFlight.set(key, controller);
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const current = () => !controller.signal.aborted && get().profileAddress === profile;
      const ids = new Set(missing.map(reference => reference.stableAssetId));
      const consume = async open => {
        const session = createAssetPageSession(open);
        const cancel = () => session.cancel();
        controller.signal.addEventListener('abort', cancel, { once: true });
        try {
          while (current()) {
            const batch = await session.next();
            if (!current() || !batch) return;
            set(state => ({ referencedAssets: deduplicateCreations([...state.referencedAssets,
              ...batch.assets.filter(asset => ids.has(asset.id))]) }));
            if (batch.complete) break;
          }
        } finally { controller.signal.removeEventListener('abort', cancel); session.cancel(); }
      };
      try {
        await consume(childSignal => liveRepository.loadReferencedCreations(profile, [...ids], { signal: childSignal }));
      } catch (error) { if (current() && signal) throw error; }
      finally {
        signal?.removeEventListener('abort', abort);
        if (referencesInFlight.get(key) === controller) referencesInFlight.delete(key);
      }
    },
    retry: () => get().load(get().profileAddress, { forceLive: true }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    selectAsset: (selectedAssetId) => set({ selectedAssetId }),
    cancel() {
      pageSession?.session.cancel(); pageSession = null;
      cancelReferences();
      if (get().status === 'loading') set({ status: get().assets.length ? 'ready' : 'idle' });
    }
  }));
}

export const useCreationsStore = createCreationsStore();
