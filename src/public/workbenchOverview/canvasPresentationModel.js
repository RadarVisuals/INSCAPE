import { resolveWorkbenchDestination } from '../../systemWorkflow/domain/workbenchIndex.js';
import { createProfileDocumentV9AssetDossier } from '../../profileDocument/components/profileDocumentV9AssetDossier.js';
export const canvasDestinations = draft => (draft.workbenchIndex?.destinations || []).map(item => ({
  id: item.id, name: item.name, view: resolveWorkbenchDestination(item, draft),
}));

// Keep source metadata separate from the composition and retain every placement.
// The same asset can appear several times without duplicating its dossier.
export function canvasArtworkSources(model) {
  const sources = new Map();
  for (const { id, source, frame } of model.items) {
    if (source.kind !== 'image') continue;
    const asset = source.artwork?.asset;
    const key = asset?.stableAssetId || asset?.id || id;
    const existing = sources.get(key);
    if (existing) {
      existing.frames.push(frame);
      continue;
    }
    const dossier = createProfileDocumentV9AssetDossier(asset);
    sources.set(key, { id: key, name: dossier?.title || 'Artwork source unavailable', dossier, frames: [frame] });
  }
  return [...sources.values()];
}
