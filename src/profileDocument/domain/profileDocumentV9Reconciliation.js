import { restoreCompositionEditorDocument } from '../../composition/compositionEditorDocument.js';
import { restoreWorkbenchIndex } from '../../systemWorkflow/domain/workbenchIndex.js';
import { artworkLayers, artworkRecords, projectArtworkLayers, reconcileArtworkLayers } from '../../systemWorkflow/domain/artworkLayers.js';
import { restorePublishedWorkbenchGroups } from './publishedWorkbenchGroups.js';
import { reconcileRemovedWorkbenchMembers } from '../../systemWorkflow/domain/workbenchGroups.js';
import {
  createBlankWorkbenchDraft,
  assertValidSystemWorkflowDraft,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { restoreImageModules } from '../../imageModule/imageModule.js';
import { restoreShapes } from '../../shapes/shapes.js';
import { restoreKeeperDocks } from '../../keeper/keeper.js';
import { restoreTextModules } from '../../text/domain/article.js';
import { createDefaultWorkbenchPresentation } from './workbenchPresentation.js';

function restoredIdentity(identity) {
  return {
    ...(identity.card ? { card: structuredClone(identity.card) } : {}),
    alias: identity.alias,
    avatar: {
      mode: identity.avatar.mode,
      stableAssetId: identity.avatar.asset?.stableAssetId || null,
      shape: identity.avatar.shape,
      ...(identity.avatar.asset?.media?.url && identity.avatar.asset.media.type === 'image' ? { selectedMedia: {
        url: identity.avatar.asset.media.url, width: identity.avatar.asset.media.width, height: identity.avatar.asset.media.height,
      } } : {}),
    },
    bio: { ...identity.bio },
    tags: structuredClone(identity.tags),
    visibility: { ...identity.visibility },
  };
}

// Public content restores through the same module boundaries while local private work is retained.
export function reconcileSystemWorkflowDraftFromProfileDocumentV9(documentInput, currentDraftInput = null) {
  const document = assertValidProfileDocumentV9(documentInput);
  if (currentDraftInput !== null) {
    const current = assertValidSystemWorkflowDraft(currentDraftInput);
    if (current.profileAddress !== document.profile.address) {
      throw new TypeError('The local draft and published document belong to different profiles');
    }
  }
  const shapes = restoreShapes(document.shapes, currentDraftInput?.shapes);
  const keeperDocks = restoreKeeperDocks(document.keeperDocks, currentDraftInput?.keeperDocks);
  const imageModules = restoreImageModules(document.imageModules, currentDraftInput?.imageModules);
  const texts = restoreTextModules(document.texts, currentDraftInput?.texts);
  let workbench = document.workbench ? { ...createDefaultWorkbenchPresentation(), ...structuredClone(document.workbench) } : null;
  const privateTextWindows = (currentDraftInput?.workbench?.texts || []).filter(w => texts.some(t => t.id === w.id && t.visibility === 'PRIVATE'));
  if (privateTextWindows.length) {
    workbench ||= createDefaultWorkbenchPresentation();
    workbench.texts = [...(workbench.texts || []), ...structuredClone(privateTextWindows)];
  }
  const privateShapeWindows = (currentDraftInput?.workbench?.shapes || []).filter(w => shapes.some(shape => shape.id === w.id && shape.visibility === 'PRIVATE'));
  if (privateShapeWindows.length) {
    workbench ||= createDefaultWorkbenchPresentation();
    workbench.shapes = [...(workbench.shapes || []), ...structuredClone(privateShapeWindows)];
  }
  const privateImageWindows = (currentDraftInput?.workbench?.imageModules || []).filter(w => imageModules.some(image => image.id === w.id && image.visibility === 'PRIVATE'));
  if (workbench) delete workbench.keeperDocks;
  if (privateImageWindows.length) {
    workbench ||= createDefaultWorkbenchPresentation();
    workbench.imageModules = [...(workbench.imageModules || []), ...structuredClone(privateImageWindows)];
  }
  const restored = {
    ...createBlankWorkbenchDraft(document.profile.address),
    identityPresentation: restoredIdentity(document.identityPresentation),
    ...(document.composition ? { composition: restoreCompositionEditorDocument(document.composition) } : {}),
    ...(workbench ? { workbench } : {}),
    ...((document.shapes || currentDraftInput?.shapes) ? { shapes } : {}),
    ...((document.keeperDocks || currentDraftInput?.keeperDocks) ? { keeperDocks } : {}),
    ...((document.imageModules || currentDraftInput?.imageModules) ? { imageModules } : {}),
    ...((document.texts || currentDraftInput?.texts) ? { texts } : {}),
  };
  const workbenchGroups = restorePublishedWorkbenchGroups(document, currentDraftInput, restored);
  if (workbenchGroups) restored.workbenchGroups = workbenchGroups;
  const workbenchIndex = restoreWorkbenchIndex(document.workbenchIndex, currentDraftInput?.workbenchIndex);
  if (workbenchIndex) restored.workbenchIndex = workbenchIndex;
  if (document.artworkLayers || currentDraftInput?.artworkLayers) {
    if (currentDraftInput?.artworkLayers && JSON.stringify(projectArtworkLayers(currentDraftInput, document)) === JSON.stringify(artworkLayers(document))) {
      restored.artworkLayers = reconcileArtworkLayers(currentDraftInput, { ...restored, artworkLayers: currentDraftInput.artworkLayers }).artworkLayers;
    } else {
      const publicIds = new Set(artworkRecords(document).map(item => item.id));
      const available = new Set(artworkRecords(restored).map(item => item.id));
      const privateLayers = artworkLayers(currentDraftInput).flatMap(layer => {
        if (typeof layer === 'string') return !publicIds.has(layer) && available.has(layer) ? [layer] : [];
        const children = layer.children.filter(id => !publicIds.has(id) && available.has(id));
        return children.length ? [{ ...layer, children }] : [];
      });
      restored.artworkLayers = [...artworkLayers(document), ...privateLayers];
    }
  }
  return assertValidSystemWorkflowDraft(reconcileRemovedWorkbenchMembers(currentDraftInput, restored));
}
