import { resolveWorkbenchDestination } from '../../systemWorkflow/domain/workbenchIndex.js';
import { createProfileDocumentV9AssetDossier } from '../../profileDocument/components/profileDocumentV9FocusViewModel.js';
import { createOwnerSystemWorkflowMetadataViewModel } from '../ownerSystemWorkflow/ownerSystemWorkflowMetadataViewModel.js';
import { projectSystemWorkflowViewport, projectSystemWorkflowPlacement } from '../../systemWorkflow/systemWorkflowViewportProjection.js';

export const canvasDestinations = draft => (draft.workbenchIndex?.destinations || []).map(item => ({
  id: item.id, name: item.name, view: resolveWorkbenchDestination(item, draft),
}));

// Keep source metadata separate from the composition and retain every placement.
// The same asset can appear several times without duplicating its dossier.
export function canvasArtworkSources(model) {
  const sources = new Map();
  const add = (asset, id, frame, embedded) => {
    const key = asset?.stableAssetId || asset?.id || id;
    const existing = sources.get(key);
    if (existing) { existing.frames.push(frame); return; }
    const dossier = embedded ? createProfileDocumentV9AssetDossier(asset)
      : createOwnerSystemWorkflowMetadataViewModel({ id }, asset)?.dossier;
    sources.set(key, { id: key, name: dossier?.title || 'Artwork source unavailable', dossier, frames: [frame] });
  };
  for (const item of model.items) {
    if (item.source.kind === 'image') add(item.source.side?.asset, item.id, item.frame, true);
    if (item.source.kind === 'display') {
      const { source, frame } = item, field = projectSystemWorkflowViewport(source.geometry, frame);
      for (const placement of source.grid?.placements || []) {
        if (placement.kind === 'text') continue;
        const rectangle = projectSystemWorkflowPlacement(placement, field);
        add(placement.asset || source.assets?.get(placement.stableAssetId), placement.stableAssetId || placement.id,
          { ...rectangle, left: frame.left + rectangle.left, top: frame.top + rectangle.top }, Boolean(placement.asset));
      }
    }
  }
  return [...sources.values()];
}
