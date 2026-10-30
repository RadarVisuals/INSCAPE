import { refreshLibraryTokenMetadata } from './refreshLibraryTokenMetadata.js';

const fields = ['name', 'description', 'imageUrl', 'thumbnailUrl', 'originalImageUrl',
  'imageWidth', 'imageHeight', 'mediaFileType', 'imageGroups', 'attributes', 'metadataStatus', 'rawMetadata'];
export function mergeAssetMetadata(assets, updates) {
  const byId = new Map(updates.map(asset => [asset.id, asset]));
  return assets.map(asset => {
    const update = byId.get(asset.id);
    if (!update) return asset;
    return { ...asset, ...Object.fromEntries(fields.filter(key => key in update).map(key => [key, update[key]])),
      fieldProvenance: { ...asset.fieldProvenance, ...Object.fromEntries(['name', 'description', 'images', 'attributes']
        .filter(key => update.fieldProvenance?.[key]).map(key => [key, update.fieldProvenance[key]])) } };
  });
}

// One demand list across Owned, Created and collection records. Selected IDs go
// first. Only a small active batch and the current visible cards can be fetched.
export function createLibraryMetadataDemand({ onBatch, onError = () => {}, refresh = refreshLibraryTokenMetadata, now = Date.now }) {
  let desired = [], running = false, controller = null, generation = 0;
  const checked = new Map();
  async function pump() {
    if (running) return;
    running = true;
    const run = generation;
    try {
      for (;;) {
        const assets = desired.filter(asset => (checked.get(asset.id) || 0) <= now()).slice(0, 4);
        if (!assets.length || run !== generation) break;
        controller = new AbortController();
        const signal = controller.signal;
        const active = controller;
        let abort;
        const timer = setTimeout(() => active.abort(), 15000);
        try {
          await Promise.race([(async () => {
            for await (const batch of refresh(assets, { signal })) {
              if (signal.aborted || run !== generation) return;
              onBatch(batch.assets);
              if (batch.failures) onError('Some token metadata could not be refreshed. Indexed previews are retained.');
            }
          })(), new Promise((_, reject) => {
            abort = () => reject(signal.reason);
            signal.addEventListener('abort', abort, { once: true });
          })]);
        } catch { if (run === generation) onError('Some token metadata could not be refreshed. Indexed previews are retained.'); }
        finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
        if (run !== generation) break;
        for (const asset of assets) checked.set(asset.id, now() + 60000);
      }
    } finally { running = false; controller = null; if (run !== generation && desired.length) void pump(); }
  }
  return {
    set(assets) {
      desired = [...new Map(assets.filter(asset => asset?.standard === 'LSP8' && asset.tokenId).map(asset => [asset.id, asset])).values()];
      void pump();
    },
    cancel() { desired = []; generation++; checked.clear(); controller?.abort(); },
    retry() { checked.clear(); void pump(); },
  };
}
