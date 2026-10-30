import { chillwhalesProfileRepository } from '../data/chillwhalesProfileRepository.js';
import { luksoRpcProfileRepository } from '../data/luksoRpcProfileRepository.js';
import { createAssetPageSession } from '../data/assetPageSession.js';
import { mergeAssetMetadata } from '../data/libraryMetadataDemand.js';

const merge = (before, incoming) => [...new Map([...before, ...incoming].map(asset => [asset.id, asset])).values()];
const incomplete = 'Some Library assets could not be loaded. The Library may be incomplete. Retry to refresh.';

export function createLibraryInventoryActions(set, get, saveCache) {
  let inventory = null;
  let repairController = null;
  const start = (repository, generation) => ({
    repository, generation, assets: [], failures: 0,
    session: createAssetPageSession(signal => repository.loadProfileAssets(get().profileAddress, { signal }),
      { timeoutMs: repository.source === 'RPC' ? 60000 : 8000 }),
  });
  return {
    hasMore: false, inventoryComplete: false, referencedAssets: [], unresolvedAssetIds: [],
    load({ forceLive = false } = {}) {
      if (get().status === 'loading' && !forceLive) return;
      inventory?.session.cancel();
      repairController?.abort();
      const generation = get().loadGeneration + 1;
      inventory = start(chillwhalesProfileRepository, generation);
      set({ loadGeneration: generation, status: 'idle', hasMore: true, inventoryComplete: false, unresolvedAssetIds: [],
        sourceMode: 'INDEXER', error: null, liveError: null, progress: { resolved: 0, total: 0, failures: 0 } });
      return get().loadMore();
    },
    async loadMore() {
      const run = inventory;
      if (!run || !get().hasMore || get().status === 'loading') return;
      const current = () => inventory === run && get().loadGeneration === run.generation;
      set({ status: 'loading' });
      try {
        const batch = await run.session.next();
        if (!current() || !batch) return;
        run.assets = merge(run.assets, batch.assets);
        run.failures += batch.failures || 0;
        set(state => ({
          assets: batch.complete && !run.failures ? run.assets : merge(state.assets, batch.assets),
          unresolvedAssetIds: [...new Set([...state.unresolvedAssetIds, ...(batch.unresolvedAssetIds || [])])],
          hasMore: !batch.complete, inventoryComplete: Boolean(batch.complete),
          status: run.failures ? 'partial' : 'ready',
          liveError: run.failures ? incomplete : null,
          progress: { resolved: batch.resolved, total: batch.total, failures: run.failures },
        }));
        saveCache();
        if (run.repository === luksoRpcProfileRepository && !batch.complete && batch.resolved >= batch.total) await run.session.next();
      } catch (error) {
        if (!current()) return;
        if (run.repository === chillwhalesProfileRepository) {
          run.session.cancel();
          inventory = start(luksoRpcProfileRepository, run.generation);
          set({ sourceMode: 'RPC', status: 'idle', hasMore: true,
            progress: { resolved: 0, total: 0, failures: 0 } });
          return get().loadMore();
        }
        set({ hasMore: false, status: get().assets.length ? 'partial' : 'error',
          liveError: error.message, error: get().assets.length ? null : error.message });
      }
    },
    cancel() {
      inventory?.session.cancel(); inventory = null;
      repairController?.abort(); repairController = null;
      if (get().status === 'loading') set({ status: get().assets.length ? 'ready' : 'idle' });
    },
    async repair() {
      repairController?.abort();
      const controller = new AbortController(); repairController = controller;
      const generation = get().loadGeneration;
      const requested = new Set(get().unresolvedAssetIds.slice(0, 24));
      if (!requested.size) return get().load({ forceLive: true });
      const session = createAssetPageSession(signal => luksoRpcProfileRepository.loadProfileAssets(get().profileAddress,
        { signal, requestedAssetIds: [...requested] }), { timeoutMs: 60000 });
      const abort = () => session.cancel(); controller.signal.addEventListener('abort', abort, { once: true });
      const current = () => !controller.signal.aborted && get().loadGeneration === generation;
      let recovered = [];
      let complete = false;
      try {
        for (;;) {
          const batch = await session.next();
          if (!current() || !batch) return;
          recovered = merge(recovered, batch.assets.filter(asset => requested.has(asset.id) && asset.imageUrl));
          if (batch.complete) { complete = true; break; }
        }
      } catch { /* Keep successfully checked cards, but do not certify an incomplete scan. */ }
      finally { controller.signal.removeEventListener('abort', abort); session.cancel(); }
      if (current()) {
        const ids = new Set(recovered.map(asset => asset.id));
        if (inventory) { inventory.assets = merge(inventory.assets, recovered); inventory.failures = Math.max(complete ? 0 : 1, inventory.failures - ids.size); }
        set(state => {
          const unresolvedAssetIds = state.unresolvedAssetIds.filter(id => !ids.has(id));
          const failures = Math.max(complete ? 0 : 1, state.progress.failures - ids.size);
          return { unresolvedAssetIds, assets: !failures && state.inventoryComplete && inventory ? inventory.assets : merge(state.assets, recovered),
            status: failures ? 'partial' : 'ready', liveError: failures ? incomplete : null,
            progress: { ...state.progress, failures } };
        }); saveCache();
      }
    },
    async loadReferencedAssets(ids, { signal } = {}) {
      if (signal?.aborted) return;
      const known = new Set(get().referencedAssets.map(asset => asset.id));
      ids = ids.filter(id => !known.has(id));
      if (!ids.length) return;
      const profile = get().profileAddress;
      const accepted = new Set(ids);
      const current = () => !signal?.aborted && get().profileAddress === profile;
      let assets = [];
      let unresolved = [];
      const read = async repository => {
        const session = createAssetPageSession(childSignal => repository.loadProfileAssets(profile,
          { signal: childSignal, requestedAssetIds: ids }), { timeoutMs: repository.source === 'RPC' ? 60000 : 8000 });
        const abort = () => session.cancel();
        signal?.addEventListener('abort', abort, { once: true });
        try {
          while (current()) {
            const batch = await session.next();
            if (!current() || !batch) return;
            assets = merge(assets, batch.assets.filter(asset => accepted.has(asset.id)));
            unresolved.push(...(batch.unresolvedAssetIds || []));
            if (batch.complete) break;
          }
        } finally { signal?.removeEventListener('abort', abort); session.cancel(); }
      };
      try {
        await read(chillwhalesProfileRepository);
        if (unresolved.length && current()) { ids = [...new Set(unresolved)]; await read(luksoRpcProfileRepository); }
      }
      catch (error) { if (!current()) return; await read(luksoRpcProfileRepository); }
      if (current()) set(state => ({ referencedAssets: merge(state.referencedAssets.filter(asset => !accepted.has(asset.id)), assets) }));
    },
    updateMetadata(updates) {
      if (inventory) inventory.assets = mergeAssetMetadata(inventory.assets, updates);
      set(state => ({ assets: mergeAssetMetadata(state.assets, updates),
        referencedAssets: mergeAssetMetadata(state.referencedAssets, updates) }));
      saveCache();
    },
  };
}
