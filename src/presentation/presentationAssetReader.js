import { loadLibraryAssetCache } from '../library/storage/libraryAssetCache.js';
import { luksoCreationsRepository } from '../creations/data/luksoCreationsRepository.js';

// Read only the explicitly referenced artwork. No Library workspace, inventory,
// editor store or persistence is acquired. Cached records retain their provenance.
export function createPresentationAssetReader(profile, ids, { storage = globalThis.localStorage, repository = luksoCreationsRepository } = {}) {
  const requested = new Set(ids), listeners = new Set();
  const assets = new Map(loadLibraryAssetCache(storage, profile).filter(asset => requested.has(asset.id)).map(asset => [asset.id, asset]));
  let controller = null;
  let snapshot = { assets, status: [...requested].every(id => assets.has(id)) ? 'ready' : 'loading' };
  const publish = (assets, status) => { snapshot = { assets, status }; listeners.forEach(listener => listener()); };
  const refresh = async () => {
    controller?.abort();
    const request = new AbortController(); controller = request;
    const current = () => controller === request && !request.signal.aborted;
    const missing = [...requested].filter(id => !snapshot.assets.has(id));
    if (!missing.length) { publish(snapshot.assets, 'ready'); return; }
    publish(snapshot.assets, 'loading');
    try {
      for await (const batch of repository.loadReferencedCreations(profile, missing, { signal: request.signal })) {
        if (!current()) return;
        const next = new Map(snapshot.assets);
        for (const asset of batch.assets) if (requested.has(asset.id)) next.set(asset.id, asset);
        publish(next, 'loading');
      }
      if (current()) publish(snapshot.assets, [...requested].every(id => snapshot.assets.has(id)) ? 'ready' : 'unavailable');
    } catch { if (current()) publish(snapshot.assets, 'unavailable'); }
  };
  return { getSnapshot: () => snapshot, refresh,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1 && snapshot.status !== 'ready') void refresh();
      return () => { listeners.delete(listener); if (!listeners.size) { controller?.abort(); controller = null; } };
    },
  };
}
